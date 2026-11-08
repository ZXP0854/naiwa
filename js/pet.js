/* ============================================================
 * 奶蛙桌宠组件
 * - 右下角固定奶蛙：点击展开搜索面板
 * - 动作：idle / blink / happy / waiting / running / review /
 *         failed / laugh / sleep / thinking / walk_left / walk_right
 * - 闲置时会自己眨眼、发呆、傻笑、来回走；久坐会睡着
 * - 搜索调用 NAIWA_STORE.search，结果点击跳 students.html?id=学号
 * ============================================================ */
(function () {
  "use strict";

  var BASE = "assets/pet/";
  var HEIGHT = 150;

  // 每个动作目录的帧数
  var FRAMES = {
    blink: 3,
    happy: 4,
    waiting: 6,
    running: 6,
    review: 6,
    failed: 8,
    laugh: 5,
    sleep: 6,
    thinking: 6,
    walk_left: 8,
    walk_right: 8
  };

  var PHRASES = [
    "hi. 我是奶蛙。",
    "要不要搜个学号试试？",
    "22 个学院，慢慢逛～",
    "今天也要好好学习。",
    "点我就能找同学。"
  ];

  var pet, stage, img, panel, input, resultBox, bubble, statusEl;
  var animTimer = null;
  var ambientTimer = null;
  var walkTimer = null;
  var hoverAt = 0;
  var curAnim = "idle";
  var frameIdx = 0;
  var panelOpen = false;
  var sleeping = false;
  var walking = false;
  var busy = false;
  var petX = 0;
  var lastInteraction = Date.now();

  function frameSrc(name, i) {
    return BASE + name + "/frame_0" + i + ".png";
  }

  /* ---------------- 动画播放 ---------------- */
  // 播放动作；loop=true 循环，否则播一遍后回 idle
  function play(name, loop) {
    if (curAnim === name && loop) return;
    stopAnim();
    curAnim = name;
    frameIdx = 0;
    busy = true;
    var total = FRAMES[name];
    if (!total) { setIdle(); return; }
    img.src = frameSrc(name, 0);
    animTimer = setInterval(function () {
      frameIdx++;
      if (frameIdx >= total) {
        if (loop) {
          frameIdx = 0;
        } else {
          setIdle();
          return;
        }
      }
      img.src = frameSrc(name, frameIdx);
    }, 125); // ~8fps
  }

  function stopAnim() {
    if (animTimer) { clearInterval(animTimer); animTimer = null; }
  }

  function setIdle() {
    stopAnim();
    curAnim = "idle";
    busy = false;
    img.src = BASE + "idle.png";
  }

  /* ---------------- 气泡 / 面板提示 ---------------- */
  function say(text, ms) {
    // 面板打开时，提示显示在面板内，避免和面板重叠
    if (panelOpen && statusEl) {
      statusEl.textContent = text || "";
      statusEl.style.display = text ? "block" : "none";
      bubble.style.display = "none";
      if (text && ms) {
        setTimeout(function () {
          if (statusEl.textContent === text) statusEl.style.display = "none";
        }, ms);
      }
      return;
    }
    bubble.textContent = text;
    bubble.style.display = text ? "block" : "none";
    if (text && ms) {
      setTimeout(function () {
        if (bubble.textContent === text && !sleeping) bubble.style.display = "none";
      }, ms);
    }
  }

  /* ---------------- 睡眠 ---------------- */
  function startSleep() {
    if (panelOpen) return;
    sleeping = true;
    play("sleep", true);
    bubble.textContent = "Zzz…";
    bubble.style.display = "block";
  }

  function wake() {
    if (!sleeping) return;
    sleeping = false;
    bubble.style.display = "none";
    play("happy", false);
  }

  /* ---------------- 走动 ---------------- */
  function walk() {
    if (walking || panelOpen || sleeping) return;
    // 弹窗打开时不要乱走，避免挡住按钮
    if (document.querySelector(".modal-mask.show")) return;
    walking = true;
    lastInteraction = Date.now();

    var maxLeft = Math.max(40, window.innerWidth - 132 - 40);
    var dir = Math.random() < 0.5 ? "left" : "right";
    var step = 5;
    var ticks = 15;
    var dx = dir === "left" ? -step : step;

    // 快到边界时换方向
    if (dir === "left" && petX - ticks * step < -maxLeft) {
      dir = "right"; dx = step;
    } else if (dir === "right" && petX + ticks * step > 0) {
      dir = "left"; dx = -step;
    }

    play("walk_" + dir, true);
    var n = 0;
    if (walkTimer) clearInterval(walkTimer);
    walkTimer = setInterval(function () {
      petX = Math.max(-maxLeft, Math.min(0, petX + dx));
      stage.style.transform = "translateX(" + petX + "px)";
      n++;
      if (n >= ticks) {
        clearInterval(walkTimer);
        walkTimer = null;
        walking = false;
        setIdle();
      }
    }, 130);
  }

  /* ---------------- 闲置小动作 ---------------- */
  function scheduleAmbient() {
    if (ambientTimer) clearTimeout(ambientTimer);
    ambientTimer = setTimeout(ambient, 4500 + Math.random() * 4000);
  }

  function ambient() {
    if (panelOpen || walking || sleeping || curAnim !== "idle") {
      scheduleAmbient();
      return;
    }
    if (Date.now() - lastInteraction > 90000) {
      startSleep();
      scheduleAmbient();
      return;
    }
    var r = Math.random();
    if (r < 0.26) play("blink", false);
    else if (r < 0.42) play("thinking", false);
    else if (r < 0.56) play("laugh", false);
    else if (r < 0.70) play("waiting", false);
    else if (r < 0.90) walk();
    else play("happy", false);
    scheduleAmbient();
  }

  /* ---------------- 面板 ---------------- */
  function openPanel() {
    lastInteraction = Date.now();
    wake();
    panelOpen = true;
    panel.style.display = "flex";
    statusEl.style.display = "none";
    statusEl.textContent = "";
    bubble.style.display = "none";
    if (curAnim === "idle" || curAnim === "sleep") play("happy", false);
    setTimeout(function () { input.focus(); }, 50);
  }

  function closePanel() {
    panelOpen = false;
    panel.style.display = "none";
    if (!sleeping) say("");
    setIdle();
    lastInteraction = Date.now();
  }

  function renderResults(list, q) {
    if (!q) { resultBox.innerHTML = ""; return; }
    if (!list.length) {
      resultBox.innerHTML = '<div class="pet-empty">没有找到相关学生</div>';
      return;
    }
    var html = "";
    list.slice(0, 5).forEach(function (s) {
      html += '<a class="pet-result" href="students.html?id=' + encodeURIComponent(s.id) + '">' +
        '<span class="pet-rid">' + s.id + '</span>' +
        '<span class="pet-rname">' + s.name + '</span>' +
        '<span class="pet-rmajor">' + s.college + " · " + s.major + "</span>" +
        "</a>";
    });
    if (list.length > 5) {
      html += '<a class="pet-more" href="students.html?q=' + encodeURIComponent(q) + '">查看全部 ' + list.length + ' 条结果 →</a>';
    }
    resultBox.innerHTML = html;
  }

  var searchTimer = null;

  function doSearch() {
    var q = input.value.trim();
    lastInteraction = Date.now();
    if (!q) {
      renderResults([], "");
      setIdle();
      return;
    }
    play("running", true);
    setTimeout(function () {
      window.NAIWA_STORE.ready.then(function () {
        var list = window.NAIWA_STORE.search(q);
        if (list.length) {
          play("review", true);
          say("找到 " + list.length + " 只奶蛙！", 2500);
          setTimeout(function () {
            if (curAnim === "review") setIdle();
          }, 4200);
        } else {
          play("failed", true);
          say("没找到诶……换个关键词试试？", 2500);
          setTimeout(function () {
            if (curAnim === "failed") setIdle();
          }, 3600);
        }
        renderResults(list, q);
      });
    }, 800);
  }

  function onInput() {
    var q = input.value.trim();
    lastInteraction = Date.now();
    if (searchTimer) clearTimeout(searchTimer);
    if (!q) {
      renderResults([], "");
      setIdle();
      return;
    }
    play("waiting", true);
    searchTimer = setTimeout(doSearch, 500);
  }

  /* ---------------- 构建 ---------------- */
  function build() {
    pet = document.createElement("div");
    pet.id = "naiwa-pet";
    pet.innerHTML =
      '<div class="pet-stage">' +
        '<img class="pet-img" src="' + BASE + 'idle.png" alt="奶蛙桌宠" />' +
      "</div>" +
      '<div class="pet-bubble" style="display:none"></div>' +
      '<div class="pet-panel" style="display:none">' +
        '<div class="pet-panel-title">奶蛙帮你找同学</div>' +
        '<input class="pet-input" type="text" placeholder="输入学号或姓名…" />' +
        '<div class="pet-status" style="display:none"></div>' +
        '<div class="pet-results"></div>' +
        '<a class="pet-more" href="students.html">或者，直接打开学生管理 →</a>' +
      "</div>";
    document.body.appendChild(pet);

    stage = pet.querySelector(".pet-stage");
    img = pet.querySelector(".pet-img");
    panel = pet.querySelector(".pet-panel");
    input = pet.querySelector(".pet-input");
    resultBox = pet.querySelector(".pet-results");
    bubble = pet.querySelector(".pet-bubble");
    statusEl = pet.querySelector(".pet-status");

    img.style.height = HEIGHT + "px";

    // 单击：睡眠中先唤醒，否则开关面板（延迟 220ms，避免与双击冲突）
    var clickTimer = null;
    stage.addEventListener("click", function (e) {
      e.stopPropagation();
      lastInteraction = Date.now();
      if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; return; }
      clickTimer = setTimeout(function () {
        clickTimer = null;
        if (sleeping) { wake(); openPanel(); return; }
        if (panelOpen) closePanel(); else openPanel();
      }, 220);
    });

    // 双击：傻笑 + 随机台词
    stage.addEventListener("dblclick", function (e) {
      e.stopPropagation();
      lastInteraction = Date.now();
      wake();
      play("laugh", false);
      say(PHRASES[Math.floor(Math.random() * PHRASES.length)], 2200);
    });

    // 悬停：偶尔打个招呼（节流）
    stage.addEventListener("mouseenter", function () {
      if (panelOpen) return;
      var now = Date.now();
      if (now - hoverAt < 6000) return;
      hoverAt = now;
      if (sleeping) return;
      if (curAnim === "idle") play("blink", false);
    });

    input.addEventListener("input", onInput);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        if (searchTimer) clearTimeout(searchTimer);
        doSearch();
      } else if (e.key === "Escape") {
        closePanel();
      }
    });

    panel.addEventListener("click", function (e) { e.stopPropagation(); });
    document.addEventListener("click", function () {
      if (panelOpen) closePanel();
    });

    // 窗口缩放时把走动范围收回来
    window.addEventListener("resize", function () {
      var maxLeft = Math.max(0, window.innerWidth - 132 - 40);
      petX = Math.max(-maxLeft, Math.min(0, petX));
      stage.style.transform = "translateX(" + petX + "px)";
    });

    scheduleAmbient();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
