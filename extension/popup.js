document.getElementById('capture').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'SAMEH_CAPTURE_ACTIVE' });
  window.close();
});
document.getElementById('open').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'SAMEH_OPEN_APP' });
  window.close();
});
