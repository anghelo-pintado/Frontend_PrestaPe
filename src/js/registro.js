(function () {
  if (!window.SisPrestaApi || !window.SisPrestaConfig) {
    console.error("Falta cargar js/config.js y js/api.js antes de registro.js");
    return;
  }
  const Api = window.SisPrestaApi;

  const LIMITS = {
    MONTO_MIN: 100,
    MONTO_MAX: 200000,
    TEA_MIN_PCT: 1,
    TEA_MAX_PCT: 200,
    PLAZO_MIN: 1,
    PLAZO_MAX: 120,
    UIT: 5200,
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
  function parsePositiveNumber(val) {
    const n = Number(val);
    return Number.isFinite(n) && n > 0 ? n : NaN;
  }

  const form = $("prestamo-form");
  const fechaEl = $("fecha-inicio");
  const montoEl = $("monto");
  const teaEl = $("tea");
  const plazoEl = $("plazo");
  const cronobody = $("cronograma-body");

  const alertaUIT = $("alerta-uit");
  const alertaPEP = $("alerta-pep");
  const btnGenerarDJ = $("btn-generar-dj");
  const djCard = $("dj-card");
  const btnConfirmar = $("btn-confirmar");
  const headerCliente = $("cliente-info-header");

  const url = new URL(window.location.href);
  const dni = url.searchParams.get("dni") || "";
  const nombre = url.searchParams.get("nombre") || "";
  const esPEP = url.searchParams.get("pep") === "1";

  // ===== Setear fecha actual y BLOQUEAR edición =====
  if (fechaEl) {
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
  }

  if (headerCliente) {
    headerCliente.textContent = dni
      ? `Cliente: ${nombre || "(sin nombre)"} — DNI ${dni}`
      : "(Cliente no reconocido; vuelva a Verificación)";
  }

  if (esPEP) show(alertaPEP);
  function evaluarUIT() {
    const m = parsePositiveNumber(montoEl?.value);
    if (!Number.isFinite(m)) return hide(alertaUIT);
    if (m > LIMITS.UIT) show(alertaUIT);
    else hide(alertaUIT);
  }

  function temFromTEA(teaDecimal) {
    return Math.pow(1 + teaDecimal, 1 / 12) - 1;
  }
  function cuotaFrances(monto, tem, n) {
    const i = tem;
    return monto * (i / (1 - Math.pow(1 + i, -n)));
  }
  function addMonths(isoDate, months) {
    const d = new Date(isoDate);
    const day = d.getDate();
    d.setMonth(d.getMonth() + months);
    if (d.getDate() < day) d.setDate(0); // ajuste fin de mes
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  }
  function generarCronogramaFrances({
    fechaInicioISO,
    monto,
    teaPct,
    plazoMeses,
  }) {
    const teaDec = teaPct / 100;
    const tem = temFromTEA(teaDec);
    const cuota = cuotaFrances(monto, tem, plazoMeses);
    let saldo = monto;
    const filas = [];
    for (let k = 1; k <= plazoMeses; k++) {
      const interes = saldo * tem;
      const amort = cuota - interes;
      saldo = Math.max(0, saldo - amort);
      filas.push({
        n: k,
        fecha: addMonths(fechaInicioISO, k),
        cuota: cuota,
        interes: interes,
        amort: amort,
        saldo: saldo,
      });
    }
    return { tem, cuota, filas };
  }

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
    crono.filas.forEach((f) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${f.n}</td>
        <td>${f.fecha}</td>
        <td>${fmtMoney(f.cuota)}</td>
        <td>${fmtMoney(f.interes)}</td>
        <td>${fmtMoney(f.amort)}</td>
        <td>${fmtMoney(f.saldo)}</td>
      `;
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
    const crono = generarCronogramaFrances({
      fechaInicioISO: v.fechaISO,
      monto: v.monto,
      teaPct: v.teaPct,
      plazoMeses: v.plazo,
    });
    pintarCronograma(crono);
    show(djCard);
    btnConfirmar && (btnConfirmar.disabled = false);
  });

  btnGenerarDJ?.addEventListener("click", () => {
    const m = parsePositiveNumber(montoEl?.value);
    const teaPct = parsePositiveNumber(teaEl?.value);
    const plazo = parsePositiveNumber(plazoEl?.value);
    const contenido = [
      "DECLARACIÓN JURADA - SISPRESTA",
      "-------------------------------",
      `Fecha de emisión: ${new Date().toLocaleString()}`,
      `Cliente: ${nombre || "(sin nombre)"} (DNI ${dni || "-"})`,
      `Monto solicitado: ${fmtMoney(m)}`,
      `TEA anual declarada: ${Number(teaPct || 0).toFixed(2)}%`,
      `Plazo: ${plazo || 0} meses`,
      esPEP
        ? "Condición: PEP (Debida diligencia ampliada)"
        : "Condición: No PEP",
      m > LIMITS.UIT
        ? `Alerta UIT: supera 1 UIT (${LIMITS.UIT})`
        : "Alerta UIT: no supera 1 UIT",
      "",
      "Declaro bajo juramento que la información proporcionada es verdadera.",
      "Firma digital: ____________________",
    ].join("\n");
    const blob = new Blob([contenido], { type: "text/plain;charset=utf-8" });
    const urlBlob = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = urlBlob;
    a.download = `DJ_${dni || "cliente"}.txt`;
    a.click();
    URL.revokeObjectURL(urlBlob);
  });

  btnConfirmar?.addEventListener("click", async () => {
    const v = validarCampos();
    if (!v.ok) {
      alert(
        "Datos inválidos. Genera primero el cronograma y verifica los campos."
      );
      return;
    }
    if (!dni) {
      alert(
        "No se recibió DNI en la URL. Regresa a la Verificación de Cliente."
      );
      return;
    }

    const payload = {
      clienteDni: dni,
      fechaInicio: v.fechaISO,
      monto: v.monto,
      tea: v.teaPct / 100,
      plazoMeses: v.plazo,
      metodo: "FRANCES",
    };

    try {
      const creado = await Api.crearPrestamo(payload);
      alert("Préstamo guardado correctamente.");
      window.location.href = `./prestamos.html?dni=${encodeURIComponent(dni)}`;
    } catch (e) {
      console.error(e);
      alert(e?.message || "No se pudo guardar el préstamo en el backend.");
    }
  });

  // Inicial
  evaluarUIT();
})();
