// Подписка на рассылку (ТЗ 8.9): поля проверяет общая проверка форм (data-validate, js/app.js) и присылает proto:valid;
// в прототипе — тост вместо записи в ИБ «Подписки».
(() => {
  document.querySelectorAll('[data-subscribe-mailing]').forEach((form) => {
    form.addEventListener('proto:valid', (e) => {
      e.preventDefault();
      form.reset();
      window.radioToast?.('Вы подписаны на рассылку', 'Будем присылать новинки, новости и акции');
    });
  });
})();
