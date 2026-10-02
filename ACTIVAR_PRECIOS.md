# Beauty Day · Precios reservados

La versión nueva incorpora palo de rosa, Instagram, TikTok y Facebook, reserva por WhatsApp y acceso a tarifas mediante un código privado de 24 horas. El catálogo público no contiene importes. El precio definitivo se comunica por WhatsApp antes de confirmar la cita.

## Cómo funciona para la clienta

1. La persona sigue las tres redes y solicita una cita. El mensaje incluye los perfiles para que Beauty Day pueda revisarlos.
2. Beauty Day comprueba los seguimientos y confirma la reserva después de comunicar el importe.
3. En el panel, abre **Acceso a precios**, marca las cuatro comprobaciones y pulsa **Generar código de 24 horas**.
4. Copia el mensaje y envíalo por la conversación que acabas de revisar. La persona pega el código en **Precios** y consulta el catálogo.
5. Para retirar el acceso, introduce el mismo código en **Retirar un acceso**.

Las casillas del panel son la constancia de una comprobación humana. La web no certifica por sí sola los seguimientos ni confirma automáticamente horarios. Un código permite acceder a quien lo tenga; puede compartirse. No es una cuenta personal. Los cambios de tarifas, los accesos nuevos y las revocaciones pueden tardar alrededor de un minuto en propagarse por KV. Las tarifas ya vistas no se pueden retirar de la memoria, capturas o archivos de una persona.

## Activación en el repositorio actual

El sitio está en https://milton264.github.io/Beauty-Day/. La URL del Worker aún debe conectarse. Si ya completaste **ACTIVAR_PANEL.md**, conserva sus secretos.

1. En el token de Cloudflare usado para `CLOUDFLARE_API_TOKEN`, añade **Account → Workers KV Storage → Edit** dentro de la misma cuenta. Mantén los permisos de edición del Worker.
2. Comprueba que GitHub Actions tenga los cuatro secretos indicados en `ACTIVAR_PANEL.md`: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `BEAUTY_DAY_GITHUB_TOKEN`, `BEAUTY_DAY_ADMIN_PASSWORD`. No los pegues en el chat ni en archivos.
3. Abre **Actions → Desplegar editor Beauty Day → Run workflow → main**. El proceso crea o reutiliza un único almacén privado, migra los precios anteriores si aún no hay un catálogo y conecta la misma URL del Worker con la web y el panel.
4. Cuando termine, entra al panel y revisa las tarifas en **Servicios**. Si no pudieron migrarse, abre **Acceso a precios → Importar tarifas anteriores**, selecciona `docs/content/site.json` de tu copia v2 y guarda. También puedes completar las tarifas manualmente en Servicios.
5. Haz una prueba: una visita sin código no debe obtener importes; después de confirmar las cuatro comprobaciones en el panel, el código debe mostrar las tarifas. Revisa el vencimiento y la revocación.

El despliegue reutiliza el historial de este repositorio para recuperar los importes originales. No publica un nuevo archivo de tarifas. Los importes de versiones anteriores ya públicas permanecen en el historial de GitHub: el cambio protege la entrega actual y las tarifas futuras, no borra la información que ya estuvo publicada.

## Instalación manual en Windows

Usa la instalación del panel descrita en `GUIA_INSTALACION_WINDOWS.md`. Antes de desplegar el Worker, desde `worker` ejecuta:

```powershell
npx wrangler kv namespace create PRICE_STORE
```

Añade a `wrangler.toml` el ID devuelto:

```toml
[[kv_namespaces]]
binding = "PRICE_STORE"
id = "ID_DEVUELTO_POR_CLOUDFLARE"
```

Conserva ambos límites de intentos (`LOGIN_LIMITER` y `PUBLIC_LIMITER`). Publica el Worker y coloca su URL en `docs/admin/config.js`; la web pública reutiliza ese mismo archivo. Importa las tarifas desde la copia anterior mediante el panel. No copies un archivo con precios dentro del sitio público.

## Viabilidad

Para esta web comercial, una verificación automática general de las tres redes no es una integración viable: las APIs normales no proporcionan una comprobación común y fiable de ese requisito. Instagram tiene posibilidades de comprobación en ciertos flujos de mensajería profesional, pero eso requiere otra integración y no resuelve el conjunto de tres redes. TikTok reserva su API de listas de seguidores a investigación aprobada y excluye el uso comercial. Abrir un perfil o marcar «ya sigo» no demuestra un seguimiento.

La solución implementada aplica revisión humana y controla en el servidor qué código puede recibir precios. No utiliza scraping, contraseñas de redes sociales ni automatización de seguimientos.

Referencias técnicas: [TikTok Research FAQ](https://developers.tiktok.com/docs/en/research-api-faq), [TikTok Display API](https://developers.tiktok.com/doc/display-api-get-started/), [Cloudflare KV](https://developers.cloudflare.com/kv/get-started/).

## Validación

Pruebas automatizadas: autenticación de administración, origen permitido, guardado con control de SHA, separación entre tarifas privadas y contenido público, aprobación de cuatro condiciones, códigos inválidos, vencimiento, revocación, errores de configuración y límites de intentos. Las vistas públicas se comprueban mediante generación de sus rutas. La revisión visual en navegador local no pudo ejecutarse en este entorno.
