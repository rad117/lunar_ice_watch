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
