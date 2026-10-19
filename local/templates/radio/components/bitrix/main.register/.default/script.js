// Регистрация (ТЗ 6): переключение «Физическое лицо / Юридическое лицо» меняет состав полей.
(() => {
  document.querySelectorAll('[data-register]').forEach((form) => {
    const sync = () => {
      const yur = form.querySelector('[data-person-type]:checked')?.value === 'yur';
      form.querySelectorAll('[data-person="yur"]').forEach((el) => { el.hidden = !yur; });
      // Название организации обязательно только для юрлица
      const company = form.querySelector('[name="COMPANY"]');
      if (company) company.required = yur;
      if (form.dataset.protoNext) form.dataset.protoNext = form.dataset.protoNext.replace(/role=\w+/, 'role=' + (yur ? 'yur' : 'fiz'));
      form.dispatchEvent(new Event('change'));
    };
    form.querySelectorAll('[data-person-type]').forEach((r) => r.addEventListener('change', sync));
    sync();
  });
})();
