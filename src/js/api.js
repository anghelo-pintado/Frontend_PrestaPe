(function (global) {
  if (!global.SisPrestaConfig) {
    console.error(
      "SisPrestaConfig no está cargado. Incluye js/config.js antes."
    );
    return;
  }
  const CFG = global.SisPrestaConfig;

  function getToken() {
    try {
      if (
        global.SisPrestaAuth &&
        typeof global.SisPrestaAuth.getAccessToken === "function"
      ) {
        return global.SisPrestaAuth.getAccessToken();
      }
      return localStorage.getItem(CFG.TOKEN_KEY) || "";
    } catch (_) {
      return "";
    }
  }
  function setToken(t) {
    localStorage.setItem(CFG.TOKEN_KEY, t || "");
  }

  function buildHeaders(extra = {}) {
    const h = {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...extra,
    };
    const tk = getToken();
    if (tk) h.Authorization = `Bearer ${tk}`;
    if (global.SisPrestaAuth && global.SisPrestaAuth.isTokenExpired && tk) {
      if (global.SisPrestaAuth.isTokenExpired(tk)) {
        console.warn("Token expirado. Cerrando sesión...");
        global.SisPrestaAuth.logout();
        return {}; // Detiene la ejecución
      }
    }
    return h;
  }

  async function request(path, { method = "GET", body, headers } = {}) {
    const url = path.startsWith("http") ? path : CFG.apiBase + path;
    const opts = { method, headers: buildHeaders(headers) };
    // opts.credentials = 'include'; // habilitar solo si el backend requiere cookies/CORS credentials
    if (body !== undefined) opts.body = JSON.stringify(body);

    // Log de petición (útil para debug)
    console.debug("[API REQUEST]", method, url, opts);

    const res = await fetch(url, opts);
    const contentType = res.headers.get("Content-Type") || "";
    const isJSON = contentType.includes("application/json");
    const payload = isJSON
      ? await res.json().catch(() => null)
      : await res.text();

    if (!res.ok) {
      // Log detallado para entender 403/401/500
      console.error("[API ERROR]", {
        url,
        method,
        status: res.status,
        statusText: res.statusText,
        requestBody: body,
        requestHeaders: opts.headers,
        responsePayload: payload,
      });
      const msg = (payload && payload.message) || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.payload = payload;
      throw err;
    }
    return payload;
  }

  const Api = {
    setToken,

    async health() {
      try {
        const a = await request("/actuator/health");
        return { ok: true, where: "actuator", data: a };
      } catch {
        try {
          const b = await request("/health");
          return { ok: true, where: "health", data: b };
        } catch (e) {
          return { ok: false, error: e.message || String(e) };
        }
      }
    },

    getClienteByDocumentId: async function (documentId) {
      return request("/cliente/verificar", {
        method: "POST",
        body: {
          documentId: documentId,
          pep: false, // Valor por defecto, se actualizará más tarde
        },
      });
    },
    crearPrestamo: (payload) =>
      request(`/prestamo`, { method: "POST", body: payload }),
    getPrestamoById: (id) => {
      const key = id && typeof id === "object" ? id.documentId || id.id : id;
      if (!key) return Promise.reject(new Error("documentId/id requerido"));
      return request(`/prestamo?documentId=${encodeURIComponent(key)}`);
    },
    listarPrestamos: (params = {}) => {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") q.set(k, v);
      });
      const qs = q.toString() ? `?${q.toString()}` : "";
      return request(`/prestamo${qs}`);
    },
    registrarPago: (payload) => {
      return request("/pagos", { method: "POST", body: payload });
    },
    crearPreferenciaMP: (cuotaId, monto) => {
      // Nota: El backend espera @RequestParam, por eso usamos query params en la URL
      return request(
        `/pagos/mercadopago/preferencia?cuotaId=${cuotaId}&monto=${monto}`,
        {
          method: "POST",
        }
      );
    },
    getComprobantesPorCuota: (cuotaId) => {
      if (!cuotaId) {
        return Promise.reject(new Error("cuotaId requerido"));
      }
      return request(`/comprobantes/cuota/${cuotaId}`);
    },
    abrirCaja: (payload) =>
      request("/caja/abrir", { method: "POST", body: payload }),

    getCajaResumen: () => request("/caja/resumen"), // GET por defecto

     // Validar si hay suficiente efectivo para dar vuelto
    validarVuelto: (cuotaId, montoPagar, montoRecibido) =>
      request("/caja/validar-vuelto", {
        method: "POST",
        body: { cuotaId, montoPagar, montoRecibido },
      }),

    // Registrar reingreso de dinero a caja
    registrarReingreso: (payload) =>
      request("/caja/reingreso", { method: "POST", body: payload }),

    // Listar movimientos de caja
    getMovimientosCaja: () => request("/caja/movimientos"),

    cerrarCaja: (payload) =>
      request("/caja/cerrar", { method: "POST", body: payload }),
  };

  global.SisPrestaApi = Api;
})(window);
