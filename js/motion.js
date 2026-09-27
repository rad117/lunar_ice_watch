(function () {
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";

  if (reduceMotion || !hasGsap) return;

  gsap.registerPlugin(ScrollTrigger);

  if (typeof window.Lenis !== "undefined") {
    var lenis = new Lenis();
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  /* ---- shared, light reveals (every page) ---- */
  document.querySelectorAll(".reveal").forEach(function (el) {
    gsap.to(el, {
      opacity: 1, y: 0, duration: 0.7, ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 88%" }
    });
  });

  document.querySelectorAll(".reveal-line > span").forEach(function (span, i) {
    gsap.to(span, {
      y: "0%", duration: 0.8, ease: "power3.out", delay: (i % 4) * 0.05,
      scrollTrigger: { trigger: span, start: "top 90%" }
    });
  });

  document.querySelectorAll(".reveal-stagger").forEach(function (group) {
    gsap.to(group.children, {
      opacity: 1, y: 0, duration: 0.6, ease: "power2.out", stagger: 0.08,
      scrollTrigger: { trigger: group, start: "top 85%" }
    });
  });

  if (!document.body.classList.contains("home-page")) return;

  /* ---- homepage-only heavy sequences ---- */
  var mm = gsap.matchMedia();

  mm.add("(min-width: 801px)", function () {
    document.querySelectorAll(".home-hero [data-speed]").forEach(function (el) {
      var speed = parseFloat(el.dataset.speed);
      gsap.to(el, {
        yPercent: speed * -35, ease: "none",
        scrollTrigger: { trigger: ".home-hero", start: "top top", end: "bottom top", scrub: true }
      });
    });

    var journeyTl = gsap.timeline({
      scrollTrigger: { trigger: ".journey-section", start: "top top", end: "+=100%", scrub: true, pin: true }
    });
    journeyTl
      .to(".journey-moon", { scale: 1.55, boxShadow: "0 0 220px rgba(139,220,255,.3)", duration: 1 })
      .to(".journey-copy", { opacity: 1, duration: 0.6 }, "-=0.35");

    return function () {};
  });

  mm.add("(max-width: 800px)", function () {
    gsap.to(".journey-copy", {
      opacity: 1, duration: 0.6,
      scrollTrigger: { trigger: ".journey-section", start: "top 70%" }
    });
    return function () {};
  });

  var progressFill = document.querySelector(".workflow-progress .fill");
  if (progressFill) {
    gsap.to(progressFill, {
      scaleX: 1, ease: "none",
      scrollTrigger: { trigger: ".workflow", start: "top 75%", end: "bottom 65%", scrub: true }
    });
  }

  var satellite = document.querySelector(".scroll-satellite");
  var homeContainer = document.querySelector(".home-container");
  if (satellite && homeContainer) {
    gsap.fromTo(satellite,
      { top: "0%", opacity: 0 },
      {
        top: "94%", opacity: 1, ease: "none",
        scrollTrigger: { trigger: homeContainer, start: "top center", end: "bottom bottom", scrub: true }
      }
    );
  }

  var burst = document.querySelector(".cta-burst");
  if (burst) {
    gsap.to(burst, {
      opacity: 1, scale: 1.15, duration: 1,
      scrollTrigger: { trigger: ".home-bottom-cta", start: "top 80%" }
    });
  }
})();
