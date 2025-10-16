(function (global) {
  const SisPrestaConfig = {
    BASE_URL: "https://prestape-backend-20f65424c7e9.herokuapp.com",
    API_PREFIX: "/api/v1",

    TOKEN_KEY: "sispresta:auth",

    get apiBase() {
      return this.BASE_URL + this.API_PREFIX;
    },
  };

  global.SisPrestaConfig = SisPrestaConfig;
})(window);
