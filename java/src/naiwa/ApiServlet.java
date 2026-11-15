package naiwa;

import java.io.BufferedReader;
import java.io.IOException;
import java.sql.Connection;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;

/**
 * 学生信息管理系统的 REST 接口（Servlet 实现，统一映射 /api/*）。
 *
 * GET    /api/students            学生列表（支持 q / college / major 筛选）
 * POST   /api/students            新增学生（需管理员）
 * PUT    /api/students/{id}       修改学生（需管理员）
 * DELETE /api/students/{id}       删除学生（需管理员）
 * GET    /api/next-id             按年份生成下一个学号（需管理员）
 * POST   /api/reset               恢复演示数据（需管理员）
 * GET    /api/health              健康检查
 * GET    /api/stats               按学院统计人数
 * GET    /api/session             当前会话状态
 * POST   /api/login               管理员登录
 * POST   /api/logout              退出登录
 * POST   /api/admin/setup         首次设置管理员密码
 * POST   /api/password            修改管理员密码
 */
public class ApiServlet extends HttpServlet {

    private static final long serialVersionUID = 1L;

    private static final String[] FIELDS = {
            "id", "name", "gender", "college", "major", "className",
            "year", "phone", "email", "hometown", "note"
    };

    @Override
    protected void service(HttpServletRequest req, HttpServletResponse res) throws IOException {
        res.setCharacterEncoding("UTF-8");
        res.setContentType("application/json;charset=UTF-8");
        String path = req.getPathInfo() == null ? "/" : req.getPathInfo();
        String method = req.getMethod().toUpperCase();
        try {
            Db.init();
            if ("/students".equals(path)) {
                if ("GET".equals(method)) listStudents(req, res);
                else if ("POST".equals(method)) createStudent(req, res);
                else fail(res, 405, "不支持的请求方法");
            } else if (path.startsWith("/students/")) {
                String id = path.substring("/students/".length());
                if ("PUT".equals(method)) updateStudent(req, res, id);
                else if ("DELETE".equals(method)) deleteStudent(req, res, id);
                else fail(res, 405, "不支持的请求方法");
            } else if ("/next-id".equals(path)) {
                nextId(req, res);
            } else if ("/reset".equals(path)) {
                reset(req, res);
            } else if ("/health".equals(path)) {
                health(res);
            } else if ("/stats".equals(path)) {
                stats(res);
            } else if ("/session".equals(path)) {
                sessionInfo(req, res);
            } else if ("/login".equals(path)) {
                login(req, res);
            } else if ("/logout".equals(path)) {
                logout(req, res);
            } else if ("/admin/setup".equals(path)) {
                setup(req, res);
            } else if ("/password".equals(path)) {
                changePassword(req, res);
            } else {
                fail(res, 404, "接口不存在：" + path);
            }
        } catch (Exception e) {
            e.printStackTrace();
            fail(res, 500, "服务器错误：" + e.getClass().getSimpleName()
                    + (e.getMessage() == null ? "" : "，" + e.getMessage()));
        }
    }

    /* ================= 学生查询 ================= */

    private void listStudents(HttpServletRequest req, HttpServletResponse res) throws Exception {
        String q = trim(req.getParameter("q"));
        String college = trim(req.getParameter("college"));
        String major = trim(req.getParameter("major"));

        StringBuilder sql = new StringBuilder("SELECT * FROM students");
        List<Object> args = new ArrayList<Object>();
        List<String> where = new ArrayList<String>();
        if (!college.isEmpty()) {
            where.add("college = ?");
            args.add(college);
        }
        if (!major.isEmpty()) {
            where.add("major = ?");
            args.add(major);
        }
        if (!where.isEmpty()) sql.append(" WHERE ").append(String.join(" AND ", where));
        sql.append(" ORDER BY id");

        List<Map<String, Object>> list = query(sql.toString(), args);
        if (!q.isEmpty()) {
            List<Map<String, Object>> hit = new ArrayList<Map<String, Object>>();
            String key = q.toLowerCase();
            for (Map<String, Object> s : list) {
                String id = Db.str(s.get("id")).toLowerCase();
                String name = Db.str(s.get("name")).toLowerCase();
                if (id.contains(key) || name.contains(key)) hit.add(s);
            }
            list = hit;
        }
        out(res, Json.write(Json.map("ok", true, "students", list, "total", list.size(),
                "engine", Db.ENGINE)));
    }

    /* ================= 新增 / 修改 / 删除 ================= */

    private void createStudent(HttpServletRequest req, HttpServletResponse res) throws Exception {
        if (!requireAdmin(req, res)) return;
        Map<String, Object> body = body(req);
        String id = trim(Db.str(body.get("id")));
        String name = trim(Db.str(body.get("name")));
        if (name.isEmpty()) {
            fail(res, 400, "姓名不能为空");
            return;
        }
        try (Connection c = Db.conn()) {
            if (id.isEmpty()) {
                id = nextIdOf(c, yearOf(body));
            }
            if (Db.one(c, "SELECT id FROM students WHERE id = ?", id) != null) {
                fail(res, 400, "学号 " + id + " 已存在");
                return;
            }
            Db.exec(c, "INSERT INTO students (id, name, gender, college, major, className, year, "
                            + "phone, email, hometown, note) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                    id, name, Db.str(body.get("gender")), Db.str(body.get("college")),
                    Db.str(body.get("major")), Db.str(body.get("className")), yearOf(body),
                    Db.str(body.get("phone")), Db.str(body.get("email")),
                    Db.str(body.get("hometown")), Db.str(body.get("note")));
            Map<String, Object> stu = Db.one(c, "SELECT * FROM students WHERE id = ?", id);
            out(res, Json.write(Json.map("ok", true, "msg", "添加成功", "student", normalize(stu))));
        }
    }

    private void updateStudent(HttpServletRequest req, HttpServletResponse res, String id)
            throws Exception {
        if (!requireAdmin(req, res)) return;
        Map<String, Object> body = body(req);
        try (Connection c = Db.conn()) {
            if (Db.one(c, "SELECT id FROM students WHERE id = ?", id) == null) {
                fail(res, 404, "该学号不存在：" + id);
                return;
            }
            String name = trim(Db.str(body.get("name")));
            if (name.isEmpty()) {
                fail(res, 400, "姓名不能为空");
                return;
            }
            Db.exec(c, "UPDATE students SET name=?, gender=?, college=?, major=?, className=?, "
                            + "year=?, phone=?, email=?, hometown=?, note=? WHERE id=?",
                    name, Db.str(body.get("gender")), Db.str(body.get("college")),
                    Db.str(body.get("major")), Db.str(body.get("className")), yearOf(body),
                    Db.str(body.get("phone")), Db.str(body.get("email")),
                    Db.str(body.get("hometown")), Db.str(body.get("note")), id);
            Map<String, Object> stu = Db.one(c, "SELECT * FROM students WHERE id = ?", id);
            out(res, Json.write(Json.map("ok", true, "msg", "保存成功", "student", normalize(stu))));
        }
    }

    private void deleteStudent(HttpServletRequest req, HttpServletResponse res, String id)
            throws Exception {
        if (!requireAdmin(req, res)) return;
        try (Connection c = Db.conn()) {
            int n = Db.exec(c, "DELETE FROM students WHERE id = ?", id);
            if (n == 0) {
                fail(res, 404, "该学号不存在：" + id);
            } else {
                out(res, Json.write(Json.map("ok", true, "msg", "已删除 " + id)));
            }
        }
    }

    /* ================= 其余接口 ================= */

    private void nextId(HttpServletRequest req, HttpServletResponse res) throws Exception {
        if (!requireAdmin(req, res)) return;
        int year;
        try {
            year = Integer.parseInt(trim(req.getParameter("year")));
        } catch (Exception e) {
            year = java.time.LocalDate.now().getYear();
        }
        try (Connection c = Db.conn()) {
            out(res, Json.write(Json.map("ok", true, "id", nextIdOf(c, year))));
        }
    }

    private void reset(HttpServletRequest req, HttpServletResponse res) throws Exception {
        if (!requireAdmin(req, res)) return;
        try (Connection c = Db.conn()) {
            int n = Db.reseed(c);
            List<Map<String, Object>> list = query("SELECT * FROM students ORDER BY id");
            out(res, Json.write(Json.map("ok", true, "msg", "已恢复 " + n + " 条演示数据",
                    "students", list)));
        }
    }

    private void health(HttpServletResponse res) throws Exception {
        int n = 0;
        try (Connection c = Db.conn()) {
            List<Map<String, Object>> r = Db.rows(c, "SELECT COUNT(*) AS n FROM students");
            n = r.isEmpty() ? 0 : ((Number) r.get(0).get("n")).intValue();
        } catch (Exception ignore) {
            /* 数据库不可用时仍返回结构，便于前端提示 */
        }
        boolean ok = !"none".equals(Db.ENGINE) && n > 0;
        out(res, Json.write(Json.map("ok", ok, "engine", Db.ENGINE,
                "students", n, "note", Db.NOTE)));
    }

    private void stats(HttpServletResponse res) throws Exception {
        List<Map<String, Object>> list;
        try (Connection c = Db.conn()) {
            list = Db.rows(c, "SELECT college, COUNT(*) AS n FROM students "
                    + "GROUP BY college ORDER BY n DESC, college");
        }
        out(res, Json.write(Json.map("ok", true, "stats", list, "engine", Db.ENGINE)));
    }

    /* ================= 会话与鉴权 ================= */

    private void sessionInfo(HttpServletRequest req, HttpServletResponse res) throws Exception {
        boolean configured = true;
        try (Connection c = Db.conn()) {
            configured = Db.one(c, "SELECT v FROM settings WHERE k = ?", "admin_hash") != null;
        } catch (Exception ignore) {
            /* 忽略，按未配置处理 */
        }
        out(res, Json.write(Json.map("ok", true, "admin", isAdmin(req), "configured", configured,
                "engine", Db.ENGINE, "source", "jdbc", "students", Db.countAll())));
    }

    private void login(HttpServletRequest req, HttpServletResponse res) throws Exception {
        String pwd = Db.str(body(req).get("password"));
        try (Connection c = Db.conn()) {
            Map<String, Object> row = Db.one(c, "SELECT v FROM settings WHERE k = ?", "admin_hash");
            if (row != null && Db.hash(pwd).equals(Db.str(row.get("v")))) {
                HttpSession s = req.getSession(true);
                s.setAttribute("admin", Boolean.TRUE);
                out(res, Json.write(Json.map("ok", true, "admin", true, "msg", "登录成功")));
            } else {
                fail(res, 401, "密码错误");
            }
        }
    }

    private void logout(HttpServletRequest req, HttpServletResponse res) throws Exception {
        HttpSession s = req.getSession(false);
        if (s != null) s.invalidate();
        out(res, Json.write(Json.map("ok", true, "admin", false, "msg", "已退出登录")));
    }

    private void setup(HttpServletRequest req, HttpServletResponse res) throws Exception {
        String pwd = Db.str(body(req).get("password"));
        if (pwd.length() < 4) {
            fail(res, 400, "密码至少 4 位");
            return;
        }
        try (Connection c = Db.conn()) {
            if (Db.one(c, "SELECT v FROM settings WHERE k = ?", "admin_hash") != null) {
                fail(res, 400, "管理员密码已设置，请直接登录");
                return;
            }
            Db.exec(c, "INSERT INTO settings (k, v) VALUES (?, ?)", "admin_hash", Db.hash(pwd));
            req.getSession(true).setAttribute("admin", Boolean.TRUE);
            out(res, Json.write(Json.map("ok", true, "admin", true, "configured", true)));
        }
    }

    private void changePassword(HttpServletRequest req, HttpServletResponse res) throws Exception {
        if (!requireAdmin(req, res)) return;
        Map<String, Object> b = body(req);
        String oldPwd = Db.str(b.get("old"));
        String newPwd = Db.str(b.get("new"));
        if (newPwd.length() < 4) {
            fail(res, 400, "新密码至少 4 位");
            return;
        }
        try (Connection c = Db.conn()) {
            Map<String, Object> row = Db.one(c, "SELECT v FROM settings WHERE k = ?", "admin_hash");
            if (row == null || !Db.hash(oldPwd).equals(Db.str(row.get("v")))) {
                fail(res, 400, "原密码不正确");
                return;
            }
            Db.exec(c, "UPDATE settings SET v = ? WHERE k = ?", Db.hash(newPwd), "admin_hash");
            out(res, Json.write(Json.map("ok", true, "msg", "密码已修改")));
        }
    }

    private boolean isAdmin(HttpServletRequest req) {
        HttpSession s = req.getSession(false);
        return s != null && Boolean.TRUE.equals(s.getAttribute("admin"));
    }

    private boolean requireAdmin(HttpServletRequest req, HttpServletResponse res) throws IOException {
        if (isAdmin(req)) return true;
        fail(res, 401, "需要管理员权限，请先登录");
        return false;
    }

    /* ================= 工具方法 ================= */

    private List<Map<String, Object>> query(String sql) throws Exception {
        return query(sql, new ArrayList<Object>());
    }

    private List<Map<String, Object>> query(String sql, List<Object> args) throws Exception {
        try (Connection c = Db.conn()) {
            return Db.rows(c, sql, args.toArray());
        }
    }

    /** 把 year 统一成整型输出，避免前端拿到字符串 */
    private Map<String, Object> normalize(Map<String, Object> row) {
        if (row == null) return null;
        Map<String, Object> m = new LinkedHashMap<String, Object>();
        for (String f : FIELDS) {
            Object v = row.get(f);
            if ("year".equals(f)) m.put("year", (int) Db.num(v));
            else m.put(f, Db.str(v));
        }
        return m;
    }

    private String nextIdOf(Connection c, int year) throws Exception {
        List<Map<String, Object>> list = Db.rows(c,
                "SELECT id FROM students WHERE id LIKE ?", year + "%");
        int max = 0;
        for (Map<String, Object> r : list) {
            String id = Db.str(r.get("id"));
            try {
                int tail = Integer.parseInt(id.substring(4));
                if (tail > max) max = tail;
            } catch (Exception ignore) {
                /* 忽略不规范的历史学号 */
            }
        }
        return String.valueOf(year) + String.format("%06d", max + 1);
    }

    private int yearOf(Map<String, Object> body) {
        int y = (int) Db.num(body.get("year"));
        return y > 0 ? y : java.time.LocalDate.now().getYear();
    }

    private Map<String, Object> body(HttpServletRequest req) throws IOException {
        req.setCharacterEncoding("UTF-8");
        BufferedReader r = req.getReader();
        StringBuilder b = new StringBuilder();
        String line;
        while ((line = r.readLine()) != null) b.append(line);
        return Json.parseObject(b.toString());
    }

    private String trim(String s) {
        return s == null ? "" : s.trim();
    }

    private void out(HttpServletResponse res, String json) throws IOException {
        res.getWriter().write(json);
    }

    private void fail(HttpServletResponse res, int code, String msg) throws IOException {
        res.setStatus(code);
        res.getWriter().write(Json.write(Json.map("ok", false, "msg", msg)));
    }
}
