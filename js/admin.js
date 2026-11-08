/* ============================================================
 * 后台管理：管理员登录 + 学生增删改查
 * 写操作由服务端校验会话，未登录时接口返回 401
 * ============================================================ */
(function () {
  "use strict";

  var D = window.NAIWA_DATA;
  var S = window.NAIWA_STORE;

  var state = { q: "", college: "", major: "", page: 1, pageSize: 15 };
  var logged = false;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ---------------- 登录区 ---------------- */
  function showLogin(configured) {
    document.getElementById("admin-login").style.display = "block";
    document.getElementById("admin-console").style.display = "none";
    document.getElementById("login-title").textContent = configured ? "管理员登录" : "初次使用：设置管理密码";
    document.getElementById("login-desc").textContent = configured
      ? "请输入管理密码，登录后才能修改学生数据。"
      : "这份作业第一次运行，请先设置一个管理密码（至少 4 位），之后用它登录后台。";
    document.getElementById("admin-enter").textContent = configured ? "登录后台" : "设置密码并进入";
    document.getElementById("admin-pwd").value = "";
    setTimeout(function () { document.getElementById("admin-pwd").focus(); }, 60);
  }

  function msg(text) {
    var el = document.getElementById("admin-msg");
    el.textContent = text || "";
    el.style.display = text ? "block" : "none";
  }

  function enterAdmin() {
    logged = true;
    document.getElementById("admin-login").style.display = "none";
    document.getElementById("admin-console").style.display = "block";
    document.getElementById("admin-sub").textContent = "已登录管理员，可添加、编辑、删除学生档案";
    renderStats();
    renderTable();
  }

  function bindLogin() {
    var input = document.getElementById("admin-pwd");
    var btn = document.getElementById("admin-enter");

    function submit() {
      var pwd = input.value.trim();
      if (!pwd) { msg("请输入管理密码"); return; }
      btn.disabled = true;
      var action = S.isConfigured() ? S.login(pwd) : S.setup(pwd);
      action.then(function (r) {
        btn.disabled = false;
        if (!r.ok) { msg(r.msg || "登录失败"); return; }
        msg("");
        enterAdmin();
      });
    }

    btn.addEventListener("click", submit);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); submit(); }
    });
  }

  /* ---------------- 统计条 ---------------- */
  function renderStats() {
    var dbText = S.source() === "local" ? "浏览器本地" : "MySQL";
    var total = S.all().length;
    var majors = 0;
    D.colleges.forEach(function (c) { majors += c.majors.length; });
    document.getElementById("admin-stats").innerHTML =
      '<div class="admin-stat"><b>' + total + '</b><span>学生档案</span></div>' +
      '<div class="admin-stat"><b>' + D.colleges.length + '</b><span>学院</span></div>' +
      '<div class="admin-stat"><b>' + majors + '</b><span>专业</span></div>' +
      '<div class="admin-stat"><b>' + dbText + '</b><span>数据来源</span></div>';
  }

  /* ---------------- 下拉选项 ---------------- */
  function collegeOptions(sel) {
    var html = '<option value="">全部学院</option>';
    D.colleges.forEach(function (c) {
      html += '<option value="' + esc(c.name) + '"' + (c.name === sel ? " selected" : "") + '>' + esc(c.name) + '</option>';
    });
    return html;
  }

  function majorOptions(collegeName, sel) {
    var html = '<option value="">全部专业</option>';
    var c = D.collegeOf(collegeName);
    if (c) {
      c.majors.forEach(function (m) {
        html += '<option value="' + esc(m.name) + '"' + (m.name === sel ? " selected" : "") + '>' + esc(m.name) + '</option>';
      });
    }
    return html;
  }

  /* ---------------- 表格 ---------------- */
  function currentList() {
    var list = state.q ? S.search(state.q) : S.all();
    if (state.college) {
      list = list.filter(function (s) { return s.college === state.college; });
    }
    if (state.major) {
      list = list.filter(function (s) { return s.major === state.major; });
    }
    return list;
  }

  function renderTable(highlightId) {
    var list = currentList();
    if (highlightId) {
      var idx = -1;
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === highlightId) { idx = i; break; }
      }
      if (idx >= 0) state.page = Math.floor(idx / state.pageSize) + 1;
    }
    var pages = Math.max(1, Math.ceil(list.length / state.pageSize));
    if (state.page > pages) state.page = pages;
    var start = (state.page - 1) * state.pageSize;
    var slice = list.slice(start, start + state.pageSize);

    var tbody = document.getElementById("admin-tbody");
    if (!slice.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="7">暂无学生数据</td></tr>';
    } else {
      var html = "";
      slice.forEach(function (s) {
        html += '<tr data-id="' + esc(s.id) + '"' + (s.id === highlightId ? ' class="highlight"' : "") + '>' +
          '<td>' + esc(s.id) + '</td>' +
          '<td>' + esc(s.name) + '</td>' +
          '<td>' + esc(s.gender) + '</td>' +
          '<td>' + esc(s.college) + '</td>' +
          '<td>' + esc(s.major) + '</td>' +
          '<td>' + esc(s.className) + '</td>' +
          '<td class="ops">' +
            '<a href="javascript:void(0)" data-act="detail">详情</a>' +
            '<a href="javascript:void(0)" data-act="edit">编辑</a>' +
            '<a href="javascript:void(0)" data-act="del" class="btn-danger">删除</a>' +
          '</td></tr>';
      });
      tbody.innerHTML = html;
    }

    document.getElementById("admin-count").textContent = "共 " + list.length + " 名学生";

    var pag = document.getElementById("admin-pager");
    var ph = "";
    if (pages > 1) {
      for (var j = 1; j <= pages; j++) {
        ph += j === state.page
          ? '<span class="btn btn-primary">' + j + '</span> '
          : '<a class="btn" href="javascript:void(0)" data-page="' + j + '">' + j + '</a> ';
      }
    }
    pag.innerHTML = ph;

    if (highlightId) {
      var tr = tbody.querySelector("tr.highlight");
      if (tr) tr.scrollIntoView({ block: "center" });
    }
  }

  /* ---------------- 弹窗 ---------------- */
  function openModal(id) { document.getElementById(id).classList.add("show"); }
  function closeModal(id) { document.getElementById(id).classList.remove("show"); }

  function showDetail(id) {
    var s = S.find(id);
    if (!s) return;
    var mi = D.majorInfo(s.college, s.major);
    document.getElementById("detail-title-img").src = mi ? D.imgPath(s.college, mi.img) : "";
    var items = [
      ["学号", s.id], ["姓名", s.name], ["性别", s.gender], ["年级", s.year + " 级"],
      ["学院", s.college], ["专业", s.major], ["班级", s.className],
      ["电话", s.phone || "—"], ["邮箱", s.email || "—"], ["籍贯", s.hometown || "—"]
    ];
    var html = "";
    items.forEach(function (kv) {
      html += '<div class="item"><div class="k">' + kv[0] + '</div><div>' + esc(kv[1]) + '</div></div>';
    });
    if (s.note) {
      html += '<div class="item full"><div class="k">备注</div><div>' + esc(s.note) + '</div></div>';
    }
    document.getElementById("detail-body").innerHTML = html;
    openModal("modal-detail");
  }

  function openForm(id) {
    var form = document.getElementById("stu-form");
    form.reset();
    var cSel = document.getElementById("f-college");
    var mSel = document.getElementById("f-major");

    function syncMajors() {
      mSel.innerHTML = majorOptions(cSel.value, "");
    }
    cSel.onchange = syncMajors;

    if (id) {
      var s = S.find(id);
      if (!s) return;
      document.getElementById("form-title").textContent = "编辑学生";
      document.getElementById("f-orig-id").value = s.id;
      document.getElementById("f-id").value = s.id;
      document.getElementById("f-name").value = s.name;
      document.getElementById("f-gender").value = s.gender;
      document.getElementById("f-year").value = s.year;
      cSel.innerHTML = collegeOptions(s.college);
      mSel.innerHTML = majorOptions(s.college, s.major);
      document.getElementById("f-class").value = s.className || "";
      document.getElementById("f-phone").value = s.phone || "";
      document.getElementById("f-email").value = s.email || "";
      document.getElementById("f-hometown").value = s.hometown || "";
      document.getElementById("f-note").value = s.note || "";
    } else {
      document.getElementById("form-title").textContent = "添加学生";
      document.getElementById("f-orig-id").value = "";
      cSel.innerHTML = collegeOptions("");
      mSel.innerHTML = majorOptions("", "");
      document.getElementById("f-id").value = S.nextId(new Date().getFullYear());
    }
    openModal("modal-form");
  }

  function submitForm(e) {
    e.preventDefault();
    var origId = document.getElementById("f-orig-id").value;
    var stu = {
      id: document.getElementById("f-id").value.trim(),
      name: document.getElementById("f-name").value.trim(),
      gender: document.getElementById("f-gender").value,
      year: parseInt(document.getElementById("f-year").value, 10),
      college: document.getElementById("f-college").value,
      major: document.getElementById("f-major").value,
      className: document.getElementById("f-class").value.trim(),
      phone: document.getElementById("f-phone").value.trim(),
      email: document.getElementById("f-email").value.trim(),
      hometown: document.getElementById("f-hometown").value.trim(),
      note: document.getElementById("f-note").value.trim()
    };
    if (!stu.id || !stu.name) { alert("学号和姓名不能为空"); return; }
    if (!stu.college || !stu.major) { alert("请选择学院和专业"); return; }

    var p = origId ? S.update(origId, stu) : S.add(stu);
    p.then(function (r) {
      if (!r.ok) { alert(r.msg); return; }
      closeModal("modal-form");
      renderStats();
      renderTable(r.student ? r.student.id : undefined);
    });
  }

  /* ---------------- 事件绑定 ---------------- */
  function bindConsole() {
    var input = document.getElementById("admin-q");
    document.getElementById("admin-college").innerHTML = collegeOptions("");
    document.getElementById("admin-major").innerHTML = majorOptions("", "");

    input.addEventListener("input", function () {
      state.q = input.value;
      state.page = 1;
      renderTable();
    });

    document.getElementById("admin-college").addEventListener("change", function () {
      state.college = this.value;
      state.major = "";
      state.page = 1;
      document.getElementById("admin-major").innerHTML = majorOptions(state.college, "");
      renderTable();
    });

    document.getElementById("admin-major").addEventListener("change", function () {
      state.major = this.value;
      state.page = 1;
      renderTable();
    });

    document.getElementById("btn-add").addEventListener("click", function () { openForm(null); });

    document.getElementById("btn-reset").addEventListener("click", function () {
      if (!confirm("确定要恢复初始演示数据吗？所有修改将丢失。")) return;
      S.reset().then(function (r) {
        if (r && !r.ok) { alert(r.msg); return; }
        renderStats();
        renderTable();
      });
    });

    document.getElementById("btn-logout").addEventListener("click", function () {
      S.logout().then(function () {
        logged = false;
        document.getElementById("admin-sub").textContent = "学生的添加、编辑、删除只在这里进行，前台仅提供查询";
        showLogin(S.isConfigured());
      });
    });

    document.getElementById("admin-tbody").addEventListener("click", function (e) {
      var a = e.target.closest("a[data-act]");
      if (!a) return;
      var id = a.closest("tr").getAttribute("data-id");
      var act = a.getAttribute("data-act");
      if (act === "detail") showDetail(id);
      else if (act === "edit") openForm(id);
      else if (act === "del") {
        var s = S.find(id);
        if (s && confirm("确定删除学生「" + s.name + "（" + s.id + "）」吗？")) {
          S.remove(id).then(function (r) {
            if (r && !r.ok) { alert(r.msg); return; }
            renderStats();
            renderTable();
          });
        }
      }
    });

    document.getElementById("admin-pager").addEventListener("click", function (e) {
      var a = e.target.closest("a[data-page]");
      if (!a) return;
      state.page = parseInt(a.getAttribute("data-page"), 10);
      renderTable();
    });

    document.getElementById("stu-form").addEventListener("submit", submitForm);

    document.querySelectorAll(".modal-mask").forEach(function (mask) {
      mask.addEventListener("click", function (e) {
        if (e.target === mask) mask.classList.remove("show");
      });
    });
    document.querySelectorAll("[data-close]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        btn.closest(".modal-mask").classList.remove("show");
      });
    });
  }

  /* ---------------- 启动 ---------------- */
  document.addEventListener("DOMContentLoaded", function () {
    bindLogin();
    S.ready
      .then(function () { return S.session(); })
      .then(function (info) {
        var dbText = info && info.engine === "mysql" ? "MySQL" :
                     info && info.engine === "sqlite" ? "SQLite（降级）" :
                     S.source() === "local" ? "浏览器本地" : "—";
        document.getElementById("db-line").textContent = "数据源：" + dbText;
        if (S.source() === "local") {
          document.getElementById("login-title").textContent = "未连接到后端服务";
          document.getElementById("login-desc").textContent =
            "管理员功能需要后端服务，请双击「启动网站.bat」，或运行 python backend/app.py 后再打开本页。";
          document.getElementById("admin-pwd").style.display = "none";
          document.getElementById("admin-enter").style.display = "none";
          bindConsole();
          return;
        }
        if (info && info.configured === false) {
          showLogin(false);
        } else if (info && info.admin) {
          enterAdmin();
        } else {
          showLogin(true);
        }
        bindConsole();
      });
  });
})();
