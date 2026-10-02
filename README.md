# Beauty Day

Web pública y panel administrativo con Supabase Auth, Database y Storage. El navegador realiza las peticiones directamente a Supabase; GitHub Pages aloja los archivos de la web. No requiere un servidor propio.

Los visitantes pueden consultar el catálogo, solicitar una cita por WhatsApp e ingresar un código para consultar precios. No pueden cambiar el contenido ni consultar las tarifas directamente. Los administradores usan correo y contraseña individuales para editar textos, servicios, categorías, equipo, promociones, bonos, combos, contacto y fotografías; también autorizan otros administradores y generan o revocan códigos.

## Activación

Consulta [CONFIGURAR_SUPABASE.md](CONFIGURAR_SUPABASE.md). La configuración pública está en `docs/admin/config.js`; nunca incluyas una clave `service_role` o `sb_secret_`, una contraseña o un token de GitHub. El acceso real se verifica en la base de datos con RLS y funciones SQL.

Las contraseñas se gestionan en Supabase Auth. `beauty_private.admin_emails` solo contiene los correos autorizados; registrar una cuenta por sí solo no concede permisos administrativos.

## Desarrollo

Con Node.js 24:

```sh
npm ci
npm run build
npm test
```

Las pruebas ejecutan el esquema y sus permisos en Postgres local con PGlite, que reproduce los campos de Auth y Storage usados aquí. La conexión real, los correos y el inicio de sesión se verifican después de activar el proyecto.

`src/data.js` es el adaptador de Supabase; `docs/assets/js/data.js` es el archivo compilado que se publica. El SDK y la herramienta de compilación están fijados en `package-lock.json`.

- `docs/`: sitio público y panel, publicados desde GitHub Pages.
- `database/01_schema.sql`: tablas, validación, permisos y operaciones.
- `database/02_public_seed.sql`: contenido inicial sin importes.
- `database/03_verify.sql`: comprobación transaccional de permisos y códigos; termina con ROLLBACK.
- `GUIA_CLIENTA.md`: uso cotidiano del panel.

El guardado del contenido y sus precios es una transacción. Una revisión evita sobrescribir cambios de otro administrador. Los códigos duran 24 horas, se almacenan como hashes y se comprueban cada minuto mientras la página está abierta. Las fotografías son públicas; los precios requieren un código vigente. La verificación de seguidores y la confirmación de citas continúan siendo manuales por WhatsApp.

La versión está preparada para Supabase, pero requiere un proyecto activo y su configuración antes de habilitar las funciones administrativas. Las imágenes de referencia y los datos legales pendientes deben sustituirse por datos del negocio.
