/* 开场动画：视频播放完 → 校徽 → 淡出进入首页 */
(function () {
  var intro = document.getElementById("intro");
  if (!intro) return;

  var video = document.getElementById("intro-video");
  var badge = intro.querySelector(".intro-badge");
  var skip = document.getElementById("intro-skip");
  var finished = false;
  var guard;

  document.body.classList.add("intro-lock");

  function reveal() {
    if (finished) return;
    finished = true;
    clearTimeout(guard);
    if (video) video.pause();
    badge.classList.add("show");
    setTimeout(function () {
      intro.classList.add("done");
      document.body.classList.remove("intro-lock");
      setTimeout(function () {
        if (intro.parentNode) intro.parentNode.removeChild(intro);
      }, 750);
    }, 1500);
  }

  // 兜底：视频卡住或过长时不至于一直黑屏
  guard = setTimeout(reveal, 30000);

  if (video) {
    video.addEventListener("ended", reveal);
    video.addEventListener("error", function () {
      setTimeout(reveal, 400);
    });
    var p = video.play();
    if (p && p.catch) {
      p.catch(function () {
        setTimeout(reveal, 800);
      });
    }
  }

  if (skip) skip.addEventListener("click", reveal);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") reveal();
  });
})();
