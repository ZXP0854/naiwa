/* ============================================================
 * 星空背景：所有前台页面的固定星空层 + 开场动画共用生成器
 * 仅用 transform/opacity 动画，避免卡顿
 * ============================================================ */
(function () {
  "use strict";
  var COLORS = ["#fff8d8", "#ffe9a8", "#d8b84a", "#ffffff"];

  function into(container, n, bright) {
    for (var i = 0; i < n; i++) {
      var s = document.createElement("i");
      var size = Math.random() * 1.8 + 0.8;
      if (bright && Math.random() < 0.15) size += 1.4;
      s.style.left = (Math.random() * 100).toFixed(2) + "%";
      s.style.top = (Math.random() * 100).toFixed(2) + "%";
      s.style.width = size.toFixed(2) + "px";
      s.style.height = size.toFixed(2) + "px";
      s.style.background = COLORS[Math.floor(Math.random() * COLORS.length)];
      s.style.setProperty("--d", (1.6 + Math.random() * 2.8).toFixed(2) + "s");
      s.style.setProperty("--dl", (Math.random() * 3).toFixed(2) + "s");
      if (bright && Math.random() < 0.3) {
        s.style.boxShadow = "0 0 " + (size * 3).toFixed(1) + "px rgba(255,240,190,.9)";
      }
      container.appendChild(s);
    }
  }

  // 公共页面背景星空（z-index: -1，位于内容之下）
  function init() {
    if (document.getElementById("sky")) return;
    var d = document.createElement("div");
    d.id = "sky";
    document.body.appendChild(d);
    into(d, 64, false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // 供开场动画复用
  window.NAIWA_SKY = { into: into };
})();
