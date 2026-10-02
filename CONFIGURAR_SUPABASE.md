# Conectar Beauty Day con Supabase

La implementación usa la API de datos, Auth y Storage de Supabase directamente desde la web. Las funciones SQL se ejecutan dentro de la base de datos; no hay un servidor de aplicación propio.

## 1. Disponer de un proyecto

Crea un proyecto exclusivo para Beauty Day en [Supabase](https://supabase.com/dashboard/projects). Si tu cuenta alcanzó el límite de proyectos gratuitos activos, pausa un proyecto que no uses antes de crear uno nuevo. No reutilices una base de datos ajena al negocio sin revisar sus permisos.

El plan gratuito tiene límites y puede pausar proyectos por inactividad. Revisa [los precios y condiciones actuales](https://supabase.com/pricing) antes de elegir otro plan.

## 2. Inicializar la base de datos

En SQL Editor ejecuta, en orden:

1. `database/01_schema.sql` una sola vez en el proyecto nuevo.
2. `database/02_public_seed.sql` para importar el catálogo público sin precios.
3. Autoriza tu primer correo administrativo:

```sql
insert into beauty_private.admin_emails(email)
values (lower('TU_CORREO_ADMINISTRADOR'));
```

No escribas contraseñas en esta tabla ni en un archivo del proyecto. Supabase Auth las gestiona. Mantén `beauty_private` fuera de los esquemas expuestos por Data API; conserva únicamente los esquemas públicos habituales.

## 3. Configurar el correo administrativo

En **Authentication → URL Configuration** usa:

- Site URL: `https://milton264.github.io/Beauty-Day/admin/`
- Redirect URLs: `https://milton264.github.io/Beauty-Day/admin/`

En **Authentication → Providers → Email**, mantén habilitado el acceso con correo y la confirmación de correo. Configura un proveedor SMTP propio para enviar confirmaciones y recuperación de contraseña a los administradores: el servicio de correo incluido por Supabase tiene restricciones sobre destinatarios y frecuencia. Conserva la confirmación activada.

Para el primer administrador puedes usar **Authentication → Users → Add user → Create new user**, introducir tú su correo autorizado y su contraseña de al menos 12 caracteres, y confirmar la cuenta desde el dashboard. Después la persona inicia sesión en el panel. Esto permite activar la cuenta inicial antes de configurar SMTP. Comparte la contraseña con su titular por un canal privado y que use su propia contraseña.

Cada administrador adicional debe tener su correo autorizado en el panel y su cuenta confirmada en Auth. El registro de una cuenta sin autorización no permite administrar.

## 4. Conectar la web

Copia la **Project URL** y una clave **publishable** activa desde la configuración del proyecto. Edita `docs/admin/config.js`:

```js
window.BEAUTY_DAY_SUPABASE = {
  url: 'https://REFERENCIA_DEL_PROYECTO.supabase.co',
  publishableKey: 'sb_publishable_CLAVE_PUBLICA'
};
```

La clave publishable es pública. Los permisos están en RLS y las funciones de la base de datos. Nunca pongas una clave secreta, `service_role` o contraseña en la web. Publica estos cambios en GitHub Pages usando la rama `main` y carpeta `/docs`.

## 5. Activar las tarifas y verificar

Entra a [Administración](https://milton264.github.io/Beauty-Day/admin/) con la cuenta confirmada. Completa los precios en Servicios y tarifas o importa el `site.json` de la copia anterior desde Habilitar precios. La importación copia únicamente las tarifas coincidentes: guarda después. No subas ese JSON con los precios al repositorio público.

Comprueba que:

- Sin código, el catálogo muestra el acceso reservado y la consulta pública de `beauty_content` no devuelve importes.
- Sin sesión administrativa no se puede guardar, subir fotos, autorizar administradores ni generar códigos.
- Una cuenta registrada sin autorización tampoco puede hacerlo.
- Con un código vigente se leen los precios; al revocarlo o vencer deja de funcionar.
- Guardar una edición actualiza la web al recargar; una revisión antigua devuelve un conflicto.

`database/03_verify.sql` realiza estas comprobaciones de la base de datos con usuarios de prueba y ROLLBACK, sin dejar cuentas o códigos de prueba. Ejecútalo como propietario desde SQL Editor después de importar el contenido. También ejecuta los asesores de seguridad de Supabase.
