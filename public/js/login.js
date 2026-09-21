function tryLogin() {
  const u = document.getElementById("uname").value.trim();
  const p = document.getElementById("pass").value.trim();
  const err = document.getElementById("err");

  if (u.length === 0 || p.length === 0) {
    err.textContent = "enter a username and password";
    return;
  }

  localStorage.setItem("liw_user", u);
  window.location.href = "index.html";
}
