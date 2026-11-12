/* ============================================================
 * 前台页面主逻辑（只读）：学院合辑 / 单学院页 / 学生查询
 * 添加、编辑、删除等写操作只在 admin.html 后台页面提供
 * ============================================================ */
(function () {
  "use strict";

  var D = window.NAIWA_DATA;
  var S = window.NAIWA_STORE;
  var PER_PAGE = 16;

  var SLOGANS = [
    "兼容并蓄 百脉汇流芳", "蛙行致远 奶润初心", "啊 奶蛙大学 同心向远方",
    "新歌嘹亮 万里启新航", "博学笃行 蛙声满庭芳", "求真求实 共赴好时光"
  ];

  function qs(name) {
    var m = new RegExp("[?&]" + name + "=([^&]*)").exec(location.search);
    return m ? decodeURIComponent(m[1]) : "";
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function sloganOf(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return SLOGANS[h % SLOGANS.length];
  }

  /* ================= 合辑页 ================= */
  function renderIndex() {
    var root = document.getElementById("comp-grid");
    var totalMajors = 0;
    var html = "";
    D.colleges.forEach(function (c) {
      totalMajors += c.majors.length;
      html += '<div class="comp-section">' +
        '<div class="sec-head">' +
          '<a class="cname" href="college.html?c=' + encodeURIComponent(c.name) + '">' + esc(c.name) + '</a>' +
          '<span class="ccount">' + c.majors.length + ' 个</span>' +
        '</div><div class="row">';
      c.majors.forEach(function (m) {
        html += '<a class="mini" href="students.html?c=' + encodeURIComponent(c.name) +
          '&major=' + encodeURIComponent(m.name) + '" title="查看 ' + esc(m.name) + ' 的学生">' +
          '<img src="' + D.imgPath(c.name, m.img) + '" alt="' + esc(m.name) + '" loading="lazy" />' +
          '<div class="mname">' + esc(m.name) + '</div></a>';
      });
      html += '</div></div>';
    });
    root.innerHTML = html;
    document.getElementById("stat-line").textContent =
      D.colleges.length + " 个学院 · " + totalMajors + " 个专业";
  }

  /* ================= 单学院页 ================= */
  function renderCollege() {
    var cname = qs("c") || D.colleges[0].name;
    var c = D.collegeOf(cname);
    if (!c) { location.href = "index.html"; return; }

    var pages = Math.max(1, Math.ceil(c.majors.length / PER_PAGE));
    var p = parseInt(qs("p") || "1", 10);
    if (isNaN(p) || p < 1) p = 1;
    if (p > pages) p = pages;

    document.title = c.name + " · 奶蛙大学";
    document.getElementById("college-name").textContent = c.name;
    document.getElementById("college-sub").textContent =
      "共 " + c.majors.length + " 个专业 · 本页 " +
      Math.min(PER_PAGE, c.majors.length - (p - 1) * PER_PAGE) + " 个";
    document.getElementById("page-no").textContent = "第 " + p + " / " + pages + " 页";
    document.getElementById("slogan").textContent = sloganOf(c.name);
    document.getElementById("foot-page").textContent =
      ("0" + p).slice(-2) + " / " + ("0" + pages).slice(-2);

    var start = (p - 1) * PER_PAGE;
    var slice = c.majors.slice(start, start + PER_PAGE);
    var html = "";
    slice.forEach(function (m) {
      html += '<a class="major-card" href="students.html?c=' + encodeURIComponent(c.name) +
        '&major=' + encodeURIComponent(m.name) + '">' +
        '<img src="' + D.imgPath(c.name, m.img) + '" alt="' + esc(m.name) + '" loading="lazy" />' +
        '<div class="mname">' + esc(m.name) + '</div></a>';
    });
    document.getElementById("major-grid").innerHTML = html;

    var pag = document.getElementById("pager");
    var ph = "";
    if (pages > 1) {
      if (p > 1) ph += '<a class="btn" href="college.html?c=' + encodeURIComponent(c.name) + '&p=' + (p - 1) + '">← 上一页</a> ';
      for (var i = 1; i <= pages; i++) {
        if (i === p) ph += '<span class="btn btn-primary">' + i + '</span> ';
        else ph += '<a class="btn" href="college.html?c=' + encodeURIComponent(c.name) + '&p=' + i + '">' + i + '</a> ';
      }
      if (p < pages) ph += '<a class="btn" href="college.html?c=' + encodeURIComponent(c.name) + '&p=' + (p + 1) + '">下一页 →</a>';
    }
    pag.innerHTML = ph;
  }

  /* ================= 学生查询页（只读） ================= */
  var stuState = { q: "", college: "", major: "", page: 1, pageSize: 15 };

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

  function currentList() {
    var list = stuState.q ? S.search(stuState.q) : S.all();
    if (stuState.college) {
      list = list.filter(function (s) { return s.college === stuState.college; });
    }
    if (stuState.major) {
      list = list.filter(function (s) { return s.major === stuState.major; });
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
      if (idx >= 0) stuState.page = Math.floor(idx / stuState.pageSize) + 1;
    }
    var pages = Math.max(1, Math.ceil(list.length / stuState.pageSize));
    if (stuState.page > pages) stuState.page = pages;
    var start = (stuState.page - 1) * stuState.pageSize;
    var slice = list.slice(start, start + stuState.pageSize);

    var tbody = document.getElementById("stu-tbody");
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
          '<td class="ops"><a href="javascript:void(0)" data-act="detail">详情</a></td>' +
          '</tr>';
      });
      tbody.innerHTML = html;
    }

    document.getElementById("count-tip").textContent = "共 " + list.length + " 名学生";

    var pag = document.getElementById("stu-pager");
    var ph = "";
    if (pages > 1) {
      for (var j = 1; j <= pages; j++) {
        ph += j === stuState.page
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

  function renderFilterTag() {
    var box = document.getElementById("filter-tag");

    // 专业介绍卡：按专业筛选时展示
    var introBox = document.getElementById("major-intro");
    if (introBox) {
      var mi0 = (stuState.college && stuState.major)
        ? D.majorInfo(stuState.college, stuState.major) : null;
      if (mi0 && mi0.intro) {
        introBox.innerHTML =
          '<div class="mi-head"><b>' + esc(stuState.major) + '</b>' +
          '<span>' + esc(stuState.college) + ' · 专业介绍</span></div>' +
          '<p>' + esc(mi0.intro) + '</p>';
        introBox.hidden = false;
      } else {
        introBox.hidden = true;
      }
    }

    if (!stuState.college) { box.innerHTML = ""; return; }
    var mi = stuState.major ? D.majorInfo(stuState.college, stuState.major) : null;
    var imgHtml = mi ? '<img src="' + D.imgPath(stuState.college, mi.img) + '" alt="" />' : "";
    box.innerHTML = imgHtml +
      '<span>' + esc(stuState.college) + (stuState.major ? " · " + esc(stuState.major) : "") + '</span>' +
      '<a href="students.html">× 清除筛选</a>';
  }

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
    document.getElementById("modal-detail").classList.add("show");
  }

  function renderStudents() {
    stuState.college = qs("c");
    stuState.major = qs("major");
    stuState.q = qs("q");
    var highlightId = qs("id");

    var input = document.getElementById("toolbar-q");
    input.value = stuState.q;
    document.getElementById("toolbar-college").innerHTML = collegeOptions(stuState.college);
    document.getElementById("toolbar-major").innerHTML = majorOptions(stuState.college, stuState.major);

    renderFilterTag();
    renderTable(highlightId);
    if (highlightId) showDetail(highlightId);

    input.addEventListener("input", function () {
      stuState.q = input.value;
      stuState.page = 1;
      renderTable();
    });
    document.getElementById("toolbar-college").addEventListener("change", function () {
      stuState.college = this.value;
      stuState.major = "";
      stuState.page = 1;
      document.getElementById("toolbar-major").innerHTML = majorOptions(stuState.college, "");
      renderFilterTag();
      renderTable();
    });
    document.getElementById("toolbar-major").addEventListener("change", function () {
      stuState.major = this.value;
      stuState.page = 1;
      renderFilterTag();
      renderTable();
    });

    document.getElementById("stu-tbody").addEventListener("click", function (e) {
      var a = e.target.closest("a[data-act]");
      if (!a) return;
      var id = a.closest("tr").getAttribute("data-id");
      if (a.getAttribute("data-act") === "detail") showDetail(id);
    });

    document.getElementById("stu-pager").addEventListener("click", function (e) {
      var a = e.target.closest("a[data-page]");
      if (!a) return;
      stuState.page = parseInt(a.getAttribute("data-page"), 10);
      renderTable();
    });

    var mask = document.getElementById("modal-detail");
    mask.addEventListener("click", function (e) {
      if (e.target === mask) mask.classList.remove("show");
    });
    mask.querySelector("[data-close]").addEventListener("click", function () {
      mask.classList.remove("show");
    });
  }

  /* ================= 启动 ================= */
  document.addEventListener("DOMContentLoaded", function () {
    S.ready.then(function () {
      var page = document.body.getAttribute("data-page");
      if (page === "index") renderIndex();
      else if (page === "college") renderCollege();
      else if (page === "students") renderStudents();
    });
  });
})();
