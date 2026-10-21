// Статичная копия: патчи scripts/export.mjs (JS_PATCHES)
// Общий JS шаблона «Радио-Сервис». Чистый JS, без библиотек (ТЗ 3.1: без SPA).
// Модули независимы: каждый ищет свою разметку по data-атрибутам и молча выходит, если её нет.
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const canHover = window.matchMedia('(hover: hover)').matches;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Прокрутка из JS: плавная, а при «Уменьшить движение» в системе — мгновенная (CSS scroll-behavior её не касается)
  const smooth = () => (reduceMotion.matches ? 'auto' : 'smooth');

  // Плавные появления (CSS: html.is-ready) — только после первой отрисовки, чтобы блоки не «проявлялись» при загрузке
  requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.add('is-ready')));

  // localStorage может быть недоступен (приватный режим, запрет cookie) — тогда работаем без памяти
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* без памяти */ }
    },
  };

  // Тосты Basecoat: radioToast('Заголовок', 'Текст', 'success' | 'info' | 'error', { action: { label, onclick | href }, duration })
  window.radioToast = (title, description = '', category = 'success', extra = {}) => {
    const toaster = $('#toaster');
    if (toaster?.toast) toaster.toast({ category, title, description, ...extra });
  };

  // ---------------------------------------------------------------------------
  // Шапка: компактный режим, каталог, подменю, «Ещё» при переполнении (ТЗ 4.1)
  // ---------------------------------------------------------------------------
  const header = $('[data-header]');
  if (header) {
    // Компактная шапка после прокрутки первых 120 px
    const onScroll = () => header.classList.toggle('is-compact', window.scrollY > 120);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Панель каталога — прямой потомок шапки: встаёт под шапкой во всю ширину и в полной, и в компактной
    const catalogPanel = $('[data-catalog-panel]');
    if (catalogPanel) header.append(catalogPanel);
  }

  // ---------------------------------------------------------------------------
  // Навигационное меню с выпадашкой (ТЗ 4.1): кнопка «Каталог» у поиска, «О компании», «Ещё», меню ЛК.
  // Пункт — одна кнопка-ссылка со стрелкой (data-nav-trigger), панель — по aria-controls:
  // выпадашка Dropdown Menu из Basecoat ([data-popover] + role="menu") или панель каталога во всю ширину.
  // Мышь: наведение открывает, клик по ссылке ведёт на страницу (ТЗ); с data-nav-click — только клик (кнопка
  // «Каталог»: мышь идёт мимо неё к полю поиска). Тач: первый тап открывает, ссылка на сам раздел — в меню.
  // Клавиатура: ↓ или пробел (у кнопки — и Enter) открывают и ставят фокус в меню, ↑↓ — по пунктам, Esc — закрыть.
  // Скрипт Basecoat для этих меню не нужен (он открывает по клику): у обёртки data-dropdown-menu-initialized.
  // ---------------------------------------------------------------------------
  const navMenus = [];
  const closeNavMenus = (except) => navMenus.forEach((m) => { if (m !== except) m.close(); });
  $$('[data-nav-menu]').forEach((root) => {
    const trigger = $('[data-nav-trigger]', root);
    const panel = document.getElementById(trigger.getAttribute('aria-controls'));
    if (!panel) return;
    const items = () => $$('[role="menuitem"], a', panel).filter((a) => a.offsetParent !== null);
    let timer = null;
    const isOpen = () => panel.getAttribute('aria-hidden') === 'false';
    const set = (open) => {
      clearTimeout(timer);
      if (open === isOpen()) return;
      if (open) closeNavMenus(menu);
      panel.setAttribute('aria-hidden', String(!open));
      trigger.setAttribute('aria-expanded', String(open));
    };
    const menu = { root, panel, close: () => set(false), open: () => set(true) };
    navMenus.push(menu);

    if (canHover && !root.hasAttribute('data-nav-click')) {
      [root, panel].forEach((el) => {
        el.addEventListener('mouseenter', () => set(true));
        el.addEventListener('mouseleave', () => { clearTimeout(timer); timer = setTimeout(() => set(false), 160); });
      });
    }
    trigger.addEventListener('click', (e) => {
      // Ссылка при наведении мышью ведёт на страницу; кнопка и первый тап на таче — открывают меню
      if (trigger.tagName === 'A' && canHover) return;
      if (trigger.tagName === 'A' && isOpen()) return;
      e.preventDefault();
      e.stopPropagation();
      // Кнопка, нажатая с клавиатуры (Enter, пробел: у такого клика detail = 0), — как ↓: сразу и с фокусом в меню
      if (e.detail === 0 && trigger.tagName === 'BUTTON' && !isOpen()) openFocused();
      else set(!isOpen());
    });
    const focusItem = (i) => { const list = items(); list[(i + list.length) % list.length]?.focus(); };
    // С клавиатуры панель открывается и закрывается без анимации: такие действия повторяются и должны ощущаться
    // мгновенными. data-instant гасит переход на время смены состояния
    const instant = (open) => {
      panel.setAttribute('data-instant', '');
      set(open);
      requestAnimationFrame(() => requestAnimationFrame(() => panel.removeAttribute('data-instant')));
    };
    const openFocused = () => {
      instant(true);
      // Если панель всё же ещё невидима, focus() молча не срабатывает — пробуем несколько кадров
      const tryFocus = (left) => { focusItem(0); if (!panel.contains(document.activeElement) && left > 0) setTimeout(() => tryFocus(left - 1), 40); };
      requestAnimationFrame(() => tryFocus(8));
    };
    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || (e.key === ' ' && trigger.tagName === 'A')) {
        e.preventDefault();
        openFocused();
      } else if (e.key === 'Escape') instant(false);
    });
    panel.addEventListener('keydown', (e) => {
      const list = items();
      const i = list.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); focusItem(i + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); focusItem(i - 1); }
      else if (e.key === 'Home') { e.preventDefault(); focusItem(0); }
      else if (e.key === 'End') { e.preventDefault(); focusItem(-1); }
      else if (e.key === 'Escape') { instant(false); trigger.focus(); }
    });
    // Фокус ушёл из пункта и его панели (Tab дальше) — закрываем
    [root, panel].forEach((el) => el.addEventListener('focusout', (e) => {
      if (!root.contains(e.relatedTarget) && !panel.contains(e.relatedTarget)) set(false);
    }));
  });
  document.addEventListener('click', (e) => navMenus.forEach((m) => {
    if (!m.root.contains(e.target) && !m.panel.contains(e.target)) m.close();
  }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeNavMenus(); });

  if (header) {
    // Переполнение меню: пункты, которые не влезли в строку, уезжают в «Ещё»
    const nav = $('[data-priority-nav]');
    if (nav) {
      const list = $('[data-priority-list]', nav);
      const more = $('[data-priority-more]', nav);
      const overflow = $('[data-priority-overflow]', nav);
      const items = $$('[data-priority-item]', list);
      const relayout = () => {
        items.forEach((li) => { li.hidden = false; });
        overflow.innerHTML = '';
        more.hidden = true;
        if (list.scrollWidth <= nav.clientWidth) return;
        more.hidden = false;
        for (let i = items.length - 1; i >= 0 && list.scrollWidth > nav.clientWidth; i--) {
          const li = items[i];
          li.hidden = true;
          const a = $('a', li);
          overflow.insertAdjacentHTML('afterbegin', `<a role="menuitem" href="${a.getAttribute('href')}">${a.textContent.trim()}</a>`);
        }
      };
      new ResizeObserver(relayout).observe(nav);
    }
  }

  // ---------------------------------------------------------------------------
  // Выдвижное меню на планшете и мобиле (ТЗ 4.4)
  // ---------------------------------------------------------------------------
  const drawer = $('[data-drawer]');
  if (drawer) {
    // Выезд, анимация и закрытие по фону — Drawer из Basecoat, подпункты — details (Collapsible); здесь только открытие
    $$('[data-drawer-open]').forEach((b) => b.addEventListener('click', () => drawer.showModal()));
    // На десктопе выдвижное меню не нужно
    window.matchMedia('(min-width: 860px)').addEventListener('change', (e) => { if (e.matches && drawer.open) drawer.close(); });
  }

  // Поиск на мобиле — отдельный экран (кнопка «Поиск» в таб-баре); повторный «Поиск» и Esc закрывают его
  // и возвращают фокус на кнопку
  $$('[data-search-open]').forEach((btn) => {
    const box = document.getElementById(btn.getAttribute('aria-controls'));
    if (!box) return;
    const set = (open) => {
      box.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
    };
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = !box.classList.contains('is-open');
      set(open);
      const input = $('input', box);
      // над полем экрана поиска стоит заголовок «Поиск» — в поле хватает короткой подсказки, длинная на 320 обрезалась
      if (input?.dataset.placeholderShort) input.placeholder = input.dataset.placeholderShort;
      if (open) input?.focus();
    });
    // Выпадашку с результатами закрывает script.js поиска, строку — здесь (событие всплывает из поля)
    box.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !box.classList.contains('is-open')) return;
      set(false);
      btn.focus();
    });
  });

  // ---------------------------------------------------------------------------
  // Корзина в прототипе: cookie radio_cart = { id товара: количество } — её читает и PHP (страницы корзины
  // и оформления). В Битриксе вместо неё — корзина sale и ajax-запросы; разметка степпера та же.
  // ---------------------------------------------------------------------------
  const readCart = () => {
    const m = document.cookie.match(/(?:^|; )radio_cart=([^;]*)/);
    try { return m ? JSON.parse(decodeURIComponent(m[1])) || {} : {}; } catch { return {}; }
  };
  const writeCart = (obj) => {
    document.cookie = `radio_cart=${encodeURIComponent(JSON.stringify(obj))}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
  };
  const cart = {
    all: readCart,
    qty: (id) => readCart()[id] || 0,
    set(id, qty) {
      const all = readCart();
      if (qty > 0) all[id] = qty; else delete all[id];
      writeCart(all);
      document.dispatchEvent(new CustomEvent('cart:change', { detail: { id, qty } }));
    },
    // Запомнить состав перед необратимым действием: после перерисовки корзины — тост с «Вернуть»
    remember(title) {
      try { sessionStorage.setItem('radio_cart_undo', JSON.stringify({ title, cart: readCart() })); } catch { /* без отмены */ }
    },
    clear() {
      cart.remember('Корзина очищена');
      writeCart({});
      document.dispatchEvent(new CustomEvent('cart:change', { detail: { id: null, qty: 0 } }));
    },
  };
  window.radioCart = cart;

  // «Корзина очищена · Вернуть» (отмена вместо окна подтверждения: очистка в один клик, ошибка исправляется одним кликом)
  let undo = null;
  try { undo = JSON.parse(sessionStorage.getItem('radio_cart_undo') || 'null'); sessionStorage.removeItem('radio_cart_undo'); } catch { /* нет хранилища */ }
  if (undo?.cart && Object.keys(undo.cart).length) {
    window.radioCartUndo = () => {
      writeCart(undo.cart);
      if (window.protoStatic?.basketChanged) window.protoStatic.basketChanged(); else location.reload();
    };
    requestAnimationFrame(() => window.radioToast(undo.title, '', 'info', { action: { label: 'Вернуть', onclick: 'radioCartUndo()' }, duration: 8000 }));
  }

  // Склонение: plural(3, ['товар', 'товара', 'товаров']) → «товара» (как radio_plural() в init.php)
  const plural = (n, forms) => {
    const m = Math.abs(n) % 100;
    const m1 = m % 10;
    return forms[m > 10 && m < 20 ? 2 : m1 > 1 && m1 < 5 ? 1 : m1 === 1 ? 0 : 2];
  };

  // Счётчик позиций в шапке — не длиннее 3 символов (ТЗ 4.1). Скринридер читает подпись ссылки, а не значок:
  // «Корзина, 3 товара» (тот же текст отдаёт шаблон sale.basket.basket.line при загрузке)
  const renderCount = () => {
    const n = Object.keys(cart.all()).length;
    $$('[data-cart-count]').forEach((el) => {
      el.hidden = n === 0;
      el.textContent = n > 99 ? '99+' : String(n);
      el.closest('a')?.setAttribute('aria-label', n ? `Корзина, ${n} ${plural(n, ['товар', 'товара', 'товаров'])}` : 'Корзина');
    });
  };
  document.addEventListener('cart:change', renderCount);
  renderCount();

  // «В корзину» → степпер «− N +»: только целые, не меньше 1; «−» при 1 удаляет; «+» блокируется на остатке (ТЗ 9.2, 9.3)
  const initCartControl = (box) => {
    const id = box.dataset.productId;
    const max = box.dataset.max === '' ? Infinity : Number(box.dataset.max);
    const add = $('[data-cart-add]', box);
    const stepper = $('[data-stepper]', box);
    const input = $('[data-stepper-input]', box);
    const minus = $('[data-stepper-minus]', box);
    const plus = $('[data-stepper-plus]', box);

    const render = () => {
      const q = cart.qty(id);
      // «−» на единице прячет степпер — фокус переходит на «В корзину», а не теряется
      const focusInside = stepper.contains(document.activeElement);
      add.hidden = q > 0;
      stepper.hidden = q === 0;
      if (focusInside && q === 0) add.focus();
      input.value = String(q || 1);
      // На остатке «+» неактивна, но остаётся в порядке Tab (aria-disabled, а не disabled — фокус не пропадает)
      plus.setAttribute('aria-disabled', String(q >= max));
      // Подсказка Basecoat — на всём степпере: у выключенной кнопки «+» нет наведения
      delete stepper.dataset.tooltip;
    };
    add.addEventListener('click', (e) => {
      e.preventDefault();
      cart.set(id, 1);
      // Переход — действием тоста (кнопка Basecoat), 8 с, как у «Вернуть»: за 3 с до ссылки не успеть
      if (!box.closest('[data-basket]')) window.radioToast('Товар в корзине', '', 'success', { action: { label: 'Перейти в корзину', href: '/cart/' }, duration: 8000 });
    });
    minus.addEventListener('click', () => { if (minus.getAttribute('aria-disabled') !== 'true') cart.set(id, cart.qty(id) - 1); });
    plus.addEventListener('click', () => { if (plus.getAttribute('aria-disabled') !== 'true') cart.set(id, Math.min(max, cart.qty(id) + 1)); });
    input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, ''); });
    input.addEventListener('change', () => {
      let q = parseInt(input.value, 10);
      if (!q || q < 1) q = 1;
      if (q > max) q = max;
      cart.set(id, q);
    });
    document.addEventListener('cart:change', (e) => { if (String(e.detail.id) === String(id)) render(); });
    render();
  };
  $$('[data-cart-control]').forEach(initCartControl);
  // Контролы могут вставляться в DOM позже — экспортируем инициализацию
  window.radioInitCartControls = (root = document) => $$('[data-cart-control]', root).forEach(initCartControl);

  // ---------------------------------------------------------------------------
  // «Подписаться на товар» (ТЗ 9.2)
  // ---------------------------------------------------------------------------
  const subscribe = $('[data-subscribe-dialog]');
  if (subscribe) {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-subscribe-open]');
      if (!btn) return;
      e.preventDefault();
      $('[data-subscribe-product-id]', subscribe).value = btn.dataset.productId;
      subscribe.showModal();
    });
    // Поля проверяет общая проверка форм (data-validate) и, если всё верно, присылает proto:valid
    $('[data-subscribe-form]', subscribe).addEventListener('proto:valid', (e) => {
      e.preventDefault();
      subscribe.close();
      window.radioToast('Вы подписаны', '');
    });
  }

  // ---------------------------------------------------------------------------
  // Уведомление о cookie (ТЗ 4.3): «Принять» — запускаем Яндекс.Метрику, «Отклонить» — нет
  // ---------------------------------------------------------------------------
  const cookie = $('[data-cookie]');
  if (cookie) {
    const choice = store.get('radio_cookie', null);
    // ?cookie=show — показать попап принудительно (состояние прототипа)
    if (choice === null || new URLSearchParams(location.search).get('cookie') === 'show') cookie.hidden = false;
    const decide = (value) => {
      store.set('radio_cookie', value);
      cookie.hidden = true;
      // if (value === 'accept') { … код счётчика Яндекс.Метрики … }
    };
    $('[data-cookie-accept]', cookie).addEventListener('click', () => decide('accept'));
    $('[data-cookie-decline]', cookie).addEventListener('click', () => decide('decline'));
  }

  // ---------------------------------------------------------------------------
  // Кнопка «Вверх» — после первого экрана (ТЗ 4.5)
  // ---------------------------------------------------------------------------
  const up = $('[data-up]');
  if (up) {
    const toggle = () => { up.hidden = window.scrollY < window.innerHeight; };
    window.addEventListener('scroll', toggle, { passive: true });
    toggle();
    up.addEventListener('click', () => window.scrollTo({ top: 0, behavior: smooth() }));
  }

  // ---------------------------------------------------------------------------
  // Слайдер: data-slider; data-loop — по кругу; data-autoplay="3000" — автопрокрутка, мс; data-slider-dot — точки.
  // Без зацикливания стрелки блокируются на краях (ТЗ 8.5, 8.6).
  // ---------------------------------------------------------------------------
  $$('[data-slider]').forEach((slider) => {
    const track = $('[data-slider-track]', slider);
    const prev = $('[data-slider-prev]', slider);
    const next = $('[data-slider-next]', slider);
    const counter = $('[data-slider-counter]', slider);
    const dots = $$('[data-slider-dot]', slider);
    const loop = slider.hasAttribute('data-loop');
    const autoplay = Number(slider.dataset.autoplay || 0);
    const slides = [...track.children];
    if (!slides.length) return;

    const step = () => slides[0].getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 0);
    const index = () => Math.round(track.scrollLeft / step());
    const atStart = () => track.scrollLeft <= 2;
    const atEnd = () => track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    const go = (dir) => {
      if (loop && dir > 0 && atEnd()) track.scrollTo({ left: 0, behavior: smooth() });
      else if (loop && dir < 0 && atStart()) track.scrollTo({ left: track.scrollWidth, behavior: smooth() });
      else track.scrollBy({ left: dir * step(), behavior: smooth() });
    };
    const update = () => {
      const scrollable = track.scrollWidth > track.clientWidth + 2;
      if (prev) prev.disabled = !scrollable || (!loop && atStart());
      if (next) next.disabled = !scrollable || (!loop && atEnd());
      $$('[data-slider-nav]', slider).forEach((el) => { el.hidden = !scrollable; });
      if (counter) counter.textContent = `${Math.min(index() + 1, slides.length)} / ${slides.length}`;
      dots.forEach((d, i) => d.setAttribute('aria-current', String(i === index())));
    };
    prev?.addEventListener('click', () => go(-1));
    next?.addEventListener('click', () => go(1));
    dots.forEach((d, i) => d.addEventListener('click', () => track.scrollTo({ left: i * step(), behavior: smooth() })));
    track.addEventListener('scroll', () => window.requestAnimationFrame(update), { passive: true });
    new ResizeObserver(update).observe(track);
    update();

    // Автопрокрутка (WCAG 2.2.2): пауза на время наведения и фокуса; касание, стрелки и кнопка «Остановить» —
    // остановка насовсем (человек взял управление); вкладка в фоне — пауза
    const pauseBtn = $('[data-slider-pause]', slider);
    if (autoplay && !reduceMotion.matches) {
      let timer = null;
      let stopped = false;
      const stop = () => { clearInterval(timer); timer = null; };
      const start = () => { stop(); if (!stopped && !document.hidden) timer = setInterval(() => go(1), autoplay); };
      // Кнопка — переключатель «Остановить / Продолжить» (aria-pressed), иконка меняется
      const setStopped = (value) => {
        stopped = value;
        if (value) stop(); else start();
        if (!pauseBtn) return;
        pauseBtn.setAttribute('aria-pressed', String(value));
        pauseBtn.setAttribute('aria-label', value ? 'Продолжить прокрутку' : 'Остановить прокрутку');
        pauseBtn.querySelector('use')?.setAttribute('href', pauseBtn.querySelector('use').getAttribute('href').replace(/#i-[\w-]+$/, value ? '#i-play' : '#i-pause'));
      };
      const halt = () => setStopped(true);
      slider.addEventListener('mouseenter', stop);
      slider.addEventListener('mouseleave', start);
      slider.addEventListener('focusin', stop);
      slider.addEventListener('focusout', start);
      track.addEventListener('pointerdown', halt);
      [prev, next, ...dots].forEach((b) => b?.addEventListener('click', halt));
      pauseBtn?.addEventListener('click', () => setStopped(!stopped));
      document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
      start();
    } else if (pauseBtn) {
      pauseBtn.hidden = true;
    }
  });

  // ---------------------------------------------------------------------------
  // Хлебные крошки в одну строку (breadcrumb/.default): не влезли — средние разделы по одному с начала уходят
  // в «…» (выпадашка Basecoat). Меряем со снятым сжатием: иначе обрезка троеточием прячет нехватку места
  // ---------------------------------------------------------------------------
  $$('[data-breadcrumb]').forEach((nav) => {
    const ol = $('ol', nav);
    const more = $$('[data-crumb-more]', nav);
    const ids = [...new Set($$('[data-crumb]', nav).map((el) => el.dataset.crumb))];
    const fit = () => {
      nav.classList.add('is-measuring');
      $$('[data-crumb]', nav).forEach((el) => { el.hidden = false; });
      $$('[data-crumb-menu]', nav).forEach((a) => { a.hidden = true; });
      more.forEach((el) => { el.hidden = true; });
      for (const id of ids) {
        if (ol.scrollWidth <= ol.clientWidth + 1) break;
        more.forEach((el) => { el.hidden = false; });
        $$(`[data-crumb="${id}"]`, nav).forEach((el) => { el.hidden = true; });
        $(`[data-crumb-menu="${id}"]`, nav).hidden = false;
      }
      nav.classList.remove('is-measuring');
    };
    new ResizeObserver(fit).observe(nav);
  });

  // ---------------------------------------------------------------------------
  // «Показать ещё» у длинного текста (radio_read_more в init.php): сворачиваем, только если текст выше свёрнутого
  // больше чем на треть — иначе кнопка прячет пару строк. Свернули обратно, а начало текста выше экрана — к нему
  // ---------------------------------------------------------------------------
  $$('[data-read-more]').forEach((box) => {
    const body = box.firstElementChild;
    const limit = parseFloat(getComputedStyle(box).getPropertyValue('--read-more-h')) * parseFloat(getComputedStyle(document.documentElement).fontSize);
    if (!limit || body.scrollHeight <= limit * 1.33) return;
    box.classList.add('is-collapsed');
    // Полный текст — в модалке (карточки комплекта: раскрытая карточка тянулась бы на экраны): кнопка открывает
    // диалог сама (data-read-more-dialog), здесь её только показываем
    const opener = document.querySelector(`[data-read-more-dialog="${body.id}"]`);
    if (opener) { opener.hidden = false; return; }
    // кнопка — внутри блока или в другом месте карточки (radio_read_more_toggle), по aria-controls
    const btn = $('[data-read-more-toggle]', box) || document.querySelector(`[data-read-more-toggle][aria-controls="${body.id}"]`);
    if (!btn) return;
    const label = $('[data-read-more-label]', btn);
    btn.hidden = false;
    // Раскрытие и сворачивание — плавно по высоте, как у аккордеона (WAAPI, длительность и кривая из токенов);
    // с клавиатуры и при «Уменьшить движение» — сразу
    btn.addEventListener('click', (e) => {
      const from = body.offsetHeight;
      const open = box.classList.toggle('is-collapsed') === false;
      btn.setAttribute('aria-expanded', String(open));
      label.textContent = open ? 'Свернуть' : 'Показать ещё';
      if (!reduceMotion.matches && e.detail !== 0) {
        const css = getComputedStyle(document.documentElement);
        const to = body.offsetHeight;
        // при сворачивании класс сразу ограничивает высоту (max-height) — на время анимации ограничение снимаем
        body.style.maxHeight = 'none';
        body.style.overflow = 'hidden';
        const done = () => { body.style.maxHeight = ''; body.style.overflow = ''; };
        body.animate([{ height: `${from}px` }, { height: `${to}px` }], {
          duration: parseFloat(css.getPropertyValue('--duration-slow')) || 300,
          easing: css.getPropertyValue('--ease-out').trim() || 'ease-out',
        }).finished.then(done, done);
      }
      if (!open && box.getBoundingClientRect().top < 0) box.scrollIntoView({ block: 'start', behavior: smooth() });
    });
  });

  // ---------------------------------------------------------------------------
  // Просмотр картинок: ссылки с data-lightbox="группа" и href на большую картинку (ТЗ 8.6, 9.3, 12.1)
  // ---------------------------------------------------------------------------
  const lb = $('[data-lightbox-dialog]');
  if (lb) {
    const img = $('[data-lightbox-img]', lb);
    const caption = $('[data-lightbox-caption]', lb);
    const count = $('[data-lightbox-counter]', lb);
    let group = [];
    let current = 0;
    const show = (i) => {
      current = (i + group.length) % group.length;
      const a = group[current];
      img.src = a.getAttribute('href');
      // Новая картинка проявляется, а не подменяется рывком. Длительность и кривая — из токенов (tokens.css)
      if (!reduceMotion.matches) {
        const css = getComputedStyle(document.documentElement);
        const motion = { duration: parseFloat(css.getPropertyValue('--duration-base')) || 200, easing: css.getPropertyValue('--ease-out').trim() || 'ease-out' };
        img.decode?.().then(() => img.animate([{ opacity: 0 }, { opacity: 1 }], motion)).catch(() => {});
      }
      img.alt = a.dataset.caption || '';
      caption.textContent = a.dataset.caption || '';
      count.textContent = `${current + 1} / ${group.length}`;
    };
    document.addEventListener('click', (e) => {
      const a = e.target.closest('[data-lightbox]');
      if (!a) return;
      e.preventDefault();
      group = $$(`[data-lightbox="${a.dataset.lightbox}"]`);
      lb.classList.toggle('is-single', group.length < 2);
      show(group.indexOf(a));
      lb.showModal();
    });
    $('[data-lightbox-prev]', lb).addEventListener('click', () => show(current - 1));
    $('[data-lightbox-next]', lb).addEventListener('click', () => show(current + 1));
    $('[data-lightbox-close]', lb).addEventListener('click', () => lb.close());
    lb.addEventListener('click', (e) => { if (e.target === lb || e.target.tagName === 'FIGURE') lb.close(); });
    lb.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') show(current - 1);
      if (e.key === 'ArrowRight') show(current + 1);
    });
    // Свайп на таче
    let x0 = null;
    lb.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40 && group.length > 1) show(current + (dx < 0 ? 1 : -1));
      x0 = null;
    });
  }

  // ---------------------------------------------------------------------------
  // Подсказка с полным названием товара — только если название обрезано и есть мышь (ТЗ 9.2)
  // ---------------------------------------------------------------------------
  if (canHover) {
    let tip = null;
    let shownFor = null;
    const hide = () => { tip?.remove(); shownFor = null; };
    // Название — растянутая ссылка на всю плитку, поэтому смотрим, где курсор: подсказка — только над самим названием
    document.addEventListener('mousemove', (e) => {
      const el = e.target.closest('[data-fullname]');
      const r = el?.getBoundingClientRect();
      const over = r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!over || el.scrollHeight <= el.clientHeight + 1) { if (shownFor) hide(); return; }
      if (shownFor === el) return;
      tip ??= Object.assign(document.createElement('div'), { className: 'name-tooltip', role: 'tooltip' });
      tip.textContent = el.dataset.fullname;
      document.body.append(tip);
      const t = tip.getBoundingClientRect();
      tip.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - t.width - 8))}px`;
      tip.style.top = `${r.top - t.height - 8 < 8 ? r.bottom + 8 : r.top - t.height - 8}px`;
      shownFor = el;
    }, { passive: true });
    window.addEventListener('scroll', hide, { passive: true });
  }

  // ---------------------------------------------------------------------------
  // Маска телефона +7 XXX XXX XX XX (ТЗ 6, 16). Каретка остаётся у той же цифры, а не прыгает в конец;
  // стёрли все цифры — поле пустеет (видна подсказка); «+7» без цифр проверка форм считает пустым полем.
  // ---------------------------------------------------------------------------
  // Цифры номера: 8 в начале — это +7, без кода страны — дописываем 7; не больше 11 цифр
  const phoneDigits = (v) => {
    let d = v.replace(/\D/g, '');
    if (!d) return '';
    if (d.startsWith('8')) d = '7' + d.slice(1);
    if (!d.startsWith('7')) d = '7' + d;
    return d.slice(0, 11);
  };
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!el.matches?.('[data-phone-mask]')) return;
    const d = phoneDigits(el.value);
    if (!d) { el.value = ''; return; }
    // Сколько цифр стоит перед кареткой — после форматирования ставим её за столько же цифр
    const before = phoneDigits(el.value.slice(0, el.selectionStart ?? el.value.length)).length;
    const p = [d.slice(1, 4), d.slice(4, 7), d.slice(7, 9), d.slice(9, 11)].filter(Boolean);
    el.value = '+7' + (p.length ? ' ' + p.join(' ') : '');
    if (document.activeElement !== el) return;
    let pos = 0;
    for (let n = 0; pos < el.value.length && n < before; pos++) if (/\d/.test(el.value[pos])) n++;
    el.setSelectionRange(pos, pos);
  });
  // Backspace сразу за пробелом маски стирает цифру перед ним, а не упирается в пробел
  document.addEventListener('keydown', (e) => {
    const el = e.target;
    if (e.key !== 'Backspace' || !el.matches?.('[data-phone-mask]') || el.selectionStart !== el.selectionEnd) return;
    let i = el.selectionStart;
    while (i > 0 && el.value[i - 1] === ' ') i--;
    if (i !== el.selectionStart) el.setSelectionRange(i, i);
  });
  // Ушли из поля, где остался один «+7», — очищаем, чтобы снова была видна подсказка
  document.addEventListener('focusout', (e) => {
    if (e.target.matches?.('[data-phone-mask]') && phoneDigits(e.target.value).length < 2) e.target.value = '';
  });

  // ---------------------------------------------------------------------------
  // Проверка форм (ТЗ 5, 6, 11, 16): data-validate на форме, правила — data-rule на полях.
  // Кнопка с data-submit-ready выглядит неактивной, пока не заполнены все обязательные поля (ТЗ 5, 6, 11), но это
  // aria-disabled, а не disabled: она в порядке Tab и по нажатию показывает ошибки и ставит фокус на первое пропущенное
  // поле (WCAG 3.3.1). Ошибку пустого обязательного поля показываем при уходе с него, если в поле уже что-то вводили.
  // В прототипе успешная отправка: data-proto-next="адрес" — переход, data-proto-dialog="id" — открыть окно.
  // ---------------------------------------------------------------------------
  const FOREIGN_MAIL = /@(gmail|googlemail|yahoo|outlook|hotmail|live|icloud|me|aol|proton|protonmail)\./i;
  const RULES = {
    email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Неверное значение почты, пример: sale@mail.ru'),
    'email-ru': (v) => RULES.email(v) || (FOREIGN_MAIL.test(v) ? 'Регистрация с иностранной почтой невозможна. Укажите российский почтовый сервис или корпоративную почту' : ''),
    phone: (v) => (v.replace(/\D/g, '').length === 11 ? '' : 'Укажите телефон полностью: +7 XXX XXX XX XX'),
    inn: (v) => (/^(\d{10}|\d{12})$/.test(v) ? '' : 'ИНН — 10 цифр для организации или 12 для ИП'),
    kpp: (v) => (/^\d{9}$/.test(v) ? '' : 'КПП — 9 цифр'),
    bik: (v) => (/^\d{9}$/.test(v) ? '' : 'БИК — 9 цифр'),
    account: (v) => (/^\d{20}$/.test(v) ? '' : 'Расчётный счёт — 20 цифр'),
    password: (v) => (v.length >= 8 && /[A-ZА-ЯЁ]/.test(v) && /\d/.test(v) ? '' : 'Не меньше 8 символов, одна заглавная буква и одна цифра'),
  };
  // Значение поля для проверки: у чекбокса — отмечен ли, у телефона «+7» без цифр — пусто
  const fieldValue = (el) => {
    if (el.type === 'checkbox') return el.checked ? '1' : '';
    if (el.matches('[data-phone-mask]') && phoneDigits(el.value).length < 2) return '';
    return el.value.trim();
  };
  const fieldError = (el) => {
    const v = fieldValue(el);
    if (el.required && !v) return el.dataset.requiredText || (el.type === 'checkbox' ? 'Нужно согласие' : 'Заполните поле');
    if (!v) return '';
    const rule = el.dataset.rule || '';
    if (rule.startsWith('confirm:')) return v === document.getElementById(rule.slice(8))?.value ? '' : 'Пароли не совпадают';
    // КПП не обязателен, если ИНН из 12 цифр (ТЗ 6)
    return RULES[rule] ? RULES[rule](v) : '';
  };
  // Ошибка поля — как в компоненте Field из Basecoat: <p role="alert"> под полем, data-invalid у обёртки, aria-invalid="true" у поля
  const showError = (el, msg) => {
    const box = el.closest('[data-field]') || el.parentElement;
    let err = box.querySelector('[data-error]');
    if (!err) { err = document.createElement('p'); err.setAttribute('role', 'alert'); err.dataset.error = ''; err.dataset.reveal = ''; err.hidden = true; box.append(err); }
    err.textContent = msg;
    err.hidden = !msg;
    box.toggleAttribute('data-invalid', Boolean(msg));
    if (msg) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
  };

  $$('form[data-validate]').forEach((form) => {
    const fields = () => $$('input, select, textarea', form).filter((el) => !el.closest('[hidden]') && !el.disabled && el.type !== 'hidden');
    // Кнопка может стоять вне формы (итоговый блок оформления) — тогда она связана атрибутом form
    const ready = $('[data-submit-ready]', form) || (form.id && $(`[data-submit-ready][form="${form.id}"]`));
    const update = () => {
      if (!ready) return;
      const empty = fields().some((el) => el.required && !fieldValue(el));
      ready.setAttribute('aria-disabled', String(empty));
    };
    form.addEventListener('input', (e) => {
      e.target.dataset.touched = '';
      if (e.target.hasAttribute('aria-invalid')) showError(e.target, fieldError(e.target));
      update();
    });
    form.addEventListener('change', update);
    form.addEventListener('focusout', (e) => {
      if (e.target.matches('input, select, textarea') && (e.target.value || 'touched' in e.target.dataset)) showError(e.target, fieldError(e.target));
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let first = null;
      fields().forEach((el) => { const m = fieldError(el); showError(el, m); if (m && !first) first = el; });
      if (first) { first.focus(); return; }
      if (form.dataset.protoDialog) document.getElementById(form.dataset.protoDialog)?.showModal();
      else if (form.dataset.protoNext) location.href = window.protoStatic.url(form.dataset.protoNext);
      // Своя реакция на успешную отправку — слушатель proto:valid с preventDefault (например, «Подписаться на товар»)
      else if (form.dispatchEvent(new CustomEvent('proto:valid', { cancelable: true }))) window.radioToast('Готово', 'В прототипе данные никуда не отправляются');
    });
    update();
  });
  // ИНН из 12 цифр (ИП) — КПП становится необязательным
  document.addEventListener('input', (e) => {
    if (!e.target.matches?.('[data-rule="inn"]')) return;
    const kpp = e.target.form?.querySelector('[data-rule="kpp"]');
    if (kpp) kpp.required = e.target.value.replace(/\D/g, '').length !== 12;
  });

  // Выпадающие списки — компонент Select из Basecoat (radio_select() в init.php).
  // data-submit-on-change — выбор сразу отправляет форму (сортировка, фильтр дилеров); data-reset="city" — сбросить
  // эти поля перед отправкой (сменили страну — город сбросился).
  document.addEventListener('change', (e) => {
    const box = e.target.closest?.('[data-submit-on-change]');
    const form = box?.closest('form');
    if (!form) return;
    (box.dataset.reset || '').split(',').filter(Boolean).forEach((name) => { if (form.elements[name]) form.elements[name].value = ''; });
    form.submit();
  });
  // Сброс формы не трогает скрытое поле списка — возвращаем выбранное при загрузке значение (data-default)
  document.addEventListener('reset', (e) => {
    setTimeout(() => e.target.querySelectorAll('div.select[data-default]').forEach((s) => s.select?.(s.dataset.default)), 0);
  });

  // ---------------------------------------------------------------------------
  // Подсказки Dadata (ТЗ 6, 11, 17.2): в прототипе — заготовленный список; на сайте — API Dadata.
  // data-suggest="company" заполняет реквизиты, "city" и "street" — адрес.
  // Поле — комбобокс Basecoat с data-filter="manual" (radio_field 'suggest'): варианты подставляем сами по введённому
  // тексту, а стрелки, Enter, Esc, мышь и выбор делает Basecoat. Выбранный вариант приходит событием change.
  // ---------------------------------------------------------------------------
  const SUGGEST = {
    company: [
      { value: 'ООО «Энерголаб-Тест»', inn: '6671234567', kpp: '667101001', address: '620014, г. Екатеринбург, ул. Малышева, д. 51, оф. 1204' },
      { value: 'ООО «Энергосервис-Урал»', inn: '6658456789', kpp: '665801001', address: '620102, г. Екатеринбург, ул. Посадская, д. 23' },
      { value: 'ИП Кузнецов Андрей Сергеевич', inn: '667100123456', kpp: '', address: '620075, г. Екатеринбург, ул. Луначарского, д. 81' },
    ],
    city: ['г. Екатеринбург', 'г. Ижевск', 'г. Москва', 'г. Санкт-Петербург', 'г. Самара', 'г. Казань', 'г. Новосибирск', 'г. Пермь', 'г. Уфа', 'г. Тюмень'].map((value) => ({ value })),
    street: ['ул. Ленина', 'ул. Малышева', 'ул. Пушкинская', 'ул. Карла Маркса', 'пр-т Ленина', 'ул. Советская', 'ул. Мира'].map((value) => ({ value })),
  };
  const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  $$('[data-suggest-box]').forEach((box) => {
    const input = $('[data-suggest]', box);
    const listbox = $('[role="listbox"]', box);
    let items = [];
    const render = () => {
      const q = input.value.trim().toLowerCase().replace(/^(г\.|ул\.|ооо|ип)\s*/, '');
      items = q.length < 2 ? [] : SUGGEST[input.dataset.suggest].filter((x) => x.value.toLowerCase().includes(q) || (x.inn || '').startsWith(q));
      listbox.innerHTML = items.map((x, i) => `<div role="option" id="${input.id}-s${i}" data-value="${i}" data-label="${esc(x.value)}">`
        + `<span class="grid min-w-0 gap-0.5"><b class="font-medium">${esc(x.value)}</b>`
        + (x.inn ? `<span class="text-xs whitespace-normal text-muted-foreground">ИНН ${esc(x.inn)}${x.address ? ', ' + esc(x.address) : ''}</span>` : '')
        + '</span></div>').join('');
      // Прежний выбор забываем до refresh: иначе Basecoat вернёт в поле подпись выбранного раньше варианта
      $('input[type="hidden"]', box).value = '';
      box.refresh?.();
    };
    // Basecoat открывает список при фокусе и вводе; пустой не показываем (подсказок ещё нет — меньше двух букв)
    const closeIfEmpty = () => setTimeout(() => { if (!items.length) box.close?.(); }, 0);
    input.addEventListener('input', (e) => { if (e.isTrusted) render(); closeIfEmpty(); });
    input.addEventListener('focus', closeIfEmpty);
    input.addEventListener('click', closeIfEmpty);
    box.addEventListener('change', (e) => {
      const item = items[e.detail?.value];
      if (!item) return;
      showError(input, '');
      const form = input.form;
      if (item.inn !== undefined && form) {
        const set = (name, v) => { const el = form.querySelector(`[name="${name}"]`); if (el) { el.value = v; showError(el, ''); } };
        set('INN', item.inn); set('KPP', item.kpp); set('ADDRESS', item.address);
        form.querySelector('[data-rule="kpp"]')?.toggleAttribute('required', item.inn.length !== 12);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // «Глаз» у пароля: показать / скрыть символы (ТЗ 5)
  // ---------------------------------------------------------------------------
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-password-toggle]');
    if (!btn) return;
    const input = btn.closest('.input-group').querySelector('input');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль');
    btn.querySelector('use')?.setAttribute('href', btn.querySelector('use').getAttribute('href').replace(/#i-.+$/, show ? '#i-eye-off' : '#i-eye'));
  });

  // Плеер VK Видео подгружается только по клику (карточка товара, новости): страница не тянет внешние скрипты заранее
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-video-src]');
    if (!btn) return;
    const iframe = document.createElement('iframe');
    iframe.src = btn.dataset.videoSrc;
    iframe.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
    iframe.allowFullscreen = true;
    iframe.className = 'video-frame';
    iframe.title = btn.getAttribute('aria-label') || 'Видео';
    btn.replaceWith(iframe);
    // Кнопка, на которой стоял фокус, исчезла — переводим фокус в плеер, иначе он улетает в начало страницы
    iframe.focus();
  });

  // Модалки, которые состояние прототипа открывает сразу (?state=edit, ?state=thanks…) — как после клика
  $$('dialog[data-open-on-load]').forEach((d) => { if (!d.open) d.showModal(); });

  // Окна с data-autoclose="3000" закрываются сами через заданное время (ТЗ 16: «Благодарим за заявку» — 3 секунды)
  $$('dialog[data-autoclose]').forEach((d) => {
    let t = null;
    new MutationObserver(() => {
      clearTimeout(t);
      if (d.open) t = setTimeout(() => d.close(), Number(d.dataset.autoclose));
    }).observe(d, { attributes: true, attributeFilter: ['open'] });
    if (d.open) t = setTimeout(() => d.close(), Number(d.dataset.autoclose));
  });
})();
