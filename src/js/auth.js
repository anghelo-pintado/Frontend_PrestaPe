(function (global) {
  const CFG = global.SisPrestaConfig || {};
  const API_BASE_URL = CFG.apiBase || "";
  const TOKEN_KEY = CFG.TOKEN_KEY || "sispresta:auth";
  const ROLE_KEY = CFG.ROLE_KEY || "sispresta:role";

  function saveTokens({ accessToken, refreshToken, role }) {
    try {
      localStorage.setItem(TOKEN_KEY, accessToken || "");
      localStorage.setItem("refreshToken", refreshToken || "");
      localStorage.setItem(ROLE_KEY, role || "");
    } catch (e) {
      console.warn("No se pudo guardar tokens:", e);
    }
  }

  function clearTokens() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem("refreshToken");
      localStorage.removeItem(ROLE_KEY);
    } catch {}
  }

  function getAccessToken() {
    return localStorage.getItem(TOKEN_KEY);
  }
  function getRefreshToken() {
    return localStorage.getItem("refreshToken");
  }
  function getUserRole() {
    return localStorage.getItem(ROLE_KEY);
  }

  function isTokenExpired(token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }

  function redirectToDashboard(role) {
    let url = "login.html";
    if (role && role.toUpperCase() === "ADMIN") url = "principal.html";
    else if (role) url = "principal.html";
    global.location.href = url;
  }

  async function login(email, password) {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/autenticar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      saveTokens(data);
      redirectToDashboard(data.role);
      return true;
    } catch (e) {
      console.error("Error en login:", e);
      clearTokens();
      return false;
    }
  }

  async function apiFetch(endpoint, options = {}) {
    const token = getAccessToken();
    const headers = {
      ...(options.headers || {}),
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    };
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
    if (res.status === 401) {
      clearTokens();
      global.location.href = "login.html";
      return;
    }
    return res;
  }

  function logout() {
    clearTokens();
    global.location.href = "login.html";
  }

  function checkAuthAndRedirect(expectedRole) {
    const token = getAccessToken();
    const role = getUserRole();
    if (!token || isTokenExpired(token)) return logout();
    if (expectedRole && role.toUpperCase() !== expectedRole.toUpperCase()) {
      return redirectToDashboard(role);
    }
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn)
      logoutBtn.addEventListener("click", function (e) {
        e.preventDefault();
        logout();
      });
  }

  if (window.location.pathname.endsWith("login.html")) {
    const token = getAccessToken();
    if (token && !isTokenExpired(token)) {
      redirectToDashboard(getUserRole());
    }
  }

  global.SisPrestaAuth = {
    API_BASE_URL,
    saveTokens,
    clearTokens,
    getAccessToken,
    getRefreshToken,
    getUserRole,
    isTokenExpired,
    redirectToDashboard,
    login,
    logout,
    apiFetch,
    checkAuthAndRedirect,
  };
})(window);
