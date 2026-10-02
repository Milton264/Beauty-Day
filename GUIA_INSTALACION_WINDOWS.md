# Instalación de Beauty Day

La configuración actual usa Supabase. Sigue [CONFIGURAR_SUPABASE.md](CONFIGURAR_SUPABASE.md) para activar la base de datos y las cuentas administrativas. La web se aloja en GitHub Pages desde `main`, carpeta `/docs`.

Para modificar el adaptador en Windows, instala Node.js 24 y ejecuta `npm ci`, `npm run build` y `npm test` en la carpeta raíz. Publica también el archivo compilado `docs/assets/js/data.js`.
