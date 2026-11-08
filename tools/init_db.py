# -*- coding: utf-8 -*-
"""
一键初始化数据库
------------------------------------------------
用法：
    python tools/init_db.py                 使用环境变量 MYSQL_PASSWORD（若有）
    python tools/init_db.py --ask-password  交互式输入 MySQL 密码，不写入任何文件

作用：
    读取 backend/config.json → 连接 MySQL → 建库（naiwa）→ 建表 → 导入 data/seed_students.json
    MySQL 连不上时会提示，并自动改用 SQLite 兜底。
"""

import getpass
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    if "--ask-password" in sys.argv and not os.environ.get("MYSQL_PASSWORD"):
        os.environ["MYSQL_PASSWORD"] = getpass.getpass("MySQL 密码（直接回车表示用空密码）：")

    sys.path.insert(0, os.path.join(ROOT, "backend"))
    import db  # 放在设置环境变量之后导入，保证配置生效

    engine = db.detect_engine()
    print("目标引擎：", engine)
    if engine == "sqlite":
        print("提示：", db.FALLBACK_REASON or "已配置为 SQLite")

    db.ensure_schema()
    conn = db.connect()
    try:
        n = db.count(conn)
        groups = db.rows(conn, "SELECT college, COUNT(*) AS n FROM students "
                               "GROUP BY college ORDER BY n DESC LIMIT 5")
    finally:
        conn.close()

    print("初始化完成，当前学生记录：%d 条" % n)
    for g in groups:
        print("  - %s：%d" % (g["college"], g["n"]))
    if n == 0:
        print("警告：数据为空，请检查 data/seed_students.json 是否存在")


if __name__ == "__main__":
    main()
