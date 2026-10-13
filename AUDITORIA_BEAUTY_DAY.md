# Beauty Day: revisión de funciones y permisos

Versión 4.1.2 preparada el 13 de octubre de 2026 (UTC), con la base de datos actualizada el 12 de octubre de 2026. Se confirmó acceso a BeautyDay (`eibjseobuvzukpojgnjf`) y al proyecto Beauty Day (`vkydsmoiizksoppqerbd`) de la cuenta de Outlook. La base pública conserva la revisión 4, con 45 servicios, 5 categorías, 4 profesionales, 2 promociones, 3 bonos y 5 combos. La publicación del cliente actualizado en Cloudflare sigue pendiente.

## Correcciones incluidas

| Función del panel | Dónde la ve la clienta | Revisión y cambio |
| --- | --- | --- |
| Fotografía principal | Foto grande junto al título del inicio | Se conserva la imagen completa dentro de un marco. |
| Fotografía de detalle | Foto pequeña que acompaña la portada | Marco y dimensiones limitadas. |
| Fotografía de presentación | Inicio, sección «Más que una cita», debajo de la galería de trabajos | El panel explica su ubicación y tiene un enlace directo a la sección. |
| Servicios y tarifas | Catálogo, detalle del servicio y reserva | Se prueban los 45 detalles. Las tarifas siguen bloqueadas para visitantes sin acceso válido. El prefijo «Desde» se separa del importe; una tarifa pendiente muestra «Consultar precio». |
| Destacados | Carrusel del inicio | Se conserva la selección y la navegación; el carrusel se oculta si no hay destacados. |
| Categorías | Tarjetas del inicio, filtros del catálogo y reserva | Cuadrícula adaptable y texto largo con saltos; el filtro admite varias filas. Máximo 12 categorías. Renombrarlas conserva las referencias y el filtro; se evitan duplicados sin distinguir mayúsculas. Una categoría llamada «Todos» tiene su propio filtro. |
| Profesionales | Equipo, perfiles individuales y reserva | Se prueban todos los perfiles. Reservar desde un perfil conserva a la profesional al elegir un servicio compatible, aunque exista una reserva anterior con un servicio incompatible. Las fotos mantienen su marco y se muestran completas. |
| Promociones | Inicio y página Promociones | La web ahora utiliza la foto guardada. Las promociones inactivas siguen ocultas. |
| Bonos | Página Bonos y nueva selección en el inicio | Se aclara la consulta, compra, entrega y uso por WhatsApp. Se añade fotografía opcional. |
| Combos | Sección Combos dentro de Bonos | Se añade fotografía opcional y disposición adaptable. |
| Contacto y redes | Contacto, requisitos de acceso y solicitudes | Contacto ahora muestra Instagram, TikTok y Facebook. |
| Descubre tu ritual | Inicio y páginas de sugerencias | Si se renombra una categoría, la sugerencia vuelve al catálogo en lugar de mostrar una categoría inexistente. |
| Buscar servicios | Catálogo | Buscar conserva la categoría seleccionada y descarta filtros de categorías eliminadas. |
| Privacidad | Privacidad, Cookies y Condiciones | Se corrige la referencia del alojamiento a Cloudflare. |
| Solicitar una cita | Reserva → WhatsApp | Puede enviarse sin perfiles sociales ni declaración de seguimiento. Pedir el enlace de precios es opcional; el mensaje no declara seguimientos que la clienta no haya marcado. |
| Habilitar precios | Panel del equipo → enlace privado de la clienta | Se mantienen las cuatro comprobaciones, vencimiento de 24 horas, revocación y códigos almacenados como hash. |
| Equipo y permisos | Panel administrativo | Dos roles diferenciados, comprobados en la base de datos. |

Los bonos son opciones comerciales que se consultan con Beauty Day. El sitio no procesa pagos, emite certificados ni lleva un saldo de canjes. La compra, entrega, vigencia y utilización se coordinan por WhatsApp. No se inventaron condiciones ni importes.

## Roles

| Acción | Administración completa | Atención por WhatsApp | Visitante sin sesión |
| --- | --- | --- | --- |
| Consultar contenido público | Sí | Sí | Sí |
| Abrir editor y consultar tarifas privadas directamente | Sí | No | No |
| Editar contenido, categorías y tarifas | Sí | No | No |
| Subir, reemplazar o borrar fotografías | Sí | No | No |
| Invitar personas y cambiar roles | Sí | No | No |
| Habilitar precios tras verificar los cuatro requisitos | Sí | Sí | No |
| Retirar enlaces | Cualquier enlace | Solo los que esa persona generó | No |
| Ver tarifas mediante un enlace vigente | Sí | Sí | Sí, con ese enlace |

La autorización depende de una identidad confirmada en Auth y de una fila activa en el registro privado del equipo. No se confía en metadatos editables ni en el rol que muestre el navegador. Desactivar a una persona afecta la siguiente llamada sin esperar a renovar el token. El panel anterior conserva el rol de una persona al reactivarla. Ningún administrador puede desactivar o reducir su propio permiso desde la sesión.

Las fotografías siguen disponibles por su URL pública. El listado de archivos del bucket, la subida, el reemplazo y la eliminación requieren administración completa. Atención y visitantes no pueden listar los archivos almacenados.

## Pruebas ejecutadas

- `npm test`: 32 pruebas automatizadas aprobadas, incluidas verificaciones transaccionales en Postgres/PGlite. Los scripts SQL verifican múltiples permisos dentro de una sola prueba.
- Instalación del esquema, carga pública y ejecución de la actualización dos veces: conservan el documento, las revisiones y los permisos.
- Acceso anónimo, cuenta común, cuenta no confirmada, administración y atención. Atención no puede editar, invitar, consultar el directorio del equipo, leer códigos almacenados ni subir o eliminar fotos.
- Enlaces válidos, incompletos, vencidos y revocados; cuatro requisitos obligatorios; límite de lectura y máximo de 60 emisiones por persona en una hora. La emisión se serializa por persona.
- Revisión obsoleta y fallo de guardado: el editor conserva el borrador y permite reintentar.
- Fotografías de promociones, bonos y combos presentes en el HTML público. Imágenes locales y del bucket de Supabase permitidas; SVG, HTML, protocolos ejecutables, credenciales en URL, otros dominios y rutas con `..` rechazados.
- Los 45 detalles de servicios, los 4 perfiles, las rutas de contacto, bonos, promociones, búsqueda, privacidad y reservas se generan correctamente.
- Escenario de 12 categorías, 100 servicios, 30 profesionales, 30 promociones, 30 bonos y 30 combos, con nombres largos. También se prueba contenido vacío y texto que contiene HTML.
- Regresiones de reservas anteriores, renombrado y duplicados de categorías, categoría «Todos», filtros antiguos, carrusel sin destacados, prefijos de precios y enlaces de correo sin parámetros inyectados.
- Compilación del cliente de Supabase, comprobación de sintaxis de los scripts y análisis sintáctico de las hojas CSS.
- Auditoría de dependencias de producción: cero vulnerabilidades conocidas en la comprobación realizada.
- Las dos migraciones del 12 de octubre se aplicaron en el proyecto real, con PostgreSQL 17.11. Se ejecutaron `03_verify.sql` y `04_verify_roles.sql` y ambas finalizaron correctamente con ROLLBACK.
- La prueba de borrado acepta el rechazo adicional de `storage.protect_delete()` sin desactivar esa protección. Solo utiliza metadatos temporales que se revierten; el borrado de archivos reales debe hacerse por la API de Storage.
- Comparación antes y después: documento y tarifas idénticos, revisión 4, 45 servicios, una persona autorizada, una cuenta de Auth y un acceso existente. No quedaron usuarios, enlaces ni metadatos de fotografías de prueba.

En la base publicada, con la clave pública y sin sesión, se verificaron estas respuestas:

| Llamada | Respuesta observada |
| --- | --- |
| Lectura directa de tarifas | 401, permiso denegado |
| Lectura del esquema privado | 406, esquema no expuesto |
| Abrir editor administrativo | 401, permiso denegado |
| Autorizar personas | 401, permiso denegado |
| Emitir un acceso | 401, permiso denegado |
| Código incorrecto | Mensaje de código inválido, sin tarifas |
| Token sin firma | 401, token inválido |
| Nueva sesión de roles | 401, permiso denegado; función instalada |
| Gestionar roles sin sesión | 401, permiso denegado |
| Listar archivos sin sesión | 200, lista vacía |

El documento público contiene cero tarifas numéricas. La foto guardada de las promociones responde 200 desde Supabase con tipo `image/jpeg`, incluso después de restringir el listado de archivos; el fallo detectado estaba en la tarjeta de la web.

El asesor de seguridad mostró cero errores. Se corrigió la advertencia «Public Bucket Allows Listing». Queda «Leaked Password Protection Disabled»: esa función está limitada al plan Pro o superior, según la [documentación de Supabase](https://supabase.com/docs/guides/auth/password-security). El proyecto continúa en el plan gratuito.

## Confirmación y recuperación

La configuración de Auth todavía apuntaba a `http://localhost:3000` y no tenía retornos autorizados. Se guardó `https://soybeautyday.shop/admin/` como Site URL y como retorno exacto autorizado, sin comodines.

Por indicación del usuario, el correo y SMTP se dejan como están; no se crearon buzones ni se modificó el alojamiento. SMTP propio está desactivado. Supabase usa su servicio incluido, que limita los destinatarios a integrantes de la organización y no garantiza entrega para producción. Antes de dar acceso al personal del cliente se necesita configurar un proveedor SMTP y comprobar confirmación y recuperación. La [guía oficial de SMTP](https://supabase.com/docs/guides/auth/auth-smtp) describe el requisito. La confirmación de correo se conserva.

## Pendientes de verificación real

La base de Outlook ya está actualizada y verificada. La versión nueva del cliente todavía no está publicada en el dominio: el usuario indicó que él realizará la carga del ZIP en Cloudflare.

La revisión visual a distintos anchos y la subida real de nuevas fotos deben terminarse después de publicar el ZIP. Los escenarios de contenido máximo prueban generación y comportamiento; no equivalen a una comprobación visual en dispositivos reales. La entrega real de correos de confirmación y recuperación no se ha comprobado. La configuración de SMTP queda aplazada por indicación del usuario.

El comando de historial local de Supabase no pudo conectarse porque no hay una instancia local de Supabase en el puerto 54322. La actualización sí se ejecutó y comprobó mediante Postgres/PGlite. Las siguientes invocaciones de la herramienta se hicieron con telemetría desactivada.

## Aplicación de la actualización

1. Ya completado: `supabase/migrations/20261012182006_beauty_roles_validation.sql` y `supabase/migrations/20261012223152_beauty_storage_listing.sql` en el proyecto de Outlook. Conservan catálogo, tarifas, fotos y personas autorizadas.
2. Ya completado: `database/03_verify.sql` y `database/04_verify_roles.sql` en el proyecto real. Ambas terminaron con `rollback` y no conservaron usuarios ni cambios de prueba.
3. Publicar únicamente el contenido de `docs/` en el Worker de archivos estáticos de Cloudflare mediante el ZIP actualizado. No subir SQL, tests ni código de desarrollo a la carpeta pública.
4. Comprobar en vivo cada sección, guardar una foto temporal y restaurar el contenido anterior, probar una cuenta de atención y retirar el enlace de prueba. El usuario dejó la configuración de correo fuera de esta actualización; la confirmación y recuperación para nuevas cuentas no se presentan como verificadas.

Para una instalación nueva, ejecutar primero `database/01_schema.sql` y `database/02_public_seed.sql`, y después los archivos SQL de `supabase/migrations/` en orden. No volver a ejecutar los archivos de creación o carga inicial sobre la base de producción.

Los encabezados de seguridad de `docs/_headers` se aplican al publicar los archivos en Cloudflare Workers Static Assets. No se afirman como activos en la publicación anterior. Incluyen CSP, protección contra incrustación, rechazo de interpretación de tipos MIME y restricciones de cámara, micrófono y ubicación.
