(function () {
  if (!window.SisPrestaApi) return;
  const Api = window.SisPrestaApi;

  // Elementos DOM
  const panelCerrada = document.getElementById("panel-caja-cerrada");
  const panelAbierta = document.getElementById("panel-caja-abierta");

  // Inputs y Labels
  const inpSaldoInicial = document.getElementById("input-saldo-inicial");
  const inpMontoFisico = document.getElementById("input-monto-fisico");

  const lblFecha = document.getElementById("lbl-fecha-apertura");
  const lblInicial = document.getElementById("lbl-saldo-inicial");
  const lblEfectivo = document.getElementById("lbl-ingreso-efectivo");
  const lblDigital = document.getElementById("lbl-ingreso-digital");

  // --- 1. Inicialización: Verificar Estado ---
  async function init() {
    try {
      const resumen = await Api.getCajaResumen();

      if (resumen && resumen.cajaId) {
        mostrarPanelAbierta(resumen);
        await cargarMovimientos();
      } else {
        mostrarPanelCerrada();
      }
    } catch (e) {
      console.log("Estado caja check:", e.message);
      mostrarPanelCerrada();
    }
  }

  function mostrarPanelCerrada() {
    panelCerrada.classList.remove("hidden");
    panelAbierta.classList.add("hidden");
  }

  function mostrarPanelAbierta(data) {
    panelCerrada.classList.add("hidden");
    panelAbierta.classList.remove("hidden");

    // Llenar datos
    lblFecha.textContent = new Date(data.fechaApertura).toLocaleString();
    lblInicial.textContent = fmtMoney(data.saldoInicial);
    lblEfectivo.textContent = fmtMoney(data.ingresosEfectivo);
    lblDigital.textContent = fmtMoney(data.ingresosDigital);

    // ✅ MOSTRAR REINGRESOS Y VUELTOS
    const lblReingresos = document.getElementById("lbl-total-reingresos");
    const lblVueltos = document.getElementById("lbl-total-vueltos");
    
    if (lblReingresos) {
      lblReingresos.textContent = fmtMoney(data.totalReingresos || 0);
    }
    
    if (lblVueltos) {
      lblVueltos.textContent = fmtMoney(data.totalVueltos || 0);
    }

    // Total esperado
    const totalEsperado = data.totalEsperadoEnCaja || 
      (data.saldoInicial + data.ingresosEfectivo + (data.totalReingresos || 0) - (data.totalVueltos || 0));
    document.getElementById("lbl-total-esperado").textContent =
      fmtMoney(totalEsperado);

    // Efectivo disponible
    const efectivoDisponible = data.efectivoDisponible || 0;
    const lblDisponible = document.getElementById("lbl-efectivo-disponible");
    if (lblDisponible) {
      lblDisponible.textContent = fmtMoney(efectivoDisponible);

      if (efectivoDisponible < 50) {
        lblDisponible.style.color = "red";
        lblDisponible.style.fontWeight = "bold";
      } else if (efectivoDisponible < 100) {
        lblDisponible.style.color = "orange";
      } else {
        lblDisponible.style.color = "green";
      }
    }

    inpMontoFisico.value = "";
  }

  // --- 2. Cargar Movimientos ---
  async function cargarMovimientos() {
    try {
      const movimientos = await Api.getMovimientosCaja();

      let totalReingresos = 0;
      let totalVueltos = 0;

      movimientos.forEach(m => {
        if (m.tipo === "REINGRESO") totalReingresos += m.monto;
        else if (m.tipo === "PAGO_VUELTO") totalVueltos += m.monto;
      });

      document.getElementById("lbl-total-reingresos").textContent = fmtMoney(totalReingresos);
      document.getElementById("lbl-total-vueltos").textContent = fmtMoney(totalVueltos);

      const tbody = document.getElementById("tabla-movimientos-body");
      tbody.innerHTML = "";

      if (movimientos.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="text-center text-muted">
              <i class="fa-solid fa-inbox"></i> Sin movimientos aún
            </td>
          </tr>`;
        return;
      }

      movimientos.forEach(m => {
        const tr = document.createElement("tr");

        let icono = "";
        let color = "";
        let tipoTexto = "";
        let signo = "+";

        // ✅ SWITCH COMPLETO CON SOPORTE PARA "PAGO"
        switch (m.tipo) {
          case "REINGRESO":
            icono = "fa-coins";
            color = "text-success";
            tipoTexto = "Reingreso";
            signo = "+";
            break;
          
          case "PAGO":
            icono = "fa-credit-card";
            color = "text-primary";
            tipoTexto = "Pago";
            signo = "+";
            break;
          
          case "PAGO_VUELTO":
            icono = "fa-hand-holding-dollar";
            color = "text-danger";
            tipoTexto = "Vuelto";
            signo = "-";
            break;
          
          case "RETIRO":
            icono = "fa-arrow-down";
            color = "text-warning";
            tipoTexto = "Retiro";
            signo = "-";
            break;
          
          case "AJUSTE":
            icono = "fa-wrench";
            color = "text-info";
            tipoTexto = "Ajuste";
            signo = "";
            break;
          
          default:
            icono = "fa-question-circle";
            color = "text-muted";
            tipoTexto = m.tipo;
            signo = "";
        }

        tr.innerHTML = `
          <td><i class="fa-solid ${icono} ${color}"></i> ${tipoTexto}</td>
          <td class="${color}">
            ${signo} ${fmtMoney(m.monto)}
          </td>
          <td class="text-sm">${m.concepto}</td>
          <td class="text-sm">${formatFecha(m.fecha)}</td>
          <td>${fmtMoney(m.saldoResultante)}</td>
        `;

        tbody.appendChild(tr);
      });

    } catch (e) {
      console.error("Error cargando movimientos:", e);
    }
  }

  function formatFecha(fecha) {
    const d = new Date(fecha);
    return d.toLocaleString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  // --- 3. Abrir Caja ---
  window.abrirCaja = async function () {
    const saldo = parseFloat(inpSaldoInicial.value);
    if (isNaN(saldo) || saldo < 0) {
      alert("Ingrese un saldo inicial válido.");
      return;
    }

    if (!confirm(`¿Desea abrir caja con un saldo inicial de ${fmtMoney(saldo)}?`))
      return;

    try {
      await Api.abrirCaja({ saldoInicial: saldo });
      alert("✅ Caja abierta correctamente.");
      init();
    } catch (e) {
      alert("Error al abrir: " + e.message);
    }
  };

  // --- 4. Cerrar Caja ---
  window.procesarCierre = async function () {
    const fisico = parseFloat(inpMontoFisico.value);
    const obs = document.getElementById("input-observaciones").value.trim();

    if (isNaN(fisico) || fisico < 0) {
      alert("Por favor, cuente el dinero e ingrese el monto total en efectivo.");
      return;
    }

    const btn = document.querySelector(".btn-danger");
    const txtOriginal = btn.innerHTML;

    const enviarCierre = async (forzar) => {
      btn.disabled = true;
      btn.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...';

      try {
        await Api.cerrarCaja({
          montoFisico: fisico,
          confirmarDescuadre: forzar,
          observaciones: obs,
        });

        alert("✅ ¡Caja cuadrada y cerrada con éxito!");
        window.location.reload();
      } catch (e) {
        const msj = e.message || "";

        if (
          msj.includes("DESCUADRE") ||
          msj.includes("sobrante") ||
          msj.includes("faltante")
        ) {
          const deseaForzar = confirm(
            "⛔ REPORTE DE ARQUEO:\n\n" +
              msj +
              "\n\n-----------------------------------\n" +
              "¿Desea registrar esta diferencia como INCIDENCIA y cerrar de todas formas?"
          );

          if (deseaForzar) {
            if (!obs) {
              alert(
                "⚠️ Debe ingresar una justificación en el campo 'Observaciones' para aprobar el descuadre."
              );
            } else {
              await enviarCierre(true);
              return;
            }
          }
        } else {
          alert("Error: " + msj);
        }
      } finally {
        btn.disabled = false;
        btn.innerHTML = txtOriginal;
      }
    };

    await enviarCierre(false);
  };

  // ================
  // 🟢 REINGRESO MANUAL
  // ================
  window.abrirModalReingresoManual = function () {
    document.getElementById("input-monto-reingreso").value = "";
    document.getElementById("input-observacion-reingreso").value = "";

    const infoBox = document.querySelector("#modal-reingreso .info-box");
    if (infoBox) infoBox.style.display = "none";

    document.getElementById("modal-reingreso").classList.remove("hidden");
  };

  window.cerrarModalReingreso = function () {
    document.getElementById("modal-reingreso").classList.add("hidden");

    const infoBox = document.querySelector("#modal-reingreso .info-box");
    if (infoBox) infoBox.style.display = "block";
  };

  window.confirmarReingreso = async function () {
    const monto = parseFloat(document.getElementById("input-monto-reingreso").value);
    const concepto = document.getElementById("input-observacion-reingreso").value.trim();

    if (!monto || monto <= 0) {
      alert("Ingrese un monto válido mayor a 0");
      return;
    }
    if (!concepto) {
      alert("Debe ingresar una observación explicando el motivo del reingreso");
      return;
    }

    const btn = document.getElementById("btn-confirmar-reingreso");
    const txtOriginal = btn.innerHTML;

    try {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';

      const response = await Api.registrarReingreso({
        monto: monto,
        concepto: concepto,
        usuario: "Cajero"
      });

      console.log("✅ Reingreso registrado:", response);

      alert(`✅ Reingreso registrado exitosamente\nNuevo efectivo disponible: ${fmtMoney(response.efectivoDisponible)}`);
      cerrarModalReingreso();

      // Recargar resumen y movimientos
      await init();
      
    } catch (e) {
      console.error("Error al registrar reingreso:", e);
      alert("❌ Error al registrar reingreso: " + e.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = txtOriginal;
    }
  };

  // Actualizar efectivo disponible cada 30s
  setInterval(async () => {
    try {
      const resumen = await Api.getCajaResumen();
      if (resumen && resumen.cajaId) {
        const lblDisponible = document.getElementById("lbl-efectivo-disponible");
        if (lblDisponible) {
          const efectivo = resumen.efectivoDisponible || 0;
          lblDisponible.textContent = fmtMoney(efectivo);

          if (efectivo < 50) lblDisponible.style.color = "red";
          else if (efectivo < 100) lblDisponible.style.color = "orange";
          else lblDisponible.style.color = "green";
        }
      }
    } catch (e) {
      console.debug("Error actualizando efectivo disponible:", e);
    }
  }, 30000);

  // Utilidad
  function fmtMoney(n) {
    return "S/ " + Number(n).toFixed(2);
  }

  // Arrancar
  init();
})();