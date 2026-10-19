// Карта дилеров в прототипе (ТЗ 14): метки по координатам, при отдалении — кластеры по городам с числом,
// клик по метке — балун «название + описание», клик по названию в списке — прокрутка к карте и приближение.
// На сайте вместо этого — Яндекс.Карты (ymaps) с кластеризатором; разметка списка и фильтров та же.
(() => {
  const map = document.querySelector('[data-dealers-map]');
  if (!map) return;
  const canvas = map.querySelector('[data-map-canvas]');
  const balloon = map.querySelector('[data-map-balloon]');
  const balloonBody = balloon.querySelector('[data-map-balloon-body]');
  balloon.querySelector('[data-map-balloon-close]').addEventListener('click', () => { balloon.hidden = true; });
  const points = JSON.parse(map.dataset.points || '[]');
  if (!points.length) { canvas.innerHTML = '<p class="dealers-map__empty">Нет дилеров с адресом на карте</p>'; return; }

  // Видимая область: вся сеть или отфильтрованные точки
  let view = null;
  const fit = (pts, pad = 0.15) => {
    const lats = pts.map((p) => p.lat), lons = pts.map((p) => p.lon);
    const [a, b, c, d] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
    // Охват не меньше минимального и по центру точек — одна метка встаёт в середину карты, а не в угол
    const hLat = (Math.max(b - a, 1.2) * (1 + 2 * pad)) / 2, hLon = (Math.max(d - c, 2.4) * (1 + 2 * pad)) / 2;
    const [mLat, mLon] = [(a + b) / 2, (c + d) / 2];
    return { latMin: mLat - hLat, latMax: mLat + hLat, lonMin: mLon - hLon, lonMax: mLon + hLon };
  };
  const project = (p) => ({
    x: ((p.lon - view.lonMin) / (view.lonMax - view.lonMin)) * 100,
    y: (1 - (p.lat - view.latMin) / (view.latMax - view.latMin)) * 100,
  });

  const showBalloon = (group, x, y) => {
    balloonBody.innerHTML = group.map((p) => `<div class="dealers-map__item"><b>${p.name}</b>${p.html}</div>`).join('');
    balloon.hidden = false;
    balloon.style.left = `${Math.min(Math.max(x, 18), 82)}%`;
    balloon.style.top = `${y}%`;
  };

  const render = () => {
    canvas.innerHTML = '';
    balloon.hidden = true;
    // «Кластеризация»: при большом охвате точки одного города объединяются
    const wide = view.lonMax - view.lonMin > 8;
    const groups = new Map();
    points.forEach((p) => {
      const key = wide ? p.city : `${p.id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    });
    groups.forEach((group) => {
      const c = { lat: group.reduce((s, p) => s + p.lat, 0) / group.length, lon: group.reduce((s, p) => s + p.lon, 0) / group.length };
      const { x, y } = project(c);
      if (x < -2 || x > 102 || y < -2 || y > 102) return;
      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = group.length > 1 ? 'dealers-map__cluster' : 'dealers-map__pin';
      pin.style.left = `${x}%`;
      pin.style.top = `${y}%`;
      pin.textContent = group.length > 1 ? group.length : '';
      pin.title = group.length > 1 ? `${group[0].city}: ${group.length}` : group[0].name;
      pin.dataset.ids = group.map((p) => p.id).join(',');
      pin.addEventListener('click', () => showBalloon(group, x, y));
      canvas.append(pin);
    });
  };

  view = map.dataset.focus === 'fit' ? fit(points) : { latMin: 37, latMax: 66, lonMin: 24, lonMax: 112 };
  render();

  // Название в списке: прокрутка к карте, приближение к дилеру, балун
  document.querySelectorAll('[data-dealer-focus]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = points.find((x) => String(x.id) === btn.dataset.dealerFocus);
      if (!p) return;
      map.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
      view = { latMin: p.lat - 0.6, latMax: p.lat + 0.6, lonMin: p.lon - 1.2, lonMax: p.lon + 1.2 };
      render();
      const pin = [...canvas.children].find((el) => el.dataset.ids === String(p.id));
      pin?.classList.add('is-active');
      const { x, y } = project(p);
      showBalloon([p], x, y);
    });
  });
})();
