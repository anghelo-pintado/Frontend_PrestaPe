(function () {
  if (!window.SisPrestaApi || !window.SisPrestaConfig) {
    console.error("Falta cargar js/config.js y js/api.js antes de registro.js");
    return;
  }
  const Api = window.SisPrestaApi;

  const LIMITS = {
    MONTO_MIN: 0.01,
    MONTO_MAX: 1000000,
    TEA_MIN_PCT: 0.01,
    TEA_MAX_PCT: Infinity,
    PLAZO_MIN: 1,
    PLAZO_MAX: Infinity,
    UIT: 5350,
  };

  const $ = (id) => document.getElementById(id);
  function show(el) {
    el && el.classList.remove("hidden");
  }
  function hide(el) {
    el && el.classList.add("hidden");
  }
  function fmtMoney(n) {
    const v = Number(n || 0);
    return "S/ " + v.toFixed(2);
  }

  function formatFecha(input) {
    if (!input) return "-";
    const s = String(input).trim();
    // Si ya está en dd/mm/yyyy, dejarlo
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
    // Manejar ISO yyyy-mm-dd o datetime
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    let d;
    if (iso) {
      d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00`);
    } else {
      d = new Date(s);
    }
    if (!(d instanceof Date) || isNaN(d)) return s;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  function parsePositiveNumber(val) {
    // const n = Number(val);
    // return Number.isFinite(n) && n > 0 ? n : NaN;
    if (val === null || val === undefined) return NaN;
    // Aceptar coma o punto como separador decimal y eliminar espacios
    const s = String(val).trim().replace(",", ".");
    if (s === "") return NaN;
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : NaN;
  }

  const form = $("prestamo-form");
  const fechaEl = $("fecha-inicio");
  const montoEl = $("monto");
  const teaEl = $("tea");
  const plazoEl = $("plazo");
  const cronobody = $("cronograma-body");

  // Aceptar decimales en los inputs (UI): paso y valor mínimo
  if (montoEl) {
    montoEl.setAttribute("step", "0.01");
    montoEl.setAttribute("min", String(LIMITS.MONTO_MIN));
  }
  if (teaEl) {
    teaEl.setAttribute("step", "0.01");
    teaEl.setAttribute("min", String(LIMITS.TEA_MIN_PCT));
  }

  const alertaUIT = $("alerta-uit");
  const alertaPEP = $("alerta-pep");
  const alertaDuplicado = $("alerta-duplicado");

  const btnGenerarDJ = $("btn-generar-dj");
  const btnConfirmar = $("btn-confirmar");
  const headerCliente = $("cliente-info-header");

  const url = new URL(window.location.href);
  const documentId = url.searchParams.get("documentId") || "";
  const nombre = url.searchParams.get("nombre") || "";
  const esPEP = url.searchParams.get("pep") === "1";

  // ===== Setear fecha actual y BLOQUEAR edición =====
  /*   if (fechaEl) {
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, "0");
    const dd = String(hoy.getDate()).padStart(2, "0");
    const fechaActual = `${yyyy}-${mm}-${dd}`;
    fechaEl.value = fechaActual;

    // Bloqueos de edición/interacción
    fechaEl.readOnly = true; // no teclea
    fechaEl.min = fechaActual; // evita cambiar por teclado
    fechaEl.max = fechaActual; // idem
    fechaEl.setAttribute("aria-readonly", "true");

    // Evita abrir el datepicker en la mayoría de navegadores
    fechaEl.addEventListener("keydown", (e) => e.preventDefault());
    fechaEl.addEventListener("mousedown", (e) => e.preventDefault());
    fechaEl.addEventListener("click", (e) => e.preventDefault());

    // Señal visual opcional
    fechaEl.style.backgroundColor = "#f0f2f5";
    fechaEl.style.cursor = "not-allowed";
  } */

  if (headerCliente) {
    headerCliente.textContent = documentId
      ? `Cliente: ${nombre || "(sin nombre)"} — DNI/RUC ${documentId}`
      : "(Cliente no reconocido; vuelva a Verificación)";
  }

  if (esPEP) {
    show(alertaPEP);
    // Marcar el checkbox si viene como PEP desde la URL
    const pepCheckbox = $("pep");
    if (pepCheckbox) pepCheckbox.checked = true;
  }

  function evaluarUIT() {
    const m = parsePositiveNumber(montoEl?.value);
    const pepCheckbox = $("pep");
    const pepChecked = pepCheckbox?.checked || false;

    // Manejo de alerta UIT
    if (Number.isFinite(m) && m >= LIMITS.UIT) {
      show(alertaUIT);
    } else {
      hide(alertaUIT);
    }

    // Mostrar u ocultar el botón DJ según las condiciones
    // Se muestra si el monto >= UIT O si está marcado como PEP
    if ((Number.isFinite(m) && m >= LIMITS.UIT) || pepChecked) {
      show(btnGenerarDJ);
    } else {
      hide(btnGenerarDJ);
    }
  }

  // Agrega un event listener para el checkbox PEP
  $("pep")?.addEventListener("change", () => {
    const pepCheckbox = $("pep");
    if (pepCheckbox?.checked) {
      show(alertaPEP);
    } else {
      hide(alertaPEP);
    }
    evaluarUIT();
  });

  function validarCampos() {
    const fechaISO = fechaEl?.value || "";
    const monto = parsePositiveNumber(montoEl?.value);
    const teaPct = parsePositiveNumber(teaEl?.value);
    const plazo = parsePositiveNumber(plazoEl?.value);

    let ok = true;

    if (!fechaISO) ok = false;

    if (
      !Number.isFinite(monto) ||
      monto < LIMITS.MONTO_MIN ||
      monto > LIMITS.MONTO_MAX
    ) {
      ok = false;
    }

    if (
      !Number.isFinite(teaPct) ||
      teaPct < LIMITS.TEA_MIN_PCT ||
      teaPct > LIMITS.TEA_MAX_PCT
    ) {
      ok = false;
    }

    if (
      !Number.isFinite(plazo) ||
      plazo < LIMITS.PLAZO_MIN ||
      plazo > LIMITS.PLAZO_MAX
    ) {
      ok = false;
    }

    return { ok, fechaISO, monto, teaPct, plazo };
  }

  function pintarCronograma(crono) {
    if (!cronobody) return;
    cronobody.innerHTML = "";

    const table = cronobody.closest("table");
    const thead = table ? table.querySelector("thead") : null;
    const tfoot = table ? table.querySelector("tfoot") : null;
    const primera = crono.filas && crono.filas.length ? crono.filas[0] : null;

    // Verificar si tenemos los campos detallados del nuevo calculadora.js
    const tieneDetalle =
      primera &&
      ("capital" in primera || "interesBase" in primera || "saldo" in primera);

    // Actualizar encabezado de la tabla
    if (thead) {
      if (tieneDetalle) {
        thead.innerHTML = `
          <tr>
            <th>N°</th>
            <th>Fecha</th>
            <th>Amortización</th>
            <th>Interés</th>
            <th>IGV</th>
            <th>Cuota</th>
            <th>Saldo</th>
          </tr>
        `;
      } else {
        thead.innerHTML = `
          <tr>
            <th>N° Cuota</th>
            <th>Fecha Vencimiento</th>
            <th>Cuota (S/)</th>
          </tr>
        `;
      }
    }

    // Pintar filas
    crono.filas.forEach((f) => {
      const tr = document.createElement("tr");

      if (tieneDetalle) {
        tr.innerHTML = `
          <td>${f.n}</td>
          <td>${formatFecha(f.fecha)}</td>
          <td>${fmtMoney(f.capital)}</td>
          <td>${fmtMoney(f.interesBase)}</td>
          <td>${fmtMoney(f.igv)}</td>
          <td>${fmtMoney(f.cuota)}</td>
          <td>${fmtMoney(f.saldo)}</td>
        `;
      } else {
        tr.innerHTML = `
          <td>${f.n}</td>
          <td>${formatFecha(f.fecha)}</td>
          <td>${fmtMoney(f.cuota)}</td>
        `;
      }

      cronobody.appendChild(tr);
    });
  }

  form?.addEventListener("input", () => {
    evaluarUIT();
  });

  form?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const v = validarCampos();
    if (!v.ok) {
      alert(
        `Revisa los datos:
- Fecha: obligatoria
- Monto: ${LIMITS.MONTO_MIN} a ${LIMITS.MONTO_MAX}
- TEA (%): ${LIMITS.TEA_MIN_PCT} a ${LIMITS.TEA_MAX_PCT}
- Plazo (meses): ${LIMITS.PLAZO_MIN} a ${LIMITS.PLAZO_MAX}`
      );
      return;
    }
    const crono = window.PrestaCalculos.generarCronograma({
      fechaInicioISO: v.fechaISO,
      monto: v.monto,
      teaPct: v.teaPct,
      plazoMeses: v.plazo,
    });

    pintarCronograma(crono);
    btnConfirmar && (btnConfirmar.disabled = false);
    evaluarUIT();
  });

  btnGenerarDJ?.addEventListener("click", () => {
    // La ruta a tu archivo
    const urlPDF =
      "../docs/DECLARACION JURADA DE CONOCIMIENTO DEL CLIENTE BAJO EL REGIMEN GENERAL  PERSONA NATURAL.pdf";

    // Creamos un enlace temporal en la memoria
    const link = document.createElement("a");
    link.href = urlPDF;

    // Le asignamos el atributo download y el nombre del archivo
    link.setAttribute("download", "Formato_Declaracion_Jurada_PN.pdf");

    // Lo añadimos al documento, hacemos clic y lo removemos
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  btnConfirmar?.addEventListener("click", async () => {
    const v = validarCampos();
    if (!v.ok) {
      alert(
        "Datos inválidos. Genera primero el cronograma y verifica los campos."
      );
      return;
    }
    if (!documentId) {
      alert(
        "No se recibió DNI/RUC en la URL. Regresa a la Verificación de Cliente."
      );
      return;
    }

    const payload = {
      documentId: documentId,
      startDate: v.fechaISO,
      principal: v.monto,
      teaAnnual: v.teaPct / 100,
      months: v.plazo,
      pep: $("pep")?.checked || false,
    };

    try {
      const creado = await Api.crearPrestamo(payload);
      alert("Préstamo guardado correctamente.");
      window.location.href = `./prestamos.html?documentId=${encodeURIComponent(
        documentId
      )}`;
    } catch (e) {
      console.error(e);

      // Intentar obtener el status desde distintos tipos de error
      const status =
        e?.status ||
        e?.response?.status ||
        (e?.response && e.response.status) ||
        null;

      // Manejo específico para 403: ya existe préstamo para el cliente
      if (status === 403) {
        if (alertaDuplicado) {
          alertaDuplicado.innerHTML = `
            Ya existe un préstamo activo para este cliente.
            <a href="./prestamos.html?documentId=${encodeURIComponent(
              documentId
            )}">Ver préstamos</a>
          `;
          show(alertaDuplicado);
        } else {
          alert("Ya existe un préstamo activo para este cliente.");
        }
        return;
      }

      alert(e?.message || "No se pudo guardar el préstamo en el backend.");
    }
  });

  // Inicial
  evaluarUIT();
})();
