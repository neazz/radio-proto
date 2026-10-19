// Карточка товара (ТЗ 9.3): галерея, подсветка якорного меню, вкладки PDF-ридера, плеер VK по клику.
(() => {
  // Галерея: лента фото со snap. Стрелки и миниатюры прокручивают ленту — фото плавно едет вбок (с клавиатуры
  // и при «Уменьшить движение» — сразу). Текущее фото подсвечивает миниатюру; «На весь экран» и клик по фото —
  // просмотр со стрелками (js/app.js, data-lightbox)
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('[data-gallery]').forEach((gallery) => {
    const track = gallery.querySelector('[data-gallery-track]');
    if (!track) return;
    const slides = [...track.children];
    const thumbs = [...gallery.querySelectorAll('[data-gallery-thumb]')];
    const prev = gallery.querySelector('[data-gallery-prev]');
    const next = gallery.querySelector('[data-gallery-next]');
    const index = () => Math.round(track.scrollLeft / track.clientWidth);
    const go = (i, e) => {
      const j = Math.max(0, Math.min(slides.length - 1, i));
      track.scrollTo({ left: j * track.clientWidth, behavior: reduce.matches || e?.detail === 0 ? 'auto' : 'smooth' });
    };
    const update = () => {
      const i = index();
      thumbs.forEach((t, j) => t.setAttribute('aria-pressed', String(j === i)));
      if (prev) prev.disabled = i <= 0;
      if (next) next.disabled = i >= slides.length - 1;
    };
    thumbs.forEach((t, j) => t.addEventListener('click', (e) => go(j, e)));
    prev?.addEventListener('click', (e) => go(index() - 1, e));
    next?.addEventListener('click', (e) => go(index() + 1, e));
    gallery.querySelector('[data-gallery-zoom]')?.addEventListener('click', () => slides[index()]?.click());
    track.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
    update();
  });

  // Нижняя панель покупки (до 1080): видна, пока основной блок покупки — цена и кнопка — не на экране. Её высота —
  // в --buybar-offset: на неё поднимаются «Наверх», чат, плашка cookie и тосты
  const bar = document.querySelector('[data-buy-bar]');
  const buy = document.querySelector('[data-buy-main] .product-buy__main');
  if (bar && buy) {
    bar.hidden = false;
    const narrow = matchMedia('(max-width: 1079px)');
    let buyVisible = true;
    const sync = () => {
      const open = narrow.matches && !buyVisible;
      bar.toggleAttribute('data-open', open);
      bar.inert = !open;
      document.documentElement.style.setProperty('--buybar-offset', open ? `${bar.offsetHeight}px` : '0px');
    };
    new IntersectionObserver(([entry]) => { buyVisible = entry.isIntersecting; sync(); }).observe(buy);
    narrow.addEventListener('change', sync);
  }

  // Якорное меню: подсветка раздела, который сейчас на экране, и прокрутка меню к нему
  const links = [...document.querySelectorAll('[data-anchor-link]')];
  const sections = [...document.querySelectorAll('[data-anchor-section]')];
  if (links.length && sections.length) {
    const list = links[0].closest('ul');
    let current = null;
    const setActive = (id) => {
      if (id === current) return;
      current = id;
      links.forEach((a) => {
        const on = a.getAttribute('href') === '#' + id;
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
        // Двигаем только строку меню (на мобиле она прокручивается вбок). scrollIntoView здесь нельзя:
        // он прокручивает и страницу — пока пользователь крутит колесо, её дёргает назад.
        if (on && list && list.scrollWidth > list.clientWidth) {
          const box = list.getBoundingClientRect();
          const link = a.getBoundingClientRect();
          list.scrollTo({ left: list.scrollLeft + link.left - box.left - (box.width - link.width) / 2, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        }
      });
    };
    // Текущий раздел — последний, чей верх дошёл до места, куда его ставит переход по якорю (scroll-padding страницы
    // + scroll-margin раздела). IntersectionObserver здесь отставал на раздел: он сообщает только об изменившихся
    // секциях, а не обо всех видимых. В самом низу страницы — последний раздел
    let ticking = false;
    const limit = () => parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop || 0)
      + parseFloat(getComputedStyle(sections[0]).scrollMarginTop || 0) + 8;
    const pick = () => {
      ticking = false;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      const top = limit();
      let id = sections[0].id;
      for (const s of sections) if (s.getBoundingClientRect().top <= top) id = s.id;
      setActive(atBottom ? sections[sections.length - 1].id : id);
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(pick); } }, { passive: true });
    pick();

    // Меню шире экрана — края затухают, видно, что его можно прокрутить
    if (list) {
      const edges = () => {
        list.toggleAttribute('data-more-start', list.scrollLeft > 2);
        list.toggleAttribute('data-more-end', list.scrollLeft + list.clientWidth < list.scrollWidth - 2);
      };
      list.addEventListener('scroll', edges, { passive: true });
      new ResizeObserver(edges).observe(list);
      edges();
    }
  }
})();
