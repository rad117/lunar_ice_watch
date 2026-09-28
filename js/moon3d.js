// Powers the interactive 3D moon in the homepage hero (index.html, <div id="moon3dCanvas">).
// Built with the three.js library: renders a textured sphere the user can drag to rotate,
// and clicking it plays a one-time animation that reveals a particle ring + asteroid belt around it.
// If the browser has no WebGL or three.js fails to load, the plain CSS ".moon3d-fallback" circle
// (already in index.html) is left showing instead — see supportsWebGL() below.
(function () {
  var host = document.getElementById("moon3dCanvas");
  if (!host) return;
  var fallback = host.querySelector(".moon3d-fallback");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function supportsWebGL() {
    try {
      var c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
    } catch (e) {
      return false;
    }
  }

  // No WebGL: leave the static CSS moon (.moon3d-fallback) showing.
  if (!supportsWebGL()) return;

  init();

  async function init() {
    var THREE, OrbitControls;
    try {
      THREE = await import("three");
      OrbitControls = (await import("three/addons/controls/OrbitControls.js")).OrbitControls;
    } catch (e) {
      return; // fallback CSS moon stays showing
    }

    // ---- Basic three.js setup: renderer + scene + camera + lights, sized to fill the hero's moon area ----
    var width = host.clientWidth;
    var height = host.clientHeight;
    if (!width || !height) return;

    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    host.appendChild(renderer.domElement);
    if (fallback) fallback.style.display = "none";

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 4, 10);

    scene.add(new THREE.AmbientLight(0x334455, 0.35));
    var key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(8, 5, 5);
    scene.add(key);
    var rim = new THREE.DirectionalLight(0x4a90e2, 0.35);
    rim.position.set(-5, -3, -5);
    scene.add(rim);

    var group = new THREE.Group();
    group.rotation.x = Math.PI / 8;
    scene.add(group);

    // ---- realistic moon (real NASA-sourced texture, three.js's own bundled example asset) ----
    var RADIUS = 2.0;
    var loader = new THREE.TextureLoader();
    var moonTex = loader.load("js/vendor/three/moon_1024.jpg", undefined, undefined, function () {
      // texture failed to load: fall back to the static CSS moon instead of
      // showing an untextured sphere.
      renderer.domElement.remove();
      if (fallback) fallback.style.display = "";
    });
    if ("colorSpace" in moonTex) moonTex.colorSpace = THREE.SRGBColorSpace;

    var moon = new THREE.Mesh(
      new THREE.SphereGeometry(RADIUS, 64, 64),
      new THREE.MeshStandardMaterial({ map: moonTex, bumpMap: moonTex, bumpScale: 0.02, roughness: 0.8, metalness: 0.1 })
    );
    group.add(moon);

    // ---- click-to-reveal particle ring ----
    var PARTICLE_COUNT = 60000;
    var ringPositions = new Float32Array(PARTICLE_COUNT * 3);
    var ringColors = new Float32Array(PARTICLE_COUNT * 3);
    var ringRandoms = new Float32Array(PARTICLE_COUNT);

    (function buildRingAttributes() {
      for (var i = 0; i < PARTICLE_COUNT; i++) {
        var angle = Math.random() * Math.PI * 2;
        var rDist = Math.pow(Math.random(), 1.5);
        var radius = 2.2 + rDist * 2.2;
        var thickness = 0.4 - rDist * 0.2;
        var ySpread = Math.random() + Math.random() + Math.random() - 1.5;
        var y = ySpread * thickness;

        ringPositions[i * 3] = Math.cos(angle) * radius;
        ringPositions[i * 3 + 1] = y;
        ringPositions[i * 3 + 2] = Math.sin(angle) * radius;

        var intensity = 1.0 - rDist;
        var paletteType = Math.random();
        var baseR, baseG, baseB;
        if (paletteType < 0.8) { baseR = 0.25; baseG = 0.3; baseB = 0.35; }
        else if (paletteType < 0.92) { baseR = 0.0; baseG = 0.6; baseB = 0.8; }
        else { baseR = 0.6; baseG = 0.2; baseB = 0.8; }

        baseR = Math.min(1, Math.max(0, baseR + (Math.random() - 0.5) * 0.1));
        baseG = Math.min(1, Math.max(0, baseG + (Math.random() - 0.5) * 0.1));
        baseB = Math.min(1, Math.max(0, baseB + (Math.random() - 0.5) * 0.1));

        var sparkle = Math.random() > 0.95 ? 2.5 : 1.0;
        ringColors[i * 3] = baseR * intensity * sparkle;
        ringColors[i * 3 + 1] = baseG * intensity * sparkle;
        ringColors[i * 3 + 2] = baseB * intensity * sparkle;
        ringRandoms[i] = Math.random();
      }
    })();

    var ringGeometry = new THREE.BufferGeometry();
    ringGeometry.setAttribute("position", new THREE.BufferAttribute(ringPositions, 3));
    ringGeometry.setAttribute("color", new THREE.BufferAttribute(ringColors, 3));
    ringGeometry.setAttribute("aRandom", new THREE.BufferAttribute(ringRandoms, 1));

    var ringUniforms = {
      uProgress: { value: 0 },
      uAsteroids: { value: new Float32Array(75 * 4) },
      time: { value: 0 }
    };

    // Custom shader tweaks so particles spiral in from a swirl and dodge nearby asteroids (see uAsteroids below)
    var ringMaterial = new THREE.PointsMaterial({
      size: 0.008,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    ringMaterial.onBeforeCompile = function (shader) {
      shader.uniforms.uProgress = ringUniforms.uProgress;
      shader.uniforms.uAsteroids = ringUniforms.uAsteroids;
      shader.uniforms.time = ringUniforms.time;

      shader.vertexShader =
        "uniform float uProgress;\nuniform vec4 uAsteroids[75];\nuniform float time;\nattribute float aRandom;\nvarying float vProgress;\n" +
        shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "vec3 transformed = vec3(position);\n" +
        "float angle = atan(transformed.x, transformed.z);\n" +
        "float normalizedAngle = abs(angle) / 3.14159265359;\n" +
        "float spawnThreshold = 1.0 - normalizedAngle;\n" +
        "float progressValue = (uProgress * 1.4) - spawnThreshold;\n" +
        "float particleProgress = smoothstep(0.0, 0.4, progressValue);\n" +
        "vProgress = particleProgress;\n" +
        "transformed.y += sin(angle * 10.0 + time) * 0.05 * aRandom;\n" +
        "if (uProgress > 0.5) {\n" +
        "  for (int i = 0; i < 75; i++) {\n" +
        "    vec4 astData = uAsteroids[i];\n" +
        "    vec3 delta = transformed - astData.xyz;\n" +
        "    float dist = length(delta);\n" +
        "    float rad = astData.w * 2.0 + 0.15;\n" +
        "    if (dist < rad) {\n" +
        "      float force = pow((rad - dist) / rad, 2.0);\n" +
        "      transformed += normalize(delta) * force * 0.4;\n" +
        "      transformed.y += force * 0.20 * (aRandom - 0.5);\n" +
        "    }\n" +
        "  }\n" +
        "}\n" +
        "float swirl = (1.0 - particleProgress) * 4.0;\n" +
        "float s = sin(swirl);\n" +
        "float c = cos(swirl);\n" +
        "transformed.xz = mat2(c, -s, s, c) * transformed.xz;\n" +
        "transformed.y += (1.0 - particleProgress) * (transformed.y >= 0.0 ? 1.0 : -1.0);\n" +
        "vec3 moonSurface = normalize(transformed) * 2.1;\n" +
        "transformed = mix(moonSurface, transformed, particleProgress);\n"
      );

      shader.fragmentShader = "varying float vProgress;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        "#include <color_fragment>\ndiffuseColor.a *= vProgress;\n"
      );
    };

    var particleRing = new THREE.Points(ringGeometry, ringMaterial);
    particleRing.rotation.set(-Math.PI / 2, 0, 0);
    group.add(particleRing);

    // ---- click-to-reveal asteroid belt ----
    var ASTEROID_COUNT = 75;
    var massiveAsteroids = new Float32Array(ASTEROID_COUNT * 4);
    var asteroids = (function generateAsteroids(count) {
      var data = [];
      for (var i = 0; i < count; i++) {
        data.push({
          angle: Math.random() * Math.PI * 2,
          baseRadius: 2.8 + Math.random() * 2.0,
          radialAmplitude: 0.5 + Math.random() * 1.5,
          radialSpeed: 0.15 + Math.random() * 0.25,
          phase: Math.random() * Math.PI * 2,
          zOffset: (Math.random() - 0.5) * 0.8,
          speed: (0.04 + Math.random() * 0.08) * (Math.random() > 0.5 ? 1 : -1),
          rx: Math.random() * Math.PI, ry: Math.random() * Math.PI, rz: Math.random() * Math.PI,
          rsx: (Math.random() - 0.5) * 0.05, rsy: (Math.random() - 0.5) * 0.05, rsz: (Math.random() - 0.5) * 0.05,
          scale: 0.02 + Math.pow(Math.random(), 4) * 0.18
        });
      }
      data.sort(function (a, b) { return b.scale - a.scale; });
      return data;
    })(ASTEROID_COUNT);

    var asteroidMesh = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ map: moonTex, bumpMap: moonTex, bumpScale: 0.08, color: 0xffffff, roughness: 0.7, metalness: 0.1 }),
      ASTEROID_COUNT
    );
    asteroidMesh.visible = false;
    group.add(asteroidMesh);

    var dummy = new THREE.Object3D();
    var asteroidScale = 0;

    // ---- ring state machine (hidden -> animating -> visible), triggered by clicking the moon ----
    var ringState = "hidden";
    var raycaster = new THREE.Raycaster();
    var pointer = new THREE.Vector2();
    // Detects a click landing on the moon itself (via raycasting) and starts the reveal animation
    renderer.domElement.addEventListener("click", function (e) {
      var rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      var hit = raycaster.intersectObject(moon, false);
      if (hit.length && ringState === "hidden") ringState = "animating";
    });

    // Lets the user drag to orbit the camera around the moon (that's the "drag to rotate" interaction)
    var controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.autoRotate = false;

    var visible = true;
    var pauseObserver = new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
    }, { threshold: 0 });
    pauseObserver.observe(host);

    window.addEventListener("resize", function () {
      var w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }, { passive: true });

    var clock = new THREE.Clock();
    var invMat = new THREE.Matrix4();
    var astVec = new THREE.Vector3();

    // The per-frame render loop: spins the moon/ring, advances the click-reveal animation
    // progress, moves the asteroids along their orbits, then draws the frame
    (function animate() {
      requestAnimationFrame(animate);
      if (!visible) return;
      var delta = clock.getDelta();

      if (!reduceMotion) moon.rotation.y += delta * 0.05;

      if (!reduceMotion) particleRing.rotation.y -= delta * 0.02;
      particleRing.updateMatrix();
      invMat.copy(particleRing.matrix).invert();
      for (var i = 0; i < ASTEROID_COUNT; i++) {
        astVec.set(massiveAsteroids[i * 4], massiveAsteroids[i * 4 + 1], massiveAsteroids[i * 4 + 2]);
        astVec.applyMatrix4(invMat);
        ringUniforms.uAsteroids.value[i * 4] = astVec.x;
        ringUniforms.uAsteroids.value[i * 4 + 1] = astVec.y;
        ringUniforms.uAsteroids.value[i * 4 + 2] = astVec.z;
        ringUniforms.uAsteroids.value[i * 4 + 3] = massiveAsteroids[i * 4 + 3];
      }
      ringUniforms.time.value = clock.getElapsedTime();

      if (ringState === "animating") {
        ringUniforms.uProgress.value = reduceMotion ? 1 : Math.min(1, ringUniforms.uProgress.value + delta * 0.35);
        if (ringUniforms.uProgress.value >= 1) ringState = "visible";
      } else if (ringState === "visible") {
        ringUniforms.uProgress.value = 1;
      } else {
        ringUniforms.uProgress.value = 0;
      }

      var targetScale = ringState === "hidden" ? 0 : 1;
      var lerpSpeed = ringState === "hidden" ? 5 : 2;
      asteroidScale = reduceMotion ? targetScale : asteroidScale + (targetScale - asteroidScale) * Math.min(1, delta * lerpSpeed);

      if (asteroidScale < 0.01) {
        asteroidMesh.visible = false;
      } else {
        asteroidMesh.visible = true;
        for (var j = 0; j < ASTEROID_COUNT; j++) {
          var ast = asteroids[j];
          ast.angle += ast.speed * delta;
          ast.phase += ast.radialSpeed * delta;
          var currentRadius = ast.baseRadius + Math.sin(ast.phase) * ast.radialAmplitude;
          if (currentRadius < 2.15) currentRadius = 2.15 + (2.15 - currentRadius) * 0.85;

          var x = Math.cos(ast.angle) * currentRadius;
          var y = Math.sin(ast.angle) * currentRadius;
          massiveAsteroids[j * 4] = x;
          massiveAsteroids[j * 4 + 1] = y;
          massiveAsteroids[j * 4 + 2] = ast.zOffset;
          massiveAsteroids[j * 4 + 3] = ast.scale;

          ast.rx += ast.rsx; ast.ry += ast.rsy; ast.rz += ast.rsz;
          dummy.position.set(x, y, ast.zOffset);
          dummy.rotation.set(ast.rx, ast.ry, ast.rz);
          dummy.scale.setScalar(ast.scale * asteroidScale);
          dummy.updateMatrix();
          asteroidMesh.setMatrixAt(j, dummy.matrix);
        }
        asteroidMesh.instanceMatrix.needsUpdate = true;
      }

      controls.update();
      renderer.render(scene, camera);
    })();
  }
})();
