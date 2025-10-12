(function () {
  if (!window.SisPrestaApi || !window.SisPrestaConfig) {
    console.error("Falta cargar js/config.js y js/api.js antes de prestamo.js");
    return;
  }
  const Api = window.SisPrestaApi;

  const form = document.getElementById("verificacion-form");
  const dniInput = document.getElementById("dni");
  const nombreInput = document.getElementById("nombre-completo");
  const pepChk = document.getElementById("pep");

  const alertaNoEncontrado = document.getElementById(
    "alerta-dni-no-encontrado"
  );
  const alertaActivo = document.getElementById("alerta-prestamo-activo");

  const onlyDigits = (s) => (s || "").replace(/\D+/g, "");
  const isValidDni = (s) => /^[0-9]{8}$/.test(s || "");

  function show(el) {
    el && el.classList.remove("hidden");
  }
  function hide(el) {
    el && el.classList.add("hidden");
  }

  function resetAlerts() {
    hide(alertaNoEncontrado);
    hide(alertaActivo);
  }

  function setNombre(nombre) {
    if (!nombreInput) return;
    nombreInput.value = nombre || "";
  }

  dniInput?.addEventListener("input", () => {
    const clean = onlyDigits(dniInput.value).slice(0, 8);
    if (dniInput.value !== clean) dniInput.value = clean;
    resetAlerts();
    setNombre("");
  });

  async function consultarBackend(dni) {
    resetAlerts();
    setNombre("");

    if (!isValidDni(dni)) {
      hide(alertaActivo);
      show(alertaNoEncontrado);
      return { ok: false };
    }

    try {
      const cliente = await Api.getClienteByDni(dni);
      const nombre = cliente?.nombreCompleto || cliente?.nombre || "";
      if (!nombre) {
        show(alertaNoEncontrado);
        return { ok: false };
      }
      setNombre(nombre);

      try {
        const vigentes = await Api.listarPrestamos({
          dni,
          estado: "VIGENTE",
          page: 0,
          size: 1,
        });
        const lista = Array.isArray(vigentes)
          ? vigentes
          : Array.isArray(vigentes?.content)
          ? vigentes.content
          : [];
        if (lista.length > 0) show(alertaActivo);
      } catch (e2) {
        console.warn("No se pudo verificar préstamos vigentes:", e2);
      }

      return { ok: true, dni, nombre };
    } catch (e) {
      console.warn("Cliente no encontrado:", e);
      show(alertaNoEncontrado);
      return { ok: false };
    }
  }

  form?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const dni = onlyDigits(dniInput?.value || "");
    const pep = !!pepChk?.checked;

    const r = await consultarBackend(dni);
    if (!r.ok) return;

    const params = new URLSearchParams({
      dni: dni,
      nombre: r.nombre,
      pep: pep ? "1" : "0",
    });
    window.location.href = `./registro-prestamo.html?${params.toString()}`;
  });
})();
