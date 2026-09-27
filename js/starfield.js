(function () {
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function randomShadows(count, size, colorFn) {
    var parts = [];
    for (var i = 0; i < count; i++) {
      var x = Math.round(Math.random() * window.innerWidth);
      var y = Math.round(Math.random() * window.innerHeight);
      parts.push(x + "px " + y + "px " + colorFn());
    }
    return parts.join(",");
  }

  function build() {
    var field = document.querySelector(".starfield");
    if (!field) {
      field = document.createElement("div");
      field.className = "starfield";
      field.setAttribute("aria-hidden", "true");
      field.innerHTML =
        '<div class="star-layer layer-1"></div>' +
        '<div class="star-layer layer-2"></div>' +
        '<div class="star-layer layer-3"></div>';
      document.body.prepend(field);
    }

    var layers = [
      { el: field.querySelector(".layer-1"), count: 70, size: "1px", color: function () { return "rgba(255,255,255,.9)"; } },
      { el: field.querySelector(".layer-2"), count: 55, size: "2px", color: function () { return "rgba(196,220,255,.7)"; } },
      { el: field.querySelector(".layer-3"), count: 35, size: "2px", color: function () { return "rgba(139,220,255,.55)"; } }
    ];

    layers.forEach(function (layer) {
      if (!layer.el) return;
      layer.el.style.boxShadow = randomShadows(layer.count, layer.size, layer.color);
      layer.el.style.width = layer.size;
      layer.el.style.height = layer.size;
    });
  }

  build();

  if (!reduceMotion) {
    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(build, 400);
    });
  }
})();
