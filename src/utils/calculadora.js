// Obtener referencias seguras a las utilidades globales (no usar "addDays"/"format" directamente aquí)
const _dateFnsAddDays = (window.dateFns && window.dateFns.addDays) || null;
const _dateFnsFormat = (window.dateFns && window.dateFns.format) || null;
const _Decimal = window.Decimal || window.decimal || null;

if (!_Decimal) {
  console.error(
    'decimal.js no está cargado. Añade <script src="https://cdn.jsdelivr.net/npm/decimal.js@10.6.0/decimal.min.js"></script> antes de calculadora.js'
  );
}
if (!_dateFnsAddDays || !_dateFnsFormat) {
  // Solo aviso — no obligatorio porque tenemos funciones alternativas locales
  console.warn(
    "date-fns no está cargado en window.dateFns. Se usarán funciones locales de fecha."
  );
}

// Usar Decimal global
const Decimal = _Decimal;
if (!Decimal) {
  console.error(
    'decimal.js no está cargado. Añade <script src="https://cdn.jsdelivr.net/npm/decimal.js@10.6.0/decimal.min.js"></script> antes de calculadora.js'
  );
}

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
    const base = new Decimal(1).plus(teaDecimal);
    const exponent = new Decimal(1).div(12);
    const monthlyFactor = new Decimal(
      Math.pow(base.toNumber(), exponent.toNumber())
    );
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

    for (let k = 1; k <= plazoMeses; k++) {
      const D_interes = D_saldo.times(D_tem).toDecimalPlaces(2);
      const D_amort = D_cuotaFija.minus(D_interes);
      const D_cuotaActual = D_cuotaFija;

      D_saldo = D_saldo.minus(D_amort);
      // Fecha de vencimiento: cada 30 días desde la fechaInicioISO
      const fechaVencimiento = safeAddDays(
        new Date(`${fechaInicioISO}T00:00:00`),
        30 * k
      );

      filas.push({
        n: k,
        fecha: safeFormatYYYYMMDD(fechaVencimiento),
        cuota: D_cuotaActual.toNumber(),
      });
    }
    return { filas };
  }

  return {
    generarCronograma,
  };
})();
