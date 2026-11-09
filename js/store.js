/* ============================================================
 * 学生数据仓库
 * - 数据来源优先：本地 Flask + MySQL 后端（/api）
 * - 后端不可用时自动回退到 localStorage，保证纯静态也能打开
 * - 写操作（增/删/改/重置）需要管理员登录，接口由服务端校验
 * ============================================================ */
(function () {
  "use strict";

  var KEY = "naiwa_students_v1";
  // 线上后端：直接用浏览器双击打开 html（file://）时，也连到已部署的云端服务
  var ONLINE = "https://zxp0854.pythonanywhere.com";
  var IS_FILE = location.protocol === "file:";
  var API = (IS_FILE ? ONLINE : "") + "/api";

  var mode = "api";      // api | local
  var cache = [];
  var admin = false;
  var configured = true; // 后端是否已设置过管理密码

  /* ---------------- 本地存储（回退方案） ---------------- */
  function loadLocal() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var list = JSON.parse(raw);
        if (list && list.length) return list;
      }
    } catch (e) { /* 数据损坏则重建 */ }
    var seed = window.NAIWA_DATA.genSeedStudents();
    try { localStorage.setItem(KEY, JSON.stringify(seed)); } catch (e) { /* 忽略 */ }
    return seed;
  }

  function saveLocal() {
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) { /* 忽略 */ }
  }

  function replaceCache(student, oldId) {
    for (var i = 0; i < cache.length; i++) {
      if (cache[i].id === (oldId || student.id)) { cache[i] = student; return; }
    }
    cache.push(student);
  }

  function dropCache(id) {
    cache = cache.filter(function (s) { return s.id !== id; });
  }

  /* ---------------- 请求封装 ---------------- */
  function request(path, opts) {
    opts = opts || {};
    opts.credentials = "same-origin";   // 带上管理员会话 Cookie
    return fetch(API + path, opts).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok && !data.msg) data.msg = "请求失败（HTTP " + res.status + "）";
        return data;
      });
    });
  }

  function sendJSON(path, method, body) {
    return request(path, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
  }

  function netFail() {
    return { ok: false, msg: "连接后端失败，请确认网站服务已启动" };
  }

  /* ---------------- 初始化：拉取数据 ---------------- */
  var ready = request("/students").then(function (data) {
    if (!data.ok || !Array.isArray(data.students)) throw new Error("bad payload");
    cache = data.students;
    mode = "api";
  }).catch(function () {
    mode = "local";
    cache = loadLocal();
  });

  /* ---------------- 同步读取（基于内存缓存） ---------------- */
  function all() {
    return cache.slice();
  }

  function find(id) {
    for (var i = 0; i < cache.length; i++) {
      if (cache[i].id === id) return cache[i];
    }
    return null;
  }

  // 按学号或姓名模糊搜索（大小写不敏感）
  function search(q) {
    q = String(q || "").trim().toLowerCase();
    if (!q) return all();
    return cache.filter(function (s) {
      return s.id.toLowerCase().indexOf(q) >= 0 ||
             s.name.toLowerCase().indexOf(q) >= 0;
    });
  }

  function byMajor(college, major) {
    return cache.filter(function (s) {
      return s.college === college && s.major === major;
    });
  }

  function nextId(year) {
    var max = 0;
    cache.forEach(function (s) {
      if (s.id.slice(0, 4) === String(year)) {
        var tail = parseInt(s.id.slice(4), 10);
        if (tail > max) max = tail;
      }
    });
    return String(year) + String(max + 1).padStart(6, "0");
  }

  /* ---------------- 管理员会话 ---------------- */
  function session() {
    return request("/session").then(function (data) {
      admin = !!data.admin;
      configured = data.configured !== false;
      return data;
    }, function () {
      mode = "local";
      admin = false;
      return { ok: false, admin: false, configured: false, engine: "local", msg: "未连接到后端服务" };
    });
  }

  function login(password) {
    return sendJSON("/login", "POST", { password: password }).then(function (data) {
      admin = !!data.admin;
      return data;
    }, netFail);
  }

  function setup(password) {
    return sendJSON("/admin/setup", "POST", { password: password }).then(function (data) {
      admin = !!data.admin;
      configured = true;
      return data;
    }, netFail);
  }

  function logout() {
    admin = false;
    return sendJSON("/logout", "POST", {}).then(function (data) {
      return data;
    }, function () { return { ok: true }; });
  }

  /* ---------------- 本地模式的写操作 ---------------- */
  function localAdd(stu) {
    if (!stu.id) stu.id = nextId(stu.year || new Date().getFullYear());
    if (find(stu.id)) return { ok: false, msg: "学号 " + stu.id + " 已存在" };
    cache.push(stu);
    saveLocal();
    return { ok: true, student: stu };
  }

  function localUpdate(id, patch) {
    var s = find(id);
    if (!s) return { ok: false, msg: "学生不存在" };
    if (patch.id && patch.id !== id && find(patch.id)) {
      return { ok: false, msg: "学号 " + patch.id + " 已被占用" };
    }
    Object.keys(patch).forEach(function (k) { s[k] = patch[k]; });
    saveLocal();
    return { ok: true, student: s };
  }

  function localRemove(id) {
    if (!find(id)) return { ok: false, msg: "学生不存在" };
    dropCache(id);
    saveLocal();
    return { ok: true };
  }

  /* ---------------- 对外写操作（统一返回 Promise） ---------------- */
  function add(stu) {
    if (mode === "local") return Promise.resolve(localAdd(stu));
    if (!admin) return Promise.resolve({ ok: false, msg: "请先在后台登录管理员账号" });
    return ready.then(function () {
      return sendJSON("/students", "POST", stu);
    }).then(function (data) {
      if (data.ok && data.student) cache.push(data.student);
      return data;
    }, netFail);
  }

  function update(id, patch) {
    if (mode === "local") return Promise.resolve(localUpdate(id, patch));
    if (!admin) return Promise.resolve({ ok: false, msg: "请先在后台登录管理员账号" });
    return ready.then(function () {
      return sendJSON("/students/" + encodeURIComponent(id), "PUT", patch);
    }).then(function (data) {
      if (data.ok && data.student) replaceCache(data.student, id);
      return data;
    }, netFail);
  }

  function remove(id) {
    if (mode === "local") return Promise.resolve(localRemove(id));
    if (!admin) return Promise.resolve({ ok: false, msg: "请先在后台登录管理员账号" });
    return ready.then(function () {
      return request("/students/" + encodeURIComponent(id), { method: "DELETE" });
    }).then(function (data) {
      if (data.ok) dropCache(id);
      return data;
    }, netFail);
  }

  function reset() {
    if (mode === "local") {
      cache = window.NAIWA_DATA.genSeedStudents();
      saveLocal();
      return Promise.resolve({ ok: true });
    }
    if (!admin) return Promise.resolve({ ok: false, msg: "请先在后台登录管理员账号" });
    return ready.then(function () {
      return sendJSON("/reset", "POST", {});
    }).then(function (data) {
      if (data.ok && Array.isArray(data.students)) cache = data.students;
      return data;
    }, netFail);
  }

  window.NAIWA_STORE = {
    ready: ready,
    all: all,
    find: find,
    search: search,
    byMajor: byMajor,
    add: add,
    update: update,
    remove: remove,
    nextId: nextId,
    reset: reset,
    session: session,
    login: login,
    setup: setup,
    logout: logout,
    isAdmin: function () { return admin; },
    isConfigured: function () { return configured; },
    source: function () { return mode; },
    isFile: IS_FILE,
    onlineAdminUrl: ONLINE + "/admin.html"
  };
})();
