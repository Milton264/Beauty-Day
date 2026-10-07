(() => {
  'use strict';
  const root=document.querySelector('#admin-root');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const backend=window.BeautyData;
  let token='',data=null,sha='',tab='home',dirty=false,busy=false,pricesConfigured=false;
  const get=path=>path.split('.').reduce((obj,key)=>obj?.[key],data);
  const set=(path,value)=>{const keys=path.split('.');let obj=data;keys.slice(0,-1).forEach(key=>obj=obj[key]);obj[keys.at(-1)]=value;dirty=true;status('Cambios sin guardar.');};
  const status=(message,error=false)=>{
    const el=document.querySelector('.status');if(el){el.textContent=message;el.className='status '+(error?'error':'');}
    document.querySelectorAll('[data-save]').forEach(button=>{button.disabled=!dirty||busy;button.innerHTML=busy?'Publicando…':dirty?'Publicar cambios':'Todo guardado';});
    const bar=document.querySelector('.savebar');if(bar)bar.hidden=!dirty;
  };
  const id=()=>crypto.randomUUID().slice(0,12);
  async function preparePhoto(file){
    if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw Error('Selecciona una imagen JPG, PNG o WebP.');
    if(file.size<=400000)return file;
    const url=URL.createObjectURL(file);
    try {
      const img=new Image();img.src=url;await img.decode();
      for(const edge of [1400,1100,900]){
        const ratio=Math.min(1,edge/Math.max(img.naturalWidth,img.naturalHeight));
        const canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*ratio);canvas.height=Math.round(img.naturalHeight*ratio);
        canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
        for(const quality of [.82,.68,.52]){
          const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
          if(blob&&blob.size<=400000)return new File([blob],file.name.replace(/\.[^.]+$/,'.jpg'),{type:'image/jpeg'});
        }
      }
      throw Error('La foto sigue siendo muy grande. Elige otra imagen.');
    }finally{URL.revokeObjectURL(url);}
  }
  async function api(path,options={}) {
    const body=options.body?JSON.parse(options.body):{};
    if(path==='/api/content'&&!options.method){const r=await backend.adminContent();return {...r,sha:r.revision};}
    if(path==='/api/content'&&options.method==='PUT'){const r=await backend.saveContent(body.content,body.sha);return {...r,sha:r.revision};}
    if(path==='/api/access')return backend.issueCode(body.checks);
    if(path==='/api/access/revoke')return backend.revokeCode(body.code);
    throw Error('Operación no disponible.');
  }
  function login(message='',mode='login',email='',success=false) {
    const signup=mode==='signup',recover=mode==='recover',confirmation=mode==='confirmation';
    const title=signup?'Crea tu acceso.':recover?'Recupera tu acceso.':confirmation?'Confirma tu correo.':'Bienvenida de nuevo.';
    const description=signup?'Autorizar tu correo te permite registrarte. Crea tu contraseña y confirma el correo para entrar.':recover?'Te enviaremos un enlace para elegir una nueva contraseña.':confirmation?'Abre el mensaje de confirmación de Beauty Day en tu correo. Si no lo encuentras, revisa el correo no deseado o solicita otro enlace.':'Ingresa tu correo y contraseña.';
    const action=signup?'Crear acceso':recover?'Enviar enlace':confirmation?'Reenviar confirmación':'Entrar al panel';
    root.innerHTML=`<div class="login-wrap"><div class="login-art"><span class="brand">Beauty Day</span><div><span class="eyebrow">ESPACIO PRIVADO</span><h1>Tu espacio para cuidar cada detalle.</h1></div><p>Gestiona contenido, catálogo, equipo y fotografías desde aquí.</p></div><div class="login-panel"><form class="login-card" id="login-form"><span class="eyebrow">ADMINISTRACIÓN</span><h2>${title}</h2><p>${description}</p><label class="field">Correo electrónico<input type="email" name="email" value="${esc(email)}" required autocomplete="email" maxlength="254"></label>${recover||confirmation?'':'<label class="field">Contraseña<input type="password" name="password" required autocomplete="'+(signup?'new-password':'current-password')+'" '+(signup?'minlength="12"':'')+'></label>'}<button class="btn full" type="submit">${action}</button><p class="login-message ${success?'notice':'error'}" role="${success?'status':'alert'}">${esc(message)}</p><div class="login-options">${mode==='login'?'<button type="button" data-login-mode="signup">Crear acceso administrativo</button><button type="button" data-login-mode="recover">Olvidé mi contraseña</button><button type="button" data-login-mode="confirmation">Confirmar mi correo</button>':'<button type="button" data-login-mode="login">Volver al inicio de sesión</button>'}</div></form></div></div>`;
    document.querySelectorAll('[data-login-mode]').forEach(button=>button.addEventListener('click',()=>login('',button.dataset.loginMode,document.querySelector('#login-form').elements.email.value.trim())));
    document.querySelector('#login-form').addEventListener('submit',async e=>{
      e.preventDefault();const form=e.currentTarget,button=form.querySelector('button'),email=form.elements.email.value.trim();button.disabled=true;
      try{
        if(confirmation){await backend.resendConfirmation(email);login('Si tu cuenta está pendiente de confirmar, recibirás un nuevo enlace. Revisa también el correo no deseado.','confirmation',email,true);return;}
        if(recover){await backend.recover(email);login('Si la cuenta existe, recibirás un correo con el enlace.','login',email,true);return;}
        if(signup){const result=await backend.signUp(email,form.elements.password.value);if(!result.session){login('Registro enviado. Abre el enlace del correo de confirmación para completar tu acceso.','confirmation',email,true);return;}}
        else await backend.signIn(email,form.elements.password.value);
        token='authenticated';await load();
      }catch(err){login(err.message,err.code==='email_not_confirmed'?'confirmation':mode,email);}finally{button.disabled=false;}
    });
  }
  function passwordRecovery(){root.innerHTML=`<div class="login-panel"><form class="login-card" id="recovery-form"><span class="eyebrow">RECUPERACIÓN</span><h2>Elige una nueva contraseña.</h2><label class="field">Nueva contraseña<input name="password" type="password" minlength="12" required autocomplete="new-password"></label><label class="field">Repite la contraseña<input name="confirmation" type="password" minlength="12" required autocomplete="new-password"></label><button class="btn" type="submit">Guardar contraseña</button><p id="recovery-status" role="status"></p></form></div>`;document.querySelector('#recovery-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,message=document.querySelector('#recovery-status'),button=form.querySelector('button');if(form.elements.password.value!==form.elements.confirmation.value){message.textContent='Las contraseñas no coinciden.';return;}button.disabled=true;try{await backend.changePassword(form.elements.password.value);token='authenticated';await load();}catch(error){message.textContent=error.message;}finally{button.disabled=false;}});}
  async function load(){root.innerHTML='<p class="loading">Abriendo el contenido…</p>';try{let result=await api('/api/content');data=result.content;sha=result.sha;pricesConfigured=result.pricesConfigured;dirty=false;editor();}catch(err){token='';login(err.message);}}
  function field(path,label,type='text',extra='') {
    const value=get(path);let input;
    if(type==='textarea')input=`<textarea data-path="${esc(path)}" maxlength="${path.startsWith('brand.')?300:1200}">${esc(value)}</textarea>`;
    else if(type==='checkbox')input=`<input type="checkbox" data-path="${esc(path)}" ${value?'checked':''}>`;
    else if(type==='category')input=`<select data-path="${esc(path)}">${data.categories.map(c=>`<option value="${esc(c)}" ${value===c?'selected':''}>${esc(c)}</option>`).join('')}</select>`;
    else input=`<input data-path="${esc(path)}" type="${type}" value="${esc(value===null?'':value)}" ${type==='number'?'min="0" step="1"':''} maxlength="300">`;
    return `<label class="field ${type==='checkbox'?'check':''} ${extra}">${esc(label)}${input}${type==='number'?'<small>Deja vacío si el precio o duración está por confirmar.</small>':''}</label>`;
  }
  function upload(path,label) {
    const value=get(path);
    return `<div class="upload-row">${value?`<img class="upload-preview" src="${esc(/^https:\/\//.test(value)?value:'../'+value)}" alt="Vista previa">`:'<div class="upload-preview upload-placeholder">Sin fotografía</div>'}<label class="field">${esc(label)}<input type="file" data-upload="${esc(path)}" accept="image/png,image/jpeg,image/webp"><small>JPG, PNG o WebP. El panel optimiza la foto automáticamente; luego pulsa Guardar.</small></label></div>`;
  }

  const sections = {
    home:['Inicio','Tu salón, a tu manera.','Las tareas de cada día, sin perderte entre formularios.'],
    access:['Atención','Habilitar precios','Revisa la reserva y envía un enlace privado a tu clienta.'],
    services:['Catálogo','Servicios y tarifas','Busca un servicio y abre solo el que quieres cambiar.'],
    professionals:['Tu web','Equipo','Presenta a las personas que hacen especial cada visita.'],
    promotions:['Tu web','Promociones','Elige qué beneficios aparecen en la página.'],
    gifts:['Tu web','Bonos de regalo','Opciones para regalar una experiencia Beauty Day.'],
    combos:['Tu web','Combos','Agrupa servicios en una sola experiencia.'],
    general:['Tu web','Portada y textos','Edita la primera impresión de tu salón.'],
    contact:['Configuración','Contacto y redes','Mantén a mano los datos que necesitan tus clientas.'],
    categories:['Configuración','Categorías','Organiza tu catálogo y las especialidades del equipo.'],
    administrators:['Configuración','Administradores','Gestiona quién puede entrar a este espacio.'],
    legal:['Configuración','Privacidad','Los datos del responsable que aparecen en la web.']
  };
  const icons = {
    home:'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',
    access:'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15" r="1"/>',
    services:'<path d="M8 4h13M8 12h13M8 20h13"/><circle cx="3" cy="4" r="1"/><circle cx="3" cy="12" r="1"/><circle cx="3" cy="20" r="1"/>',
    professionals:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-6"/>',
    promotions:'<path d="m3 3 10 0 8 8-10 10-8-8z"/><circle cx="7" cy="7" r="1"/>',
    gifts:'<path d="M3 9h18v4H3zM5 13v8h14v-8M12 9v12"/><path d="M12 9C4 9 5 2 8 3c3 1 4 6 4 6s1-5 4-6c3-1 4 6-4 6"/>',
    combos:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    general:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 9v11"/>',
    contact:'<path d="M5 3h4l2 5-3 2a15 15 0 0 0 6 6l2-3 5 2v4c-9 3-19-7-16-16z"/>',
    categories:'<path d="M3 7h7l2 3h9v11H3zM3 7V3h7l2 4h9v3"/>',
    administrators:'<path d="m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6z"/><path d="m8 12 3 3 5-6"/>',
    legal:'<path d="M6 3h9l3 3v15H6zM14 3v5h4M9 12h6M9 16h6"/>',
    arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
    search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
    check:'<path d="m5 12 4 4 10-10"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>'
  };
  const icon=name=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(icons[name]||icons.arrow)+'</svg>';
  const amount=value=>value===null?'Por definir':new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(value);
  const navButton=(key,name)=>'<button class="tab '+(tab===key?'active':'')+'" data-tab="'+key+'" '+(tab===key?'aria-current="page"':'')+'>'+icon(key)+'<span>'+name+'</span>'+(key==='services'?'<small>'+data.services.length+'</small>':'')+'</button>';
  const photo=value=>/^https:\/\//.test(value||'')?value:'../'+value;
  let serviceSearch='',serviceCategory='Todos',dialogDraft=null,dialogKey='',dialogIndex=-1,dialogBusy=false,lastFocus=null,lastGrant=null;

  function home(){
    const missing=data.services.filter(s=>s.price===null).length;
    return '<div class="home-grid"><section class="home-feature"><span class="eyebrow">ATENCIÓN A CLIENTAS</span><h2>Una reserva confirmada.<br>Un enlace para ver precios.</h2><p>Comprueba los tres seguimientos y la cita. El panel prepara el mensaje; tú lo envías en la conversación de WhatsApp.</p><button class="btn" data-tab="access">Habilitar precios '+icon('arrow')+'</button><div class="feature-flower" aria-hidden="true">✳</div></section><section class="home-guide"><span class="eyebrow">ASÍ LO VIVE TU CLIENTA</span><ol><li><span>01</span><div><strong>Sigue las tres redes</strong><p>Instagram, TikTok y Facebook.</p></div></li><li><span>02</span><div><strong>Solicita su reserva</strong><p>Elige el servicio y envía sus datos.</p></div></li><li><span>03</span><div><strong>Abre el enlace privado</strong><p>Lo recibe cuando confirmas todo.</p></div></li></ol><a class="text-link" href="../#/precios" target="_blank" rel="noopener">Ver este recorrido en la web ↗</a></section></div><div class="section-heading"><div><h2>Haz un cambio en tu web</h2><p>Entra directamente a lo que necesitas editar.</p></div><span class="subtle-label">TU CONTENIDO</span></div><div class="shortcut-grid">'+[
      ['services','Servicios y tarifas',data.services.length+' servicios · '+(missing?missing+' precios por definir':'tarifas completas')],
      ['professionals','Equipo',data.professionals.length+' profesionales en tu web'],
      ['general','Portada y textos','Título, presentación e imagen principal'],
      ['promotions','Promociones',data.promotions.filter(p=>p.active).length+' promociones visibles']
    ].map(x=>'<button class="shortcut" data-tab="'+x[0]+'"><span class="shortcut-icon">'+icon(x[0])+'</span><strong>'+x[1]+'</strong><small>'+x[2]+'</small>'+icon('arrow')+'</button>').join('')+'</div>'+
    (missing?'<div class="attention-note">'+icon('services')+'<div><strong>Completa las tarifas pendientes</strong><p>'+missing+' servicios siguen con precio por definir. Puedes editarlos en Servicios y tarifas.</p></div><button class="text-button" data-tab="services">Revisar →</button></div>':'');
  }
  function general(){return '<section class="panel"><div class="panel-head"><div><h2>Lo primero que ven tus clientas</h2><p>Los textos y las fotografías de la página de inicio. La galería toma las fotos de tus servicios.</p></div><a class="text-link" href="../" target="_blank" rel="noopener">Ver portada ↗</a></div><div class="form-grid">'+field('brand.name','Nombre del negocio')+field('brand.eyebrow','Descripción breve')+field('brand.heroTitle','Título principal','text','wide')+field('brand.heroSubtitle','Texto de presentación','textarea','wide')+'</div><h3 class="block-title">Fotografía de portada</h3>'+upload('brand.heroImage','Cambiar fotografía principal')+'<h3 class="block-title">Detalle de la portada</h3>'+upload('brand.detailImage','Cambiar fotografía de detalle')+'<h3 class="block-title">Fotografía de presentación</h3>'+upload('brand.storyImage','Cambiar fotografía de presentación')+'</section>';}
  function contact(){return '<section class="panel"><div class="panel-head"><div><h2>Cómo encontrarte</h2><p>Estos datos se muestran en el sitio y en las solicitudes de reserva.</p></div></div><div class="form-grid">'+field('contact.whatsapp','WhatsApp con código de país, solo números')+field('contact.phone','Teléfono que aparece en la web')+field('contact.address','Dirección','text','wide')+field('contact.hours','Horario de atención','text','wide')+field('contact.mapsUrl','Enlace de Google Maps','url','wide')+field('contact.email','Correo de contacto','email','wide')+'</div><h3 class="block-title">Las tres redes de Beauty Day</h3><div class="form-grid">'+field('contact.instagramUrl','Instagram','url','wide')+field('contact.tiktokUrl','TikTok','url','wide')+field('contact.facebookUrl','Facebook','url','wide')+'</div></section>';}
  function services(){
    return '<section class="panel directory-panel"><div class="directory-toolbar"><label class="directory-search">'+icon('search')+'<input id="service-search" type="search" placeholder="Buscar un servicio…" aria-label="Buscar un servicio" value="'+esc(serviceSearch)+'"></label><label class="filter-control"><span class="sr-only">Filtrar por categoría</span><select id="service-category">'+['Todos'].concat(data.categories).map(c=>'<option '+(c===serviceCategory?'selected':'')+'>'+esc(c)+'</option>').join('')+'</select></label><button class="btn" data-add="services">+ Nuevo servicio</button></div><div id="services-list">'+serviceRows()+'</div><div class="directory-foot"><span>'+data.services.length+' servicios en el catálogo</span><span>Las tarifas solo se muestran con un acceso vigente.</span></div></section>';
  }
  function serviceRows(){
    const filtered=data.services.map((s,i)=>({s,i})).filter(({s})=>(serviceCategory==='Todos'||s.category===serviceCategory)&&s.name.toLocaleLowerCase('es').includes(serviceSearch.toLocaleLowerCase('es')));
    return '<div class="table-scroll"><table class="service-table"><thead><tr><th>Servicio</th><th>Categoría</th><th>Duración</th><th>Tarifa privada</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>'+filtered.map(({s,i})=>'<tr><td><button class="service-name" data-edit="services" data-index="'+i+'"><span class="service-monogram">'+esc(s.name.slice(0,1))+'</span><span><strong>'+esc(s.name)+'</strong>'+(s.featured?'<small>Destacado en inicio</small>':'')+'</span></button></td><td>'+esc(s.category)+'</td><td>'+(s.duration?s.duration+' min':'Por definir')+'</td><td><span class="'+(s.price===null?'pending-price':'row-price')+'">'+esc((s.pricePrefix?s.pricePrefix+' ':'')+amount(s.price))+'</span></td><td><button class="edit-button" data-edit="services" data-index="'+i+'" aria-label="Editar '+esc(s.name)+'">Editar '+icon('arrow')+'</button></td></tr>').join('')+'</tbody></table></div>'+(!filtered.length?'<div class="empty">No hay servicios con esa búsqueda. Prueba otro nombre o categoría.</div>':'');
  }
  function collection(key,title){
    return '<div class="collection-toolbar"><p>'+data[key].length+' '+title.toLowerCase()+'</p><button class="btn" data-add="'+key+'">+ Agregar '+({professionals:'profesional',promotions:'promoción',gifts:'bono',combos:'combo'}[key])+'</button></div><div class="entry-grid">'+data[key].map((entry,i)=>{
      const name=entry.name||entry.title;
      return '<article class="entry-card">'+(entry.image?'<img class="entry-cover" src="'+esc(photo(entry.image))+'" alt="">':'<div class="entry-art '+key+'"><span>'+esc(key==='professionals'?name.slice(0,1):'✳')+'</span></div>')+'<div class="entry-content">'+(key==='promotions'?'<span class="badge '+(entry.active?'':'neutral')+'">'+(entry.active?'Visible en la web':'Oculta')+'</span>':'')+'<h2>'+esc(name)+'</h2><p>'+esc(entry.role||entry.description||'Completa la presentación de este elemento.')+'</p>'+(key==='professionals'?'<div class="tags">'+entry.categories.map(c=>'<span>'+esc(c)+'</span>').join('')+'</div>':'')+'<button class="edit-button" data-edit="'+key+'" data-index="'+i+'">Editar '+icon('arrow')+'</button></div></article>';
    }).join('')+'</div>'+(!data[key].length?'<div class="empty">Aquí aparecerán los elementos que agregues a tu web.</div>':'');
  }
  function legal(){return '<section class="panel"><div class="panel-head"><div><h2>Responsable de Beauty Day</h2><p>Esta información aparece en la política de privacidad.</p></div></div><div class="form-grid">'+field('legal.responsibleName','Nombre legal o razón social','text','wide')+field('legal.privacyEmail','Correo para solicitudes de privacidad','email','wide')+'</div><a class="text-link" href="../#/privacidad" target="_blank" rel="noopener">Ver política de privacidad ↗</a></section>';}
  function categories(){return '<section class="panel"><div class="panel-head"><div><h2>Las áreas de tu salón</h2><p>El nombre se actualiza también en sus servicios y profesionales.</p></div><button class="btn subtle" id="add-category" type="button">+ Agregar categoría</button></div>'+data.categories.map((name,i)=>'<div class="category-editor"><span class="category-number">'+String(i+1).padStart(2,'0')+'</span><label class="field">Nombre de la categoría<input data-category-name="'+i+'" value="'+esc(name)+'" maxlength="60" required></label><span class="category-count">'+data.services.filter(s=>s.category===name).length+' servicios</span><button class="text-button danger-text" data-remove-category="'+i+'" type="button" aria-label="Eliminar categoría '+esc(name)+'">Eliminar</button></div>').join('')+'</section>';}
  function administrators(){return '<div class="settings-grid"><section class="panel"><h2>Invita a tu equipo</h2><p>Autoriza su correo. Después, esa persona crea su cuenta y confirma el correo desde el panel de acceso.</p><form id="admin-email-form"><label class="field">Correo del administrador<input name="email" type="email" required maxlength="254" placeholder="nombre@correo.com"></label><button class="btn" type="submit">Autorizar correo</button><p id="admin-email-status" role="status"></p></form></section><section class="panel"><h2>Personas autorizadas</h2><div id="admin-email-list">Cargando…</div><p class="fine">Cada persona usa su propia contraseña. Tu propio acceso permanece activo.</p></section></div>';}
  async function refreshAdministrators(){
    try{const list=await backend.admins(),el=document.querySelector('#admin-email-list');if(!el)return;
      el.innerHTML=list.map(a=>'<div class="admin-email-row"><div><strong>'+esc(a.email)+'</strong><span class="badge '+(a.active?'':'neutral')+'">'+(a.active?'Autorizado':'Desactivado')+'</span></div><button class="text-button" data-admin-email="'+esc(a.email)+'" data-admin-active="'+(!a.active)+'">'+(a.active?'Desactivar':'Activar')+'</button></div>').join('');
      document.querySelectorAll('[data-admin-email]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;try{await backend.manageAdmin(b.dataset.adminEmail,b.dataset.adminActive==='true');await refreshAdministrators();}catch(err){document.querySelector('#admin-email-status').textContent=err.message;}finally{b.disabled=false;}}));
    }catch(err){const el=document.querySelector('#admin-email-list');if(el)el.textContent=err.message;}
  }
  function access(){
    const checks=[['instagram','Instagram','Comprobé que sigue la cuenta.',data.contact.instagramUrl],['tiktok','TikTok','Comprobé que sigue la cuenta.',data.contact.tiktokUrl],['facebook','Facebook','Comprobé que sigue la página.',data.contact.facebookUrl]];
    return '<div class="access-admin-grid"><section class="panel grant-panel"><div class="panel-head"><div><span class="step-chip">PASO 1 DE 2</span><h2>Comprueba los requisitos</h2><p>Abre la conversación de la clienta en WhatsApp. Revisa sus perfiles o las capturas y confirma su cita.</p></div></div>'+(!pricesConfigured?'<div class="attention-note"><p>Completa y guarda las tarifas en Servicios antes de habilitar precios.</p></div>':'')+'<form id="grant-form"><label class="field">Nombre de la clienta <small>Opcional · solo se usa en el mensaje, no se guarda.</small><input name="client" maxlength="80" placeholder="Ej. Valentina" autocomplete="off"></label><div class="checklist">'+checks.map(x=>'<label class="check-card"><input type="checkbox" name="'+x[0]+'" required><span class="check-mark">'+icon('check')+'</span><span><strong>'+x[1]+'</strong><small>'+x[2]+'</small></span></label><a class="network-review" href="'+esc(/^https:\/\//.test(x[3])?x[3]:'#')+'" target="_blank" rel="noopener noreferrer">Abrir '+x[1]+' ↗</a>').join('')+'<label class="check-card booking-check"><input type="checkbox" name="reservation" required><span class="check-mark">'+icon('check')+'</span><span><strong>Reserva confirmada</strong><small>Acordamos el servicio, la fecha y el importe de la cita.</small></span></label></div><div class="checklist-progress"><span id="checks-count">0 de 4 comprobaciones</span><strong>El acceso dura 24 horas</strong></div><button class="btn full" id="grant-button" type="submit" disabled>Preparar enlace privado '+icon('arrow')+'</button><p id="grant-status" role="status" aria-live="polite">'+(dirty?'Publica los cambios pendientes antes de habilitar un acceso.':'')+'</p></form></section><aside class="delivery-panel"><div class="delivery-head"><span class="step-chip">PASO 2 DE 2</span><h2>Envía el acceso por WhatsApp</h2><p>La clienta toca el enlace y ve las tarifas. El enlace ya incluye su acceso.</p></div><div id="grant-placeholder" '+(lastGrant?'hidden':'')+'><div class="message-preview"><span>BEAUTY DAY</span><p>Tu reserva está confirmada.<br>Abre este enlace para consultar nuestros precios.</p><div class="preview-link">'+icon('access')+' Ver precios privados ↗</div></div><p class="fine">Cuando completes las cuatro comprobaciones, aquí aparecerá el mensaje listo para copiar.</p></div><div id="grant-result" '+(!lastGrant?'hidden':'')+'><span class="badge">Enlace listo · 24 horas</span><label class="field">Mensaje para tu clienta<textarea id="grant-message" readonly rows="7">'+esc(lastGrant?lastGrant.message:'')+'</textarea></label><button class="btn full" id="copy-grant" type="button">Copiar mensaje para WhatsApp</button><button class="text-button full" id="copy-link" type="button">Copiar solo el enlace</button><p class="fine">Pégalo en la conversación que acabas de revisar. Pide a la clienta que conserve el enlace para ella.</p></div><details class="access-help"><summary>¿Qué comprueba Beauty Day?</summary><p>El equipo revisa los tres seguimientos y confirma la reserva. Las casillas dejan constancia de esa revisión antes de crear el acceso.</p></details></aside></div><section class="panel revoke-panel"><div><h2>Retirar un acceso</h2><p>Pega el enlace privado enviado a una clienta para dejarlo sin efecto.</p></div><form id="revoke-form"><label class="field"><span class="sr-only">Enlace o código que deseas retirar</span><input name="code" required maxlength="500" autocomplete="off" placeholder="Pega el enlace privado"></label><button class="btn subtle" type="submit">Retirar acceso</button><p id="revoke-status" role="status"></p></form></section><details class="advanced-settings"><summary>Importar tarifas de una copia anterior</summary><label class="field">Archivo de tarifas<input id="import-prices" type="file" accept="application/json,.json"><small>Selecciona el archivo site.json de tu copia anterior. Solo se importan precios de servicios coincidentes.</small></label><p id="import-status" role="status"></p></details>';
  }
  function editor(){
    const [eyebrow,title,description]=sections[tab];
    const views={home:home,general:general,contact:contact,services:services,categories:categories,professionals:()=>collection('professionals','Profesionales'),promotions:()=>collection('promotions','Promociones'),gifts:()=>collection('gifts','Bonos'),combos:()=>collection('combos','Combos'),access:access,administrators:administrators,legal:legal};
    root.innerHTML='<div class="editor"><aside class="admin-sidebar"><a class="brand sidebar-brand" href="../" target="_blank" rel="noopener">Beauty Day<span>ESTUDIO · ADMINISTRACIÓN</span></a><nav class="tabs" aria-label="Secciones del panel"><span class="nav-label">DÍA A DÍA</span>'+navButton('home','Inicio')+navButton('access','Habilitar precios')+'<span class="nav-label">TU WEB</span>'+navButton('services','Servicios y tarifas')+navButton('professionals','Equipo')+navButton('promotions','Promociones')+navButton('gifts','Bonos de regalo')+navButton('combos','Combos')+navButton('general','Portada y textos')+'<span class="nav-label">CONFIGURACIÓN</span>'+navButton('contact','Contacto y redes')+navButton('categories','Categorías')+navButton('administrators','Administradores')+navButton('legal','Privacidad')+'</nav><div class="sidebar-foot"><span class="connection-dot"></span>Conectado a tu salón</div></aside><div class="workspace"><header class="topbar"><div class="breadcrumb"><span>Beauty Day</span><span>/</span><strong>Administración</strong></div><div class="topbar-actions"><a href="../" target="_blank" rel="noopener">Ver mi web ↗</a><button class="text-button" id="logout">Cerrar sesión</button></div><label class="mobile-nav">Ir a<select id="mobile-section">'+Object.entries(sections).map(([key,value])=>'<option value="'+key+'" '+(tab===key?'selected':'')+'>'+(key==='home'?'Inicio':value[1])+'</option>').join('')+'</select></label></header><main class="workspace-main"><div class="editor-head"><div><span class="eyebrow">'+eyebrow+'</span><h1>'+title+'</h1><p>'+description+'</p></div><button class="btn subtle" id="save-top" data-save '+(!dirty||busy?'disabled':'')+'>'+(dirty?'Publicar cambios':'Todo guardado '+icon('check'))+'</button></div><div class="status" role="status" aria-live="polite"></div><div class="edit-area">'+views[tab]()+'</div></main><div class="savebar" '+(!dirty?'hidden':'')+'><div><strong>Cambios pendientes</strong><span>Aún no aparecen en la web.</span></div><button class="btn" id="save" data-save '+(busy?'disabled':'')+'>Publicar cambios '+icon('arrow')+'</button></div></div><div id="modal-slot"></div></div>';
    bind();if(tab==='administrators')refreshAdministrators();
  }
  function draftField(key,label,type='text',wide=false){
    let input;const value=dialogDraft[key];
    if(type==='textarea')input='<textarea data-draft="'+key+'" maxlength="1200">'+esc(value)+'</textarea>';
    else if(type==='category')input='<select data-draft="'+key+'">'+data.categories.map(c=>'<option '+(value===c?'selected':'')+'>'+esc(c)+'</option>').join('')+'</select>';
    else if(type==='checkbox')input='<input type="checkbox" data-draft="'+key+'" '+(value?'checked':'')+'>';
    else input='<input data-draft="'+key+'" type="'+type+'" value="'+esc(value===null?'':value)+'" '+(['name','title'].includes(key)?'required ':'')+(type==='number'?'min="'+(key==='duration'?1:0)+'" max="'+(key==='duration'?1440:99999999)+'" step="1" ':'maxlength="'+(key==='pricePrefix'?40:key==='name'?(dialogKey==='professionals'?100:120):key==='title'?160:300)+'" ')+'>';
    return '<label class="field '+(wide?'wide ':'')+(type==='checkbox'?'check':'')+'">'+label+input+(type==='number'?'<small>'+ (key==='price'?'Pesos colombianos. Déjalo vacío si está por definir.':'Minutos. Déjalo vacío si está por definir.')+'</small>':'')+'</label>';
  }
  function newEntry(key){
    const shared={id:id(),image:''};
    if(key==='services')return Object.assign(shared,{name:'',category:data.categories[0],description:'',price:null,pricePrefix:'',duration:null,featured:false});
    if(key==='professionals')return Object.assign(shared,{name:'',role:'',bio:'',categories:[],schedule:''});
    if(key==='promotions')return Object.assign(shared,{title:'',tag:'',description:'',terms:'',active:false});
    return {id:id(),title:'',description:''};
  }
  function openEntry(key,index=-1){
    lastFocus=document.activeElement;dialogKey=key;dialogIndex=index;dialogDraft=structuredClone(index<0?newEntry(key):data[key][index]);
    let fields='';
    if(key==='services')fields=draftField('name','Nombre del servicio')+draftField('category','Categoría','category')+draftField('price','Tarifa privada (COP)','number')+draftField('duration','Duración','number')+draftField('pricePrefix','Texto antes del precio (opcional)')+draftField('featured','Destacar en la página de inicio','checkbox')+draftField('description','Descripción','textarea',true);
    if(key==='professionals')fields=draftField('name','Nombre')+draftField('role','Especialidad')+draftField('schedule','Horario individual','text',true)+draftField('bio','Presentación','textarea',true)+'<fieldset class="wide categories-choice"><legend>Servicios que realiza</legend>'+data.categories.map(c=>'<label><input type="checkbox" data-draft-category value="'+esc(c)+'" '+(dialogDraft.categories.includes(c)?'checked':'')+'>'+esc(c)+'</label>').join('')+'</fieldset>';
    if(key==='promotions')fields=draftField('title','Nombre de la promoción','text',true)+draftField('tag','Etiqueta')+draftField('active','Mostrar en la web','checkbox')+draftField('description','Descripción','textarea',true)+draftField('terms','Condiciones','textarea',true);
    if(key==='gifts'||key==='combos')fields=draftField('title','Nombre','text',true)+draftField('description','Descripción','textarea',true);
    const singular={services:'servicio',professionals:'profesional',promotions:'promoción',gifts:'bono',combos:'combo'}[key];
    document.querySelector('#modal-slot').innerHTML='<dialog class="edit-dialog" id="entry-dialog" aria-labelledby="dialog-title"><form id="entry-form"><header class="dialog-head"><div><span class="eyebrow">'+(index<0?'AGREGAR A TU WEB':'EDITAR')+'</span><h2 id="dialog-title">'+(index<0?'Nuevo '+singular:esc(dialogDraft.name||dialogDraft.title))+'</h2></div><button class="icon-button" type="button" id="close-dialog" aria-label="Cerrar editor">'+icon('close')+'</button></header><div class="dialog-body"><div class="form-grid">'+fields+'</div>'+(Object.hasOwn(dialogDraft,'image')?'<div class="dialog-photo"><div id="draft-photo-preview">'+(dialogDraft.image?'<img src="'+esc(photo(dialogDraft.image))+'" alt="Fotografía actual">':'<div class="upload-placeholder">'+icon(key)+'<span>Sin fotografía</span></div>')+'</div><label class="field">Fotografía<input type="file" id="draft-photo" accept="image/jpeg,image/png,image/webp"><small>El panel adapta la imagen antes de subirla.</small></label></div>':'')+'<p class="dialog-status" id="dialog-status" role="status" aria-live="polite"></p></div><footer class="dialog-footer">'+(index>=0?'<button class="text-button danger-text" id="delete-entry" type="button">Eliminar '+singular+'</button>':'<span></span>')+'<div><button class="btn subtle" type="button" id="cancel-dialog">Cancelar</button><button class="btn" type="submit" id="save-entry">Guardar '+singular+'</button></div></footer></form></dialog>';
    const dialog=document.querySelector('#entry-dialog');dialog.showModal();
    const close=()=>{if(dialogBusy)return;dialog.close();document.querySelector('#modal-slot').innerHTML='';lastFocus?.focus();};
    document.querySelector('#close-dialog').addEventListener('click',close);document.querySelector('#cancel-dialog').addEventListener('click',close);
    dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
    document.querySelector('#draft-photo')?.addEventListener('change',async e=>{
      let file=e.currentTarget.files[0];if(!file)return;
      const input=e.currentTarget,message=document.querySelector('#dialog-status');dialogBusy=true;input.disabled=true;document.querySelector('#save-entry').disabled=true;message.textContent='Preparando la fotografía…';
      try{file=await preparePhoto(file);const result=await backend.upload(file);dialogDraft.image=result.path;document.querySelector('#draft-photo-preview').innerHTML='<img src="'+esc(photo(result.path))+'" alt="Nueva fotografía">';message.textContent='Fotografía lista. Guarda para mostrarla en la web.';}catch(err){message.textContent=err.message;}finally{dialogBusy=false;input.disabled=false;document.querySelector('#save-entry').disabled=false;}
    });
    document.querySelector('#entry-form').addEventListener('submit',async e=>{
      e.preventDefault();if(dialogBusy||!e.currentTarget.reportValidity())return;
      document.querySelectorAll('[data-draft]').forEach(el=>dialogDraft[el.dataset.draft]=el.type==='checkbox'?el.checked:el.type==='number'?(el.value===''?null:Number(el.value)):el.value.trim());
      if(key==='professionals')dialogDraft.categories=[...document.querySelectorAll('[data-draft-category]:checked')].map(el=>el.value);
      if(!(dialogDraft.name||dialogDraft.title)?.trim()){document.querySelector('#dialog-status').textContent='Escribe un nombre para continuar.';return;}
      const next=structuredClone(data);if(index<0)next[key].push(dialogDraft);else next[key][index]=dialogDraft;
      await commitEntry(next,dialog,singular);
    });
    document.querySelector('#delete-entry')?.addEventListener('click',async()=>{
      if(dialogBusy||!confirm('¿Eliminar '+(dialogDraft.name||dialogDraft.title)+' de la web?'))return;
      const next=structuredClone(data);next[key].splice(index,1);await commitEntry(next,dialog,singular);
    });
  }
  async function commitEntry(next,dialog,singular){
    dialogBusy=true;document.querySelectorAll('#entry-dialog input,#entry-dialog textarea,#entry-dialog select,.dialog-footer button').forEach(b=>b.disabled=true);document.querySelector('#dialog-status').textContent='Guardando '+singular+'…';
    try{const result=await backend.saveContent(next,sha);data=next;sha=result.revision;pricesConfigured=result.pricesConfigured;dirty=false;dialog.close();editor();status('Guardado. El cambio ya aparece en tu web.');}
    catch(err){document.querySelector('#dialog-status').textContent=err.message;}
    finally{dialogBusy=false;document.querySelectorAll('#entry-dialog input,#entry-dialog textarea,#entry-dialog select,.dialog-footer button').forEach(b=>b.disabled=false);}
  }
  function bindRowButtons(){document.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openEntry(b.dataset.edit,Number(b.dataset.index))));}
  function bind(){
    document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tab;editor();}));
    document.querySelector('#mobile-section')?.addEventListener('change',e=>{tab=e.currentTarget.value;editor();});
    document.querySelectorAll('[data-add]').forEach(b=>b.addEventListener('click',()=>{const key=b.dataset.add;if(data[key].length>=(key==='services'?100:30)){status('Has alcanzado el máximo de elementos de esta sección.',true);return;}openEntry(key);}));
    bindRowButtons();
    document.querySelector('#service-search')?.addEventListener('input',e=>{serviceSearch=e.currentTarget.value;document.querySelector('#services-list').innerHTML=serviceRows();bindRowButtons();});
    document.querySelector('#service-category')?.addEventListener('change',e=>{serviceCategory=e.currentTarget.value;document.querySelector('#services-list').innerHTML=serviceRows();bindRowButtons();});
    document.querySelectorAll('[data-save]').forEach(b=>b.addEventListener('click',save));
    document.querySelector('#logout').addEventListener('click',async()=>{if(dirty&&!confirm('Hay cambios sin publicar. ¿Cerrar la sesión y descartarlos?'))return;try{await backend.signOut();token='';data=null;dirty=false;lastGrant=null;login();}catch(err){status(err.message,true);}});
    document.querySelectorAll('[data-path]').forEach(el=>el.addEventListener('input',()=>set(el.dataset.path,el.type==='checkbox'?el.checked:el.type==='number'?(el.value===''?null:Number(el.value)):el.value)));
    document.querySelectorAll('[data-upload]').forEach(el=>el.addEventListener('change',async()=>{let file=el.files[0];if(!file)return;el.disabled=true;status('Preparando la fotografía…');try{file=await preparePhoto(file);const result=await backend.upload(file);set(el.dataset.upload,result.path);if(el.dataset.upload==='brand.heroImage')set('brand.heroImageIsReference',false);editor();status('Fotografía lista. Publica el cambio para mostrarla en tu web.');}catch(err){status(err.message,true);el.disabled=false;}}));
    document.querySelector('#add-category')?.addEventListener('click',()=>{if(data.categories.length>=12){status('Puedes crear hasta 12 categorías.',true);return;}let name='Nueva categoría',i=2;while(data.categories.includes(name))name='Nueva categoría '+i++;data.categories.push(name);dirty=true;editor();});
    document.querySelectorAll('[data-category-name]').forEach(input=>input.addEventListener('change',()=>{const i=Number(input.dataset.categoryName),old=data.categories[i],name=input.value.trim();if(!name||data.categories.some((c,j)=>j!==i&&c===name)){input.value=old;status('Escribe un nombre único para la categoría.',true);return;}data.categories[i]=name;data.services.forEach(s=>{if(s.category===old)s.category=name;});data.professionals.forEach(p=>p.categories=p.categories.map(c=>c===old?name:c));dirty=true;editor();}));
    document.querySelectorAll('[data-remove-category]').forEach(b=>b.addEventListener('click',()=>{const i=Number(b.dataset.removeCategory),name=data.categories[i];if(data.categories.length===1||data.services.some(s=>s.category===name)||data.professionals.some(p=>p.categories.includes(name))){status('Esta categoría tiene servicios o profesionales. Reasígnalos antes de eliminarla.',true);return;}if(!confirm('¿Eliminar la categoría '+name+'?'))return;data.categories.splice(i,1);dirty=true;editor();}));
    document.querySelector('#admin-email-form')?.addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,message=document.querySelector('#admin-email-status'),button=form.querySelector('button');button.disabled=true;try{await backend.manageAdmin(form.elements.email.value.trim(),true);message.textContent='Correo autorizado. Esta persona puede crear su cuenta y confirmar su correo.';form.reset();await refreshAdministrators();}catch(err){message.textContent=err.message;}finally{button.disabled=false;}});
    const grantForm=document.querySelector('#grant-form');
    if(grantForm){
      const refreshChecks=()=>{const n=['instagram','tiktok','facebook','reservation'].filter(k=>grantForm.elements[k].checked).length;document.querySelector('#checks-count').textContent=n+' de 4 comprobaciones';document.querySelector('#grant-button').disabled=n!==4||!pricesConfigured||dirty||busy;};
      grantForm.addEventListener('change',refreshChecks);refreshChecks();
      grantForm.addEventListener('submit',async e=>{
        e.preventDefault();const form=e.currentTarget,button=document.querySelector('#grant-button'),message=document.querySelector('#grant-status');if(dirty||busy)return;
        button.disabled=true;message.textContent='Preparando el enlace privado…';
        try{
          const checks=Object.fromEntries(['instagram','tiktok','facebook','reservation'].map(k=>[k,form.elements[k].checked]));
          const result=await backend.issueCode(checks),link=window.BeautyAccess.link(result.code,new URL('../',location.href).href),name=form.elements.client.value.trim();
          lastGrant={link,message:'Hola'+(name?' '+name:'')+', tu reserva en Beauty Day está confirmada.\n\nYa revisamos tus seguimientos en Instagram, TikTok y Facebook. Abre este enlace para ver nuestros precios:\n'+link+'\n\nDisponible hasta '+new Date(result.expiresAt).toLocaleString('es-CO')+'.\nGuarda este enlace para ti; es tu acceso privado.'};
          document.querySelector('#grant-message').value=lastGrant.message;document.querySelector('#grant-result').hidden=false;document.querySelector('#grant-placeholder').hidden=true;message.textContent='Listo. Copia el mensaje del paso 2 y envíalo a tu clienta.';form.reset();document.querySelector('#grant-result').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'nearest'});
        }catch(err){message.textContent=err.message;}finally{refreshChecks();}
      });
    }
    const copy=async text=>{try{await navigator.clipboard.writeText(text);document.querySelector('#grant-status').textContent='Copiado. Pégalo en la conversación de WhatsApp.';}catch{const input=document.querySelector('#grant-message');input.focus();input.select();document.querySelector('#grant-status').textContent='Seleccionamos el mensaje. Usa Copiar en tu dispositivo.';}};
    document.querySelector('#copy-grant')?.addEventListener('click',()=>lastGrant&&copy(lastGrant.message));
    document.querySelector('#copy-link')?.addEventListener('click',()=>lastGrant&&copy(lastGrant.link));
    document.querySelector('#revoke-form')?.addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,button=form.querySelector('button'),message=document.querySelector('#revoke-status');button.disabled=true;try{await backend.revokeCode(window.BeautyAccess.normalize(form.elements.code.value));message.textContent='Acceso retirado. Las páginas abiertas se actualizarán en un minuto como máximo.';form.reset();}catch(err){message.textContent=err.message;}finally{button.disabled=false;}});
    document.querySelector('#import-prices')?.addEventListener('change',async e=>{const file=e.currentTarget.files[0],message=document.querySelector('#import-status');if(!file)return;try{if(file.size>300000)throw Error('El archivo es demasiado grande.');const source=JSON.parse(await file.text());if(!Array.isArray(source.services))throw Error('Selecciona el archivo site.json de tu copia anterior.');let count=0;for(const s of source.services){if(!data.services.some(x=>x.id===s.id))continue;if(!(s.price===null||Number.isInteger(s.price)&&s.price>=0&&s.price<100000000)||typeof s.pricePrefix!=='string'||s.pricePrefix.length>40)throw Error('Revisa el formato de las tarifas del archivo.');count++;}if(!count)throw Error('El archivo no coincide con tu catálogo.');for(const s of source.services){const target=data.services.find(x=>x.id===s.id);if(target){target.price=s.price;target.pricePrefix=s.pricePrefix;}}dirty=true;status(count+' tarifas importadas. Publica los cambios para guardarlas.');document.querySelector('#grant-button').disabled=true;message.textContent=count+' tarifas importadas.';}catch(err){message.textContent=err.message;}});
  }
  async function save(){
    if(!dirty||busy)return;const formInputs=[...document.querySelectorAll('[data-path]')];if(formInputs.some(el=>!el.reportValidity()))return;
    busy=true;status('Publicando los cambios…');
    document.querySelectorAll('.editor button,.editor input,.editor textarea,.editor select').forEach(el=>el.disabled=true);
    try{const result=await backend.saveContent(data,sha);sha=result.revision;pricesConfigured=result.pricesConfigured;dirty=false;busy=false;editor();status('Publicado. Los cambios ya aparecen en tu web.');}
    catch(err){busy=false;editor();status(err.message,true);}finally{busy=false;}
  }

  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  let recovering=false;
  backend.onAuthChange(event=>{if(event==='PASSWORD_RECOVERY'){recovering=true;setTimeout(passwordRecovery,0);}});
  if(!backend.configured)login('Falta conectar la base de datos de Beauty Day.');
  else backend.session().then(session=>{if(recovering)return;if(session){token='authenticated';load();}else login();}).catch(error=>login(error.message));
})();
