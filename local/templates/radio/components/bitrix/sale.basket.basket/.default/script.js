// Статичная копия: патчи scripts/export.mjs (JS_PATCHES)
// Корзина (ТЗ 10): изменения количества, удаление и очистка пишут cookie корзины (js/app.js),
// после чего страница перерисовывается — суммы, скидку и срок считает сервер, как в Битриксе.
(() => {
  const root = document.querySelector('[data-basket]');
  if (!root || !window.radioCart) return;
  let timer = null;
  const reload = () => { clearTimeout(timer); timer = setTimeout(() => { window.protoStatic.basketChanged(); }, 350); };
  document.addEventListener('cart:change', reload);
  // Удаление позиции — с отменой, как и очистка корзины (тост «Вернуть» после перерисовки)
  root.querySelectorAll('[data-basket-remove]').forEach((btn) => btn.addEventListener('click', () => {
    window.radioCart.remember('Товар удалён из корзины');
    window.radioCart.set(btn.dataset.basketRemove, 0);
  }));
  root.querySelector('[data-basket-clear]')?.addEventListener('click', () => window.radioCart.clear());
  // В корзине «−» на единице не удаляет товар: для удаления есть отдельная кнопка (ТЗ 10: меньше 1 указать нельзя)
  root.querySelectorAll('[data-stepper-minus]').forEach((btn) => {
    const input = btn.parentElement.querySelector('[data-stepper-input]');
    // aria-disabled, а не disabled: кнопка остаётся в порядке Tab, фокус не пропадает (клик гасит app.js)
    const sync = () => { btn.setAttribute('aria-disabled', String(Number(input.value) <= 1)); };
    sync();
    new MutationObserver(sync).observe(input, { attributes: true });
    input.addEventListener('change', sync);
  });
})();
