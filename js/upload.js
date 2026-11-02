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

const REQUIRED_COLS = ["cpr", "thermalTemp", "terrainHazard"];
const TEMPLATE_CSV =
  "label,crater,x,y,pv,cpr,serd,tRatio,thermalTemp,altFlag,terrainHazard,boulderCount\n" +
  "Site B1,Near Shackleton rim,40,50,0.6,1.3,0.2,0.5,-235,false,22,4\n";

function checkCsvHeader(text) {
  const head = text.replace(/^\uFEFF/, "").split(/\r?\n/)[0].split(",").map(function (h) { return h.trim().replace(/^"|"$/g, ""); });
  REQUIRED_COLS.forEach(function (c) {
    if (head.indexOf(c) < 0) throw new Error("CSV is missing required column: " + c);
  });
}

function downloadTemplate() {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: "text/csv" }));
  a.download = "lunar_ice_watch_template.csv";
  a.click();
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
  const file = fileInput.files[0];
  if (!file) { showToast("Choose a CSV file first", "error"); return; }

  document.querySelectorAll("#checklist li").forEach(function (li) {
    li.classList.remove("active", "done");
  });
  const results = document.getElementById("uploadResults");
  results.replaceChildren();

  const stages = ["read", "radar", "thermal", "evidence"];
  let sites;
  try {
    for (let i = 0; i < stages.length; i++) {
      setStage(stages[i], "active");
      status.textContent = document.querySelector('#checklist li[data-stage="' + stages[i] + '"]').textContent + "...";
      if (i === 0) { var text = await file.text(); checkCsvHeader(text); }
      if (i === 3) {
        const ctl = new AbortController();
        const timer = setTimeout(function () { ctl.abort(); }, 30000);
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name, filename: file.name, csv: text }),
          signal: ctl.signal
        }).catch(function (e) { throw new Error(e.name === "AbortError" ? "The server did not answer within 30 s. Try again." : e.message); })
          .finally(function () { clearTimeout(timer); });
        const body = await res.json().catch(function () { return {}; });
        if (!res.ok) throw new Error(body.error || "Uploads need the server (returned " + res.status + "). Use the live site or npm run demo.");
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

  results.replaceChildren(...sites.map(function (site) {
    const label = site.prediction.label;
    return h("li", null, h("span", null, site.name + " - " + site.region), h("span", { class: "badge " + classificationClass(label) }, label));
  }));

  status.replaceChildren("analysis complete - " + sites.length + " site(s) added. ", h("a", { class: "text-link", href: "dashboard.html" }, "View on the dashboard →"));
  showToast(sites.length + " site(s) added to the dashboard", "success");
  nameInput.value = "";
}

const UPLOADS_OFF = "Uploads need a running server and database, so they are switched off here. Use the live site or npm run demo.";
fetch("/api/routes?siteId=none").then(function (r) {
  if (!r.ok || r.headers.get("x-data-source") === "snapshot") document.getElementById("statusText").textContent = UPLOADS_OFF;
}).catch(function () { document.getElementById("statusText").textContent = UPLOADS_OFF; });
