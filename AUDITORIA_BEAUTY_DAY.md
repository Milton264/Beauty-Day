# Beauty Day: revisión de funciones y permisos

Versión 4.2.0 preparada el 13 de octubre de 2026 (UTC), con la base de datos actualizada el 13 de octubre de 2026. Se confirmó acceso a BeautyDay (`eibjseobuvzukpojgnjf`) y al proyecto Beauty Day (`vkydsmoiizksoppqerbd`) de la cuenta de Outlook. La base pública conserva la revisión 4, con 45 servicios, 5 categorías, 4 profesionales, 2 promociones, 3 bonos y 5 combos. La publicación del cliente actualizado en Cloudflare sigue pendiente.

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

- `npm test`: 45 pruebas automatizadas aprobadas, incluidas verificaciones transaccionales en Postgres/PGlite. Los scripts SQL verifican múltiples permisos dentro de una sola prueba.
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

El asesor de seguridad se volvió a ejecutar tras la migración de sesiones y mostró cero errores. Se revisaron las cuatro observaciones informativas de RLS sin políticas en tablas de beauty_private: son intencionadas, sin concesiones de lectura directa y accesibles únicamente a través de las funciones privadas autorizadas. Se corrigió la advertencia «Public Bucket Allows Listing». Queda «Leaked Password Protection Disabled»: esa función está limitada al plan Pro o superior, según la [documentación de Supabase](https://supabase.com/docs/guides/auth/password-security). El proyecto continúa en el plan gratuito.

## Revisión adicional de sesiones (13 de octubre)

Se confirmó que la versión anterior guardaba el login en sessionStorage y permitía renovarlo sin límite de inactividad. Además, la autorización comprobaba a la persona activa, pero no la vigencia de su sesión de Auth. El cierre de Auth por sí solo no invalida un JWT firmado antes de su vencimiento.

Cambios aplicados y probados:

- Los tokens de acceso y renovación se conservan solo en memoria. Se retiran al salir o recargar. Se borran las entradas de sesión que haya dejado la versión anterior.
- El panel se cierra tras 15 minutos sin actividad y dura como máximo 8 horas. La renovación automática de tokens y los eventos sintéticos no cuentan como actividad.
- Las funciones privadas y RLS comprueban que el session_id pertenece a esa persona, sigue presente en auth.sessions y tiene una sesión privada vigente, sin revocación. El mismo token no puede reiniciar una sesión vencida o retirada.
- Las tablas de sesión no están expuestas por la API ni tienen permisos de lectura directa para visitantes o equipo. Los ayudantes privilegiados permanecen en el esquema privado y las funciones públicas usan SECURITY INVOKER.
- Cerrar sesión retira primero la sesión privada. Si la conexión falla, el panel se cierra y borra los tokens locales, e informa que no se pudo confirmar el cierre remoto. Al abandonar la página se intenta retirar la sesión; el vencimiento obligatorio en la base sigue protegiendo si el navegador interrumpe el envío.
- Las respuestas privadas pendientes no vuelven a abrir el editor después del cierre. Se limpian tarifas, borradores, enlaces preparados, filtros y referencias a formularios anteriores.
- El flujo de recuperación conserva únicamente un verificador temporal de hasta 15 minutos entre pestañas, sin guardar la sesión. Actualizar la contraseña solicita el cierre de las otras sesiones de Auth.
- En el proveedor Email de Supabase se guardó un mínimo de 12 caracteres para nuevas contraseñas y se activó Secure password change. La contraseña existente no se cambió. Se verificó la opción activada al volver a abrir el proveedor.
- Se comprobaron los límites reales de Auth: 30 registros o inicios de sesión por IP en 5 minutos, 30 verificaciones de token por IP en 5 minutos y reenvío de IP desactivado. Se conservaron estos límites.
- Los retornos de Auth se procesan solo en /admin/. Se mantienen la confirmación de correo y la prohibición de inicios anónimos.

La migración `20261013062709_beauty_panel_sessions.sql` se aplicó en el proyecto real. `05_verify_sessions.sql` pasó en SQL Editor con ROLLBACK: acceso anónimo, arranque de sesión, inactividad, duración máxima, revocación del panel y de Auth, JWT renovado, sesión de otra persona, metadatos manipulados y aislamiento de atención. Se conserva la prueba previa de roles del 12 de octubre; sus fixtures se actualizaron para el nuevo contrato y se probaron junto al esquema en Postgres/PGlite.

La comparación antes y después conserva revisión 4, 45 tarifas, una cuenta, un miembro y un enlace. El hash del documento permanece `9efde73891b7bb31878e26a8f3c7e0f2` y el hash de tarifas con el mismo formato permanece `f0c7a4cbbf49f2ef3810631f8b63e60f`. No quedaron cuentas ni sesiones de prueba; la tabla nueva tiene cero registros hasta que alguien abra el panel actualizado.

Se comprobaron de nuevo por la API real: el catálogo público responde 200 sin tarifas numéricas; iniciar, renovar o cerrar una sesión privada y abrir el panel sin autenticación responden 401/42501; el esquema de sesiones privadas responde 406/PGRST106. La nueva versión del cliente requiere esta migración ya instalada: el panel anterior no registra una sesión vigente.

La auditoría cubre estos controles y escenarios; no equivale a una garantía de ausencia de vulnerabilidades, una prueba de penetración independiente ni validación visual real de la nueva publicación. El análisis de dependencias de producción volvió a dar cero vulnerabilidades conocidas.

## Confirmación y recuperación

La configuración de Auth todavía apuntaba a `http://localhost:3000` y no tenía retornos autorizados. Se guardó `https://soybeautyday.shop/admin/` como Site URL y como retorno exacto autorizado, sin comodines.

Por indicación del usuario, el correo y SMTP se dejan como están; no se crearon buzones ni se modificó el alojamiento. SMTP propio está desactivado. Supabase usa su servicio incluido, que limita los destinatarios a integrantes de la organización y no garantiza entrega para producción. Antes de dar acceso al personal del cliente se necesita configurar un proveedor SMTP y comprobar confirmación y recuperación. La [guía oficial de SMTP](https://supabase.com/docs/guides/auth/auth-smtp) describe el requisito. La confirmación de correo se conserva.

## Pendientes de verificación real

La base de Outlook ya está actualizada y verificada, incluida la migración de sesiones del 13 de octubre. La versión nueva del cliente todavía no está publicada en el dominio: el usuario indicó que él realizará la carga del ZIP en Cloudflare.

La revisión visual a distintos anchos y la subida real de nuevas fotos deben terminarse después de publicar el ZIP. Los escenarios de contenido máximo prueban generación y comportamiento; no equivalen a una comprobación visual en dispositivos reales. La entrega real de correos de confirmación y recuperación no se ha comprobado. La configuración de SMTP queda aplazada por indicación del usuario.

El comando de historial local de Supabase no pudo conectarse porque no hay una instancia local de Supabase en el puerto 54322. La actualización sí se ejecutó y comprobó mediante Postgres/PGlite. Las siguientes invocaciones de la herramienta se hicieron con telemetría desactivada.

## Aplicación de la actualización

1. Ya completado: `supabase/migrations/20261012182006_beauty_roles_validation.sql` y `supabase/migrations/20261012223152_beauty_storage_listing.sql` en el proyecto de Outlook. Conservan catálogo, tarifas, fotos y personas autorizadas.
2. Ya completado: `database/03_verify.sql` y `database/04_verify_roles.sql` en el proyecto real. Ambas terminaron con `rollback` y no conservaron usuarios ni cambios de prueba.
3. Ya completado: `20261013062709_beauty_panel_sessions.sql` y `database/05_verify_sessions.sql` en el proyecto real, con los datos de prueba revertidos.
4. Publicar únicamente el contenido de `docs/` en el Worker de archivos estáticos de Cloudflare mediante el ZIP actualizado. No subir SQL, tests ni código de desarrollo a la carpeta pública.
5. Comprobar en vivo cada sección, guardar una foto temporal y restaurar el contenido anterior, probar una cuenta de atención y retirar el enlace de prueba. El usuario dejó la configuración de correo fuera de esta actualización; la confirmación y recuperación para nuevas cuentas no se presentan como verificadas.

Para una instalación nueva, ejecutar primero `database/01_schema.sql` y `database/02_public_seed.sql`, y después los archivos SQL de `supabase/migrations/` en orden. No volver a ejecutar los archivos de creación o carga inicial sobre la base de producción.

Los encabezados de seguridad de `docs/_headers` se aplican al publicar los archivos en Cloudflare Workers Static Assets. No se afirman como activos en la publicación anterior. Incluyen CSP, protección contra incrustación, rechazo de interpretación de tipos MIME y restricciones de cámara, micrófono y ubicación.
