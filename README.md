# Beauty Day

Web pública y panel administrativo con Supabase Auth, Database y Storage. El navegador realiza las peticiones directamente a Supabase; Cloudflare aloja los archivos de la web. No requiere un servidor propio.

Los visitantes pueden consultar el catálogo, solicitar una cita por WhatsApp y abrir un enlace privado para consultar precios. No pueden cambiar el contenido ni consultar las tarifas directamente. Los administradores usan correo y contraseña individuales para editar textos, servicios, categorías, equipo, promociones, bonos, combos, contacto y fotografías; también autorizan al equipo y preparan o retiran enlaces privados. El rol de atención por WhatsApp solo permite habilitar precios y retirar sus propios enlaces.

## Activación

Consulta [CONFIGURAR_SUPABASE.md](CONFIGURAR_SUPABASE.md). La configuración pública está en `docs/admin/config.js`; nunca incluyas una clave `service_role` o `sb_secret_`, una contraseña o un token de GitHub. El acceso real se verifica en la base de datos con RLS y funciones SQL.

Las contraseñas se gestionan en Supabase Auth. `beauty_private.admin_emails` contiene los correos autorizados, su estado y su rol; registrar una cuenta por sí solo no concede permisos administrativos.

## Desarrollo

Con Node.js 24:

```sh
npm ci
npm run build
npm test
```

Las pruebas ejecutan el esquema y sus permisos en Postgres local con PGlite, que reproduce los campos de Auth y Storage usados aquí. La conexión real, los correos y el inicio de sesión se verifican después de activar el proyecto.

`src/data.js` es el adaptador de Supabase; `docs/assets/js/data.js` es el archivo compilado que se publica. El SDK y la herramienta de compilación están fijados en `package-lock.json`.

- `docs/`: sitio público y panel, listos para Cloudflare Workers Static Assets o Pages.
- `database/01_schema.sql`: tablas, validación, permisos y operaciones.
- `database/02_public_seed.sql`: contenido inicial sin importes.
- `database/03_verify.sql`: comprobación transaccional de permisos y códigos; termina con ROLLBACK.
- `GUIA_CLIENTA.md`: uso cotidiano del panel.

El guardado del contenido y sus precios es una transacción. Una revisión evita sobrescribir cambios de otro administrador. Los códigos duran 24 horas, se almacenan como hashes y se comprueban cada minuto mientras la página está abierta. Las fotografías son públicas; los precios requieren un código vigente. La verificación de seguidores y la confirmación de citas continúan siendo manuales por WhatsApp.

El sitio está conectado al proyecto de Supabase de BeautyDay. Las imágenes de referencia y los datos legales pendientes deben sustituirse por datos del negocio.

El panel organiza las tareas en Inicio, Servicios y tarifas y Habilitar precios. Los servicios se editan en fichas individuales. El enlace privado lleva el acceso en el fragmento de la URL y lo retira de la dirección al abrirse. Se conserva el ingreso de códigos anteriores como alternativa.

## Actualización: funciones y rol de WhatsApp

Consulta [AUDITORIA_BEAUTY_DAY.md](AUDITORIA_BEAUTY_DAY.md) para las correcciones, la matriz de permisos, las pruebas y el orden de instalación. Las reservas pueden enviarse sin rellenar redes sociales ni solicitar acceso a precios. Los requisitos de seguimiento y reserva se mantienen para habilitar las tarifas. La versión 4.2.0 incluye las correcciones de reservas, filtros e imágenes y la protección de sesiones: tokens en memoria, cierre al salir o recargar, 15 minutos sin actividad y 8 horas máximas, con validación en la base. Las migraciones de `supabase/migrations/` ya se aplicaron y verificaron en el proyecto de Outlook de Beauty Day; no es necesario repetirlas para publicar este ZIP. En otra instalación, aplica las migraciones antes de publicar el cliente. Nunca vuelvas a cargar el contenido inicial en una base de producción existente.
