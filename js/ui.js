// Small shared UI helpers used by every page (loaded first via <script src="js/ui.js">)

// Highlights the current page's link in the top navbar (adds the "active" underline style)
function setActiveNav() {
  const links = document.querySelectorAll(".navbar a[href]");
  if (!links.length) return;

  const here = window.location.pathname.split("/").pop() || "index.html";
  links.forEach(function (a) {
    const href = a.getAttribute("href");
    if (href === here) {
      a.classList.add("active");
    }
  });
}

// Pops up a small notification in the bottom-right corner (the ".toast" styles in style.css)
function showToast(message, variant) {
  let stack = document.querySelector(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }

  const toast = document.createElement("div");
  toast.className = "toast" + (variant ? " " + variant : "");
  toast.textContent = message;
  stack.appendChild(toast);

  setTimeout(function () {
    toast.classList.add("leaving");
    setTimeout(function () {
      toast.remove();
    }, 200);
  }, 3200);
}

// Animates a number counting up from 0 to `target`; used by dashboard.js for the stat tiles on the Dashboard page
function animateCount(el, target, opts) {
  const duration = (opts && opts.duration) || 700;
  const decimals = (opts && opts.decimals) || 0;
  const start = performance.now();

  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 2);
    const val = target * eased;
    el.textContent = decimals ? val.toFixed(decimals) : Math.round(val);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

document.addEventListener("DOMContentLoaded", setActiveNav);

// Adds "Sign in" or "Sign out (email)" to the navbar, depending on the session cookie
document.addEventListener("DOMContentLoaded", function () {
  const links = document.querySelector(".navbar .links");
  if (!links) return;
  fetch("/api/auth/me").then(function (r) { return r.json(); }).then(function (user) {
    const a = document.createElement("a");
    if (user) {
      a.href = "#";
      a.textContent = "Sign out (" + user.email + ")";
      a.addEventListener("click", function (e) {
        e.preventDefault();
        fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then(function () { location.reload(); });
      });
    } else {
      a.href = "login.html";
      a.textContent = "Sign in";
      if (location.pathname.endsWith("login.html")) a.classList.add("active");
    }
    links.insertBefore(a, links.querySelector(".theme-toggle"));
  }).catch(function () { /* signed-out look is fine if the API is down */ });
});

// Reads the saved preference and shows/hides the ambient corner moon + starfield background accordingly
function applyMoonMode() {
  const enabled = localStorage.getItem("liw_moon_mode") !== "off";
  document.body.classList.toggle("no-moon", !enabled);
  const btn = document.querySelector(".theme-toggle");
  if (btn) {
    btn.setAttribute("aria-pressed", enabled ? "true" : "false");
    btn.textContent = enabled ? "☾ Moonlight" : "✦ Minimal";
  }
}

// Wired to the "☾ Moonlight" button in the navbar on every page; flips the saved preference and shows a toast
function toggleMoonMode() {
  const enabled = localStorage.getItem("liw_moon_mode") !== "off";
  localStorage.setItem("liw_moon_mode", enabled ? "off" : "on");
  applyMoonMode();
  showToast(enabled ? "Moon ambience reduced" : "Moon ambience restored", "success");
}

document.addEventListener("DOMContentLoaded", applyMoonMode);
