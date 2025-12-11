// Obtener referencias seguras a las utilidades globales
// AGREGAMOS 'addMonths' A LA LISTA DE IMPORTACIONES
const _dateFnsAddDays = (window.dateFns && window.dateFns.addDays) || null;
const _dateFnsAddMonths = (window.dateFns && window.dateFns.addMonths) || null; // <--- NUEVO
const _dateFnsFormat = (window.dateFns && window.dateFns.format) || null;
const _Decimal = window.Decimal || window.decimal || null;

if (!_Decimal) {
  console.error(
    'decimal.js no está cargado. Añade <script src="https://cdn.jsdelivr.net/npm/decimal.js@10.6.0/decimal.min.js"></script> antes de calculadora.js'
  );
}
// Verificamos dateFns
if (!_dateFnsAddDays || !_dateFnsFormat) {
  console.warn(
    "date-fns no está completo en window.dateFns. Se usarán funciones locales."
  );
}

const Decimal = _Decimal;

// Constantes para IGV (18%) - igual que el backend
const IGV_RATE = new Decimal("0.18");
const DIVISOR_IGV = new Decimal("1.18");

// Función local para sumar días (fallback)
function localAddDays(date, days) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

// --- NUEVA FUNCIÓN LOCAL PARA SUMAR MESES (Fallback de Java plusMonths) ---
function localAddMonths(date, months) {
  const d = new Date(date.getTime());
  const originalDay = d.getDate();

  // Sumamos los meses
  d.setMonth(d.getMonth() + months);

  // CORRECCIÓN DE DESBORDAMIENTO:
  // Si era 31 de Enero y sumas 1 mes, JS te lleva al 2 o 3 de Marzo.
  // Java te lleva al 28/29 de Febrero. Queremos el comportamiento de Java.
  if (d.getDate() !== originalDay) {
    // Si el día cambió, significa que el mes destino tenía menos días.
    // Regresamos al último día del mes anterior.
    d.setDate(0);
  }
  return d;
}

// Función local para formatear fecha (fallback)
function localFormatYYYYMMDD(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Wrappers seguros
function safeAddDays(date, days) {
  return _dateFnsAddDays
    ? _dateFnsAddDays(date, days)
    : localAddDays(date, days);
}

// --- NUEVO WRAPPER SEGURO PARA MESES ---
function safeAddMonths(date, months) {
  return _dateFnsAddMonths
    ? _dateFnsAddMonths(date, months)
    : localAddMonths(date, months);
}

function safeFormatYYYYMMDD(date) {
  return _dateFnsFormat
    ? _dateFnsFormat(date, "yyyy-MM-dd")
    : localFormatYYYYMMDD(date);
}

window.PrestaCalculos = (function () {
  function temFromTEA(teaDecimal) {
    // TEM = (1 + TEA)^(1/12) - 1
    const base = new Decimal(1).plus(teaDecimal);
    const baseDouble = base.toNumber();
    const exponentDouble = 1.0 / 12.0;
    const monthlyFactor = new Decimal(Math.pow(baseDouble, exponentDouble));
    return monthlyFactor.minus(1);
  }

  function cuotaFrances(monto, tem, n) {
    if (tem.isZero()) {
      return monto.div(n);
    }
    const i = tem;
    const factorBase = new Decimal(1).plus(i);
    const factor = factorBase.pow(n); // (1+i)^n
    const numerator = i.times(factor);
    const denominator = factor.minus(1);
    return monto.times(numerator.div(denominator));
  }

  function generarCronograma({ fechaInicioISO, monto, teaPct, plazoMeses }) {
    if (!Decimal) {
      throw new Error("decimal.js no está disponible.");
    }

    Decimal.set({ precision: 18 });
    const D_monto = new Decimal(monto);
    const D_tea = new Decimal(teaPct).div(100);

    const D_tem = temFromTEA(D_tea);
    const D_cuotaFija = cuotaFrances(
      D_monto,
      D_tem,
      plazoMeses
    ).toDecimalPlaces(2);

    let D_saldo = D_monto;
    const filas = [];

    // Totales para resumen
    let totalInteres = new Decimal(0);
    let totalInteresBase = new Decimal(0);
    let totalIgv = new Decimal(0);
    let totalCapital = new Decimal(0);

    // Parsear fecha inicio una sola vez (asegurando hora 00:00 para evitar cambios de zona horaria)
    // Agregamos 'T00:00:00' si viene solo YYYY-MM-DD
    const fechaBaseStr = fechaInicioISO.includes("T")
      ? fechaInicioISO
      : `${fechaInicioISO}T00:00:00`;
    const fechaBase = new Date(fechaBaseStr);

    for (let k = 1; k <= plazoMeses; k++) {
      // 1. Calcular Interés Global del periodo
      const D_interesTotalMes = D_saldo.times(D_tem).toDecimalPlaces(2);

      // 2. Desglosar IGV
      const D_interesBase =
        D_interesTotalMes.div(DIVISOR_IGV).toDecimalPlaces(2);
      const D_igvMes =
        D_interesTotalMes.minus(D_interesBase).toDecimalPlaces(2);

      // 3. Calcular Capital
      let D_capitalMes =
        D_cuotaFija.minus(D_interesTotalMes).toDecimalPlaces(2);

      // 4. Actualizar Saldo
      D_saldo = D_saldo.minus(D_capitalMes).toDecimalPlaces(2);

      let D_cuotaActual = D_cuotaFija;

      // 5. Ajuste última cuota
      if (k === plazoMeses && !D_saldo.isZero()) {
        D_capitalMes = D_capitalMes.plus(D_saldo);
        D_cuotaActual = D_capitalMes.plus(D_interesTotalMes).toDecimalPlaces(2);
        D_saldo = new Decimal(0);
      }

      // Acumular totales
      totalInteres = totalInteres.plus(D_interesTotalMes);
      totalInteresBase = totalInteresBase.plus(D_interesBase);
      totalIgv = totalIgv.plus(D_igvMes);
      totalCapital = totalCapital.plus(D_capitalMes);

      // --- CORRECCIÓN DE FECHAS AQUÍ ---
      // Usamos safeAddMonths en lugar de multiplicar por 30 días
      const fechaVencimiento = safeAddMonths(fechaBase, k);

      filas.push({
        n: k,
        fecha: safeFormatYYYYMMDD(fechaVencimiento),
        cuota: D_cuotaActual.toNumber(),
        capital: D_capitalMes.toNumber(),
        interesBase: D_interesBase.toNumber(),
        igv: D_igvMes.toNumber(),
        interesTotal: D_interesTotalMes.toNumber(),
        saldo: D_saldo.toNumber(),
      });
    }

    return {
      filas,
      resumen: {
        tem: D_tem.times(100).toDecimalPlaces(6).toNumber(),
        cuotaFija: D_cuotaFija.toNumber(),
        totalCapital: totalCapital.toDecimalPlaces(2).toNumber(),
        totalInteresBase: totalInteresBase.toDecimalPlaces(2).toNumber(),
        totalIgv: totalIgv.toDecimalPlaces(2).toNumber(),
        totalInteres: totalInteres.toDecimalPlaces(2).toNumber(),
        totalPagar: D_monto.plus(totalInteres).toDecimalPlaces(2).toNumber(),
      },
    };
  }

  function generarCronogramaSimple({
    fechaInicioISO,
    monto,
    teaPct,
    plazoMeses,
  }) {
    const resultado = generarCronograma({
      fechaInicioISO,
      monto,
      teaPct,
      plazoMeses,
    });
    return {
      filas: resultado.filas.map((f) => ({
        n: f.n,
        fecha: f.fecha,
        cuota: f.cuota,
      })),
    };
  }

  return {
    generarCronograma,
    generarCronogramaSimple,
    temFromTEA,
    cuotaFrances,
  };
})();
