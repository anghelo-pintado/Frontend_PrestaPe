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
  const resPlazo = $("res-plazo");
  const resCuota = $("res-cuota");

  function renderPrestamo(prestamo) {
    if (!prestamo) return;
    hide(alertaNo);
    show(resultado);

    resCliente.textContent = prestamo.clienteNombre || "(sin nombre)";
    resDni.textContent = prestamo.clienteDni || "(sin DNI)";
    resMonto.textContent = fmtMoney(prestamo.monto || 0);
    resTea.textContent = ((prestamo.tea || 0) * 100).toFixed(2) + " %";
    resPlazo.textContent = prestamo.plazoMeses + " meses";
    resCuota.textContent = fmtMoney(prestamo.cuotaMensual || 0);

    cronobody.innerHTML = "";
    (prestamo.cronograma || []).forEach((fila, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${fila.fechaVencimiento || "-"}</td>
        <td>${fmtMoney(fila.montoCuota || 0)}</td>
      `;
      cronobody.appendChild(tr);
    });
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
      const lista = await Api.listarPrestamos({ dni });
      const prestamos = Array.isArray(lista)
        ? lista
        : Array.isArray(lista.content)
        ? lista.content
        : [];

      if (prestamos.length === 0) {
        show(alertaNo);
        return;
      }

      const prestamo = prestamos[0];
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

  btnExportar?.addEventListener("click", () => {
    window.print();
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
