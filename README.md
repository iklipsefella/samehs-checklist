# Sameh's Checklist

A local-first, time-aware daily checklist built as a standalone PWA.

## Included

- Automatic morning, day, evening, and night routine views
- Editable recurring checklist items
- Now 3 priority strip
- One-off tasks with dates, times, reminders, notes, and immediate checked-state timestamps
- Smart rollover labels that retain the original due date
- Waiting-on tracker with automatic return dates
- Google Calendar/Outlook iCal sync plus `.ics` import
- Morning briefing and night closeout
- Seven-day completion and rollover history
- Browser notifications
- Optional Chrome hotkey companion for selected text capture and background reminder alarms
- Responsive desktop, tablet, and mobile interface
- PWA installation and offline shell
- Local JSON backup and restore

## Data model

All checklist data is stored in the browser's local storage. No account or database is required for this build. Export a JSON backup from Settings when moving to another browser or computer.

The calendar URL, if used, is stored only in the browser. It is sent in a POST body to the restricted serverless calendar proxy, not placed in the page URL.

## Hotkey companion

Download `samehs-checklist-hotkey.zip`, unzip it, then load the folder as an unpacked Chrome extension. The extension works with browser versions of WhatsApp, Slack, email, and other websites; native desktop apps cannot expose highlighted text to a browser extension.

Default shortcuts:

- Windows/Linux: `Ctrl + Shift + Y`
- macOS: `Command + Shift + Y`

The shortcut can be changed at `chrome://extensions/shortcuts`.

The companion captures highlighted text from WhatsApp Web, Slack, email, or another browser page. It also schedules persistent Chrome reminders with Done and Snooze actions. It does not wake the computer.

## Local preview

Serve the folder over HTTP:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.
