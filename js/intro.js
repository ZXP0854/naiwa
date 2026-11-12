/* ============================================================
 * 开场动画（纯 HTML/CSS 星空，不再内嵌视频）
 * - 每个浏览器会话只在第一次打开时播放（sessionStorage）
 * - 点别的页面再回来不会重播；跳过按钮 / Esc 可提前结束
 * ============================================================ */
(function () {
  "use strict";
  var KEY = "naiwa-intro-seen";
  var intro = document.getElementById("intro");
  if (!intro) return;

  // 本会话已看过：直接移除开场层，无任何动画
  try {
    if (sessionStorage.getItem(KEY) === "1") {
      intro.parentNode.removeChild(intro);
      return;
    }
  } catch (e) { /* 隐私模式下忽略 */ }

  document.body.classList.add("intro-lock");

  var badge = intro.querySelector(".intro-badge");
  var finished = false;
  var timers = [];

  // 生成星空（复用 starfield.js 的生成器）
  var starsA = document.getElementById("intro-stars");
  var starsB = document.getElementById("intro-stars-b");
  if (window.NAIWA_SKY) {
    if (starsA) window.NAIWA_SKY.into(starsA, 55, true);
    if (starsB) window.NAIWA_SKY.into(starsB, 30, false);
  }

  function done() {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    try { sessionStorage.setItem(KEY, "1"); } catch (e) {}
    badge.classList.add("show");
    intro.classList.add("done");
    document.body.classList.remove("intro-lock");
    setTimeout(function () {
      if (intro.parentNode) intro.parentNode.removeChild(intro);
    }, 750);
  }

  // 时间轴：星空旋转 ~2.4s 校徽浮现，~6s 淡出进入主页
  timers.push(setTimeout(function () { badge.classList.add("show"); }, 2400));
  timers.push(setTimeout(done, 6000));

  function skip() { done(); }
  var btn = document.getElementById("intro-skip");
  if (btn) btn.addEventListener("click", skip);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") skip();
  });
})();
