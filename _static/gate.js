// Вход по паролю в выложенную копию прототипа (собирает scripts/protect.mjs, подключается к каждой странице копии).
//
// Страница копии на хостинге — заглушка: внутри только зашифрованный текст настоящей страницы
// (gzip → AES-256-GCM, ключ из пароля через PBKDF2). Без пароля содержимое не прочитать ни в браузере,
// ни в исходниках, ни в репозитории. После ввода ключ запоминается в localStorage этого браузера,
// и следующие страницы открываются сразу.
//
// Свои скрипты копии (шаблон, _static/static.js, индексы поиска с ценами) тоже зашифрованы: лежат как *.js.enc,
// в странице у них data-enc-src вместо src. gate.js расшифровывает их и подключает через blob-адреса.
(() => {
  const STORE = 'radio-proto-key';
  const cfg = document.currentScript.dataset;
  const root = cfg.root || '';
  const SALT = cfg.salt;
  const ITER = Number(cfg.iter);
  const payload = document.getElementById('proto-data').textContent.trim();

  const bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));

  const storage = {
    get() { try { return localStorage.getItem(STORE); } catch { return null; } },
    set(v) { try { localStorage.setItem(STORE, v); } catch { /* приватный режим — спросим пароль снова */ } },
    drop() { try { localStorage.removeItem(STORE); } catch { /* нечего чистить */ } },
  };

  async function derive(password) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: bytes(SALT), iterations: ITER, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, true, ['decrypt'],
    );
  }

  // iv (12 байт) + шифротекст с тегом → распакованный текст
  async function decrypt(key, b64) {
    const data = bytes(b64);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: data.slice(0, 12) }, key, data.slice(12));
    const stream = new Blob([plain]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).text();
  }

  const scriptUrl = (code) => URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  const fetchEnc = async (key, path) => {
    const res = await fetch(`${path}.enc`);
    if (!res.ok) throw new Error(`${path}.enc: ${res.status}`);
    return decrypt(key, await res.text());
  };

  async function show(key, html) {
    // Зашифрованные скрипты страницы (data-enc-src) расшифровываем и подключаем через blob-адреса
    const srcs = [...new Set([...html.matchAll(/data-enc-src="([^"]+)"/g)].map((m) => m[1]))];
    const urls = new Map(await Promise.all(srcs.map(async (src) => [src, scriptUrl(await fetchEnc(key, src))])));
    html = html.replace(/data-enc-src="([^"]+)"/g, (m, src) => `src="${urls.get(src)}"`);
    // Индекс поиска static.js загружает через эту функцию (window переживает document.open)
    window.PROTO_LOAD_SCRIPT = async (src) => {
      const s = Object.assign(document.createElement('script'), { src: scriptUrl(await fetchEnc(key, src)) });
      await new Promise((ok, fail) => { s.onload = ok; s.onerror = fail; document.head.append(s); });
    };
    document.open();
    document.write(html);
    document.close();
  }

  const form = document.getElementById('gate-form');
  const input = document.getElementById('gate-password');
  const button = form.querySelector('button');
  const error = document.getElementById('gate-error');

  const ask = (message = '') => {
    document.documentElement.classList.add('gate-ready');
    error.textContent = message;
    button.disabled = false;
    button.textContent = 'Войти';
    input.focus();
  };

  if (!window.crypto?.subtle || typeof DecompressionStream === 'undefined') {
    ask('Браузер устарел: откройте прототип в свежем Chrome, Safari, Firefox или Edge.');
    button.disabled = true;
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = input.value;
    if (!password) return ask('Введите пароль.');
    button.disabled = true;
    button.textContent = 'Проверяю…';
    error.textContent = '';
    let key;
    let html;
    try {
      key = await derive(password);
      html = await decrypt(key, payload);
    } catch {
      input.select();
      return ask('Неверный пароль.');
    }
    storage.set(toB64(await crypto.subtle.exportKey('raw', key)));
    show(key, html);
  });

  // Ключ уже сохранён — открываем страницу без вопроса
  const saved = storage.get();
  if (!saved) return ask();
  crypto.subtle.importKey('raw', bytes(saved), 'AES-GCM', false, ['decrypt'])
    .then((key) => decrypt(key, payload).then((html) => show(key, html)))
    .catch(() => {
      // Пароль сменили или ключ испорчен
      storage.drop();
      ask();
    });
})();
