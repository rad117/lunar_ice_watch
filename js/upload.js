// Powers upload.html: the drag-and-drop zone, the "run analysis" pipeline, and generating
// rows parsed from an uploaded CSV, which the server (server/classify.js) classifies and stores in MongoDB.

// ---- Drag-and-drop file picker (#dropzone) ----
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

// Columns the CSV must have; the rest are optional and get defaults on the server
const REQUIRED_COLS = ["cpr", "thermalTemp", "terrainHazard"];
const TEMPLATE_CSV =
  "label,crater,x,y,pv,cpr,serd,tRatio,thermalTemp,altFlag,terrainHazard,boulderCount\n" +
  "Site B1,Near Shackleton rim,40,50,0.6,1.3,0.2,0.5,-235,false,22,4\n";

// Minimal CSV parse (no quoted commas): header row -> array of {column: value} objects
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
  const head = lines.shift().split(",").map(function (h) { return h.trim(); });
  REQUIRED_COLS.forEach(function (c) {
    if (head.indexOf(c) < 0) throw new Error("CSV is missing required column: " + c);
  });
  return lines.map(function (l) {
    const cells = l.split(",");
    const row = {};
    head.forEach(function (h, i) { row[h] = (cells[i] || "").trim(); });
    return row;
  });
}

// "Download template" link on upload.html
function downloadTemplate() {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: "text/csv" }));
  a.download = "lunar_ice_watch_template.csv";
  a.click();
}

// ---- Processing checklist (#checklist): steps through the stages while the upload is sent ----
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

// Runs when "Run Analysis" is clicked: parses the CSV, steps through the checklist, then POSTs the
// rows to /api/sites where the server classifies and saves them
async function startUpload() {
  const status = document.getElementById("statusText");
  const nameInput = document.getElementById("siteName");
  const name = nameInput.value.trim() || "Site " + Math.floor(Math.random() * 900 + 100);
  const file = fileInput.files[0];
  if (!file) { showToast("Choose a CSV file first", "error"); return; }

  document.querySelectorAll("#checklist li").forEach(function (li) {
    li.classList.remove("active", "done");
  });

  const stages = ["read", "radar", "thermal", "evidence"];
  let sites;
  try {
    for (let i = 0; i < stages.length; i++) {
      setStage(stages[i], "active");
      status.textContent = document.querySelector('#checklist li[data-stage="' + stages[i] + '"]').textContent + "...";
      if (i === 0) { var text = await file.text(); parseCsv(text); } // client-side check only; the server validates again
      if (i === 3) {
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name, filename: file.name, csv: text })
        });
        const body = await res.json();
        if (res.status === 401) { location.href = "login.html?next=upload.html"; return; }
        if (!res.ok) throw new Error(body.error || "Upload failed");
        sites = body;
      }
      await wait(300);
      setStage(stages[i], "done");
    }
  } catch (e) {
    status.textContent = e.message;
    showToast(e.message, "error");
    return;
  }
  sites.forEach(function (site) { siteData.push(flattenSite(site)); });

  status.textContent = "analysis complete - " + sites.length + " site(s) added to dashboard";
  showToast(sites.length + " site(s) added to the dashboard", "success");
  nameInput.value = "";
}
