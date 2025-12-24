# PrestaPe

**PrestaPe** es una aplicación web para la gestión eficiente de préstamos personales. Permite administrar todo el ciclo de vida de un préstamo, desde el registro del cliente y la creación del préstamo hasta el seguimiento de cuotas, cálculo de moras y gestión de pagos.

## Características Principales

*   **Autenticación y Roles:** Sistema de login seguro con gestión de sesiones y roles de usuario.
*   **Gestión de Préstamos:**
    *   Creación de nuevos préstamos con cálculo automático de cuotas y TEA.
    *   Visualización del cronograma de pagos.
    *   Búsqueda de préstamos por documento de identidad.
*   **Gestión de Pagos:**
    *   Registro de pagos de cuotas (parciales o totales).
    *   Cálculo automático de moras por pagos atrasados.
    *   Opción de pago con efectivo o integración con Mercado Pago.
    *   Generación y visualización de comprobantes de pago (PDF).
*   **Caja:**
    *   Apertura y cierre de caja.
    *   Control de flujo de efectivo.
*   **Panel Principal (Dashboard):** Vista rápida del estado de las operaciones.
*   **Perfil de Usuario:** Gestión de datos del usuario logueado.

## Tecnologías Utilizadas

El proyecto está construido principalmente con tecnologías web estándar, sin dependencias pesadas de frameworks de frontend, lo que lo hace ligero y fácil de desplegar.

*   **HTML5 & CSS3:** Estructura y estilos de la aplicación.
*   **JavaScript (Vanilla):** Lógica del lado del cliente.
*   **Librerías Externas:**
    *   `date-fns`: Para manipulación y formateo de fechas.
    *   `decimal.js`: Para cálculos financieros precisos.
    *   `Font Awesome`: Para iconos e interfaz visual.
    *   `Mercado Pago SDK`: Para integración de pasarela de pagos.

## Estructura del Proyecto

```
src/
├── css/            # Estilos CSS de la aplicación
├── js/             # Lógica JavaScript
│   ├── api.js              # Interacción con el Backend (API REST)
│   ├── auth.js             # Lógica de autenticación
│   ├── config.js           # Configuración global (URLs, constantes)
│   ├── prestamos-logic.js  # Lógica de negocio de préstamos
│   └── ...
├── pages/          # Vistas HTML (Login, Principal, Préstamos, etc.)
├── utils/          # Utilidades varias
└── index.html      # Punto de entrada (Redirecciona al login)
```

## Configuración y Ejecución

### Requisitos Previos

*   Un navegador web moderno.
*   Acceso a internet (para cargar librerías externas vía CDN como Font Awesome y conectar con el Backend).

### Instalación

1.  **Clonar el repositorio:**
    ```bash
    git clone <url-del-repositorio>
    cd <nombre-del-directorio>
    ```

2.  **Configurar el Backend:**
    *   La aplicación espera conectarse a una API REST.
    *   Edita el archivo `src/js/config.js` para apuntar a tu servidor backend:
        ```javascript
        const SisPrestaConfig = {
            BASE_URL: "http://localhost:8080", // Cambia esto por la URL de tu API
            // ...
        };
        ```

3.  **Ejecutar la aplicación:**
    *   Dado que es una aplicación estática, puedes servirla con cualquier servidor HTTP simple.
    *   Si tienes Python instalado:
        ```bash
        # Desde la raíz del proyecto
        python3 -m http.server
        ```
    *   O usando `live-server` (Node.js):
        ```bash
        npx live-server .
        ```
    *   Abre tu navegador en `http://localhost:8000` (o el puerto que indique tu servidor).

### Uso

1.  Al abrir la aplicación, serás redirigido a la página de **Login**.
2.  Ingresa tus credenciales (correo y contraseña).
3.  Una vez autenticado, accederás al **Panel Principal**.
4.  Utiliza el menú de navegación para acceder a las diferentes secciones: "Préstamos", "Caja", "Perfil", etc.

## Contribución

Si deseas contribuir al proyecto, por favor crea un *fork* del repositorio, realiza tus cambios y envía un *Pull Request*.

## Licencia

[Incluir aquí la licencia del proyecto, e.g., MIT, Privada, etc.]
