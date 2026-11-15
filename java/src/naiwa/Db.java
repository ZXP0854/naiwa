package naiwa;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * JDBC 数据访问层：
 * 1) 启动时自动建库建表、灌入种子数据、清理已裁剪专业的残留学生；
 * 2) 对上层提供 rows / exec 两个统一方法，SQL 一律使用 ? 占位符；
 * 3) 管理员密码以 sha256(盐 + 明文) 摘要存于 settings 表，不保存明文。
 */
public final class Db {

    /** 当前使用的数据库引擎，供 /api/health 展示 */
    public static String ENGINE = "none";
    /** 无法连接数据库时的原因说明 */
    public static String NOTE = "";

    private static final String SALT = "naiwa-jdbc-salt";
    private static final String DEFAULT_PASSWORD = "123456";

    private static String url = "";
    private static String user = "";
    private static String pass = "";
    private static boolean ready = false;

    private Db() {
    }

    /* ---------------- 配置 ---------------- */

    private static String env(String key, String def) {
        String v = System.getenv(key);
        if (v == null || v.trim().isEmpty()) v = System.getProperty(key);
        return (v == null || v.trim().isEmpty()) ? def : v.trim();
    }

    private static String host() {
        return env("NAIWA_DB_HOST", "127.0.0.1");
    }

    private static String port() {
        return env("NAIWA_DB_PORT", "3306");
    }

    private static String dbName() {
        return env("NAIWA_DB_NAME", "naiwa");
    }

    private static String params() {
        return "?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai"
                + "&characterEncoding=UTF-8&rewriteBatchedStatements=true";
    }

    /* ---------------- 初始化 ---------------- */

    public static synchronized void init() {
        if (ready) return;
        ready = true;
        String u = env("NAIWA_DB_USER", "root");
        String p = env("NAIWA_DB_PASSWORD", "");
        try {
            Class.forName("com.mysql.cj.jdbc.Driver");
            // 先连到服务器（不指定库）确保数据库存在
            try (Connection c = DriverManager.getConnection(
                    "jdbc:mysql://" + host() + ":" + port() + "/" + params(), u, p);
                 Statement st = c.createStatement()) {
                st.executeUpdate("CREATE DATABASE IF NOT EXISTS `" + dbName()
                        + "` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci");
            }
            url = "jdbc:mysql://" + host() + ":" + port() + "/" + dbName() + params();
            user = u;
            pass = p;
            ENGINE = "mysql";
            try (Connection c = conn()) {
                ensureSchema(c);
            }
        } catch (Exception e) {
            ENGINE = "none";
            NOTE = "MySQL 连接失败：" + e.getMessage();
            System.out.println("[naiwa] " + NOTE);
        }
    }

    /** 取得连接；调用方负责 close */
    public static Connection conn() throws SQLException {
        if (!ready) init();
        if ("none".equals(ENGINE)) throw new SQLException(NOTE);
        return DriverManager.getConnection(url, user, pass);
    }

    private static void ensureSchema(Connection c) throws SQLException {
        try (Statement st = c.createStatement()) {
            st.executeUpdate("CREATE TABLE IF NOT EXISTS `students` ("
                    + "`id` VARCHAR(20) NOT NULL,"
                    + "`name` VARCHAR(60) NOT NULL,"
                    + "`gender` VARCHAR(10) DEFAULT '',"
                    + "`college` VARCHAR(60) DEFAULT '',"
                    + "`major` VARCHAR(80) DEFAULT '',"
                    + "`className` VARCHAR(80) DEFAULT '',"
                    + "`year` INT DEFAULT 0,"
                    + "`phone` VARCHAR(30) DEFAULT '',"
                    + "`email` VARCHAR(120) DEFAULT '',"
                    + "`hometown` VARCHAR(80) DEFAULT '',"
                    + "`note` VARCHAR(255) DEFAULT '',"
                    + "PRIMARY KEY (`id`)"
                    + ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");
            try {
                st.executeUpdate("CREATE INDEX idx_college_major ON students(college, major)");
            } catch (SQLException ignore) {
                /* 索引已存在时忽略 */
            }
            st.executeUpdate("CREATE TABLE IF NOT EXISTS `settings` ("
                    + "`k` VARCHAR(50) NOT NULL,"
                    + "`v` VARCHAR(255) DEFAULT '',"
                    + "PRIMARY KEY (`k`)"
                    + ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");
        }
        // 默认管理员密码（与线上一致，首次登录后可在后台修改）
        if (rows(c, "SELECT v FROM settings WHERE k = ?", adminHash()).isEmpty()) {
            exec(c, "INSERT INTO settings (k, v) VALUES (?, ?)", "admin_hash", hash(DEFAULT_PASSWORD));
        }
        if (count(c) == 0) {
            int n = reseed(c);
            System.out.println("[naiwa] 已灌入种子学生 " + n + " 条");
        }
        int removed = pruneOrphans(c);
        if (removed > 0) {
            System.out.println("[naiwa] 已清理 " + removed + " 条属于已裁剪专业的残留学生");
        }
    }

    private static Object[] adminHash() {
        return new Object[]{"admin_hash"};
    }

    private static int count(Connection c) throws SQLException {
        List<Map<String, Object>> r = rows(c, "SELECT COUNT(*) AS n FROM students");
        return r.isEmpty() ? 0 : ((Number) r.get(0).get("n")).intValue();
    }

    /** 清空并重新灌入种子数据，返回写入条数 */
    public static int reseed(Connection c) throws SQLException {
        try (Statement st = c.createStatement()) {
            st.executeUpdate("DELETE FROM students");
        }
        List<Object> list = seedRows();
        String sql = "INSERT INTO students (id, name, gender, college, major, className, year, "
                + "phone, email, hometown, note) VALUES (?,?,?,?,?,?,?,?,?,?,?)";
        int n = 0;
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            for (Object o : list) {
                if (!(o instanceof Map)) continue;
                Map<?, ?> m = (Map<?, ?>) o;
                ps.setString(1, str(m.get("id")));
                ps.setString(2, str(m.get("name")));
                ps.setString(3, str(m.get("gender")));
                ps.setString(4, str(m.get("college")));
                ps.setString(5, str(m.get("major")));
                ps.setString(6, str(m.get("className")));
                ps.setInt(7, (int) num(m.get("year")));
                ps.setString(8, str(m.get("phone")));
                ps.setString(9, str(m.get("email")));
                ps.setString(10, str(m.get("hometown")));
                ps.setString(11, str(m.get("note")));
                ps.addBatch();
                n++;
            }
            ps.executeBatch();
        }
        return n;
    }

    /** 删除所属 (学院, 专业) 已不在 majors.json 中的历史残留学生 */
    private static int pruneOrphans(Connection c) throws SQLException {
        String text = resource("/data/majors.json");
        if (text == null) return 0;
        Set<String> valid = new HashSet<String>();
        Object tree = Json.parse(text);
        if (tree instanceof List) {
            for (Object co : (List<?>) tree) {
                if (!(co instanceof Map)) continue;
                Map<?, ?> cm = (Map<?, ?>) co;
                String cname = str(cm.get("name"));
                Object ms = cm.get("majors");
                if (!(ms instanceof List)) continue;
                for (Object mo : (List<?>) ms) {
                    if (mo instanceof Map) {
                        valid.add(cname + "\u0000" + str(((Map<?, ?>) mo).get("name")));
                    }
                }
            }
        }
        if (valid.isEmpty()) return 0;
        List<String> stale = new ArrayList<String>();
        for (Map<String, Object> r : rows(c, "SELECT id, college, major FROM students")) {
            String key = str(r.get("college")) + "\u0000" + str(r.get("major"));
            if (!valid.contains(key)) stale.add(str(r.get("id")));
        }
        int removed = 0;
        for (int i = 0; i < stale.size(); i += 200) {
            List<String> chunk = stale.subList(i, Math.min(i + 200, stale.size()));
            StringBuilder q = new StringBuilder("DELETE FROM students WHERE id IN (");
            for (int j = 0; j < chunk.size(); j++) q.append(j == 0 ? "?" : ",?");
            q.append(")");
            removed += exec(c, q.toString(), chunk.toArray());
        }
        return removed;
    }

    /* ---------------- 通用查询 ---------------- */

    public static List<Map<String, Object>> rows(Connection c, String sql, Object... args) throws SQLException {
        List<Map<String, Object>> list = new ArrayList<Map<String, Object>>();
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            for (int i = 0; i < args.length; i++) ps.setObject(i + 1, args[i]);
            try (ResultSet rs = ps.executeQuery()) {
                ResultSetMetaData md = rs.getMetaData();
                int cols = md.getColumnCount();
                while (rs.next()) {
                    Map<String, Object> row = new LinkedHashMap<String, Object>();
                    for (int i = 1; i <= cols; i++) {
                        Object v = rs.getObject(i);
                        if (v == null) v = "";
                        row.put(md.getColumnLabel(i), v);
                    }
                    list.add(row);
                }
            }
        }
        return list;
    }

    public static Map<String, Object> one(Connection c, String sql, Object... args) throws SQLException {
        List<Map<String, Object>> r = rows(c, sql, args);
        return r.isEmpty() ? null : r.get(0);
    }

    public static int exec(Connection c, String sql, Object... args) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            for (int i = 0; i < args.length; i++) ps.setObject(i + 1, args[i]);
            return ps.executeUpdate();
        }
    }

    public static int countAll() {
        try (Connection c = conn()) {
            return count(c);
        } catch (Exception e) {
            return 0;
        }
    }

    /* ---------------- 管理员密码 ---------------- */

    public static String hash(String pwd) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] bs = md.digest((SALT + pwd).getBytes(StandardCharsets.UTF_8));
            StringBuilder b = new StringBuilder();
            for (byte x : bs) b.append(String.format("%02x", x));
            return b.toString();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /* ---------------- 资源与类型转换 ---------------- */

    private static List<Object> seedRows() {
        String text = resource("/data/seed_students.json");
        if (text == null) return new ArrayList<Object>();
        Object v = Json.parse(text);
        if (v instanceof List) {
            @SuppressWarnings("unchecked")
            List<Object> list = (List<Object>) v;
            return list;
        }
        return new ArrayList<Object>();
    }

    private static String resource(String path) {
        InputStream in = Db.class.getResourceAsStream(path);
        if (in == null) return null;
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            in.close();
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }

    static String str(Object v) {
        return v == null ? "" : String.valueOf(v);
    }

    static long num(Object v) {
        if (v instanceof Number) return ((Number) v).longValue();
        try {
            return Long.parseLong(String.valueOf(v).trim());
        } catch (Exception e) {
            return 0;
        }
    }
}
