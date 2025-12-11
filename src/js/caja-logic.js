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
      // Intentamos obtener resumen.
      // Si da error 400/500 o dice "No hay caja", mostramos panel cerrada.
      const resumen = await Api.getCajaResumen(); // Necesitas agregar esto a api.js

      if (resumen && resumen.cajaId) {
        mostrarPanelAbierta(resumen);
      } else {
        mostrarPanelCerrada();
      }
    } catch (e) {
      // Si el backend lanza error "No hay caja abierta", caemos aquí
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
    lblEfectivo.textContent = data.ingresosEfectivo;
    lblDigital.textContent = fmtMoney(data.ingresosDigital);

    // ✅ NUEVO: Calcular y mostrar total esperado
    const totalEsperado = data.saldoInicial + data.ingresosEfectivo;
    document.getElementById("lbl-total-esperado").textContent =
      fmtMoney(totalEsperado);

    // Limpiar input de cierre
    inpMontoFisico.value = "";
  }

  // --- 2. Abrir Caja ---
  window.abrirCaja = async function () {
    const saldo = parseFloat(inpSaldoInicial.value);
    if (isNaN(saldo) || saldo < 0) {
      alert("Ingrese un saldo inicial válido.");
      return;
    }

    if (
      !confirm(`¿Desea abrir caja con un saldo inicial de ${fmtMoney(saldo)}?`)
    )
      return;

    try {
      await Api.abrirCaja({ saldoInicial: saldo });
      alert("✅ Caja abierta correctamente.");
      init(); // Recargar estado
    } catch (e) {
      alert("Error al abrir: " + e.message);
    }
  };

  // --- 3. Cerrar Caja (El Cuadre) ---
  window.procesarCierre = async function () {
    const fisico = parseFloat(inpMontoFisico.value);
    // Capturamos la observación que agregamos al HTML
    const obs = document.getElementById("input-observaciones").value.trim();

    if (isNaN(fisico) || fisico < 0) {
      alert(
        "Por favor, cuente el dinero e ingrese el monto total en efectivo."
      );
      return;
    }

    const btn = document.querySelector(".btn-danger");
    const txtOriginal = btn.innerHTML;

    // Función auxiliar para llamar a la API
    const enviarCierre = async (forzar) => {
      btn.disabled = true;
      btn.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...';

      try {
        // Enviamos los nuevos parámetros al backend
        await Api.cerrarCaja({
          montoFisico: fisico,
          confirmarDescuadre: forzar, // true o false
          observaciones: obs,
        });

        // Si pasa:
        alert("✅ ¡Caja cuadrada y cerrada con éxito!");
        window.location.reload();
      } catch (e) {
        const msj = e.message || "";

        // DETECTAMOS SI ES EL ERROR DE DESCUADRE (Busca palabras clave de tu backend)
        if (
          msj.includes("DESCUADRE") ||
          msj.includes("sobrante") ||
          msj.includes("faltante")
        ) {
          // Le damos la opción al usuario de "salvar" el examen
          const deseaForzar = confirm(
            "⛔ REPORTE DE ARQUEO:\n\n" +
              msj +
              "\n\n-----------------------------------\n" +
              "¿Desea registrar esta diferencia como INCIDENCIA y cerrar de todas formas?"
          );

          if (deseaForzar) {
            // REINTENTO AUTOMÁTICO con el flag activado
            if (!obs) {
              alert(
                "⚠️ Debe ingresar una justificación en el campo 'Observaciones' para aprobar el descuadre."
              );
            } else {
              await enviarCierre(true); // Llamada recursiva con true
              return; // Salimos para no reactivar botón doble vez
            }
          }
        } else {
          // Otro error (ej. servidor caído)
          alert("Error: " + msj);
        }
      } finally {
        btn.disabled = false;
        btn.innerHTML = txtOriginal;
      }
    };

    // Primera llamada: Intentar cerrar sin forzar (false)
    await enviarCierre(false);
  };

  function fmtMoney(n) {
    return "S/ " + Number(n).toFixed(2);
  }

  // Arrancar
  init();
})();
