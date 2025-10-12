(function () {
  if (!window.SisPrestaApi || !window.SisPrestaConfig) {
    console.error("Falta cargar js/config.js y js/api.js antes de main.js");
    return;
  }
  const { health } = window.SisPrestaApi;
  const CFG = window.SisPrestaConfig;

  function setStatus(text, ok) {
    const el = document.getElementById("api-status");
    if (!el) return;
    el.textContent = text;
    el.classList.remove("status-ok", "status-bad");
    el.classList.add(ok ? "status-ok" : "status-bad");
    el.title = `Base API: ${CFG.apiBase}`;
  }

  async function init() {
    setStatus("Comprobando API…", false);
    const h = await health();
    if (h.ok) {
      setStatus("API OK", true);
    } else {
      setStatus("API OFF", false);
      console.warn("Health error:", h.error);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
