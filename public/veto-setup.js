(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const status = byId('status');
  const result = byId('result');
  const refresh = byId('refresh');
  const activation = byId('activate');
  const secretInput = byId('secret');
  const confirm = byId('confirm');
  const render = (id, value) => { byId(id).textContent = String(value ?? '—'); };
  async function readStatus() {
    refresh.disabled = true;
    status.textContent = 'Проверяем Telegram API…';
    try {
      const response = await fetch('/api/setup', { method: 'GET', cache: 'no-store', credentials: 'same-origin' });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'HTTP ' + response.status);
      const expected = new URL('/api/webhook-v8', location.origin).toString();
      const configured = (data.webhook || '') === expected;
      render('bot', data.bot || '—');
      render('webhook', data.webhook || 'Не зарегистрирован');
      render('expected', expected);
      render('pending', data.pending_updates);
      render('last-error', data.last_error || 'Нет');
      status.textContent = data.bot?.toLowerCase() !== '@vetotg_bot'
        ? 'Проверь TELEGRAM_BOT_TOKEN: подключён другой бот.'
        : configured ? 'Webhook VETO уже зарегистрирован.' : 'Токен работает, но webhook нужно настроить.';
      status.dataset.ready = configured && data.bot?.toLowerCase() === '@vetotg_bot' ? 'yes' : 'no';
    } catch (err) {
      status.textContent = 'Проверка не удалась: ' + (err?.message || 'Ошибка подключения');
      status.dataset.ready = 'no';
    } finally {
      refresh.disabled = false;
    }
  }
  async function activate(event) {
    event.preventDefault();
    if (!confirm.checked) return;
    if (!window.confirm('Заменить действующий Telegram webhook бота @vetotg_bot на сервер VETO?')) return;
    const secret = secretInput.value.trim();
    if (!secret) return;
    secretInput.value = '';
    activation.disabled = true;
    result.textContent = 'Настраиваем Telegram, подожди…';
    try {
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + secret },
        credentials: 'same-origin',
        cache: 'no-store',
        body: '{}',
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'HTTP ' + response.status);
      result.textContent = 'Настройка выполнена. Webhook: ' + (data.active_webhook || data.webhook_url || 'проверь состояние');
      await readStatus();
    } catch (err) {
      result.textContent = 'Не удалось завершить настройку: ' + (err?.message || 'Ошибка');
    } finally {
      activation.disabled = false;
    }
  }
  byId('activate-form').addEventListener('submit', activate);
  refresh.addEventListener('click', readStatus);
  readStatus();
})();
