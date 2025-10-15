(function () {
  if (!window.SisPrestaApi || !window.SisPrestaConfig) {
    console.error(
      "Falta cargar js/config.js y js/api.js antes de prestamos-logic.js"
    );
    return;
  }
  const Api = window.SisPrestaApi;

  const $ = (id) => document.getElementById(id);
  function show(el) {
    el && el.classList.remove("hidden");
  }
  function hide(el) {
    el && el.classList.add("hidden");
  }
  function fmtMoney(v) {
    const n = Number(v || 0);
    return "S/ " + n.toFixed(2);
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

  const form = $("filtro-form");
  const inputDni = $("filtro-dni");
  const resultado = $("resultado-busqueda");
  const alertaNo = $("mensaje-no-encontrado");
  const cronobody = $("res-cronograma-body");
  const btnExportar = $("btn-exportar-pdf");
  const btnEmail = $("btn-enviar-email");
  const emailInput = $("email-input");

  const resCliente = $("res-cliente");
  const resDni = $("res-dni");
  const resMonto = $("res-monto");
  const resTea = $("res-tea");
  const resFechaInicio = $("res-fecha-inicio");
  const resPlazo = $("res-plazo");
  const resCuota = $("res-cuota");
  const resPep = $("res-pep");

  function renderPrestamo(prestamo) {
    if (!prestamo) return;
    hide(alertaNo);
    show(resultado);

    resCliente.textContent = prestamo.clienteNombre || "(sin nombre)";
    resDni.textContent = prestamo.clienteDni || "(sin DNI)";
    resMonto.textContent = fmtMoney(prestamo.monto || 0);
    resTea.textContent = ((prestamo.tea || 0) * 100).toFixed(2) + " %";
    resFechaInicio.textContent =
      formatFecha(prestamo.fechaInicio) || "(sin fecha)";
    resPlazo.textContent = prestamo.plazoMeses + " meses";
    resCuota.textContent = fmtMoney(prestamo.cuotaMensual || 0);
    resPep.textContent = prestamo.esPep ? "Sí" : "No";

    cronobody.innerHTML = "";
    (prestamo.cronograma || []).forEach((fila, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${formatFecha(fila.fechaVencimiento) || "-"}</td>
        <td>${fmtMoney(fila.montoCuota || 0)}</td>
      `;
      cronobody.appendChild(tr);
    });
  }

  function mapBackendToUi(b) {
    if (!b) return null;
    const c = b.customer || {};
    const clienteNombre =
      c.fullName ||
      [c.firstName, c.firstLastName, c.secondLastName]
        .filter(Boolean)
        .join(" ") ||
      "(sin nombre)";
    const clienteDni = c.dni || "";

    return {
      clienteNombre,
      clienteDni,
      monto: b.principal ?? 0,
      tea: b.teaAnnual ?? b.tea ?? 0,
      fechaInicio: b.startDate || b.fechaInicio || "-",
      plazoMeses: b.months ?? 0,
      cuotaMensual: b.installmentAmount ?? b.cuotaMensual ?? 0,
      esPep: c.pep || false,
      cronograma: (b.schedule || b.cronograma || []).map((s) => ({
        fechaVencimiento: s.dueDate || s.fechaVencimiento || "-",
        montoCuota: s.amount ?? s.montoCuota ?? 0,
      })),
    };
  }

  async function buscarPrestamoPorDni(dni) {
    hide(alertaNo);
    hide(resultado);
    cronobody.innerHTML = "";

    if (!dni || dni.length < 8) {
      alert("Ingrese un DNI válido de 8 dígitos.");
      return;
    }

    try {
      const resp = await Api.getPrestamoById({ dni });

      // Normalizeamos la respuesta para manejar:
      // - array de préstamos
      // - objeto con .content (array)
      // - un único objeto préstamo
      let prestamos = [];
      if (!resp) {
        prestamos = [];
      } else if (Array.isArray(resp)) {
        prestamos = resp;
      } else if (Array.isArray(resp.content)) {
        prestamos = resp.content;
      } else if (typeof resp === "object") {
        prestamos = [resp]; // respuesta única: convertir a array
      } else {
        prestamos = [];
      }

      if (prestamos.length === 0) {
        show(alertaNo);
        return;
      }

      // Convertir cada préstamo del backend al modelo UI y tomar el primero
      const prestamosUi = prestamos.map((p) => mapBackendToUi(p) || p);
      const prestamo = prestamosUi[0];
      renderPrestamo(prestamo);
    } catch (e) {
      console.error(e);
      show(alertaNo);
    }
  }

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const dni = inputDni.value.trim();
    buscarPrestamoPorDni(dni);
  });

  btnExportar?.addEventListener("click", (e) => {
    e.preventDefault();
    if (
      window.GenerarPdf &&
      typeof window.GenerarPdf.exportCronogramaPdf === "function"
    ) {
      window.GenerarPdf.exportCronogramaPdf();
    } else {
      window.print(); // fallback
    }
  });

  btnEmail?.addEventListener("click", async () => {
    const email = emailInput?.value.trim();
    if (!email) {
      alert("Ingrese un correo electrónico válido.");
      return;
    }
    alert(`(Simulado) Se enviaría el cronograma al correo: ${email}`);
  });

  const params = new URLSearchParams(window.location.search);
  const dniAuto = params.get("dni");
  if (dniAuto) {
    inputDni.value = dniAuto;
    buscarPrestamoPorDni(dniAuto);
  }
})();
