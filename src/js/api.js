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
    return h;
  }

  async function request(path, { method = "GET", body, headers } = {}) {
    const url = path.startsWith("http") ? path : CFG.apiBase + path;
    const opts = { method, headers: buildHeaders(headers) };
    if (body !== undefined) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    const contentType = res.headers.get("Content-Type") || "";
    const isJSON = contentType.includes("application/json");
    const payload = isJSON
      ? await res.json().catch(() => null)
      : await res.text();

    if (!res.ok) {
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

    getClienteByDni: (dni) => request(`/clientes/${encodeURIComponent(dni)}`),
    crearPrestamo: (payload) =>
      request(`/prestamos`, { method: "POST", body: payload }),
    getPrestamoById: (id) => request(`/prestamos/${encodeURIComponent(id)}`),
    listarPrestamos: (params = {}) => {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") q.set(k, v);
      });
      const qs = q.toString() ? `?${q.toString()}` : "";
      return request(`/prestamos${qs}`);
    },
  };

  global.SisPrestaApi = Api;
})(window);
