// Wired to the "Logout" link in the navbar on every logged-in page (dashboard/map/traverse/upload/site)
function logout() {
  localStorage.removeItem("liw_user");
  window.location.href = "login.html";
}
