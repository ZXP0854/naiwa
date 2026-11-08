-- ============================================================
-- 奶蛙大学 · 学生信息管理系统 —— MySQL 表结构
-- 数据库：naiwa（字符集 utf8mb4）
-- 执行方式：mysql -u root -p naiwa < db/schema_mysql.sql
-- 也可以直接运行 tools/init_db.py，脚本会自动建库、建表、导入演示数据
-- ============================================================

CREATE DATABASE IF NOT EXISTS `naiwa`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_general_ci;

USE `naiwa`;

DROP TABLE IF EXISTS `students`;

CREATE TABLE `students` (
  `id`        VARCHAR(20)  NOT NULL COMMENT '学号：年份4位 + 学院2位 + 专业2位 + 序号2位',
  `name`      VARCHAR(60)  NOT NULL COMMENT '姓名',
  `gender`    VARCHAR(10)  DEFAULT '' COMMENT '性别',
  `college`   VARCHAR(60)  DEFAULT '' COMMENT '学院',
  `major`     VARCHAR(80)  DEFAULT '' COMMENT '专业',
  `className` VARCHAR(80)  DEFAULT '' COMMENT '班级',
  `year`      INT          DEFAULT 0  COMMENT '年级',
  `phone`     VARCHAR(30)  DEFAULT '' COMMENT '电话',
  `email`     VARCHAR(120) DEFAULT '' COMMENT '邮箱',
  `hometown`  VARCHAR(80)  DEFAULT '' COMMENT '籍贯',
  `note`      VARCHAR(255) DEFAULT '' COMMENT '备注',
  PRIMARY KEY (`id`),
  KEY `idx_college_major` (`college`, `major`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='学生档案';

-- 演示数据共 515 条，来自 data/seed_students.json。
-- 用 tools/init_db.py 导入最方便（会读取同一份 JSON，避免两处维护）。

-- 常用查询示例：
-- SELECT COUNT(*) FROM students;
-- SELECT college, COUNT(*) AS n FROM students GROUP BY college ORDER BY n DESC;
-- SELECT * FROM students WHERE id LIKE '2023%' OR name LIKE '%张%';
-- SELECT * FROM students WHERE college = '医学院' AND major = '临床医学';
