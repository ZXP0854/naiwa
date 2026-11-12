# -*- coding: utf-8 -*-
"""
数据库适配层
------------------------------------------------
默认使用 MySQL（表结构见 db/schema_mysql.sql）。
当 MySQL 连不上且配置允许时，自动降级到 SQLite，保证压缩包在任何电脑上都能直接跑起来。
两种引擎对外暴露同一组函数，上层 app.py 不需要关心具体是哪一个。
"""

import json
import os
import sqlite3

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BACKEND_DIR)
CONFIG_PATH = os.path.join(BACKEND_DIR, "config.json")
LOCAL_CONFIG_PATH = os.path.join(BACKEND_DIR, "config.local.json")
SEED_PATH = os.path.join(ROOT, "data", "seed_students.json")

FIELDS = ["id", "name", "gender", "college", "major",
          "className", "year", "phone", "email", "hometown", "note"]

DEFAULT_CONFIG = {
    "engine": "mysql",
    "fallback_sqlite": True,
    "mysql": {
        "host": "127.0.0.1",
        "port": 3306,
        "user": "root",
        "password": "",
        "database": "naiwa",
    },
    "sqlite_path": "data/naiwa.db",
    "port": 8000,
}

MYSQL_DDL = """
CREATE TABLE IF NOT EXISTS `students` (
    `id`        VARCHAR(20)  NOT NULL,
    `name`      VARCHAR(60)  NOT NULL,
    `gender`    VARCHAR(10)  DEFAULT '',
    `college`   VARCHAR(60)  DEFAULT '',
    `major`     VARCHAR(80)  DEFAULT '',
    `className` VARCHAR(80)  DEFAULT '',
    `year`      INT          DEFAULT 0,
    `phone`     VARCHAR(30)  DEFAULT '',
    `email`     VARCHAR(120) DEFAULT '',
    `hometown`  VARCHAR(80)  DEFAULT '',
    `note`      VARCHAR(255) DEFAULT '',
    PRIMARY KEY (`id`),
    KEY `idx_college_major` (`college`, `major`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
"""

SQLITE_DDL = """
CREATE TABLE IF NOT EXISTS students (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    gender    TEXT,
    college   TEXT,
    major     TEXT,
    className TEXT,
    year      INTEGER,
    phone     TEXT,
    email     TEXT,
    hometown  TEXT,
    note      TEXT
)
"""

# ---------------------------------------------------------------- 配置
def _merge(base, extra):
    for k, v in extra.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            _merge(base[k], v)
        else:
            base[k] = v
    return base


def load_config():
    cfg = json.loads(json.dumps(DEFAULT_CONFIG))
    for path in (CONFIG_PATH, LOCAL_CONFIG_PATH):
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    _merge(cfg, json.load(f))
            except Exception as e:
                print("配置文件读取失败（%s）：%s" % (os.path.basename(path), e))

    # 环境变量可覆盖（部署到云平台时用，不用改文件）
    env = os.environ
    cfg["engine"] = env.get("NAIWA_ENGINE", cfg["engine"])
    cfg["mysql"]["host"] = env.get("MYSQL_HOST", cfg["mysql"]["host"])
    cfg["mysql"]["port"] = int(env.get("MYSQL_PORT", cfg["mysql"]["port"]))
    cfg["mysql"]["user"] = env.get("MYSQL_USER", cfg["mysql"]["user"])
    cfg["mysql"]["password"] = env.get("MYSQL_PASSWORD", cfg["mysql"]["password"])
    cfg["mysql"]["database"] = env.get("MYSQL_DATABASE", cfg["mysql"]["database"])
    cfg["port"] = int(env.get("NAIWA_PORT", cfg["port"]))
    return cfg


CFG = load_config()

ENGINE = "sqlite"
PLACEHOLDER = "?"
FALLBACK_REASON = ""
MYSQL_OK = False


def _mysql_connect(with_db=True):
    import pymysql
    params = {
        "host": CFG["mysql"]["host"],
        "port": CFG["mysql"]["port"],
        "user": CFG["mysql"]["user"],
        "password": CFG["mysql"]["password"],
        "charset": "utf8mb4",
        "connect_timeout": 6,
        "cursorclass": pymysql.cursors.DictCursor,
    }
    if with_db:
        params["database"] = CFG["mysql"]["database"]
    return pymysql.connect(**params)


def connect():
    """返回一个连接；调用方负责 close。"""
    if ENGINE == "mysql":
        return _mysql_connect()
    path = CFG["sqlite_path"]
    if not os.path.isabs(path):
        path = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def norm(sql):
    """统一用 ? 写 SQL，MySQL 模式下换成 %s。"""
    return sql.replace("?", "%s") if ENGINE == "mysql" else sql


# ---------------------------------------------------------------- 基础操作
def rows(conn, sql, args=()):
    cur = conn.cursor()
    try:
        cur.execute(norm(sql), args)
        data = cur.fetchall()
    finally:
        cur.close()
    return [dict(r) for r in data]


def one(conn, sql, args=()):
    cur = conn.cursor()
    try:
        cur.execute(norm(sql), args)
        r = cur.fetchone()
    finally:
        cur.close()
    return dict(r) if r else None


def execute(conn, sql, args=()):
    cur = conn.cursor()
    try:
        cur.execute(norm(sql), args)
        n = cur.rowcount
    finally:
        cur.close()
    return n


def executemany(conn, sql, seq):
    cur = conn.cursor()
    try:
        cur.executemany(norm(sql), seq)
    finally:
        cur.close()


INSERT_SQL = ("INSERT INTO students (" + ", ".join(FIELDS) + ") VALUES ("
              + ", ".join(["?"] * len(FIELDS)) + ")")


def load_seed():
    try:
        with open(SEED_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def insert_many(conn, students):
    seq = [tuple(_clean(s.get(k)) for k in FIELDS) for s in students]
    executemany(conn, INSERT_SQL, seq)


def _clean(v):
    if v is None:
        return None
    if isinstance(v, str):
        return v
    return v


def prune_orphans(conn):
    """清理残留学生：所属 (学院, 专业) 已不在 data/majors.json 中（专业被裁剪）则删除。"""
    try:
        with open(os.path.join(ROOT, "data", "majors.json"), "r", encoding="utf-8") as f:
            tree = json.load(f)
        valid = {(c["name"], m["name"]) for c in tree for m in c["majors"]}
    except Exception as e:
        print("专业列表读取失败，跳过残留学生清理：%s" % e)
        return 0

    all_rows = rows(conn, "SELECT id, college, major FROM students")
    stale = [r["id"] for r in all_rows if (r["college"], r["major"]) not in valid]
    removed = 0
    for i in range(0, len(stale), 200):
        chunk = stale[i:i + 200]
        removed += execute(
            conn,
            "DELETE FROM students WHERE id IN (" + ",".join(["?"] * len(chunk)) + ")",
            tuple(chunk),
        )
    if removed:
        conn.commit()
        print("已清理 %d 条属于已裁剪专业的残留学生" % removed)
    return removed


def count(conn):
    return one(conn, "SELECT COUNT(*) AS n FROM students")["n"]


def next_id(conn, year):
    """学号 = 年份(4) + 6 位流水号（与前端算法一致）"""
    prefix = str(year)
    max_tail = 0
    for r in rows(conn, "SELECT id FROM students WHERE id LIKE ?", (prefix + "%",)):
        tail = r["id"][4:]
        if tail.isdigit():
            max_tail = max(max_tail, int(tail))
    return prefix + str(max_tail + 1).zfill(6)


# ---------------------------------------------------------------- 初始化
def detect_engine():
    """确定本次运行用哪个数据库。"""
    global ENGINE, PLACEHOLDER, FALLBACK_REASON, MYSQL_OK

    if str(CFG["engine"]).lower() == "sqlite":
        ENGINE = "sqlite"
        PLACEHOLDER = "?"
        FALLBACK_REASON = "配置指定使用 SQLite"
        return ENGINE

    try:
        _mysql_connect(with_db=False).close()
        ENGINE = "mysql"
        PLACEHOLDER = "%s"
        MYSQL_OK = True
        FALLBACK_REASON = ""
    except Exception as e:
        if not CFG.get("fallback_sqlite", True):
            raise
        ENGINE = "sqlite"
        PLACEHOLDER = "?"
        MYSQL_OK = False
        FALLBACK_REASON = "MySQL 连接失败，已自动切换到 SQLite：%s" % e
    return ENGINE


def ensure_schema():
    """建库 / 建表 / 空表时灌入种子数据。"""
    if ENGINE == "mysql":
        conn = _mysql_connect(with_db=False)
        try:
            execute(conn, "CREATE DATABASE IF NOT EXISTS `%s` "
                          "DEFAULT CHARACTER SET utf8mb4" % CFG["mysql"]["database"])
            conn.commit()
        finally:
            conn.close()

        conn = connect()
        try:
            execute(conn, MYSQL_DDL)
            conn.commit()
            if count(conn) == 0:
                insert_many(conn, load_seed())
                conn.commit()
            prune_orphans(conn)
        finally:
            conn.close()
    else:
        conn = connect()
        try:
            execute(conn, SQLITE_DDL)
            conn.commit()
            if count(conn) == 0:
                insert_many(conn, load_seed())
                conn.commit()
            prune_orphans(conn)
        finally:
            conn.close()
