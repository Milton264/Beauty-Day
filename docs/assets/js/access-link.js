(() => {
  'use strict';
  const normalize = value => {
    let text = String(value || '').trim();
    if (/^https?:\/\//i.test(text)) {
      const url = new URL(text);
      text = new URLSearchParams(url.hash.split('?')[1] || '').get('acceso') || '';
    }
    const code = text.toLowerCase().replace(/[-\s]/g, '');
    if (!/^[a-f0-9]{32}$/.test(code)) throw Error('Pega el enlace privado o el código completo que te envió Beauty Day.');
    return code;
  };
  window.BeautyAccess = {
    normalize,
    fromHash(hash) { return new URLSearchParams(String(hash).split('?')[1] || '').get('acceso'); },
    link(code, base) {
      const url = new URL(base);
      url.search = '';
      url.hash = '/servicios?acceso=' + normalize(code);
      return url.href;
    }
  };
})();
