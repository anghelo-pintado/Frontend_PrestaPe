(function (global) {
  const SisPrestaConfig = {
    BASE_URL: "http://localhost:8080",
    API_PREFIX: "/api/v1",

    TOKEN_KEY: "sispresta:auth",

    get apiBase() {
      return this.BASE_URL + this.API_PREFIX;
    },
  };

  global.SisPrestaConfig = SisPrestaConfig;
})(window);
