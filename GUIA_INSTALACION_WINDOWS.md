> Versión 3: antes de publicar, completa también **ACTIVAR_PRECIOS.md** para el almacenamiento privado de tarifas.

# Beauty Day: instalación paso a paso en Windows

Esta guía es para **Milton**, una sola vez. La dueña del spa no realiza ninguno de estos pasos técnicos. Al terminar, solo recibe la dirección del panel y su contraseña.

## Antes de empezar

Necesitas tu cuenta de GitHub, una cuenta gratuita en [Cloudflare](https://dash.cloudflare.com/sign-up), Git y Node.js instalados. El dominio propio puede conectarse al final; primero usa la dirección gratuita que da GitHub Pages.

Abre el ZIP y entra en la carpeta **`beauty-day-atelier`**. En VS Code, abre esa carpeta como proyecto. Todo lo que hay dentro de ella debe quedar en la **raíz** del repositorio: GitHub debe mostrar `docs`, `worker` y `README.md` directamente, sin una carpeta adicional alrededor.

## 1. Publica la web en GitHub Pages

1. En GitHub, pulsa **New repository**. Ponle `beauty-day`, selecciónalo **Public** y créalo **sin README** inicial.
2. En VS Code, abre **Terminal → New Terminal** dentro de `beauty-day-atelier` y ejecuta, cambiando `TU_USUARIO` por tu usuario de GitHub:

   ```powershell
   git init
   git add .
   git commit -m "Beauty Day Atelier"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/beauty-day.git
   git push -u origin main
   ```

3. En ese repositorio, abre **Settings → Pages**. En **Build and deployment**, selecciona **Deploy from a branch**; rama **main** y carpeta **/docs**. Pulsa **Save**.
4. Espera a que GitHub muestre **Visit site** y abre la web. Una dirección típica es `https://TU_USUARIO.github.io/beauty-day/`. Si la página carga, ya puedes revisar el diseño; el panel todavía no guardará hasta completar los pasos siguientes.

## 2. Crea un permiso limitado para guardar cambios

El panel necesita permiso para actualizar **solo este repositorio**. Ese permiso se llama *token* y no se le da a la clienta.

1. En GitHub abre tu foto de perfil → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. En **Repository access** elige **Only select repositories** y selecciona `beauty-day`.
3. En **Repository permissions**, configura **Contents → Read and write**. Los demás permisos quedan sin acceso adicional.
4. Selecciona una fecha de vencimiento que puedas recordar y crea el token. Cópialo en tu gestor de contraseñas: GitHub no volverá a mostrarlo. Cuando venza, tendrás que sustituirlo en Cloudflare.

No pegues el token en ningún archivo del proyecto, mensaje al cliente ni chat.

## 3. ¿Qué es el Worker?

GitHub Pages solo muestra archivos; no puede recibir una foto nueva y sustituir archivos por sí mismo. El **Worker** es el programa pequeño alojado en Cloudflare que recibe el botón **Guardar** del panel. Comprueba la contraseña y le pide a GitHub actualizar el contenido. La clienta solo ve el panel de Beauty Day.

## 4. Configura y publica el Worker

1. En la terminal de VS Code, desde `beauty-day-atelier`, entra a su carpeta y crea el archivo de configuración:

   ```powershell
   cd worker
   Copy-Item .\wrangler.toml.example .\wrangler.toml
   notepad .\wrangler.toml
   ```

2. En Bloc de notas cambia **solo** estas líneas y guarda:

   ```toml
   SITE_ORIGIN = "https://TU_USUARIO.github.io"
   REPO_OWNER = "TU_USUARIO"
   REPO_NAME = "beauty-day"
   BRANCH = "main"
   ```

   `SITE_ORIGIN` es el inicio de la dirección, **sin** `/beauty-day/` ni `/` al final. Por ejemplo, si tu sitio es `https://milton84-toc.github.io/beauty-day/`, escribe `https://milton84-toc.github.io`. Deja `CONTENT_PATH` y `UPLOAD_PREFIX` como están.

3. Instala la herramienta y conecta tu cuenta Cloudflare:

   ```powershell
   npm install
   npx wrangler login
   ```

   Se abrirá el navegador. Entra en Cloudflare y autoriza Wrangler. Regresa a la terminal.

4. Publica el Worker por primera vez:

   ```powershell
   npm run deploy
   ```

   Si Cloudflare pide crear un subdominio `workers.dev`, acepta. Guarda la dirección que aparece, por ejemplo `https://beauty-day-editor.tu-cuenta.workers.dev`. En este momento el Worker todavía responderá «configuración incompleta»; es normal hasta añadir los secretos.

5. Genera la contraseña del panel y tres valores internos:

   ```powershell
   npm run secrets
   ```

   Se mostrarán `CONTRASEÑA DEL PANEL`, `ADMIN_PASSWORD_SALT`, `ADMIN_PASSWORD_HASH` y `ADMIN_SESSION_SECRET`. Copia los cuatro en tu gestor de contraseñas. La contraseña del panel es la única que más adelante recibe la dueña.

6. Ejecuta **cada comando por separado**. Wrangler te pedirá que pegues el valor de la línea con el mismo nombre. No pongas los valores dentro de los comandos:

   ```powershell
   npx wrangler secret put ADMIN_PASSWORD_SALT
   npx wrangler secret put ADMIN_PASSWORD_HASH
   npx wrangler secret put ADMIN_SESSION_SECRET
   npx wrangler secret put GITHUB_TOKEN
   ```

   Para `GITHUB_TOKEN` pega el token limitado que creaste en el paso 2. Cloudflare lo guarda como secreto. La dirección del Worker es pública, los secretos no.

## 5. Conecta el panel al Worker

1. Desde la carpeta `worker` ejecuta:

   ```powershell
   notepad ..\docs\admin\config.js
   ```

2. Cambia `CONFIGURAR_URL_DEL_WORKER` por la dirección real del paso 4, **sin `/` final**. Debe quedar así:

   ```javascript
   window.BEAUTY_DAY_API = 'https://beauty-day-editor.tu-cuenta.workers.dev';
   ```

3. Guarda el archivo y, en la terminal, vuelve a la carpeta raíz y envía solo ese cambio a GitHub:

   ```powershell
   cd ..
   git add docs/admin/config.js
   git commit -m "Conecta el panel de Beauty Day"
   git push
   ```

4. Espera la publicación de Pages. Abre `https://TU_USUARIO.github.io/beauty-day/admin/`. Ingresa la **CONTRASEÑA DEL PANEL**. Cambia un texto corto, pulsa **Guardar cambios**, espera unos minutos y recarga la web pública para comprobarlo. GitHub indica que un cambio puede tardar hasta unos 10 minutos en verse publicado.

## 6. Cuando compres el dominio

Conecta el dominio en **Settings → Pages → Custom domain** y configura sus DNS según las instrucciones que muestre GitHub. Cuando el sitio ya abra con `https://tudominio.com`, entra de nuevo a `worker/wrangler.toml`, cambia `SITE_ORIGIN` a `https://tudominio.com` (o `https://www.tudominio.com` si esa es la dirección que usarás) y ejecuta `npm run deploy` desde `worker`. El panel solo acepta solicitudes del origen indicado. Entrega a la clienta la URL final `https://tudominio.com/admin/`.

## 7. Antes de que el cliente use la web

Pide a la dueña las fotos reales del local y del equipo, dirección, Instagram, correo, horarios de cada profesional y los servicios cuyo precio o duración falten. Para la política de privacidad, confirma el nombre real o razón social del responsable, dirección, correo para solicitudes sobre datos, cómo conserva sus conversaciones de WhatsApp y autorización de cada profesional para publicar su foto. Completa **General** y **Privacidad** en el panel y revisa el texto legal con esos datos. Si incorporas Google Analytics, Meta Pixel, un mapa incrustado o publicidad después, tendrás que actualizar la información y el mecanismo de cookies.

## Si algo falla

- **«Configura la URL del Worker»**: revisa `docs/admin/config.js`, guarda y haz `git push`.
- **«Origen no permitido»**: `SITE_ORIGIN` no coincide con el dominio desde el que abriste el panel; ajusta `wrangler.toml` y vuelve a ejecutar `npm run deploy`.
- **«Configuración incompleta del servidor»**: falta alguno de los cuatro secretos. Repite el comando `npx wrangler secret put NOMBRE` correspondiente.
- **«GitHub rechazó la operación»**: comprueba dueño, repositorio, rama, permiso `Contents: Read and write` y vencimiento del token.
- **La web aún muestra datos anteriores**: espera la publicación en **Settings → Pages**. Luego recarga la página.
- **No abre al dar doble clic a `index.html`**: usa el servidor local o la URL de Pages; el archivo JSON necesita servirse por HTTP.

La dueña puede seguir [GUIA_CLIENTA.md](GUIA_CLIENTA.md), que no incluye ninguno de estos pasos técnicos.

## Referencias oficiales

- [GitHub: publicar un sitio de Pages desde `/docs`](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site).
- [GitHub: crear un token con acceso limitado](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).
- [Cloudflare: desplegar un Worker con Wrangler](https://developers.cloudflare.com/workers/get-started/guide/).
- [Cloudflare: guardar secretos del Worker](https://developers.cloudflare.com/workers/configuration/secrets/).
- [SIC: contenido de la política y aviso de privacidad](https://sedeelectronica.sic.gov.co/publicaciones/boletin-juridico/concepto/politicas-de-tratamiento-de-datos-personales).
