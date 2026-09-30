# Beauty Day · Atelier

Web para GitHub Pages y panel de edición de contenido. La parte pública usa HTML, CSS y JavaScript separados. El panel está en `docs/admin/` y guarda cambios mediante una pequeña función externa de Cloudflare.

**Empieza por [GUIA_INSTALACION_WINDOWS.md](GUIA_INSTALACION_WINDOWS.md).** Explica cada clic y comando desde cero. La clienta solo necesitará el enlace y una contraseña; no entra a GitHub ni a Cloudflare.

## En palabras simples

GitHub Pages muestra la web. Un **Worker** es un programa pequeño que funciona en Cloudflare: comprueba la contraseña del panel y guarda textos y fotos en el repositorio de GitHub. La contraseña y el permiso de escritura de GitHub se guardan allí como secretos, nunca en la página visible.

El visitante puede explorar 45 servicios, equipo, promociones, bonos y combos, y preparar una solicitud de cita. Al final se abre WhatsApp con un mensaje listo para enviar. Beauty Day confirma manualmente la disponibilidad; la web no bloquea horarios.

## Qué puede cambiar la dueña

- Portada, datos de contacto y horarios.
- Servicios, precios, duración, descripciones y fotos.
- Profesionales, especialidades, horarios y fotografías.
- Promociones, bonos y combos.
- Nombre del responsable de los datos y correo de privacidad.

Las fotos grandes se optimizan automáticamente. El panel puede abrirse en el celular.

## Privacidad y textos legales

Incluye páginas de privacidad, cookies y almacenamiento, condiciones de reserva y autorización visible antes de abrir WhatsApp. El código actual no instala analítica ni publicidad. El navegador conserva la solicitud durante la sesión y recuerda que el visitante cerró el aviso informativo. Las tipografías se cargan desde Google Fonts; al pulsar WhatsApp se abre un servicio externo.

**Antes de publicar**, Beauty Day debe confirmar el nombre real o razón social del responsable, dirección, correo para privacidad, funcionamiento efectivo de conservación de conversaciones y autorización para publicar fotos de profesionales. La dueña puede completar los datos visibles en el panel. El texto legal es una base ajustada al flujo implementado, sujeta a revisión con los datos reales del negocio.

## Contenido pendiente del cliente

- Fotos reales del local y de las profesionales. Las imágenes del local incluidas son ilustrativas y están identificadas. El catálogo usa composiciones gráficas hasta que se suban fotografías propias.
- Dirección, enlace de Maps, Instagram, correo y horarios individuales.
- Precio o duración de algunos servicios. Aparecen como «Consultar precio» o «Duración por confirmar».
- Precios de bonos y combos, si se quieren publicar.

La promoción de cumpleaños se puede consultar en el formulario con una fecha opcional. No se recoge cédula en la web. El documento original mencionaba una promoción por registro, pero esta etapa no crea cuentas de cliente ni verifica descuentos automáticamente; la dueña los confirma por WhatsApp.

## Archivos

- `docs/`: web pública lista para GitHub Pages; `docs/admin/`: panel.
- `docs/content/site.json`: contenido editable por el panel.
- `worker/`: función de guardado, contraseña y conexión con GitHub.
- `tests/`: pruebas del acceso y la escritura.
- `MENSAJE_PARA_CLIENTE.md`: texto breve para presentar el panel.

## Vista local y pruebas

En la carpeta raíz: `py -m http.server 8000 --directory docs` (Windows) y abre `http://localhost:8000/`. No abras `index.html` con doble clic, porque el navegador puede impedir leer el JSON local.

Para las pruebas: `cd worker`, `npm test`. El guardado real requiere completar la guía de instalación. Si dos personas editan a la vez, el panel impide que la segunda sobrescriba los cambios de la primera y pide recargar.
