const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const dzFile = document.getElementById("dzFile");

dropzone.addEventListener("click", function () {
  fileInput.click();
});

fileInput.addEventListener("change", function () {
  if (fileInput.files[0]) dzFile.textContent = fileInput.files[0].name;
});

["dragenter", "dragover"].forEach(function (evt) {
  dropzone.addEventListener(evt, function (e) {
    e.preventDefault();
    dropzone.classList.add("drag-over");
  });
});

["dragleave", "drop"].forEach(function (evt) {
  dropzone.addEventListener(evt, function (e) {
    e.preventDefault();
    dropzone.classList.remove("drag-over");
  });
});

dropzone.addEventListener("drop", function (e) {
  const file = e.dataTransfer.files[0];
  if (file) {
    fileInput.files = e.dataTransfer.files;
    dzFile.textContent = file.name;
  }
});

function classifyNewSite(m) {
  if (m.thermalGate === "fail") {
    return { classification: "ICE-UNLIKELY", tier: "NONE", rationale: "Region is not cold enough to sustain surface ice. Thermal gate failure overrides any radar signal." };
  }
  if (m.altFlag) {
    return { classification: "INCONCLUSIVE", tier: "NONE", rationale: "Passed the thermal gate but the alternative-explanation flag is raised. Radar signal alone is not enough to confirm ice." };
  }
  if (m.cpr >= 1.2 && m.terrainHazard < 30) {
    return { classification: "ICE-SUPPORTED-HIGH", tier: "STRONG_SUPPORT", rationale: "High CPR combined with a passed thermal gate and low terrain hazard. No competing explanation found for the radar anomaly." };
  }
  if (m.cpr >= 0.9) {
    return { classification: "ICE-SUPPORTED-MODERATE", tier: "STRONG_SUPPORT", rationale: "Moderate radar and thermal evidence align. Terrain hazard is on the higher side so confidence is not maximal." };
  }
  return { classification: "INCONCLUSIVE", tier: "NONE", rationale: "Radar signal is weak. Thermal gate passed but evidence is not strong enough for a confident call." };
}

function synthesizeSite(name) {
  const cpr = +(0.6 + Math.random() * 1.0).toFixed(2);
  const terrainHazard = Math.round(15 + Math.random() * 55);
  const thermalTemp = Math.round(-260 + Math.random() * 130);
  const metrics = {
    cpr: cpr,
    terrainHazard: terrainHazard,
    thermalGate: thermalTemp < -190 ? "pass" : "fail",
    altFlag: Math.random() < 0.25
  };
  const result = classifyNewSite(metrics);
  const id = "u" + Date.now();

  return {
    id: id,
    label: name,
    crater: "Newly surveyed region",
    x: Math.round(10 + Math.random() * 80),
    y: Math.round(10 + Math.random() * 80),
    pv: +(0.2 + Math.random() * 0.6).toFixed(2),
    cpr: cpr,
    serd: +(0.15 + Math.random() * 0.45).toFixed(2),
    tRatio: +(0.2 + Math.random() * 0.5).toFixed(2),
    thermalGate: metrics.thermalGate,
    thermalTemp: thermalTemp,
    altFlag: metrics.altFlag,
    altNote: metrics.altFlag ? "Adjacent terrain feature may explain part of the signal" : "No competing terrain explanation identified",
    terrainHazard: terrainHazard,
    boulderCount: Math.round(terrainHazard / 5),
    classification: result.classification,
    tier: result.tier,
    rationale: result.rationale
  };
}

function persistSite(site) {
  let extra = [];
  try {
    extra = JSON.parse(localStorage.getItem("liw_extra_sites") || "[]");
  } catch (e) {
    extra = [];
  }
  extra.push(site);
  localStorage.setItem("liw_extra_sites", JSON.stringify(extra));
}

function setStage(stageName, state) {
  const li = document.querySelector('#checklist li[data-stage="' + stageName + '"]');
  li.classList.remove("active", "done");
  if (state) li.classList.add(state);
}

function wait(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

async function startUpload() {
  const status = document.getElementById("statusText");
  const nameInput = document.getElementById("siteName");
  const name = nameInput.value.trim() || "Site " + Math.floor(Math.random() * 900 + 100);

  document.querySelectorAll("#checklist li").forEach(function (li) {
    li.classList.remove("active", "done");
  });

  const stages = ["read", "radar", "thermal", "evidence"];
  for (let i = 0; i < stages.length; i++) {
    setStage(stages[i], "active");
    status.textContent = document.querySelector('#checklist li[data-stage="' + stages[i] + '"]').textContent + "...";
    await wait(500);
    setStage(stages[i], "done");
  }

  const site = synthesizeSite(name);
  siteData.push(site);
  persistSite(site);

  status.textContent = "analysis complete - " + site.label + " added to dashboard as " + site.classification;
  showToast(site.label + " added to the dashboard (" + site.classification + ")", "success");
  nameInput.value = "";
}
