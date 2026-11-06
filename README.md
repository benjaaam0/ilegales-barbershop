# Ilegales Barbershop

Página web y app de reservas para **Ilegales Barbershop**.

- **Página para clientes** (`index.html`): servicios y combos, barberos con su estado en vivo, reserva online (nombre → servicio → día y hora → barbero → forma de pago), calificaciones, horario y ubicación.
- **App para barberos** (`barberos/`): cada barbero entra con su cuenta y ve sus reservas (hora de llegada, nombre del cliente, servicio y forma de pago), recibe un aviso cuando llega una reserva nueva, marca a los clientes como atendidos y cambia su estado (disponible, atendiendo, no disponible). Se puede instalar en el celular como una app.

Todo es HTML, CSS y JavaScript, sin nada que instalar. Los datos se guardan en **Firebase** (Firestore + Authentication), que tiene un plan gratuito suficiente para una barbería.

## Estructura

```
index.html            Página para clientes
css/estilos.css       Estilos de la página
js/app.js             Lógica de la página (reservas, barberos, opiniones)
js/datos.js           ⭐ Servicios, precios, horas, horario y contacto (edita aquí)
js/firebase-config.js ⭐ Claves de tu proyecto de Firebase
img/local.jpg         Foto del local
barberos/             App de los barberos (instalable en el celular)
firestore.rules       Reglas de seguridad de la base de datos
firebase.json         Configuración para publicar con Firebase Hosting
```

## Puesta en marcha

### 1. Crear el proyecto de Firebase
1. Entra a <https://console.firebase.google.com> y crea un proyecto (por ejemplo `ilegales-barbershop`).
2. En **Compilación → Firestore Database**, crea la base de datos (ubicación `southamerica-east1` o la más cercana).
3. En **Compilación → Authentication → Método de acceso**, activa **Correo electrónico/contraseña**.
4. En **Configuración del proyecto → Tus apps**, agrega una **app web** y copia los valores de `firebaseConfig` en `js/firebase-config.js`.

### 2. Subir las reglas de seguridad
En **Firestore Database → Reglas**, pega el contenido de `firestore.rules` y publica.
(O con la terminal: `firebase deploy --only firestore:rules`).

### 3. Crear a los 4 barberos
Para cada barbero:
1. En **Authentication → Usuarios → Agregar usuario**, crea su correo y contraseña. Copia su **UID**.
2. En **Firestore Database**, crea la colección `barberos` y un documento cuyo **ID sea ese UID**, con estos campos:

| Campo    | Tipo   | Ejemplo                    |
|----------|--------|----------------------------|
| `nombre` | string | `Benja`                    |
| `estado` | string | `disponible`               |
| `orden`  | number | `1` (posición en la página)|
| `foto`   | string | URL de una foto (opcional) |

### 4. Ajustar los datos de la barbería
Edita `js/datos.js`: precios de cada servicio, horas de atención para reservar, días cerrados, horario que se muestra, dirección y mapa.

### 5. Publicar
La opción más simple y gratuita es **Firebase Hosting**:
```bash
npm install -g firebase-tools
firebase login
firebase use --add      # elige tu proyecto
firebase deploy
```
La página queda en `https://TU-PROYECTO.web.app` y la app de barberos en `https://TU-PROYECTO.web.app/barberos/`.

> Nota: GitHub Pages en un repositorio **privado** requiere un plan pago de GitHub; por eso se recomienda Firebase Hosting (también sirven Netlify o Vercel).

### 6. Instalar la app en el celular de cada barbero
Abrir `…/barberos/` en el celular, iniciar sesión y luego:
- **Android (Chrome):** menú ⋮ → **Instalar app** / **Agregar a la pantalla principal**.
- **iPhone (Safari):** botón Compartir → **Agregar a inicio**.

Después tocar **Activar notificaciones** para recibir el aviso de cada reserva nueva.

## Pagos
El cliente elige **pagar online**, **débito en el local** o **efectivo en el local**, y el barbero ve esa información en cada reserva.

Para el pago online, lo más simple sin servidor es crear un **link de pago de Mercado Pago** por servicio (Mercado Pago → Cobrar → Link de pago) y pegarlo en `linkPago` de cada servicio en `js/datos.js`. Al confirmar, el cliente es enviado a pagar. Mientras no haya link, la página avisa que puede pagar en el local.

Para confirmar los pagos de forma automática (que la reserva quede marcada como "Pagado"), el siguiente paso es una **Cloud Function** que cree la preferencia de pago con Mercado Pago o Webpay (Transbank) y reciba su notificación. La página nunca maneja datos de tarjetas.

## Cómo funciona por dentro
Colecciones de Firestore:
- `barberos/{uid}`: nombre, estado, orden, foto.
- `reservas/{id}`: nombre y teléfono del cliente, servicio, barbero, fecha, hora, forma de pago, estado. Solo el barbero dueño puede verlas.
- `ocupados/{barberoId_fecha_hora}`: marca la hora como tomada (pública, sin datos del cliente) para que nadie reserve la misma hora.
- `opiniones/{id}`: nombre, estrellas (1 a 5) y comentario.

## Próximos pasos posibles
- Notificaciones push con la app cerrada (Firebase Cloud Messaging).
- Confirmación automática del pago online.
- Que el cliente califique también a su barbero.
- Cancelar o reprogramar una reserva desde la app del barbero.
