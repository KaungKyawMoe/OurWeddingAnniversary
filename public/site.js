(function () {
  var FONTS = { 'Brush Script MT': ['"Brush Script MT","Segoe Script",cursive'], 'Great Vibes': ['"Great Vibes",cursive', 1], 'Dancing Script': ['"Dancing Script",cursive', 1],
    'Allura': ['Allura,cursive', 1], 'Parisienne': ['Parisienne,cursive', 1], 'Georgia': ['Georgia,"Times New Roman",serif'], 'Playfair Display': ['"Playfair Display",serif', 1],
    'Cormorant Garamond': ['"Cormorant Garamond",serif', 1], 'Lora': ['Lora,serif', 1], 'Libre Baskerville': ['"Libre Baskerville",serif', 1] };
  window.FONTS = FONTS;
  var VARS = { rose: '--rose', deepRose: '--deep-rose', ivory: '--ivory', blush: '--blush', ink: '--ink', gold: '--gold' };
  function font(name, prop) {
    var f = FONTS[name], r = document.documentElement.style;
    if (!f) return r.removeProperty(prop);
    if (f[1] && !document.getElementById('gf-' + name)) {
      var l = document.createElement('link'); l.id = 'gf-' + name; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=' + name.replace(/ /g, '+') + '&display=swap'; document.head.appendChild(l);
    }
    r.setProperty(prop, f[0]);
  }
  function apply(c) {
    c = c || {}; var t = c.text || {}, th = c.theme || {}, im = c.images || {}, r = document.documentElement.style;
    document.querySelectorAll('[data-k]').forEach(function (e) {
      if (e.dataset.d === undefined) e.dataset.d = e.textContent;
      e.textContent = typeof t[e.dataset.k] === 'string' ? t[e.dataset.k] : e.dataset.d;
    });
    Object.keys(VARS).forEach(function (k) { th[k] ? r.setProperty(VARS[k], th[k]) : r.removeProperty(VARS[k]); });
    font(th.scriptFont, '--script-font'); font(th.bodyFont, '--body-font');
    th.scale ? r.setProperty('--scale', th.scale) : r.removeProperty('--scale');
    document.body.classList.toggle('no-hearts', th.hearts === false);
    document.querySelectorAll('img[data-img]').forEach(function (i) {
      if (i.dataset.d === undefined) i.dataset.d = i.getAttribute('src');
      var v = im[i.dataset.img];
      if (v === null) { i.setAttribute('src', ''); i.style.display = 'none'; }
      else { i.setAttribute('src', v ? '/uploads/' + v : i.dataset.d); i.style.display = ''; }
    });
  }
  if (location.search.indexOf('preview=1') > -1) {          // inside the admin dashboard
    addEventListener('message', function (e) { if (e.origin === location.origin && e.data && e.data.type === 'apply') apply(e.data.content); });
  } else {
    fetch('/api/content').then(function (r) { return r.json(); }).then(apply).catch(function () {});
  }
})();
