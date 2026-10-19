// «Повторить заказ» (ТЗ 17.3): товары заказа добавляются к корзине; если товар уже в корзине — количество суммируется,
// но не больше доступного остатка; недоступные товары пропускаются.
(() => {
  document.querySelectorAll('[data-repeat-order]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const items = JSON.parse(btn.dataset.repeatOrder);
      items.forEach((it) => {
        const qty = (window.radioCart.qty(it.id) || 0) + it.qty;
        window.radioCart.set(it.id, it.max === null ? qty : Math.min(qty, it.max));
      });
      const skipped = Number(btn.dataset.repeatSkipped);
      window.radioToast('Товары добавлены в корзину', (skipped ? `Нет в наличии и не добавлено: ${skipped}. ` : '') + '<a href="/cart/" class="underline">Перейти в корзину</a>');
    });
  });
})();
