// Оформление заказа (ТЗ 11): блоки по способу получения и оплаты, пересчёт сумм.
// «Деловые линии» с оплатой при оформлении: +наценка к каждой единице; скидка 3% считается уже с наценкой;
// НДС для юрлица и дилера = итог × 22 / 122. В Битриксе это считает sale.order.ajax, здесь — для показа.
(() => {
  const root = document.querySelector('[data-checkout]');
  if (!root) return;

  // Гость: тип покупателя выбирают в форме регистрации — итоги сразу показывают его условия (ТЗ 3.9):
  // юрлицу — строка НДС и срок 45 рабочих дней, физлицу — 5 (или 45, если в корзине больше остатка)
  const syncPerson = () => {
    const yur = root.querySelector('[data-person-type]:checked')?.value === 'yur';
    const days = root.querySelector('[data-days]');
    if (days) days.textContent = yur ? days.dataset.daysYur : days.dataset.daysFiz;
    const vatRow = root.querySelector('[data-vat-row]');
    if (vatRow && root.dataset.role === 'guest') vatRow.hidden = !yur;
  };
  root.querySelectorAll('[data-person-type]').forEach((r) => r.addEventListener('change', syncPerson));
  syncPerson();

  const form = root.querySelector('[data-checkout-form]');
  if (!form) return;
  const role = root.dataset.role;
  const markup = Number(root.dataset.markup);
  const vat = Number(root.dataset.vat);
  const from = Number(root.dataset.discountFrom);
  const percent = Number(root.dataset.discountPercent);
  const items = JSON.parse(root.dataset.items || '[]');
  const money = (v) => new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v).replace(/[\u202F\u00A0 ]/g, '\u00A0') + '\u00A0₽';
  const $ = (s) => root.querySelector(s);

  const recalc = () => {
    const delivery = form.querySelector('[data-delivery]:checked')?.value;
    const add = delivery === 'dl-prepaid' ? markup : 0;
    let sum = 0;
    items.forEach((it) => {
      if (it.price === null) return;
      const price = it.price + add;
      const line = Math.round(price * it.qty * 100) / 100;
      sum += line;
      const row = root.querySelector(`[data-row="${it.id}"]`);
      if (row) { row.querySelector('[data-row-price]').textContent = money(price); row.querySelector('[data-row-sum]').textContent = money(line); }
    });
    const discount = role !== 'dealer' && sum > from ? Math.round(sum * percent) / 100 : 0;
    const total = sum - discount;
    $('[data-sum]').textContent = money(sum);
    $('[data-sum-row]').hidden = discount === 0;
    $('[data-discount-row]').hidden = discount === 0;
    const markupRow = $('[data-markup-row]');
    if (markupRow) {
      const qty = items.reduce((n, it) => n + (it.price === null ? 0 : it.qty), 0);
      markupRow.hidden = !add;
      $('[data-markup-sum]').textContent = money(markup * qty);
    }
    $('[data-discount]').textContent = '−' + money(discount);
    $('[data-total]').textContent = money(total);
    const vatEl = $('[data-vat-sum]');
    if (vatEl) vatEl.textContent = money(Math.round(total * vat / (100 + vat) * 100) / 100);

    // Адрес доставки — только для «Деловых линий», поле адреса самовывоза — только для самовывоза
    form.querySelector('[data-address]').hidden = delivery === 'pickup';
    form.querySelector('[data-pickup]').hidden = delivery !== 'pickup';
    form.dispatchEvent(new Event('change'));
  };

  const payChange = () => {
    const pay = form.querySelector('[data-pay]:checked')?.value;
    const contract = form.querySelector('[data-contract]');
    if (contract) contract.hidden = pay !== 'contract';
    form.dataset.protoNext = '/cart/order/success/?pay=' + pay;
  };

  // Сохранённый адрес подставляется в поля; поля можно править
  const saved = form.querySelector('[data-saved-address]');
  saved?.addEventListener('change', () => {
    const a = JSON.parse(saved.dataset.addresses)[saved.value] || { CITY: '', STREET: '', HOUSE: '', OFFICE: '' };
    ['CITY', 'STREET', 'HOUSE', 'OFFICE'].forEach((k) => { const el = form.querySelector(`[name="${k}"]`); if (el) el.value = a[k] || ''; });
    form.dispatchEvent(new Event('change'));
  });

  // Свёрнутые реквизиты: «Изменить» раскрывает поля и ставит фокус в первое
  const edit = form.querySelector('[data-requisites-edit]');
  edit?.addEventListener('click', () => {
    const box = document.getElementById(edit.getAttribute('aria-controls'));
    box.hidden = false;
    edit.setAttribute('aria-expanded', 'true');
    form.querySelector('[data-requisites-summary]')?.remove();
    box.querySelector('input')?.focus();
  });

  form.querySelectorAll('[data-delivery]').forEach((r) => r.addEventListener('change', recalc));
  form.querySelectorAll('[data-pay]').forEach((r) => r.addEventListener('change', payChange));
  recalc();
  payChange();
})();
