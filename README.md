# Beauty Day · Atelier

Sitio de Beauty Day para GitHub Pages con panel privado de contenido. HTML, CSS y JavaScript separados; no requiere compilación para la parte pública.

## Qué incluye

- Inicio, catálogo filtrable y búsqueda, detalle de cada servicio, equipo y perfiles, promociones, bonos, combos, guía de visita, contacto y reserva en cuatro pasos.
- La reserva abre WhatsApp con los datos elegidos. La fecha y hora son **preferencias**: Beauty Day confirma la disponibilidad manualmente. No existe bloqueo automático de horarios.
- Panel en `/admin/` para editar portada, contacto, horarios, servicios, profesionales, fotos, promociones, bonos y combos. La dueña no necesita entrar a GitHub.
- Worker de Cloudflare con contraseña, sesión firmada, límite de intentos, validación y token de GitHub alojado como secreto. El panel está en una URL pública, pero solo una sesión autorizada puede guardar.

## Vista local

Desde la raíz del proyecto ejecuta `python -m http.server 8000 -d docs` y abre `http://localhost:8000/`. El catálogo y la reserva funcionan localmente. Para probar el guardado del panel hace falta desplegar/configurar el Worker.

## Publicar en GitHub Pages

1. Crea un repositorio para el proyecto y sube esta carpeta. Nunca subas contraseñas, el token ni `.dev.vars`.
2. En **Settings → Pages**, elige **Deploy from a branch**, rama `main`, carpeta `/docs`. Espera la URL publicada.
3. Puedes conectar después un dominio propio en Pages y en DNS. Si usas dominio, el valor de `SITE_ORIGIN` debe ser exactamente el origen público, por ejemplo `https://www.tu-dominio.com`, sin barra final.
4. Crea un token **fine-grained** de GitHub limitado únicamente a este repositorio con permiso **Contents: Read and write**. No lo pongas en el frontend.

## Configurar el panel

1. En `worker/`, copia `wrangler.toml.example` a `wrangler.toml`. Sustituye `SITE_ORIGIN`, `REPO_OWNER`, `REPO_NAME` y `BRANCH` por los valores reales. `CONTENT_PATH` y `UPLOAD_PREFIX` ya apuntan a `/docs`.
2. Ejecuta `npm install` y `npm run secrets` en `worker/`. El script genera una contraseña aleatoria para la dueña y tres secretos. Guárdalos en un lugar privado; no se escriben en archivos.
3. Instala o inicia sesión en Cloudflare Wrangler con `npx wrangler login`. Configura cada secreto con `npx wrangler secret put ADMIN_PASSWORD_SALT`, `npx wrangler secret put ADMIN_PASSWORD_HASH`, `npx wrangler secret put ADMIN_SESSION_SECRET` y `npx wrangler secret put GITHUB_TOKEN`. Pega el valor solicitado de forma interactiva, nunca como argumento en la terminal. También puedes crearlos desde el panel de Cloudflare antes de desplegar.
4. Ejecuta `npm run deploy`. Copia la URL del Worker a `docs/admin/config.js` y sube ese cambio al repositorio. La URL no es un secreto.
5. Abre `https://tu-dominio.com/admin/`, inicia sesión y cambia un texto o una foto. Pulsa **Guardar cambios**. El panel enviará el cambio al Worker, que hará un commit en GitHub; Pages actualizará la web después de publicar el commit.

Para cambiar la contraseña, vuelve a ejecutar `npm run secrets`, reemplaza los tres secretos `ADMIN_*` en Cloudflare y cierra sesiones anteriores rotando `ADMIN_SESSION_SECRET`.

## Datos y decisiones pendientes

- Las tres imágenes incluidas son **ilustrativas** y están señaladas como tales. Faltan las fotos reales del local y de las profesionales. El panel permite sustituirlas.
- Faltan dirección, enlace de Maps, Instagram, correo y horarios individuales. Los campos se dejan vacíos hasta recibirlos.
- Hay servicios cuyo precio o duración no aparece en el documento; figuran como «Consultar precio» o «Duración por confirmar». La dueña podrá completarlos.
- El documento menciona una promoción por registro y un registro con cédula. El alcance acordado para esta etapa es solicitar por WhatsApp sin cuentas de cliente: el panel permite comunicar la promoción, pero no verificar automáticamente el registro ni aplicar descuentos. Para el beneficio de cumpleaños, el formulario pide la fecha solo si la persona quiere compartirla; la identidad se comprueba directamente con el spa.
- Los bonos y combos se consultan por WhatsApp; el documento no proporciona sus precios.
- No hay pagos en línea, calendario de disponibilidad ni confirmación automática. Esos cambios necesitarían lógica y datos adicionales.

## Seguridad y operación

`docs/admin/` contiene la interfaz y por sí sola no protege nada. El Worker exige un origen exacto, contraseña verificada con PBKDF2, sesión HMAC de 8 horas, límite de cinco intentos por minuto y valida contenido e imágenes. El token de GitHub solo existe como secreto del Worker. El panel optimiza automáticamente fotos grandes a unos 400 KB para que el Worker gratuito pueda procesarlas. Cada foto se guarda con nombre único y luego se actualiza la referencia al guardar el contenido; las fotos antiguas siguen en el repositorio y pueden borrarse manualmente más adelante.

Un archivo de imagen subido puede quedar sin usar si se cierra el panel antes de pulsar Guardar. Si dos personas editan al mismo tiempo, la segunda verá un aviso de conflicto y deberá recargar para evitar sobrescribir cambios ajenos.

Para comprobar el Worker: `cd worker && npm test`.
