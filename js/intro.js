/* 开场动画：视频播放 → 24 秒时校徽缓缓浮现 → 视频结束后进入首页 */
(function () {
  var intro = document.getElementById("intro");
  if (!intro) return;

  var video = document.getElementById("intro-video");
  var badge = intro.querySelector(".intro-badge");
  var skip = document.getElementById("intro-skip");
  var BADGE_AT = 24;          // 视频播到第 24 秒时，校徽开始出现
  var finished = false;
  var guard;

  document.body.classList.add("intro-lock");

  function showBadge() {
    if (badge && !badge.classList.contains("show")) badge.classList.add("show");
  }

  function leave() {
    if (finished) return;
    finished = true;
    clearTimeout(guard);
    showBadge();
    // 校徽停留一下再淡出遮罩
    setTimeout(function () {
      intro.classList.add("done");
      document.body.classList.remove("intro-lock");
      setTimeout(function () {
        if (intro.parentNode) intro.parentNode.removeChild(intro);
      }, 750);
    }, 1200);
  }

  // 兜底：视频异常时不至于一直黑屏
  guard = setTimeout(leave, 35000);

  if (video) {
    video.addEventListener("timeupdate", function () {
      if (video.currentTime >= BADGE_AT) showBadge();
    });
    video.addEventListener("ended", leave);
    video.addEventListener("error", function () {
      setTimeout(leave, 400);
    });
    var p = video.play();
    if (p && p.catch) {
      p.catch(function () {
        setTimeout(leave, 800);
      });
    }
  }

  if (skip) skip.addEventListener("click", leave);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") leave();
  });
})();
