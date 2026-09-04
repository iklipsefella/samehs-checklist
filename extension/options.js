const appUrl = document.getElementById('appUrl');
const snoozeMinutes = document.getElementById('snoozeMinutes');
const status = document.getElementById('status');

chrome.storage.sync.get({ appUrl: 'https://samehs-checklist-info-56698819s-projects.vercel.app/', snoozeMinutes: 10 }).then(data => {
  appUrl.value = data.appUrl;
  snoozeMinutes.value = data.snoozeMinutes || 10;
});

document.getElementById('save').addEventListener('click', async () => {
  try {
    const url = new URL(appUrl.value.trim());
    await chrome.storage.sync.set({ appUrl: url.origin, snoozeMinutes: Math.max(1, Number(snoozeMinutes.value) || 10) });
    status.textContent = 'Saved. The hotkey is ready.';
  } catch {
    status.textContent = 'Enter a valid checklist URL.';
  }
});
