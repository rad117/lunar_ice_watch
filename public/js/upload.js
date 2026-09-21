function startUpload() {
  const fill = document.getElementById("progressFill");
  const wrap = document.getElementById("progressWrap");
  const status = document.getElementById("statusText");

  wrap.style.display = "block";
  status.textContent = "reading file...";
  fill.style.width = "0%";

  let pct = 0;
  const timer = setInterval(function () {
    pct += 10;
    fill.style.width = pct + "%";

    if (pct === 30) status.textContent = "computing radar metrics...";
    if (pct === 60) status.textContent = "checking thermal gate...";
    if (pct === 85) status.textContent = "running evidence engine...";

    if (pct >= 100) {
      clearInterval(timer);
      status.textContent = "analysis complete - new site added to dashboard";
    }
  }, 250);
}
