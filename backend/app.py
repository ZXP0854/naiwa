# -*- coding: utf-8 -*-
"""
奶蛙大学 · 学生信息管理系统 —— 后端
------------------------------------------------
技术栈：Python 3 + Flask + MySQL（默认）/ SQLite（自动兜底）
功能：
  * 托管静态站点（index.html / css / js / assets）
  * 学生数据 REST 接口：查询公开，增删改需管理员登录
  * 首次启动自动建库建表并导入 data/seed_students.json 里的 322 条演示数据

启动：  python backend/app.py   →  http://127.0.0.1:8000/
"""

import hashlib
import hmac
import os
import secrets
import sys

from flask import Flask, abort, jsonify, request, session

# 根目录下的 db/ 文件夹会遮住 backend/db.py，这里保证 backend 目录优先命中
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_ROOT_DIR = os.path.dirname(_BACKEND_DIR)
for _p in (_ROOT_DIR, _BACKEND_DIR):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import db

ROOT = db.ROOT
BACKEND_DIR = db.BACKEND_DIR
ADMIN_KEY_PATH = os.path.join(BACKEND_DIR, "admin.key")

HOST = os.environ.get("NAIWA_HOST", "0.0.0.0")
PORT = db.CFG["port"]

BLOCKED_DIRS = ("backend/", "data/", "tools/", "db/", ".git/")
BLOCKED_EXT = (".py", ".pyc", ".db", ".json", ".key", ".md", ".bat", ".sql")

app = Flask(__name__, static_folder=ROOT, static_url_path="")
app.json.ensure_ascii = False
app.secret_key = os.environ.get("NAIWA_SECRET") or secrets.token_hex(24)
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
)


# ---------------------------------------------------------------- 管理员口令
def _hash(password, salt):
    return hashlib.sha256((salt + password).encode("utf-8")).hexdigest()


def _env_admin_password():
    """部署时可用环境变量注入管理密码，优先于本地密码文件。"""
    return os.environ.get("NAIWA_ADMIN_PASSWORD") or ""


def admin_configured():
    return bool(_env_admin_password()) or os.path.exists(ADMIN_KEY_PATH)


def set_admin_password(password):
    salt = secrets.token_hex(8)
    with open(ADMIN_KEY_PATH, "w", encoding="utf-8") as f:
        f.write(salt + ":" + _hash(password, salt))


def check_admin_password(password):
    env_pwd = _env_admin_password()
    if env_pwd:
        return hmac.compare_digest(password, env_pwd)
    if not os.path.exists(ADMIN_KEY_PATH):
        return False
    with open(ADMIN_KEY_PATH, "r", encoding="utf-8") as f:
        raw = f.read().strip()
    salt, target = raw.split(":", 1)
    return hmac.compare_digest(_hash(password, salt), target)


def is_admin():
    return bool(session.get("admin"))


def denied():
    return jsonify({"ok": False, "msg": "需要管理员登录后才能操作"}), 401


# ---------------------------------------------------------------- 请求钩子
@app.before_request
def handle_preflight_and_guard():
    if request.method == "OPTIONS":
        return ("", 204)
    path = request.path.lstrip("/")
    if path.startswith(BLOCKED_DIRS) or path.lower().endswith(BLOCKED_EXT):
        abort(404)


@app.after_request
def add_cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    resp.headers["Access-Control-Allow-Credentials"] = "true"
    return resp


def fail(msg, code=400):
    return jsonify({"ok": False, "msg": msg}), code


# ---------------------------------------------------------------- 页面
@app.route("/")
def home():
    return app.send_static_file("index.html")


# ---------------------------------------------------------------- 会话 / 登录
@app.get("/api/session")
def api_session():
    return jsonify({
        "ok": True,
        "admin": is_admin(),
        "configured": admin_configured(),
        "engine": db.ENGINE,
        "fallback": db.FALLBACK_REASON,
    })


@app.post("/api/admin/setup")
def api_admin_setup():
    """第一次使用：设置管理密码（只接受一次，之后改用登录）"""
    if admin_configured():
        return fail("管理密码已设置，请直接登录", 409)
    body = request.get_json(silent=True) or {}
    pwd = str(body.get("password") or "")
    if len(pwd) < 4:
        return fail("管理密码至少 4 位")
    set_admin_password(pwd)
    session["admin"] = True
    return jsonify({"ok": True, "admin": True})


@app.post("/api/login")
def api_login():
    if not admin_configured():
        return fail("尚未设置管理密码，请先初始化", 428)
    body = request.get_json(silent=True) or {}
    pwd = str(body.get("password") or "")
    if not check_admin_password(pwd):
        return fail("管理密码错误", 401)
    session["admin"] = True
    return jsonify({"ok": True, "admin": True})


@app.post("/api/logout")
def api_logout():
    session.pop("admin", None)
    return jsonify({"ok": True, "admin": False})


# ---------------------------------------------------------------- 只读接口
@app.get("/api/health")
def api_health():
    conn = db.connect()
    try:
        n = db.count(conn)
    finally:
        conn.close()
    return jsonify({
        "ok": True,
        "engine": db.ENGINE,
        "database": db.CFG["mysql"]["database"] if db.ENGINE == "mysql" else db.CFG["sqlite_path"],
        "students": n,
        "fallback": db.FALLBACK_REASON,
    })


@app.get("/api/stats")
def api_stats():
    conn = db.connect()
    try:
        total = db.count(conn)
        groups = db.rows(conn, "SELECT college, COUNT(*) AS n FROM students "
                               "GROUP BY college ORDER BY n DESC")
    finally:
        conn.close()
    return jsonify({"ok": True, "total": total, "colleges": groups})


@app.get("/api/students")
def api_list():
    q = (request.args.get("q") or "").strip().lower()
    college = request.args.get("college") or ""
    major = request.args.get("major") or ""

    conn = db.connect()
    try:
        where, args = [], []
        if college:
            where.append("college = ?")
            args.append(college)
        if major:
            where.append("major = ?")
            args.append(major)
        sql = "SELECT * FROM students"
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY id"
        students = db.rows(conn, sql, tuple(args))
    finally:
        conn.close()

    if q:
        students = [s for s in students
                    if q in (s["id"] or "").lower() or q in (s["name"] or "").lower()]
    return jsonify({"ok": True, "students": students, "total": len(students)})


@app.get("/api/students/<sid>")
def api_get(sid):
    conn = db.connect()
    try:
        row = db.one(conn, "SELECT * FROM students WHERE id = ?", (sid,))
    finally:
        conn.close()
    if not row:
        return fail("学生不存在", 404)
    return jsonify({"ok": True, "student": row})


# ---------------------------------------------------------------- 管理员写接口
@app.post("/api/students")
def api_create():
    if not is_admin():
        return denied()
    body = request.get_json(silent=True) or {}
    if not body.get("name"):
        return fail("姓名不能为空")

    conn = db.connect()
    try:
        year = body.get("year") or 2025
        sid = str(body.get("id") or "").strip() or db.next_id(conn, year)
        if db.one(conn, "SELECT 1 AS x FROM students WHERE id = ?", (sid,)):
            return fail("学号 %s 已存在" % sid, 409)

        stu = {k: body.get(k) for k in db.FIELDS}
        stu["id"] = sid
        stu["year"] = int(year) if str(year).isdigit() else year
        db.insert_many(conn, [stu])
        conn.commit()
    finally:
        conn.close()
    return jsonify({"ok": True, "student": stu}), 201


@app.put("/api/students/<sid>")
def api_update(sid):
    if not is_admin():
        return denied()
    body = request.get_json(silent=True) or {}

    conn = db.connect()
    try:
        row = db.one(conn, "SELECT * FROM students WHERE id = ?", (sid,))
        if not row:
            return fail("学生不存在", 404)

        new_id = str(body.get("id") or sid).strip()
        if new_id != sid and db.one(conn, "SELECT 1 AS x FROM students WHERE id = ?", (new_id,)):
            return fail("学号 %s 已被占用" % new_id, 409)

        data = dict(row)
        for k in db.FIELDS:
            if k in body and body[k] is not None:
                data[k] = body[k]
        data["id"] = new_id
        if str(data.get("year", "")).isdigit():
            data["year"] = int(data["year"])

        db.execute(
            conn,
            "UPDATE students SET id=?, name=?, gender=?, college=?, major=?, "
            "className=?, year=?, phone=?, email=?, hometown=?, note=? WHERE id=?",
            tuple(data[k] for k in db.FIELDS) + (sid,),
        )
        conn.commit()
    finally:
        conn.close()
    return jsonify({"ok": True, "student": data})


@app.delete("/api/students/<sid>")
def api_delete(sid):
    if not is_admin():
        return denied()
    conn = db.connect()
    try:
        n = db.execute(conn, "DELETE FROM students WHERE id = ?", (sid,))
        conn.commit()
    finally:
        conn.close()
    if n == 0:
        return fail("学生不存在", 404)
    return jsonify({"ok": True})


@app.post("/api/reset")
def api_reset():
    if not is_admin():
        return denied()
    seed = db.load_seed()
    conn = db.connect()
    try:
        db.execute(conn, "DELETE FROM students")
        db.insert_many(conn, seed)
        conn.commit()
    finally:
        conn.close()
    return jsonify({"ok": True, "students": seed, "total": len(seed)})


# ---------------------------------------------------------------- 启动
def boot():
    db.detect_engine()
    db.ensure_schema()
    print("=" * 56)
    print(" 奶蛙大学 · 学生信息管理系统")
    print(" 数据库： %s" % ("MySQL @ %s:%s/%s" % (
        db.CFG["mysql"]["host"], db.CFG["mysql"]["port"], db.CFG["mysql"]["database"])
        if db.ENGINE == "mysql" else "SQLite @ " + db.CFG["sqlite_path"]))
    if db.FALLBACK_REASON:
        print(" 提示： %s" % db.FALLBACK_REASON)
    print(" 后台地址： http://127.0.0.1:%d/admin.html" % PORT)
    print("=" * 56)


boot()   # 部署到 WSGI / 云平台时也会执行

if __name__ == "__main__":
    app.run(host=HOST, port=PORT, debug=False, threaded=True)
