(function () {
  if (!window.SisPrestaApi || !window.SisPrestaConfig) {
    console.error("Falta cargar js/config.js y js/api.js antes de prestamo.js");
    return;
  }
  const Api = window.SisPrestaApi;

  const form = document.getElementById("verificacion-form");
  const documentIdInput = document.getElementById("documentId");
  const nombreInput = document.getElementById("nombre-completo");
  const submitBtn = document.getElementById("verificar-button");

  const alertaNoEncontrado = document.getElementById(
    "alerta-documentId-no-encontrado"
  );
  const alertaActivo = document.getElementById("alerta-prestamo-activo");

  const onlyDigits = (s) => (s || "").replace(/\D+/g, "");
  const isValidDocumentId = (s) => /^[0-9]{8,11}$/.test(s || "");

  // Deshabilitar botón y checkbox inicialmente
  if (submitBtn) submitBtn.disabled = true;

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

  function updateButtonsState(value) {
    const isValid = isValidDocumentId(value);
    if (submitBtn) submitBtn.disabled = !isValid;
  }

  documentIdInput?.addEventListener("input", () => {
    const clean = onlyDigits(documentIdInput.value).slice(0, 11);
    if (documentIdInput.value !== clean) documentIdInput.value = clean;
    resetAlerts();
    setNombre("");
    updateButtonsState(clean);
  });

  async function consultarBackend(documentId) {
    resetAlerts();
    setNombre("");

    if (!isValidDocumentId(documentId)) {
      hide(alertaActivo);
      show(alertaNoEncontrado);
      return { ok: false };
    }

    try {
      const cliente = await Api.getClienteByDocumentId(documentId);
      const nombre = cliente?.nombreCompleto || cliente?.fullName || "";
      if (!nombre) {
        show(alertaNoEncontrado);
        return { ok: false };
      }
      setNombre(nombre);

      try {
        const vigentes = await Api.listarPrestamos({
          documentId,
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

      return { ok: true, documentId, nombre };
    } catch (e) {
      console.warn("Cliente no encontrado:", e);
      show(alertaNoEncontrado);
      return { ok: false };
    }
  }

  form?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const documentId = onlyDigits(documentIdInput?.value || "");

    const r = await consultarBackend(documentId);
    if (!r.ok) return;

    const params = new URLSearchParams({
      documentId: r.documentId,
      nombre: r.nombre,
      //pep: r.pep ? "1" : "0",
    });
    window.location.href = `./registro-prestamo.html?${params.toString()}`;
  });
})();
