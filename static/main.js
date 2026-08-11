// DMT Building Group — nav, dropdowns, gallery filter, lightbox
(function () {
  // Mobile nav toggle
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // Dropdowns: tap-to-open on touch/mobile
  document.querySelectorAll('.has-drop > a').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var li = link.parentElement;
      var isMobile = window.matchMedia('(max-width: 900px)').matches;
      if (isMobile && !li.classList.contains('open')) {
        e.preventDefault();
        document.querySelectorAll('.has-drop.open').forEach(function (o) {
          if (o !== li) o.classList.remove('open');
        });
        li.classList.add('open');
      }
    });
  });

  // Filterable grids (Our Work gallery + blog topics)
  document.querySelectorAll('.filter-bar').forEach(function (bar) {
    var scope = bar.parentElement;
    bar.addEventListener('click', function (e) {
      var btn = e.target.closest('.filter-btn');
      if (!btn) return;
      bar.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var f = btn.dataset.filter;
      scope.querySelectorAll('.g-item').forEach(function (item) {
        var cats = (item.dataset.cats || '').split(/\s+/);
        item.classList.toggle('hidden', f !== 'all' && cats.indexOf(f) === -1);
      });
    });
  });

  // Lightbox for gallery items that declare a full-size image
  var lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = '<img alt="">';
  document.body.appendChild(lb);
  lb.addEventListener('click', function () { lb.classList.remove('open'); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') lb.classList.remove('open');
  });
  document.querySelectorAll('[data-full]').forEach(function (el) {
    el.addEventListener('click', function () {
      lb.querySelector('img').src = el.dataset.full;
      lb.classList.add('open');
    });
  });
})();
