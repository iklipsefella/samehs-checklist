(() => {
  const FROM_WEB = 'samehs-checklist-web';
  const FROM_EXTENSION = 'samehs-checklist-extension';

  function post(type, payload = {}) {
    window.postMessage({ source: FROM_EXTENSION, type, ...payload }, '*');
  }

  async function deliverPendingCapture() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'SAMEH_GET_PENDING_CAPTURE' });
      if (response?.capture?.text) post('SAMEH_PENDING_CAPTURE', response.capture);
    } catch {}
  }

  window.addEventListener('message', async (event) => {
    if (event.source !== window || !event.data || event.data.source !== FROM_WEB) return;

    if (event.data.type === 'SAMEH_PING_EXTENSION') {
      post('SAMEH_EXTENSION_READY');
      return;
    }

    if (event.data.type === 'SAMEH_GET_PENDING_CAPTURE') {
      await deliverPendingCapture();
      return;
    }

    if (event.data.type === 'SAMEH_SYNC_REMINDERS') {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'SAMEH_SYNC_REMINDERS',
          reminders: event.data.reminders || [],
        });
        post('SAMEH_REMINDERS_SYNCED', { count: response?.count || 0 });
      } catch {}
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'SAMEH_DELIVER_CAPTURE') deliverPendingCapture();
  });

  post('SAMEH_EXTENSION_READY');
  setTimeout(deliverPendingCapture, 300);
})();
