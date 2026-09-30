# Activar el panel de Beauty Day

La web pública ya funciona en https://milton264.github.io/Beauty-Day/. Este procedimiento activa el guardado del panel. Se hace una sola vez desde tu navegador normal; la dueña solo usará el enlace del panel y su contraseña.

## 1. Dos credenciales de alcance limitado

**En Cloudflare:** entra a tu cuenta desde tu navegador habitual. En **Account API tokens**, crea un token con la plantilla **Edit Cloudflare Workers** y limita el acceso a tu cuenta de Beauty Day. Copia también el **Account ID** de esa cuenta. No uses la Global API Key.

**En GitHub:** en **Settings → Developer settings → Personal access tokens → Fine-grained tokens**, crea un token para el propietario `Milton264`, con acceso solo al repositorio `Beauty-Day`. En permisos del repositorio, asigna **Contents: Read and write**. No le des acceso a otros repositorios. Anota su fecha de vencimiento para renovarlo después; al vencer, el panel dejará de guardar.

## 2. Guardarlos en GitHub como secretos

En `Milton264/Beauty-Day` abre **Settings → Secrets and variables → Actions → New repository secret**. Crea estos cuatro nombres exactos:

| Nombre | Valor |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID de Cloudflare |
| `CLOUDFLARE_API_TOKEN` | Token limitado para editar Workers |
| `BEAUTY_DAY_GITHUB_TOKEN` | Token limitado a Contents del repositorio Beauty-Day |
| `BEAUTY_DAY_ADMIN_PASSWORD` | Contraseña larga de al menos 20 caracteres que usarán para entrar al panel |

Guarda la contraseña del panel en un gestor de contraseñas para entregarla a la dueña. No pongas ninguno de estos valores en archivos del repositorio, mensajes ni capturas.

## 3. Avisar que los cuatro secretos están listos

Avísame «listo» sin enviarme los valores. Yo activaré la acción y comprobaré el resultado. Si prefieres ejecutarla tú, en **Actions → Desplegar editor Beauty Day → Run workflow** selecciona `main`. Cuando termine en verde, habrá publicado el Worker y escrito su URL en `docs/admin/config.js`. GitHub Pages publicará ese último cambio. Luego probaré una edición desde https://milton264.github.io/Beauty-Day/admin/ contigo, sin que me compartas la contraseña por chat.

Si el despliegue indica que falta un subdominio `workers.dev`, entra a **Workers & Pages** de tu cuenta de Cloudflare y configura el subdominio de tu cuenta. Después vuelve a ejecutar la acción. Si aparece otro error, comparte el enlace de la ejecución de Actions, sin copiar secretos.

Documentación oficial: [Cloudflare Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/), [tokens personales de GitHub](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) y [secretos de GitHub Actions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions).
