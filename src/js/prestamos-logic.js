(function () {
  if (!window.SisPrestaApi || !window.SisPrestaConfig) {
    console.error(
      "Falta cargar js/config.js y js/api.js antes de prestamos-logic.js"
    );
    return;
  }
  const Api = window.SisPrestaApi;

  // Inicializa Mercado Pago (Asegúrate de poner tu Public Key real)
  const mp = new MercadoPago("APP_USR-1b053ced-9c7e-4bf7-ba7f-aafcbf20aa24", {
    locale: "es-PE",
  });

  function $(id) {
    return document.getElementById(id);
  }

  function show(el) {
    el && el.classList.remove("hidden");
  }
  function hide(el) {
    el && el.classList.add("hidden");
  }

  function fmtMoney(n) {
    return "S/ " + Number(n).toFixed(2);
  }

  function formatFecha(input) {
    if (!input) return "-";
    const s = String(input).trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    let d;
    if (iso) d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00`);
    else d = new Date(s);
    if (!(d instanceof Date) || isNaN(d)) return s;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  // --- VARIABLES GLOBALES DEL MODAL ---
  let cuotaActual = null;
  let deudaTotalPrestamo = 0;
  let metodoSeleccionado = "EFECTIVO";

  // --- 1. CONFIGURACIÓN DE MERCADO PAGO ---
  window.iniciarPagoMP = async function (cuotaId, monto, btnId) {
    const btn = document.getElementById(btnId);
    const originalContent = btn.innerHTML;

    try {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

      const data = await Api.crearPreferenciaMP(cuotaId, monto);

      if (!data || !data.preferenceId) {
        throw new Error("No se recibió el ID de preferencia");
      }

      mp.checkout({
        preference: {
          id: data.preferenceId,
        },
        autoOpen: true,
      });
    } catch (error) {
      console.error("Error en pago:", error);
      alert(
        "Error al iniciar el pago: " + (error.message || "Intente nuevamente")
      );
    } finally {
      setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = originalContent;
      }, 3000);
    }
  };

  // --- 2. LÓGICA DEL MODAL DE PAGO ---

  window.abrirModalPago = function (fila) {
    cuotaActual = fila; // 'fila' ya viene con moraEstimada y totalConMora desde el mapping

    // Resetear UI
    seleccionarMetodo("EFECTIVO");
    document.getElementById("input-notas").value = "";
    document.getElementById("input-monto-recibido").value = "";
    document.getElementById("texto-vuelto").textContent = "S/ 0.00";
    document.getElementById("info-redondeo").classList.add("hidden");

    // Llenar Datos Básicos
    document.getElementById(
      "modal-title"
    ).textContent = `Pagar Cuota #${fila.num}`;
    document.getElementById("modal-fecha").textContent = formatFecha(
      fila.fechaVencimiento
    );

    // --- LÓGICA DE VISUALIZACIÓN DE MORA ---
    const divMora = document.getElementById("modal-mora-container");
    const spanMora = document.getElementById("modal-mora");
    const spanSaldo = document.getElementById("modal-saldo");

    if (fila.tieneMora) {
      // Caso: Vencido -> Mostramos desglose
      spanSaldo.textContent = fmtMoney(fila.montoRestante) + " (Capital)";
      spanMora.textContent = "+ " + fmtMoney(fila.moraEstimada);
      divMora.classList.remove("hidden");
    } else {
      // Caso: Al día -> Solo saldo
      spanSaldo.textContent = fmtMoney(fila.montoRestante);
      divMora.classList.add("hidden");
    }

    // Configurar input monto
    // Por defecto sugerimos pagar TODO (Capital + Mora si existe)
    const montoSugerido = fila.totalConMora || fila.montoRestante;
    const inputPagar = document.getElementById("input-monto-pagar");
    inputPagar.value = montoSugerido.toFixed(2);

    // Permitir pagar más (adelanto) limitándolo a la deuda total del préstamo
    // Nota: deudaTotalPrestamo es un aproximado calculado en render
    inputPagar.max = (deudaTotalPrestamo + (fila.moraEstimada || 0)).toFixed(2);

    // Ejecutar cálculo inicial para mostrar mensajes
    actualizarCalculosUI();

    // Mostrar modal
    document.getElementById("modal-pago").classList.remove("hidden");
  };

  window.cerrarModalPago = function () {
    document.getElementById("modal-pago").classList.add("hidden");
    cuotaActual = null;
  };

  window.seleccionarMetodo = function (metodo) {
    metodoSeleccionado = metodo;

    document
      .getElementById("card-efectivo")
      .classList.toggle("selected", metodo === "EFECTIVO");
    document
      .getElementById("card-mp")
      .classList.toggle("selected", metodo === "MERCADO_PAGO");

    const secEfectivo = document.getElementById("seccion-efectivo");
    const secMp = document.getElementById("seccion-mp");
    const btn = document.getElementById("btn-confirmar-pago");

    if (metodo === "EFECTIVO") {
      secEfectivo.classList.remove("hidden");
      secMp.classList.add("hidden");
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Confirmar Pago';
      btn.className = "btn btn-primary";
      // Actualizar cálculos de vuelto
      actualizarCalculosUI();
    } else {
      secEfectivo.classList.add("hidden");
      secMp.classList.remove("hidden");
      btn.innerHTML =
        'Pagar con Mercado Pago <i class="fa-solid fa-arrow-right"></i>';
      btn.className = "btn btn-info";
    }
  };

  window.fijarMonto = function (tipo) {
    if (!cuotaActual) return;
    const input = document.getElementById("input-monto-pagar");

    if (tipo === "CUOTA") {
      // Fijar el TOTAL EXIGIBLE (Capital + Mora)
      const total = cuotaActual.totalConMora || cuotaActual.montoRestante;
      input.value = total.toFixed(2);
    } else if (tipo === "TOTAL") {
      input.value = deudaTotalPrestamo.toFixed(2);
    }
    input.dispatchEvent(new Event("input"));
  };

  // --- 3. CALCULADORA UI (Vuelto + Aviso Mora) ---
  function actualizarCalculosUI() {
    const inputPagar = document.getElementById("input-monto-pagar");
    const inputRecibido = document.getElementById("input-monto-recibido");

    const montoPagar = parseFloat(inputPagar.value) || 0;

    // A. LÓGICA DE AVISO DE MORA (El "Truco")
    // Buscamos si ya existe el aviso, si no, lo creamos
    let avisoMora = document.getElementById("aviso-mora-dinamico");
    if (!avisoMora) {
      avisoMora = document.createElement("div");
      avisoMora.id = "aviso-mora-dinamico";
      avisoMora.className = "mt-2 text-sm text-center font-weight-bold";
      inputPagar.parentNode.appendChild(avisoMora); // Insertar debajo del input
    }

    if (cuotaActual && cuotaActual.tieneMora) {
      // Tolerancia pequeña para decimales
      const deudaTotal = cuotaActual.totalConMora;

      if (montoPagar < deudaTotal - 0.02) {
        // Pago Parcial -> Mora Perdonada
        avisoMora.innerHTML =
          '<i class="fa-solid fa-gift text-success"></i> Pago Parcial: <strong>¡Mora Perdonada!</strong>';
        avisoMora.className = "mt-2 text-sm text-center text-success";
      } else {
        // Pago Total -> Cobra Mora
        avisoMora.innerHTML = `<i class="fa-solid fa-circle-exclamation text-warning"></i> Incluye Mora de ${fmtMoney(
          cuotaActual.moraEstimada
        )}`;
        avisoMora.className = "mt-2 text-sm text-center text-warning";
      }
    } else {
      avisoMora.textContent = "";
    }

    // B. LÓGICA DE VUELTO (Solo Efectivo)
    if (metodoSeleccionado !== "EFECTIVO") return;

    const montoRecibido = parseFloat(inputRecibido.value) || 0;
    const montoRedondeado = Math.round(montoPagar * 10) / 10; // Redondeo 0.10
    const diferenciaRedondeo = montoRedondeado - montoPagar;

    const infoRedondeo = document.getElementById("info-redondeo");
    const valRedondeo = document.getElementById("val-redondeo");

    if (Math.abs(diferenciaRedondeo) > 0.001) {
      infoRedondeo.classList.remove("hidden");
      valRedondeo.textContent =
        (diferenciaRedondeo > 0 ? "+" : "") + diferenciaRedondeo.toFixed(2);
    } else {
      infoRedondeo.classList.add("hidden");
    }

    const vuelto = montoRecibido - montoRedondeado;
    const elVuelto = document.getElementById("texto-vuelto");

    if (vuelto >= 0) {
      elVuelto.textContent = fmtMoney(vuelto);
      elVuelto.style.color = "green";
    } else {
      elVuelto.textContent = "Faltan " + fmtMoney(Math.abs(vuelto));
      elVuelto.style.color = "red";
    }
  }

  // Listeners
  document
    .getElementById("input-monto-pagar")
    .addEventListener("input", actualizarCalculosUI);
  document
    .getElementById("input-monto-recibido")
    .addEventListener("input", actualizarCalculosUI);

  // --- 4. PROCESAR PAGO ---
  window.procesarPago = async function () {
    const btn = document.getElementById("btn-confirmar-pago");
    const originalText = btn.innerHTML;

    try {
      const montoPagar = parseFloat(
        document.getElementById("input-monto-pagar").value
      );
      const notas = document.getElementById("input-notas").value;

      if (!montoPagar || montoPagar <= 0) throw new Error("Monto inválido.");

      btn.disabled = true;
      btn.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';

      if (metodoSeleccionado === "EFECTIVO") {
        const montoRecibido = parseFloat(
          document.getElementById("input-monto-recibido").value
        );
        const cobroReal = Math.round(montoPagar * 10) / 10;

        if (!montoRecibido || montoRecibido < cobroReal) {
          throw new Error(
            `El monto recibido es insuficiente. Mínimo: ${cobroReal.toFixed(2)}`
          );
        }

        const payload = {
          cuotaId: cuotaActual.id,
          montoPagado: montoPagar,
          montoRecibido: montoRecibido,
          metodoPago: "EFECTIVO",
          observaciones: notas,
        };

        await Api.registrarPago(payload);
        alert("¡Pago registrado correctamente!");
        cerrarModalPago();

        // Recargar tabla
        const docId = document.getElementById("filtro-documentId").value;
        if (docId) document.querySelector("#filtro-form button").click();
      } else {
        // MERCADO PAGO
        // Usamos el montoPagar tal cual. El backend decide si divide en items (capital+mora)
        const data = await Api.crearPreferenciaMP(cuotaActual.id, montoPagar);

        if (data && data.preferenceId) {
          mp.checkout({
            preference: { id: data.preferenceId },
            autoOpen: true,
          });
          cerrarModalPago();
        } else {
          throw new Error("No se pudo iniciar Mercado Pago.");
        }
      }
    } catch (e) {
      console.error(e);
      alert(e.message || "Error al procesar el pago.");
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  };

  // --- 5. LOGICA DE RENDERIZADO Y MAPEO ---

  // Aquí mapeamos los NUEVOS campos que vienen del Backend (DTO actualizado)
  function mapBackendToUi(b) {
    if (!b) return null;
    const c = b.customer || {};
    const clienteNombre =
      c.fullName ||
      [c.firstName, c.firstLastName, c.secondLastName]
        .filter(Boolean)
        .join(" ") ||
      "(sin nombre)";
    const clienteDocumentId = c.documentId || "";

    return {
      clienteNombre,
      clienteDocumentId,
      monto: b.principal ?? 0,
      tea: b.teaAnnual ?? b.tea ?? 0,
      fechaInicio: b.startDate || b.fechaInicio || "-",
      plazoMeses: b.months ?? 0,
      cuotaMensual: b.installmentAmount ?? b.cuotaMensual ?? 0,
      esPep: c.pep || false,
      cronograma: (b.schedule || b.cronograma || []).map((s) => ({
        id: s.id,
        num: s.num || s.n,
        fechaVencimiento: s.dueDate || s.fechaVencimiento || "-",
        montoCuota: s.amount ?? s.montoCuota ?? 0,
        montoPagado: s.amountPaid ?? s.montoPagado ?? 0,
        montoRestante: s.balance ?? s.montoRestante ?? 0,
        estado: s.state || s.estado,

        // --- NUEVOS CAMPOS MORA ---
        moraEstimada: s.moraEstimada || 0,
        totalConMora: s.totalConMora || (s.balance ?? 0),
        tieneMora: s.tieneMora || false,
      })),
    };
  }

  window.renderPrestamo = function (prestamo) {
    if (!prestamo) return;
    hide(alertaNo);
    show(resultado);

    resCliente.textContent = prestamo.clienteNombre || "(sin nombre)";
    resDni.textContent = prestamo.clienteDocumentId || "(sin DNI)";
    resMonto.textContent = fmtMoney(prestamo.monto || 0);
    resTea.textContent = ((prestamo.tea || 0) * 100).toFixed(2) + " %";
    resFechaInicio.textContent = formatFecha(prestamo.fechaInicio) || "-";
    resPlazo.textContent = prestamo.plazoMeses + " meses";
    resCuota.textContent = fmtMoney(prestamo.cuotaMensual || 0);
    resPep.textContent = prestamo.esPep ? "Sí" : "No";

    deudaTotalPrestamo = prestamo.cronograma.reduce(
      (acc, c) => acc + (c.montoRestante || 0),
      0
    );

    const tbody = document.getElementById("res-cronograma-body");
    tbody.innerHTML = "";

    (prestamo.cronograma || []).forEach((fila, i) => {
      const tr = document.createElement("tr");

      let accionHtml = "-";
      let comprobanteHtml = "-";

      if (fila.estado !== "PAGADO") {
        // Pasamos todo el objeto 'fila' (con los datos de mora) al botón
        accionHtml = `
            <button class="btn btn-sm btn-primary btn-pagar-row" 
                    data-cuota='${JSON.stringify(fila)}'>
              <i class="fa-solid fa-hand-holding-dollar"></i> Pagar
            </button>
          `;
      } else {
        accionHtml = '<span class="badge-success">Pagado</span>';
      }

      if ((fila.montoPagado || 0) > 0) {
        comprobanteHtml = `
          <button class="btn btn-sm btn-secondary btn-comprobantes"
                  data-cuota-id="${fila.id}">
            <i class="fa-solid fa-file-invoice"></i> Comprobantes
          </button>
        `;
      }

      // Si tiene mora, mostramos el estado en rojo o con alerta
      let estadoStr = fila.estado || "-";
      if (fila.tieneMora) {
        estadoStr += ` <span style="color:red; font-size: 0.8em;">(Mora)</span>`;
      }

      tr.innerHTML = `
        <td>${fila.num || i + 1}</td>
        <td>${formatFecha(fila.fechaVencimiento) || "-"}</td>
        <td>${fmtMoney(fila.montoCuota || 0)}</td>
        <td>${fmtMoney(fila.montoPagado || 0)}</td>
        <td>${fmtMoney(fila.montoRestante || 0)}</td>
        <td>${estadoStr}</td>
        <td style="text-align: center;">${accionHtml}</td>
        <td style="text-align: center;">${comprobanteHtml}</td>
      `;
      tbody.appendChild(tr);
    });

    document.querySelectorAll(".btn-pagar-row").forEach((btn) => {
      btn.addEventListener("click", function () {
        const data = JSON.parse(this.getAttribute("data-cuota"));
        abrirModalPago(data);
      });
    });
  };

  // --- 6. FUNCIONES DE BÚSQUEDA Y AUXILIARES ---

  // (Sin cambios mayores respecto a tu código, solo reordenamiento)
  async function buscarPrestamoPorDocumentId(documentId) {
    hide(alertaNo);
    hide(resultado);
    cronobody.innerHTML = "";

    if (!documentId || documentId.length < 8 || documentId.length > 11) {
      alert("Ingrese un DNI/RUC válido de 8 a 11 dígitos.");
      return;
    }

    try {
      const resp = await Api.getPrestamoById({ documentId });
      let prestamos = [];
      if (!resp) prestamos = [];
      else if (Array.isArray(resp)) prestamos = resp;
      else if (Array.isArray(resp.content)) prestamos = resp.content;
      else if (typeof resp === "object") prestamos = [resp];

      if (prestamos.length === 0) {
        show(alertaNo);
        return;
      }

      const prestamosUi = prestamos.map((p) => mapBackendToUi(p) || p);
      const prestamo = prestamosUi[0];
      renderPrestamo(prestamo);
    } catch (e) {
      console.error(e);
      show(alertaNo);
    }
  }

  // --- Event Listeners Globales ---
  const form = $("filtro-form");
  const inputDocumentId = $("filtro-documentId");
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

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const documentId = inputDocumentId.value.trim();
    buscarPrestamoPorDocumentId(documentId);
  });

  window.mostrarModalComprobantes = function (lista) {
    const cont = document.getElementById("lista-comprobantes");
    cont.innerHTML = "";
    if (!lista || lista.length === 0) {
      cont.innerHTML = "<p>No existen comprobantes.</p>";
    } else {
      lista.forEach((c) => {
        const div = document.createElement("div");
        div.className = "comprobante-item";
        div.innerHTML = `
            <div>
               <strong>${c.tipo === "01" ? "Factura" : "Boleta"}</strong><br>
               ${c.serie}-${String(c.correlativo).padStart(6, "0")}<br>
               Fecha: ${c.fecha}
            </div>
            <button class="btn btn-sm btn-primary" onclick="window.open('${
              c.pdfUrl
            }', '_blank')">
               <i class="fa-solid fa-file-pdf"></i> Ver PDF
            </button>
        `;
        cont.appendChild(div);
      });
    }
    document.getElementById("modal-comprobantes").classList.remove("hidden");
  };

  window.cerrarModalComprobantes = function () {
    document.getElementById("modal-comprobantes").classList.add("hidden");
  };

  // Delegación de eventos Comprobantes
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-comprobantes");
    if (!btn) return;
    const cuotaId = btn.getAttribute("data-cuota-id");
    try {
      const comprobantes = await Api.getComprobantesPorCuota(cuotaId);
      mostrarModalComprobantes(comprobantes);
    } catch (e) {
      console.error(e);
      alert("Error obteniendo comprobantes.");
    }
  });

  btnExportar?.addEventListener("click", (e) => {
    e.preventDefault();
    if (window.GenerarPdf && window.GenerarPdf.exportCronogramaPdf) {
      window.GenerarPdf.exportCronogramaPdf();
    } else {
      window.print();
    }
  });

  // Auto-run si hay params en URL
  const params = new URLSearchParams(window.location.search);
  const documentIdAuto = params.get("documentId") || params.get("dni");
  if (documentIdAuto) {
    inputDocumentId.value = documentIdAuto;
    buscarPrestamoPorDocumentId(documentIdAuto);
  }
})();
