const DEFAULT_APP_URL = 'https://samehs-checklist-info-56698819s-projects.vercel.app';
const ALARM_PREFIX = 'sameh-reminder:';
const ESCALATION_PREFIX = 'sameh-escalation:';
const REMINDERS_KEY = 'samehReminderMap';
const PENDING_CAPTURE_KEY = 'samehPendingCapture';

async function getSettings() {
  const stored = await chrome.storage.sync.get({ appUrl: DEFAULT_APP_URL, snoozeMinutes: 10 });
  let appUrl = DEFAULT_APP_URL;
  try { appUrl = new URL(stored.appUrl || DEFAULT_APP_URL).origin; } catch {}
  return { appUrl, snoozeMinutes: Math.max(1, Number(stored.snoozeMinutes) || 10) };
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'sameh-add-selection',
      title: "Add to Sameh's Checklist",
      contexts: ['selection'],
    });
  });
});

async function getSelectionFromTab(tabId) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const selection = window.getSelection?.().toString().trim();
        if (selection) return selection;
        const active = document.activeElement;
        if (active && /^(TEXTAREA|INPUT)$/.test(active.tagName) && typeof active.selectionStart === 'number') {
          return active.value.slice(active.selectionStart, active.selectionEnd).trim();
        }
        return '';
      },
    });
    return String(result || '').trim();
  } catch {
    return '';
  }
}

async function findChecklistTab() {
  const { appUrl } = await getSettings();
  const tabs = await chrome.tabs.query({});
  return tabs.find((tab) => tab.url?.startsWith(appUrl));
}

async function openApp(extraPath = '') {
  const { appUrl } = await getSettings();
  const url = `${appUrl}/${String(extraPath || '').replace(/^\//, '')}`;
  const existing = await findChecklistTab();
  if (existing?.id && !extraPath) {
    await chrome.tabs.update(existing.id, { active: true });
    if (existing.windowId) await chrome.windows.update(existing.windowId, { focused: true });
    return existing;
  }
  return chrome.tabs.create({ url, active: true });
}

async function openChecklistWithCapture(text, sourceUrl = '') {
  await chrome.storage.local.set({
    [PENDING_CAPTURE_KEY]: {
      text,
      sourceUrl,
      createdAt: new Date().toISOString(),
    },
  });

  const existing = await findChecklistTab();
  if (existing?.id) {
    await chrome.tabs.update(existing.id, { active: true });
    if (existing.windowId) await chrome.windows.update(existing.windowId, { focused: true });
    try { await chrome.tabs.sendMessage(existing.id, { type: 'SAMEH_DELIVER_CAPTURE' }); } catch {}
  } else {
    await openApp();
  }
}

async function captureActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  const text = await getSelectionFromTab(tab.id);
  if (!text) {
    chrome.notifications.create('sameh-no-selection', {
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: "Sameh's Checklist",
      message: 'Highlight the task text first, then press the capture hotkey again.',
    });
    return;
  }
  await openChecklistWithCapture(text, tab.url || '');
}

chrome.commands.onCommand.addListener((command) => {
  if (command === 'capture-selection') captureActiveTab();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'sameh-add-selection' && info.selectionText) {
    openChecklistWithCapture(info.selectionText.trim(), tab?.url || '');
  }
});

async function clearReminderAlarms() {
  const alarms = await chrome.alarms.getAll();
  const managed = alarms.filter((alarm) => alarm.name.startsWith(ALARM_PREFIX) || alarm.name.startsWith(ESCALATION_PREFIX));
  await Promise.all(managed.map((alarm) => chrome.alarms.clear(alarm.name)));
}

async function syncReminders(reminders) {
  await clearReminderAlarms();
  const map = {};
  const now = Date.now();
  for (const reminder of reminders || []) {
    const timestamp = Number(reminder?.timestamp ?? reminder?.when);
    if (!reminder?.id || !Number.isFinite(timestamp) || timestamp < now - 30000) continue;
    const alarmName = `${ALARM_PREFIX}${reminder.id}`;
    const normalized = { ...reminder, timestamp };
    map[alarmName] = normalized;
    map[`${ESCALATION_PREFIX}${reminder.id}`] = normalized;
    chrome.alarms.create(alarmName, { when: Math.max(timestamp, now + 500) });
  }
  await chrome.storage.local.set({ [REMINDERS_KEY]: map });
  return Object.keys(map).filter((key) => key.startsWith(ALARM_PREFIX)).length;
}

async function getReminder(notificationOrAlarmId) {
  const stored = await chrome.storage.local.get(REMINDERS_KEY);
  return stored[REMINDERS_KEY]?.[notificationOrAlarmId] || null;
}

async function showReminderNotification(id, reminder, escalated = false) {
  if (!reminder) return;
  chrome.notifications.create(id, {
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title: escalated ? 'Still open' : "Sameh's Checklist",
    message: reminder.body || reminder.title || 'This task is due now.',
    requireInteraction: true,
    priority: 2,
    buttons: [{ title: 'Mark done' }, { title: 'Snooze' }],
  });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  const primary = alarm.name.startsWith(ALARM_PREFIX);
  const escalated = alarm.name.startsWith(ESCALATION_PREFIX);
  if (!primary && !escalated) return;
  const reminder = await getReminder(alarm.name);
  if (!reminder) return;
  await showReminderNotification(alarm.name, reminder, escalated);
  if (primary) {
    const { snoozeMinutes } = await getSettings();
    chrome.alarms.create(`${ESCALATION_PREFIX}${reminder.id}`, { delayInMinutes: Math.max(5, snoozeMinutes) });
  }
});

async function clearReminderPair(reminder) {
  if (!reminder?.id) return;
  await chrome.alarms.clear(`${ALARM_PREFIX}${reminder.id}`);
  await chrome.alarms.clear(`${ESCALATION_PREFIX}${reminder.id}`);
  chrome.notifications.clear(`${ALARM_PREFIX}${reminder.id}`);
  chrome.notifications.clear(`${ESCALATION_PREFIX}${reminder.id}`);
}

chrome.notifications.onClicked.addListener(async (notificationId) => {
  if (!notificationId.startsWith(ALARM_PREFIX) && !notificationId.startsWith(ESCALATION_PREFIX)) return;
  await openApp();
  chrome.notifications.clear(notificationId);
});

chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  if (!notificationId.startsWith(ALARM_PREFIX) && !notificationId.startsWith(ESCALATION_PREFIX)) return;
  const reminder = await getReminder(notificationId);
  if (!reminder) return;
  if (buttonIndex === 0) {
    await clearReminderPair(reminder);
    await openApp(`?complete=${encodeURIComponent(reminder.ref || '')}`);
    return;
  }
  const { snoozeMinutes } = await getSettings();
  await clearReminderPair(reminder);
  const snoozedName = `${ALARM_PREFIX}${reminder.id}`;
  const stored = await chrome.storage.local.get(REMINDERS_KEY);
  const map = stored[REMINDERS_KEY] || {};
  map[snoozedName] = reminder;
  map[`${ESCALATION_PREFIX}${reminder.id}`] = reminder;
  await chrome.storage.local.set({ [REMINDERS_KEY]: map });
  chrome.alarms.create(snoozedName, { delayInMinutes: snoozeMinutes });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') return;

  if (message.type === 'SAMEH_GET_PENDING_CAPTURE') {
    chrome.storage.local.get(PENDING_CAPTURE_KEY).then((stored) => {
      const capture = stored[PENDING_CAPTURE_KEY] || null;
      if (capture) chrome.storage.local.remove(PENDING_CAPTURE_KEY);
      sendResponse({ capture });
    });
    return true;
  }

  if (message.type === 'SAMEH_SYNC_REMINDERS') {
    syncReminders(message.reminders).then((count) => sendResponse({ count })).catch(() => sendResponse({ count: 0 }));
    return true;
  }

  if (message.type === 'SAMEH_OPEN_APP') {
    openApp().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === 'SAMEH_CAPTURE_ACTIVE') {
    captureActiveTab().then(() => sendResponse({ ok: true }));
    return true;
  }
});
