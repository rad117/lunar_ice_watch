// Runs when the "Log in" button on login.html is clicked
function tryLogin() {
  const u = document.getElementById("uname").value.trim();
  const p = document.getElementById("pass").value.trim();
  const err = document.getElementById("err");
  const box = document.getElementById("loginBox"); // the login card, shaken on error

  if (u.length === 0 || p.length === 0) {
    // Show the red error text and re-trigger the CSS "shake" animation on the box
    err.textContent = "enter a username and password";
    box.classList.remove("shake");
    void box.offsetWidth; // forces the browser to notice the class was removed, so re-adding it replays the animation
    box.classList.add("shake");
    return;
  }

  // Demo-only "auth": any non-empty username is accepted and stored, then we go to the homepage
  localStorage.setItem("liw_user", u);
  window.location.href = "index.html";
}

// Let pressing Enter in either field submit the form, same as clicking the button
document.getElementById("pass").addEventListener("keydown", function (e) {
  if (e.key === "Enter") tryLogin();
});

document.getElementById("uname").addEventListener("keydown", function (e) {
  if (e.key === "Enter") tryLogin();
});
