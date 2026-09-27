function logout() {
  localStorage.removeItem("liw_user");
  window.location.href = "login.html";
}
