(() => {
  'use strict';
  // Solo fotografías locales o del bucket público de Supabase. Nunca HTML/SVG,
  // protocolos ejecutables, rutas con traversal ni URLs con credenciales.
  const local = /^assets\/(?:img|uploads)\/[a-zA-Z0-9._/-]+\.(?:png|jpe?g|webp)$/;
  const stored = /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/beauty-images\/[a-zA-Z0-9._/-]+\.(?:png|jpe?g|webp)$/;
  window.BeautyMedia = {
    path(value) {
      if (typeof value !== 'string' || value.length > 1200 || value.includes('..')) return '';
      return local.test(value) || stored.test(value) ? value : '';
    },
    adminPath(value) {
      const path = this.path(value);
      return path && !path.startsWith('https://') ? '../' + path : path;
    }
  };
})();
