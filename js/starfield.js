// Injects the animated background stars (css/starfield.css draws the actual dots) behind everything on every page,
// and makes the 3 depth layers drift slightly with the mouse for a parallax effect.
(function () {
  var field = document.querySelector(".starfield");
  if (!field) {
    field = document.createElement("div");
    field.className = "starfield";
    field.setAttribute("aria-hidden", "true");
    field.innerHTML =
      '<div class="star-parallax-layer" data-depth="6"><div id="stars"></div></div>' +
      '<div class="star-parallax-layer" data-depth="12"><div id="stars2"></div></div>' +
      '<div class="star-parallax-layer" data-depth="20"><div id="stars3"></div></div>';
    document.body.prepend(field);
  }

  var canParallax = window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!canParallax) return;

  var layers = Array.prototype.slice.call(field.querySelectorAll(".star-parallax-layer"));
  var tx = 0, ty = 0, cx = 0, cy = 0;

  window.addEventListener("mousemove", function (e) {
    tx = e.clientX / window.innerWidth - 0.5;
    ty = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  function raf() {
    cx += (tx - cx) * 0.06;
    cy += (ty - cy) * 0.06;
    layers.forEach(function (layer) {
      var depth = parseFloat(layer.dataset.depth);
      layer.style.transform = "translate(" + (-cx * depth) + "px," + (-cy * depth) + "px)";
    });
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);
})();
