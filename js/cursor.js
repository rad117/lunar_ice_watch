(function () {
  var canUse = window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!canUse) return;

  document.documentElement.classList.add("has-custom-cursor");

  var star = document.createElement("div");
  star.id = "cursor-star";
  star.innerHTML =
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l2.6 8.2L23 11l-8.4 2.8L12 22l-2.6-8.2L1 11l8.4-2.8z"/></svg>';
  document.body.appendChild(star);

  var mx = 0, my = 0, sx = 0, sy = 0;
  window.addEventListener("mousemove", function (e) {
    mx = e.clientX;
    my = e.clientY;
    if (Math.random() < 0.25) spawnSparkle(mx, my);
  });

  function raf() {
    sx += (mx - sx) * 0.18;
    sy += (my - sy) * 0.18;
    star.style.transform = "translate(" + sx + "px," + sy + "px)";
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  function spawnSparkle(x, y) {
    var s = document.createElement("div");
    s.className = "cursor-sparkle";
    s.style.transform = "translate(" + x + "px," + y + "px)";
    document.body.appendChild(s);
    var life = 500;
    var start = performance.now();
    function fade(now) {
      var t = (now - start) / life;
      if (t >= 1) {
        s.remove();
        return;
      }
      s.style.opacity = String(1 - t);
      requestAnimationFrame(fade);
    }
    requestAnimationFrame(fade);
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
    for (var i = 0; i < 6; i++) {
      spawnSparkle(e.clientX + (Math.random() - 0.5) * 20, e.clientY + (Math.random() - 0.5) * 20);
    }
  });
})();
