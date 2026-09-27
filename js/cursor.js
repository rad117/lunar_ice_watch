(function () {
  var canUse = window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!canUse) return;

  document.documentElement.classList.add("has-custom-cursor");

  var star = document.createElement("div");
  star.id = "cursor-star";
  star.setAttribute("aria-hidden", "true");
  star.innerHTML =
    '<svg class="cursor-star-inner" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l2.6 8.2L23 11l-8.4 2.8L12 22l-2.6-8.2L1 11l8.4-2.8z"/></svg>';
  document.body.appendChild(star);

  var mx = -100, my = -100, sx = -100, sy = -100;
  var lastSparkle = 0;
  var activeSparkles = 0;
  var MAX_SPARKLES = 16;
  var SPARKLE_GAP_MS = 55;

  window.addEventListener("mousemove", function (e) {
    mx = e.clientX;
    my = e.clientY;
    var now = e.timeStamp;
    if (now - lastSparkle > SPARKLE_GAP_MS && activeSparkles < MAX_SPARKLES) {
      lastSparkle = now;
      spawnSparkle(mx, my);
    }
  }, { passive: true });

  function raf() {
    // snappy follow: light easing just enough to smooth jitter, not to lag
    sx += (mx - sx) * 0.45;
    sy += (my - sy) * 0.45;
    star.style.transform = "translate(" + sx + "px," + sy + "px)";
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  function spawnSparkle(x, y) {
    activeSparkles++;
    var s = document.createElement("div");
    s.className = "cursor-sparkle";
    s.setAttribute("aria-hidden", "true");
    s.style.transform = "translate(" + x + "px," + y + "px) scale(1)";
    document.body.appendChild(s);
    // next frame: kick off the CSS transition (compositor-driven, not JS-ticked)
    requestAnimationFrame(function () {
      s.style.opacity = "0";
      s.style.transform = "translate(" + x + "px," + y + "px) scale(0.3)";
    });
    setTimeout(function () {
      s.remove();
      activeSparkles--;
    }, 420);
  }

  document.addEventListener("mouseover", function (e) {
    if (e.target.closest("a, button, .chip, .site-row, input, select, [role='link']")) {
      star.classList.add("cursor-active");
    }
  });
  document.addEventListener("mouseout", function (e) {
    if (e.target.closest("a, button, .chip, .site-row, input, select, [role='link']")) {
      star.classList.remove("cursor-active");
    }
  });

  document.addEventListener("click", function (e) {
    for (var i = 0; i < 4; i++) {
      if (activeSparkles >= MAX_SPARKLES) break;
      spawnSparkle(e.clientX + (Math.random() - 0.5) * 20, e.clientY + (Math.random() - 0.5) * 20);
    }
  });
})();
