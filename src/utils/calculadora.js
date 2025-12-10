// Obtener referencias seguras a las utilidades globales
const _dateFnsAddDays = (window.dateFns && window.dateFns.addDays) || null;
const _dateFnsFormat = (window.dateFns && window.dateFns.format) || null;
const _Decimal = window.Decimal || window.decimal || null;

if (!_Decimal) {
  console.error(
    'decimal.js no está cargado. Añade <script src="https://cdn.jsdelivr.net/npm/decimal.js@10.6.0/decimal.min.js"></script> antes de calculadora.js'
  );
}
if (!_dateFnsAddDays || !_dateFnsFormat) {
  console.warn(
    "date-fns no está cargado en window.dateFns. Se usarán funciones locales de fecha."
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

// Función local para formatear fecha (fallback)
function localFormatYYYYMMDD(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Wrappers seguros que prefieren date-fns si está disponible
function safeAddDays(date, days) {
  return _dateFnsAddDays
    ? _dateFnsAddDays(date, days)
    : localAddDays(date, days);
}
function safeFormatYYYYMMDD(date) {
  return _dateFnsFormat
    ? _dateFnsFormat(date, "yyyy-MM-dd")
    : localFormatYYYYMMDD(date);
}

window.PrestaCalculos = (function () {
  function temFromTEA(teaDecimal) {
    // TEM = (1 + TEA)^(1/12) - 1
    // Usar Math.pow para coincidir exactamente con el backend Java
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

    for (let k = 1; k <= plazoMeses; k++) {
      // 1. Calcular Interés Global del periodo (Saldo * Tasa)
      const D_interesTotalMes = D_saldo.times(D_tem).toDecimalPlaces(2);

      // 2. Desglosar IGV del Interés (SUNAT)
      const D_interesBase =
        D_interesTotalMes.div(DIVISOR_IGV).toDecimalPlaces(2);
      const D_igvMes =
        D_interesTotalMes.minus(D_interesBase).toDecimalPlaces(2);

      // 3. Calcular Amortización de Capital
      let D_capitalMes =
        D_cuotaFija.minus(D_interesTotalMes).toDecimalPlaces(2);

      // 4. Actualizar Saldo Deudor
      D_saldo = D_saldo.minus(D_capitalMes).toDecimalPlaces(2);

      let D_cuotaActual = D_cuotaFija;

      // 5. Ajuste última cuota (igual que el backend)
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

      // Fecha de vencimiento: cada 30 días desde la fechaInicioISO
      const fechaVencimiento = safeAddDays(
        new Date(`${fechaInicioISO}T00:00:00`),
        30 * k
      );

      filas.push({
        n: k,
        fecha: safeFormatYYYYMMDD(fechaVencimiento),
        cuota: D_cuotaActual.toNumber(),
        capital: D_capitalMes.toNumber(), // Principal (Inafecto)
        interesBase: D_interesBase.toNumber(), // Interés (Gravado)
        igv: D_igvMes.toNumber(), // IGV
        interesTotal: D_interesTotalMes.toNumber(),
        saldo: D_saldo.toNumber(),
      });
    }

    return {
      filas,
      resumen: {
        tem: D_tem.times(100).toDecimalPlaces(6).toNumber(), // TEM en %
        cuotaFija: D_cuotaFija.toNumber(),
        totalCapital: totalCapital.toDecimalPlaces(2).toNumber(),
        totalInteresBase: totalInteresBase.toDecimalPlaces(2).toNumber(),
        totalIgv: totalIgv.toDecimalPlaces(2).toNumber(),
        totalInteres: totalInteres.toDecimalPlaces(2).toNumber(),
        totalPagar: D_monto.plus(totalInteres).toDecimalPlaces(2).toNumber(),
      },
    };
  }

  // Función simple que solo devuelve cuota y fechas (compatibilidad con versión anterior)
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
    generarCronogramaSimple, // Mantiene compatibilidad con código existente
    temFromTEA,
    cuotaFrances,
  };
})();
