(function () {
  var section = document.getElementById("moon3dCanvas");
  if (!section) return;
  var statusEl = section.querySelector(".moon3d-status");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function supportsWebGL() {
    try {
      var c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
    } catch (e) {
      return false;
    }
  }

  if (!supportsWebGL()) {
    if (statusEl) statusEl.textContent = "3D preview needs WebGL, which isn't available in this browser.";
    return;
  }

  // Procedurally drawn crater texture -- no external image/network dependency.
  function generateMoonTexture() {
    var canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    var ctx = canvas.getContext("2d");

    var base = ctx.createLinearGradient(0, 0, 0, canvas.height);
    base.addColorStop(0, "#f2f5f8");
    base.addColorStop(0.5, "#d6dde4");
    base.addColorStop(1, "#a7afb9");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (var i = 0; i < 260; i++) {
      var x = Math.random() * canvas.width;
      var y = Math.random() * canvas.height;
      var r = 3 + Math.random() * Math.random() * 42;
      var shade = 0.5 + Math.random() * 0.3;

      var shadow = ctx.createRadialGradient(x, y, 0, x, y, r);
      shadow.addColorStop(0, "rgba(20,26,34," + (1 - shade) * 0.9 + ")");
      shadow.addColorStop(0.7, "rgba(20,26,34," + (1 - shade) * 0.32 + ")");
      shadow.addColorStop(1, "rgba(20,26,34,0)");
      ctx.fillStyle = shadow;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(255,255,255," + (0.05 + Math.random() * 0.09) + ")";
      ctx.lineWidth = Math.max(1, r * 0.07);
      ctx.beginPath();
      ctx.arc(x - r * 0.18, y - r * 0.18, r * 0.82, 0, Math.PI * 2);
      ctx.stroke();
    }

    return canvas;
  }

  var started = false;
  var startObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting && !started) {
        started = true;
        init();
      }
    });
  }, { rootMargin: "200px" });
  startObserver.observe(section);

  async function init() {
    if (statusEl) statusEl.textContent = "Loading 3D moon…";

    var THREE, OrbitControls;
    try {
      THREE = await import("three");
      OrbitControls = (await import("three/addons/controls/OrbitControls.js")).OrbitControls;
    } catch (e) {
      if (statusEl) statusEl.textContent = "Couldn't load the 3D viewer.";
      return;
    }

    var width = section.clientWidth;
    var height = section.clientHeight;

    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    if (statusEl) statusEl.remove();
    section.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0.35, 4.2);

    scene.add(new THREE.AmbientLight(0x8899aa, 0.55));
    var key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(4, 2, 3);
    scene.add(key);
    var rim = new THREE.DirectionalLight(0x4cc9ff, 0.45);
    rim.position.set(-4, -1.5, -3);
    scene.add(rim);

    var texture = new THREE.CanvasTexture(generateMoonTexture());
    if ("colorSpace" in texture) texture.colorSpace = THREE.SRGBColorSpace;

    var moon = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 64, 64),
      new THREE.MeshStandardMaterial({ map: texture, bumpMap: texture, bumpScale: 0.03, roughness: 0.9, metalness: 0.05 })
    );
    scene.add(moon);

    var controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = !reduceMotion;
    controls.autoRotateSpeed = 0.6;

    var visible = true;
    var pauseObserver = new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
    }, { threshold: 0 });
    pauseObserver.observe(section);

    window.addEventListener("resize", function () {
      var w = section.clientWidth, h = section.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }, { passive: true });

    (function animate() {
      requestAnimationFrame(animate);
      if (!visible) return;
      controls.update();
      renderer.render(scene, camera);
    })();
  }
})();
