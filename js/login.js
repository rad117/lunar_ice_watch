function tryLogin() {
  const u = document.getElementById("uname").value.trim();
  const p = document.getElementById("pass").value.trim();
  const err = document.getElementById("err");
  const box = document.getElementById("loginBox");

  if (u.length === 0 || p.length === 0) {
    err.textContent = "enter a username and password";
    box.classList.remove("shake");
    void box.offsetWidth;
    box.classList.add("shake");
    return;
  }

  localStorage.setItem("liw_user", u);
  window.location.href = "index.html";
}

document.getElementById("pass").addEventListener("keydown", function (e) {
  if (e.key === "Enter") tryLogin();
});

document.getElementById("uname").addEventListener("keydown", function (e) {
  if (e.key === "Enter") tryLogin();
});
