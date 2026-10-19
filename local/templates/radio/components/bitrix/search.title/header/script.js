// Поиск в шапке (ТЗ 4.1): лупа от 1 символа, крестик, выпадашка с 3 символов, «Ещё» у чипсов разделов.
(() => {
  const root = document.querySelector('[data-search]');
  if (!root) return;
  const input = root.querySelector('[data-search-input]');
  const clear = root.querySelector('[data-search-clear]');
  const submit = root.querySelector('[data-search-submit]');
  const results = root.querySelector('[data-search-results]');
  let timer = null;
  let lastQuery = '';
  let controller = null;

  // Выпадашка — поповер Basecoat: видимость через aria-hidden (с анимацией появления)
  const show = (open) => {
    results.setAttribute('aria-hidden', String(!open));
    input.setAttribute('aria-expanded', String(open));
  };
  const close = () => show(false);

  const setupChips = () => {
    const wrap = results.querySelector('[data-search-chips]');
    if (!wrap) return;
    const list = wrap.querySelector('[data-search-chips-list]');
    const more = wrap.querySelector('[data-search-chips-more]');
    // Кнопка «Ещё» нужна, только если чипсы не влезли в одну строку
    const firstTop = list.firstElementChild?.offsetTop ?? 0;
    const overflow = [...list.children].some((li) => li.offsetTop > firstTop);
    more.hidden = !overflow;
    more.onclick = () => {
      const open = wrap.classList.toggle('is-open');
      // Плавно на точную высоту списка; закрытие — обратно к одной строке (max-height из CSS)
      list.style.maxHeight = open ? `${list.scrollHeight}px` : '';
      more.setAttribute('aria-expanded', String(open));
      more.querySelector('span').textContent = open ? 'Свернуть' : 'Ещё';
    };
  };

  const load = async (q) => {
    controller?.abort();
    controller = new AbortController();
    try {
      const res = await fetch(`/search/title.php?q=${encodeURIComponent(q)}`, { signal: controller.signal });
      results.innerHTML = await res.text();
      show(true);
      setupChips();
    } catch (e) {
      if (e.name !== 'AbortError') console.error(e);
    }
  };

  const update = () => {
    const q = input.value.trim();
    clear.hidden = input.value === '';
    submit.disabled = q.length < 1;
    clearTimeout(timer);
    if (q.length < 3) {
      close();
      lastQuery = '';
      return;
    }
    if (q === lastQuery) return;
    timer = setTimeout(() => { lastQuery = q; load(q); }, 200);
  };

  input.addEventListener('input', update);
  input.addEventListener('focus', () => { if (input.value.trim().length >= 3 && results.innerHTML) { show(true); setupChips(); } });
  clear.addEventListener('click', () => { input.value = ''; update(); input.focus(); });
  document.addEventListener('click', (e) => { if (!root.contains(e.target) && !e.target.closest('[data-search-open]')) close(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { close(); input.blur(); } });
  update();
})();
