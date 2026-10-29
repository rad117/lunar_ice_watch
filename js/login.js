// Powers login.html: sign in or create an account, then go to ?next= (default upload.html).
const form = document.getElementById("authForm");
const status = document.getElementById("authStatus");

async function submit(path) {
  status.textContent = "";
  const res = await fetch("/api/auth/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: form.email.value, password: form.password.value })
  });
  const body = await res.json().catch(function () { return {}; });
  if (!res.ok) { status.textContent = body.error || "Something went wrong"; return; }
  const next = new URLSearchParams(location.search).get("next");
  location.href = /^[\w-]+\.html$/.test(next || "") ? next : "upload.html"; // only same-site pages, no open redirect
}

form.addEventListener("submit", function (e) { e.preventDefault(); submit("login"); });
document.getElementById("registerBtn").addEventListener("click", function () {
  if (form.reportValidity()) submit("register");
});
