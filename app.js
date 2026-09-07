(() => {
  'use strict';

  const STORAGE_KEY = 'samehs-checklist-v1';
  const APP_VERSION = 1;
  const DAY_START_HOUR = 4;
  const PHASES = ['morning', 'day', 'evening', 'night'];
  const PHASE_COPY = {
    morning: { label: 'Morning routine', title: 'Start clean.' },
    day: { label: 'Day routine', title: 'Keep the work moving.' },
    evening: { label: 'Evening routine', title: 'Clear the open loops.' },
    night: { label: 'Night routine', title: 'Close the day.' }
  };

  // Real UUIDs (not the old "prefix_timestamp_random" strings) so every id is a valid
  // Postgres `uuid` value once it syncs to Supabase. Prefix arg kept for call-site compat.
  const uid = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };
  const pad = n => String(n).padStart(2, '0');
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));

  function nowDate() { return new Date(); }
  function effectiveDate(date = nowDate()) {
    const d = new Date(date);
    d.setHours(d.getHours() - DAY_START_HOUR);
    return d;
  }
  function dateKey(date = nowDate()) {
    const d = effectiveDate(date);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function actualDateFromKey(key, hour = 12, minute = 0) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d, hour, minute, 0, 0);
  }
  function addDaysKey(key, days) {
    const d = actualDateFromKey(key);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function daysBetween(fromKey, toKey) {
    const a = actualDateFromKey(fromKey);
    const b = actualDateFromKey(toKey);
    return Math.max(0, Math.round((b - a) / 86400000));
  }
  function isTodayKey(key) { return key === dateKey(); }
  function phaseFor(date = nowDate()) {
    const h = date.getHours();
    if (h >= 5 && h < 11) return 'morning';
    if (h >= 11 && h < 17) return 'day';
    if (h >= 17 && h < 21) return 'evening';
    return 'night';
  }
  function phaseIndex(phase) { return PHASES.indexOf(phase); }
  function formatDate(key, options = {}) {
    const d = actualDateFromKey(key);
    return new Intl.DateTimeFormat(undefined, { weekday: options.short ? 'short' : 'long', month: options.short ? 'short' : 'long', day: 'numeric', ...(options.year ? { year: 'numeric' } : {}) }).format(d);
  }
  function formatShortDate(key) {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(actualDateFromKey(key));
  }
  function formatTime(value) {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(d);
  }
  function humanDuration(ms) {
    const minutes = Math.max(0, Math.round(ms / 60000));
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  function dayNameList(days) {
    const set = [...new Set(days)].sort((a, b) => a - b);
    if (set.length === 7) return 'Every day';
    if (JSON.stringify(set) === JSON.stringify([1,2,3,4,5])) return 'Weekdays';
    if (JSON.stringify(set) === JSON.stringify([0,6])) return 'Weekends';
    const names = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    return set.map(d => names[d]).join(', ');
  }
  function timeToMinutes(value) {
    if (!value) return null;
    const [h, m] = value.split(':').map(Number);
    return h * 60 + m;
  }
  function minutesToTime(minutes) {
    const normalized = ((minutes % 1440) + 1440) % 1440;
    return `${pad(Math.floor(normalized / 60))}:${pad(normalized % 60)}`;
  }
  function parseLocalDateTime(key, time = '09:00') {
    const [y, m, d] = key.split('-').map(Number);
    const [hh, mm] = (time || '09:00').split(':').map(Number);
    return new Date(y, m - 1, d, hh, mm || 0, 0, 0);
  }

  function buildSeedRoutinesV1(today) {
    return [
      { id: uid('routine'), title: 'Check billy@iklipseworld', phase: 'morning', time: '12:00', days: [0,1,2,3,4,5,6], reminderMinutes: '', startDate: today, active: true, createdAt: new Date().toISOString() },
      { id: uid('routine'), title: 'Check contacts@thedigired.com', phase: 'morning', time: '12:00', days: [0,1,2,3,4,5,6], reminderMinutes: '', startDate: today, active: true, createdAt: new Date().toISOString() },
      { id: uid('routine'), title: 'Clear LinkedIn', phase: 'morning', time: '12:00', days: [0,1,2,3,4,5,6], reminderMinutes: '', startDate: today, active: true, createdAt: new Date().toISOString() },
      { id: uid('routine'), title: 'Clear Fiverr', phase: 'morning', time: '12:00', days: [0,1,2,3,4,5,6], reminderMinutes: '', startDate: today, active: true, createdAt: new Date().toISOString() },
      { id: uid('routine'), title: 'Clear Briefs', phase: 'morning', time: '12:00', days: [0,1,2,3,4,5,6], reminderMinutes: '', startDate: today, active: true, createdAt: new Date().toISOString() },
      { id: uid('routine'), title: 'Check Pending Slack Items (Expansio / OCA & iklipse)', phase: 'morning', time: '12:00', days: [0,1,2,3,4,5,6], reminderMinutes: '', startDate: today, active: true, createdAt: new Date().toISOString() },
      { id: uid('routine'), title: 'Review Gig Performance', phase: 'morning', time: '12:00', days: [0,1,2,3,4,5,6], reminderMinutes: '', startDate: today, active: true, createdAt: new Date().toISOString() },
      { id: uid('routine'), title: 'Review Biker’s Mutual Groups', phase: 'morning', time: '12:00', days: [0,1,2,3,4,5,6], reminderMinutes: '', startDate: today, active: true, createdAt: new Date().toISOString() },
      { id: uid('routine'), title: 'Check billy@iklipseworld', phase: 'night', time: '23:40', days: [0,1,2,3,4,5,6], reminderMinutes: '', startDate: today, active: true, createdAt: new Date().toISOString() },
      { id: uid('routine'), title: 'Check contacts@thedigired.com', phase: 'night', time: '23:40', days: [0,1,2,3,4,5,6], reminderMinutes: '', startDate: today, active: true, createdAt: new Date().toISOString() },
      { id: uid('routine'), title: 'Clear LinkedIn', phase: 'night', time: '23:40', days: [0,1,2,3,4,5,6], reminderMinutes: '', startDate: today, active: true, createdAt: new Date().toISOString() },
      { id: uid('routine'), title: 'Clear Fiverr', phase: 'night', time: '23:40', days: [0,1,2,3,4,5,6], reminderMinutes: '', startDate: today, active: true, createdAt: new Date().toISOString() },
      { id: uid('routine'), title: 'Clear Briefs', phase: 'night', time: '23:40', days: [0,1,2,3,4,5,6], reminderMinutes: '', startDate: today, active: true, createdAt: new Date().toISOString() },
      { id: uid('routine'), title: 'Check Pending Slack Items (Expansio / OCA & iklipse)', phase: 'night', time: '23:40', days: [0,1,2,3,4,5,6], reminderMinutes: '', startDate: today, active: true, createdAt: new Date().toISOString() },
      { id: uid('routine'), title: 'Review Biker’s Mutual Groups', phase: 'night', time: '23:40', days: [0,1,2,3,4,5,6], reminderMinutes: '', startDate: today, active: true, createdAt: new Date().toISOString() }
    ];
  }

  function tasklistTitles() {
    return [
      'Clear unreplied Fiverr messages',
      'Review Fiverr messages from the last 24 hours',
      'Review Fiverr briefs',
      'Follow up custom offers and interested leads already given rates',
      'Review Fiverr Ads',
      'Review Fiverr gig performance and report issues',
      'Review pending Fiverr tickets, issues and conflicts',
      'Check imminent Fiverr deadlines, deliveries and extension needs',
      'Review emails from the last 7 days across all addresses',
      'Follow up email leads',
      'Check Webflow form submissions and clear spam',
      'Remove duplicate and overlapping calendar events',
      'Review meeting notes and preparation for the next 7 days',
      'Double-check Instagram for missed items and errors',
      'Clean and unsubscribe from marketing emails',
      'Check imminent non-Fiverr deadlines, request team updates and report issues',
      'Update Trello tasks, report issues and remind Biker',
      'Update OCA dashboard',
      'Verify consulting client data, reports, meeting links, recordings and next calls are booked and sent',
      'Review Nabil’s EOD chat and task list',
      '1-hour Learning'
    ];
  }

  function buildSeedTasklistRoutinesV1(today) {
    // Deprecated (kept only so old code referencing it doesn't break): superseded by V2 below,
    // which puts every item in both Morning and Night, all daily, per Sameh's explicit correction.
    return buildSeedTasklistRoutinesV2(today);
  }

  function buildSeedTasklistRoutinesV2(today) {
    const everyDay = [0,1,2,3,4,5,6];
    const out = [];
    tasklistTitles().forEach(title => {
      out.push({ id: uid('routine'), title, phase: 'morning', time: '12:00', days: everyDay, reminderMinutes: '', startDate: today, active: true, createdAt: new Date().toISOString() });
      out.push({ id: uid('routine'), title, phase: 'night', time: '23:40', days: everyDay, reminderMinutes: '', startDate: today, active: true, createdAt: new Date().toISOString() });
    });
    return out;
  }

  function buildSeedTasklistTasksV1() {
    return [
      { id: uid('task'), title: 'Accounting collection and revision', notes: '', dueDate: '2026-09-05', dueTime: '', phase: 'any', status: 'open', createdAt: new Date().toISOString(), completedAt: null, originalDueDate: '2026-09-05', rolledFrom: null, rollCount: 0, reminderMinutes: '', source: 'seed' },
      { id: uid('task'), title: 'Accounting finalization', notes: '', dueDate: '2026-09-30', dueTime: '', phase: 'any', status: 'open', createdAt: new Date().toISOString(), completedAt: null, originalDueDate: '2026-09-30', rolledFrom: null, rollCount: 0, reminderMinutes: '', source: 'seed' },
      { id: uid('task'), title: 'Send accounting', notes: '', dueDate: '2026-10-01', dueTime: '12:00', phase: 'any', status: 'open', createdAt: new Date().toISOString(), completedAt: null, originalDueDate: '2026-10-01', rolledFrom: null, rollCount: 0, reminderMinutes: '', source: 'seed' }
    ];
  }

  function defaultState() {
    const today = dateKey();
    return {
      version: APP_VERSION,
      settings: {
        name: 'Sameh',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Cairo',
        calendarUrl: '',
        notificationsEnabled: false,
        snoozeMinutes: 10
      },
      routines: [...buildSeedRoutinesV1(today), ...buildSeedTasklistRoutinesV2(today)],
      tasks: buildSeedTasklistTasksV1(),
      seedFlags: { routinesV1: true, tasklistV1: true, tasklistV2: true },
      routineCompletions: {},
      priorities: {},
      calendarEvents: [],
      calendarSyncAt: null,
      activity: [],
      notified: {},
      lastProcessedDate: today
    };
  }

  function migrateSeeds(st) {
    st.seedFlags = st.seedFlags || {};
    let changed = false;
    const today = dateKey();
    if (!st.seedFlags.routinesV1) {
      const seed = buildSeedRoutinesV1(today);
      const existingKeys = new Set(st.routines.map(r => `${r.title}|${r.phase}|${r.time}`));
      seed.forEach(r => {
        const key = `${r.title}|${r.phase}|${r.time}`;
        if (!existingKeys.has(key)) { st.routines.push(r); existingKeys.add(key); }
      });
      st.seedFlags.routinesV1 = true;
      changed = true;
    }
    if (!st.seedFlags.tasklistV1) {
      const seedRoutines = buildSeedTasklistRoutinesV1(today);
      const existingKeys = new Set(st.routines.map(r => `${r.title}|${r.phase}|${r.time}`));
      seedRoutines.forEach(r => {
        const key = `${r.title}|${r.phase}|${r.time}`;
        if (!existingKeys.has(key)) { st.routines.push(r); existingKeys.add(key); }
      });
      const seedTasks = buildSeedTasklistTasksV1();
      const existingTaskTitles = new Set(st.tasks.map(t => t.title));
      seedTasks.forEach(t => {
        if (!existingTaskTitles.has(t.title)) { st.tasks.push(t); existingTaskTitles.add(t.title); }
      });
      st.seedFlags.tasklistV1 = true;
      changed = true;
    }
    if (!st.seedFlags.tasklistV2) {
      // Correction: the task-list items belong in BOTH Morning and Night (like the core
      // routine set), all daily — not scattered across day/evening at different times.
      // Strip any old wrongly-phased tasklist entries, then insert the corrected pairs.
      const titleSet = new Set(tasklistTitles());
      st.routines = st.routines.filter(r => !(titleSet.has(r.title) && r.phase !== 'morning' && r.phase !== 'night'));
      const seedRoutines = buildSeedTasklistRoutinesV2(today);
      const existingKeys = new Set(st.routines.map(r => `${r.title}|${r.phase}|${r.time}`));
      seedRoutines.forEach(r => {
        const key = `${r.title}|${r.phase}|${r.time}`;
        if (!existingKeys.has(key)) { st.routines.push(r); existingKeys.add(key); }
      });
      st.seedFlags.tasklistV2 = true;
      changed = true;
    }
    return changed;
  }

  function normalizeState(raw) {
    const base = defaultState();
    if (!raw || typeof raw !== 'object') return base;
    return {
      ...base,
      ...raw,
      settings: { ...base.settings, ...(raw.settings || {}) },
      routines: Array.isArray(raw.routines) ? raw.routines : base.routines,
      tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
      seedFlags: raw.seedFlags || {},
      routineCompletions: raw.routineCompletions || {},
      priorities: raw.priorities || {},
      calendarEvents: Array.isArray(raw.calendarEvents) ? raw.calendarEvents : [],
      activity: Array.isArray(raw.activity) ? raw.activity : [],
      notified: raw.notified || {}
    };
  }

  let state;
  try { state = normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
  catch { state = defaultState(); }
  if (migrateSeeds(state)) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }

  const ui = {
    activeView: 'today',
    activeRoutineFilter: phaseFor(),
    lastUndo: null,
    extensionConnected: false,
    reminderTimer: null,
    calendarSyncing: false
  };

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];

  // ===================== CLOUD SYNC (Supabase) =====================
  // Source of truth after the one-time migration below is Supabase; localStorage stays
  // as an offline cache / fast-boot snapshot. Every local mutation already funnels through
  // saveState() (grep confirms it — every create/update/delete/complete/undo path calls it),
  // so that's the single hook: it writes localStorage as before, then schedules a debounced
  // push of the full tasks/routines/routineCompletions/settings state to the cloud. Realtime
  // subscriptions pull remote changes back down and re-render. Dataset is small and personal,
  // so "diff by id set, refetch-on-change" is deliberately simple rather than fine-grained —
  // matches the handoff doc's own guidance (correctness over premature optimization).

  let db = null;
  let cloudSyncEnabled = false;
  let cloudReady = false;
  let applyingRemoteUpdate = false;
  let cloudPushTimer = null;
  let remoteRefreshTimer = null;
  let lastSyncedTaskIds = new Set();
  let lastSyncedRoutineIds = new Set();
  let lastSyncedCompletionKeys = new Set();

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // Small visible signal (sidebar footer) so it's obvious at a glance whether a device is
  // actually on cloud sync or has silently fallen back to local-only. States:
  //   'offline'   — cloud sync unavailable this session, saved to this device only
  //   'connecting'— talking to Supabase for the first time / initial migration in flight
  //   'synced'    — connected, realtime subscription live
  //   'syncing'   — a local change is being pushed up right now
  //   'error'     — cloud sync is on but the last push/pull failed; local save still succeeded
  function setSyncStatusUI(status) {
    const dot = document.getElementById('syncStatusDot');
    const text = document.getElementById('syncStatusText');
    if (!dot || !text) return;
    dot.classList.remove('is-offline', 'is-syncing', 'is-error');
    switch (status) {
      case 'connecting':
        dot.classList.add('is-syncing');
        text.textContent = 'Connecting to cloud…';
        break;
      case 'syncing':
        dot.classList.add('is-syncing');
        text.textContent = 'Syncing…';
        break;
      case 'synced':
        text.textContent = 'Synced to all devices';
        break;
      case 'error':
        dot.classList.add('is-error');
        text.textContent = 'Sync error — saved locally';
        break;
      case 'offline':
      default:
        dot.classList.add('is-offline');
        text.textContent = 'Saved on this device';
        break;
    }
  }

  function getDeviceId() {
    let id;
    try { id = localStorage.getItem('samehs-checklist-device-id'); } catch { id = null; }
    if (!id) {
      id = uid();
      try { localStorage.setItem('samehs-checklist-device-id', id); } catch {}
    }
    return id;
  }

  // One-time fixup for ids created before uid() switched to real UUIDs (needed because
  // Supabase's tasks/routines tables use a `uuid` primary key). Rewrites routineCompletions
  // keys and priorities refs so nothing goes stale. Only runs once, at first cloud migration.
  function remapLegacyIds(st) {
    const taskIdMap = {};
    const routineIdMap = {};

    st.tasks.forEach(task => {
      if (!UUID_RE.test(task.id)) { const newId = uid(); taskIdMap[task.id] = newId; task.id = newId; }
    });
    st.routines.forEach(routine => {
      if (!UUID_RE.test(routine.id)) { const newId = uid(); routineIdMap[routine.id] = newId; routine.id = newId; }
    });

    if (Object.keys(routineIdMap).length) {
      const remapped = {};
      Object.entries(st.routineCompletions).forEach(([key, value]) => {
        const idx = key.indexOf('::');
        const date = key.slice(0, idx);
        const routineId = key.slice(idx + 2);
        remapped[`${date}::${routineIdMap[routineId] || routineId}`] = value;
      });
      st.routineCompletions = remapped;
    }

    if (Object.keys(taskIdMap).length || Object.keys(routineIdMap).length) {
      Object.keys(st.priorities).forEach(dateStr => {
        st.priorities[dateStr] = (st.priorities[dateStr] || []).map(ref => {
          if (ref.startsWith('t:') && taskIdMap[ref.slice(2)]) return `t:${taskIdMap[ref.slice(2)]}`;
          if (ref.startsWith('r:')) {
            const parts = ref.split(':');
            if (routineIdMap[parts[1]]) return `r:${routineIdMap[parts[1]]}:${parts[2]}`;
          }
          return ref;
        });
      });
    }

    return Object.keys(taskIdMap).length > 0 || Object.keys(routineIdMap).length > 0;
  }

  function taskToRow(task) {
    return {
      id: task.id,
      title: task.title,
      notes: task.notes || '',
      due_date: task.dueDate || null,
      due_time: task.dueTime || null,
      phase: task.phase || 'any',
      status: task.status || 'open',
      completed_at: task.completedAt || null,
      rolled_from: task.rolledFrom || null,
      roll_count: task.rollCount || 0,
      waiting_for: task.waiting?.person || null,
      waiting_until: task.waiting?.followUpDate || null,
      waiting_note: task.waiting?.note || null,
      waiting_since: task.waiting?.since || null,
      returned_from_waiting: task.returnedFromWaiting || null,
      reminder_minutes: task.reminderMinutes === '' || task.reminderMinutes == null ? null : Number(task.reminderMinutes),
      original_due_date: task.originalDueDate || null,
      last_rolled_at: task.lastRolledAt || null,
      source: task.source || null,
      created_at: task.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      data: task
    };
  }

  function rowToTask(row) {
    if (row.data && typeof row.data === 'object') return { ...row.data, id: row.id };
    return {
      id: row.id, title: row.title, notes: row.notes || '', dueDate: row.due_date, dueTime: row.due_time || '',
      phase: row.phase || 'any', status: row.status || 'open', completedAt: row.completed_at,
      rolledFrom: row.rolled_from, rollCount: row.roll_count || 0,
      waiting: row.waiting_for ? { person: row.waiting_for, followUpDate: row.waiting_until, note: row.waiting_note || '', since: row.waiting_since } : null,
      returnedFromWaiting: row.returned_from_waiting || null,
      reminderMinutes: row.reminder_minutes == null ? '' : String(row.reminder_minutes),
      originalDueDate: row.original_due_date, lastRolledAt: row.last_rolled_at, source: row.source, createdAt: row.created_at
    };
  }

  function routineToRow(routine) {
    const days = Array.isArray(routine.days) ? routine.days : [];
    return {
      id: routine.id,
      title: routine.title,
      notes: routine.notes || null,
      phase: routine.phase,
      frequency: days.length >= 7 ? 'daily' : 'weekly',
      // Stored using JS weekday numbering (Sun=0..Sat=6) to match everything else in this
      // app. This column is supplementary only — `data` below is authoritative on read.
      days_of_week: days,
      due_time: routine.time || null,
      reminder_minutes: routine.reminderMinutes === '' || routine.reminderMinutes == null ? null : Number(routine.reminderMinutes),
      active: !!routine.active,
      start_date: routine.startDate || null,
      created_at: routine.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      data: routine
    };
  }

  function rowToRoutine(row) {
    if (row.data && typeof row.data === 'object') return { ...row.data, id: row.id };
    return {
      id: row.id, title: row.title, phase: row.phase, time: row.due_time || '',
      days: Array.isArray(row.days_of_week) ? row.days_of_week : [],
      reminderMinutes: row.reminder_minutes == null ? '' : String(row.reminder_minutes),
      startDate: row.start_date, active: row.active, createdAt: row.created_at
    };
  }

  async function initDataLayer() {
    try {
      const response = await fetch('/api/config', { cache: 'no-store' });
      if (!response.ok) throw new Error(`config endpoint returned ${response.status}`);
      const config = await response.json();
      if (!config.supabaseUrl || !config.supabaseAnonKey) throw new Error('Supabase config missing from /api/config');
      if (!window.supabase || typeof window.supabase.createClient !== 'function') throw new Error('Supabase client script did not load');
      db = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
      cloudSyncEnabled = true;
    } catch (err) {
      cloudSyncEnabled = false;
      setSyncStatusUI('offline');
      console.warn('[cloud sync] disabled —', err?.message || err);
    }
  }

  async function fetchCloudSnapshot() {
    const [tasksRes, routinesRes, completionsRes, settingsRes] = await Promise.all([
      db.from('tasks').select('*'),
      db.from('routines').select('*'),
      db.from('routine_completions').select('*'),
      db.from('settings').select('*')
    ]);
    if (tasksRes.error) throw tasksRes.error;
    if (routinesRes.error) throw routinesRes.error;
    if (completionsRes.error) throw completionsRes.error;
    if (settingsRes.error) throw settingsRes.error;
    return { tasks: tasksRes.data || [], routines: routinesRes.data || [], completions: completionsRes.data || [], settings: settingsRes.data || [] };
  }

  function applyCloudSnapshotToState(snapshot) {
    applyingRemoteUpdate = true;
    try {
      state.tasks = snapshot.tasks.map(rowToTask);
      state.routines = snapshot.routines.map(rowToRoutine);

      const completions = {};
      snapshot.completions.forEach(row => {
        completions[routineCompletionKey(row.routine_id, row.completion_date)] =
          (row.data && typeof row.data === 'object') ? row.data : { status: 'done', completedAt: row.completed_at };
      });
      state.routineCompletions = completions;

      const settingsMap = {};
      snapshot.settings.forEach(row => { settingsMap[row.key] = row.value; });
      if (settingsMap.app_settings) state.settings = { ...state.settings, ...settingsMap.app_settings };
      if (settingsMap.priorities) state.priorities = settingsMap.priorities;
      if (settingsMap.seed_flags) state.seedFlags = { ...state.seedFlags, ...settingsMap.seed_flags };
      if (settingsMap.activity) state.activity = settingsMap.activity;

      lastSyncedTaskIds = new Set(state.tasks.map(t => t.id));
      lastSyncedRoutineIds = new Set(state.routines.map(r => r.id));
      lastSyncedCompletionKeys = new Set(Object.keys(state.routineCompletions));

      saveState();
      processDayBoundary();
      renderAll();
    } finally {
      applyingRemoteUpdate = false;
    }
  }

  async function pushLocalStateToCloud() {
    if (!cloudSyncEnabled || !db) return;
    const taskRows = state.tasks.map(taskToRow);
    const routineRows = state.routines.map(routineToRow);
    const completionEntries = Object.entries(state.routineCompletions);
    const completionRows = completionEntries.map(([key, completion]) => {
      const idx = key.indexOf('::');
      return {
        completion_date: key.slice(0, idx),
        routine_id: key.slice(idx + 2),
        completed_at: completion.completedAt || new Date().toISOString(),
        data: completion
      };
    });

    const currentTaskIds = new Set(state.tasks.map(t => t.id));
    const currentRoutineIds = new Set(state.routines.map(r => r.id));
    const currentCompletionKeys = new Set(completionEntries.map(([key]) => key));

    const deletedTaskIds = [...lastSyncedTaskIds].filter(id => !currentTaskIds.has(id));
    const deletedRoutineIds = [...lastSyncedRoutineIds].filter(id => !currentRoutineIds.has(id));
    const deletedCompletionKeys = [...lastSyncedCompletionKeys].filter(key => !currentCompletionKeys.has(key));

    setSyncStatusUI('syncing');
    try {
      if (taskRows.length) { const { error } = await db.from('tasks').upsert(taskRows, { onConflict: 'id' }); if (error) throw error; }
      if (routineRows.length) { const { error } = await db.from('routines').upsert(routineRows, { onConflict: 'id' }); if (error) throw error; }
      if (completionRows.length) { const { error } = await db.from('routine_completions').upsert(completionRows, { onConflict: 'routine_id,completion_date' }); if (error) throw error; }
      if (deletedTaskIds.length) { const { error } = await db.from('tasks').delete().in('id', deletedTaskIds); if (error) throw error; }
      if (deletedRoutineIds.length) { const { error } = await db.from('routines').delete().in('id', deletedRoutineIds); if (error) throw error; }
      for (const key of deletedCompletionKeys) {
        const idx = key.indexOf('::');
        const { error } = await db.from('routine_completions').delete().eq('routine_id', key.slice(idx + 2)).eq('completion_date', key.slice(0, idx));
        if (error) throw error;
      }

      const { error: settingsError } = await db.from('settings').upsert([
        { key: 'app_settings', value: state.settings, updated_at: new Date().toISOString() },
        { key: 'priorities', value: state.priorities, updated_at: new Date().toISOString() },
        { key: 'seed_flags', value: state.seedFlags, updated_at: new Date().toISOString() },
        { key: 'activity', value: state.activity.slice(0, 300), updated_at: new Date().toISOString() }
      ], { onConflict: 'key' });
      if (settingsError) throw settingsError;

      lastSyncedTaskIds = currentTaskIds;
      lastSyncedRoutineIds = currentRoutineIds;
      lastSyncedCompletionKeys = currentCompletionKeys;
      setSyncStatusUI('synced');
    } catch (err) {
      setSyncStatusUI('error');
      console.warn('[cloud sync] push failed:', err?.message || err);
    }
  }

  function scheduleCloudPush() {
    if (!cloudSyncEnabled || applyingRemoteUpdate) return;
    clearTimeout(cloudPushTimer);
    cloudPushTimer = setTimeout(pushLocalStateToCloud, 700);
  }

  async function loadInitialData() {
    if (!cloudSyncEnabled || !db) return;
    setSyncStatusUI('connecting');
    try {
      const snapshot = await fetchCloudSnapshot();
      const migrationRow = snapshot.settings.find(s => s.key === 'migration_v1');
      const cloudHasData = snapshot.tasks.length > 0 || snapshot.routines.length > 0;

      if (migrationRow || cloudHasData) {
        // Cloud wins — it's the shared source of truth once any device has migrated.
        applyCloudSnapshotToState(snapshot);
      } else {
        // Nothing in the cloud yet: this device's local state becomes the seed.
        remapLegacyIds(state);
        lastSyncedTaskIds = new Set();
        lastSyncedRoutineIds = new Set();
        lastSyncedCompletionKeys = new Set();
        await pushLocalStateToCloud();
        const { error } = await db.from('settings').upsert(
          { key: 'migration_v1', value: { completedAt: new Date().toISOString(), sourceCount: state.tasks.length + state.routines.length, deviceId: getDeviceId() } },
          { onConflict: 'key' }
        );
        if (error) throw error;
        saveState();
      }
      cloudReady = true;
      setSyncStatusUI('synced');
    } catch (err) {
      setSyncStatusUI('error');
      console.warn('[cloud sync] initial load failed, staying local-only for this session:', err?.message || err);
    }
  }

  function handleRemoteChange() {
    if (applyingRemoteUpdate) return;
    clearTimeout(remoteRefreshTimer);
    remoteRefreshTimer = setTimeout(async () => {
      try {
        applyCloudSnapshotToState(await fetchCloudSnapshot());
        setSyncStatusUI('synced');
      }
      catch (err) {
        setSyncStatusUI('error');
        console.warn('[cloud sync] realtime refresh failed:', err?.message || err);
      }
    }, 400);
  }

  function subscribeRealtime() {
    if (!cloudSyncEnabled || !db) return;
    db.channel('samehs-checklist-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, handleRemoteChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'routines' }, handleRemoteChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'routine_completions' }, handleRemoteChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, handleRemoteChange)
      .subscribe();
  }

  async function initCloudSync() {
    setSyncStatusUI('connecting');
    await initDataLayer();
    if (!cloudSyncEnabled) return;
    await loadInitialData();
    subscribeRealtime();
  }
  // =================== END CLOUD SYNC (Supabase) ====================

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    syncRemindersToExtension();
    scheduleCloudPush();
  }

  function addActivity(type, title, metadata = {}, at = new Date()) {
    state.activity.unshift({ id: uid('activity'), type, title, metadata, at: at.toISOString(), date: dateKey(at) });
    if (state.activity.length > 1200) state.activity.length = 1200;
  }

  function processDayBoundary() {
    const today = dateKey();
    let changed = false;

    for (const task of state.tasks) {
      if (task.status === 'waiting' && task.waiting?.followUpDate && task.waiting.followUpDate <= today) {
        const waitingOn = task.waiting.person;
        task.status = 'open';
        task.dueDate = today;
        task.returnedFromWaiting = { person: waitingOn, followUpDate: task.waiting.followUpDate };
        task.waiting = null;
        addActivity('returned', task.title, { waitingOn });
        changed = true;
      }

      if (task.status === 'open' && task.dueDate && task.dueDate < today) {
        const from = task.dueDate;
        task.originalDueDate = task.originalDueDate || from;
        task.rolledFrom = task.originalDueDate;
        task.rollCount = (task.rollCount || 0) + Math.max(1, daysBetween(from, today));
        task.lastRolledAt = new Date().toISOString();
        task.dueDate = today;
        addActivity('rolled', task.title, { from, to: today, original: task.originalDueDate });
        changed = true;
      }
    }

    if (state.lastProcessedDate !== today) {
      state.lastProcessedDate = today;
      changed = true;
    }
    if (changed) saveState();
  }

  function routineOccursOn(routine, key = dateKey()) {
    if (!routine.active) return false;
    if (routine.startDate && key < routine.startDate) return false;
    const day = actualDateFromKey(key).getDay();
    return Array.isArray(routine.days) && routine.days.includes(day);
  }

  function routineCompletionKey(routineId, key = dateKey()) {
    return `${key}::${routineId}`;
  }

  function getRoutineOccurrence(routine, key = dateKey()) {
    const completion = state.routineCompletions[routineCompletionKey(routine.id, key)] || null;
    return {
      kind: 'routine',
      ref: `r:${routine.id}:${key}`,
      id: routine.id,
      occurrenceDate: key,
      title: routine.title,
      phase: routine.phase,
      time: routine.time,
      reminderMinutes: routine.reminderMinutes,
      status: completion?.status || 'open',
      completedAt: completion?.completedAt || null,
      routine
    };
  }

  function tasksForToday() {
    const today = dateKey();
    return state.tasks.filter(task => task.status !== 'dropped' && task.status !== 'waiting' && task.dueDate === today);
  }

  function routinesForDate(key = dateKey()) {
    return state.routines.filter(r => routineOccursOn(r, key)).map(r => getRoutineOccurrence(r, key));
  }

  function currentPhaseRoutines() {
    const phase = phaseFor();
    return routinesForDate().filter(item => item.phase === phase);
  }

  function getItemByRef(ref) {
    if (!ref) return null;
    if (ref.startsWith('r:')) {
      const [, id, key] = ref.split(':');
      const routine = state.routines.find(r => r.id === id);
      return routine && routineOccursOn(routine, key || dateKey()) ? getRoutineOccurrence(routine, key || dateKey()) : null;
    }
    const id = ref.startsWith('t:') ? ref.slice(2) : ref;
    const task = state.tasks.find(t => t.id === id);
    return task ? { ...task, kind: 'task', ref: `t:${task.id}` } : null;
  }

  function allOpenTodayItems() {
    const routines = routinesForDate().filter(i => i.status === 'open');
    const tasks = tasksForToday().filter(t => t.status === 'open').map(t => ({ ...t, kind: 'task', ref: `t:${t.id}` }));
    return [...routines, ...tasks];
  }

  function priorityRefs(key = dateKey()) {
    const refs = Array.isArray(state.priorities[key]) ? state.priorities[key] : [];
    return refs.slice(0, 3);
  }

  function setPriority(ref, rank) {
    const key = dateKey();
    const refs = priorityRefs(key);
    const clean = refs.filter(existing => existing !== ref);
    if (rank === null) {
      state.priorities[key] = clean;
    } else {
      while (clean.length < 3) clean.push(null);
      const displaced = clean[rank];
      clean[rank] = ref;
      const compact = clean.filter(Boolean);
      if (displaced && displaced !== ref && !compact.includes(displaced) && compact.length < 3) compact.push(displaced);
      state.priorities[key] = compact.slice(0, 3);
    }
    saveState();
    renderAll();
  }

  function addToFirstPriority(ref) {
    const key = dateKey();
    const refs = priorityRefs(key).filter(Boolean).filter(r => r !== ref);
    if (refs.length < 3) refs.push(ref);
    else refs[2] = ref;
    state.priorities[key] = refs;
  }

  function removeInvalidPriorities() {
    const key = dateKey();
    state.priorities[key] = priorityRefs(key).filter(ref => {
      const item = getItemByRef(ref);
      return item && item.status !== 'dropped' && item.status !== 'waiting';
    });
  }

  function completeItem(ref, completed = true) {
    const item = getItemByRef(ref);
    if (!item) return;
    const at = new Date();

    if (item.kind === 'routine') {
      const key = routineCompletionKey(item.id, item.occurrenceDate);
      const previous = state.routineCompletions[key] || null;
      if (completed) {
        state.routineCompletions[key] = { status: 'done', completedAt: at.toISOString() };
        addActivity('done', item.title, { kind: 'routine', routineId: item.id, occurrenceDate: item.occurrenceDate });
      } else {
        delete state.routineCompletions[key];
        const activityIndex = state.activity.findIndex(a => a.type === 'done' && a.metadata?.routineId === item.id && a.metadata?.occurrenceDate === item.occurrenceDate);
        if (activityIndex >= 0) state.activity.splice(activityIndex, 1);
      }
      ui.lastUndo = { type: 'routine', ref, previous };
    } else {
      const task = state.tasks.find(t => t.id === item.id);
      const previous = { status: task.status, completedAt: task.completedAt };
      if (completed) {
        task.status = 'done';
        task.completedAt = at.toISOString();
        addActivity('done', task.title, { kind: 'task', taskId: task.id });
      } else {
        task.status = 'open';
        task.completedAt = null;
        const activityIndex = state.activity.findIndex(a => a.type === 'done' && a.metadata?.taskId === task.id);
        if (activityIndex >= 0) state.activity.splice(activityIndex, 1);
      }
      ui.lastUndo = { type: 'task', ref, previous };
    }

    saveState();
    renderAll();
    if (completed) showToast(`Checked: ${item.title}`, 'Undo', undoLast);
  }

  function undoLast() {
    const action = ui.lastUndo;
    if (!action) return;
    const item = getItemByRef(action.ref);
    if (!item) return;

    if (action.type === 'routine') {
      const [, id, key] = action.ref.split(':');
      const completionKey = routineCompletionKey(id, key);
      if (action.previous) state.routineCompletions[completionKey] = action.previous;
      else delete state.routineCompletions[completionKey];
      const activityIndex = state.activity.findIndex(a => a.type === 'done' && a.metadata?.routineId === id && a.metadata?.occurrenceDate === key);
      if (activityIndex >= 0) state.activity.splice(activityIndex, 1);
    } else {
      const task = state.tasks.find(t => t.id === item.id);
      task.status = action.previous.status;
      task.completedAt = action.previous.completedAt;
      const activityIndex = state.activity.findIndex(a => a.type === 'done' && a.metadata?.taskId === task.id);
      if (activityIndex >= 0) state.activity.splice(activityIndex, 1);
    }
    ui.lastUndo = null;
    saveState();
    renderAll();
    showToast('Completion undone');
  }

  function dropTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    task.status = 'dropped';
    task.droppedAt = new Date().toISOString();
    addActivity('dropped', task.title, { taskId: task.id });
    saveState();
    renderAll();
    showToast('Task dropped', 'Undo', () => {
      task.status = 'open';
      task.droppedAt = null;
      const index = state.activity.findIndex(a => a.type === 'dropped' && a.metadata?.taskId === task.id);
      if (index >= 0) state.activity.splice(index, 1);
      saveState();
      renderAll();
    });
  }

  function moveTaskToTomorrow(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    const from = task.dueDate;
    const to = addDaysKey(dateKey(), 1);
    task.originalDueDate = task.originalDueDate || from;
    task.dueDate = to;
    task.rolledFrom = task.originalDueDate;
    task.rollCount = (task.rollCount || 0) + 1;
    task.lastRolledAt = new Date().toISOString();
    addActivity('rolled', task.title, { from, to, original: task.originalDueDate, manual: true });
    saveState();
    renderAll();
    showToast(`Moved to ${formatDate(to, { short: true })}`);
  }

  function bringBackWaiting(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    const person = task.waiting?.person;
    task.status = 'open';
    task.dueDate = dateKey();
    task.waiting = null;
    addActivity('returned', task.title, { waitingOn: person, manual: true });
    saveState();
    renderAll();
    showToast('Task returned to Today');
  }

  function showToast(message, actionLabel, action) {
    const stack = $('#toastStack');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>${esc(message)}</span>${actionLabel ? `<button type="button">${esc(actionLabel)}</button>` : ''}`;
    if (actionLabel && action) toast.querySelector('button').addEventListener('click', () => { action(); toast.remove(); });
    stack.appendChild(toast);
    setTimeout(() => { if (toast.isConnected) toast.remove(); }, actionLabel ? 6500 : 3500);
  }

  function openModal(id) {
    $('#modalLayer').hidden = false;
    $$('.modal').forEach(modal => { modal.hidden = modal.id !== id; });
    document.body.style.overflow = 'hidden';
    const modal = document.getElementById(id);
    setTimeout(() => modal?.querySelector('input:not([type="hidden"]),textarea,button')?.focus(), 50);
  }

  function closeModal() {
    $('#modalLayer').hidden = true;
    $$('.modal').forEach(modal => modal.hidden = true);
    document.body.style.overflow = '';
  }

  function openTaskModal(taskId = null, seed = null) {
    const task = taskId ? state.tasks.find(t => t.id === taskId) : null;
    $('#taskId').value = task?.id || '';
    $('#taskModalEyebrow').textContent = task ? 'Edit task' : (seed?.source === 'hotkey' ? 'Captured from selection' : 'Quick capture');
    $('#taskModalTitle').textContent = task ? 'Edit task' : 'Add a task';
    $('#taskTitle').value = task?.title || seed?.title || '';
    $('#taskDate').value = task?.dueDate || seed?.dueDate || dateKey();
    $('#taskTime').value = task?.dueTime || seed?.dueTime || '';
    $('#taskPhase').value = task?.phase || seed?.phase || 'any';
    $('#taskReminder').value = task?.reminderMinutes ?? seed?.reminderMinutes ?? '';
    $('#taskPriority').checked = task ? priorityRefs().includes(`t:${task.id}`) : Boolean(seed?.priority);
    $('#taskNotes').value = task?.notes || seed?.notes || '';
    $('#deleteTaskButton').hidden = !task;
    openModal('taskModal');
  }

  function openRoutineModal(routineId = null, phase = phaseFor()) {
    const routine = routineId ? state.routines.find(r => r.id === routineId) : null;
    $('#routineId').value = routine?.id || '';
    $('#routineModalTitle').textContent = routine ? 'Edit routine item' : 'Add routine item';
    $('#routineTitle').value = routine?.title || '';
    $('#routinePhase').value = routine?.phase || phase;
    $('#routineTime').value = routine?.time || '';
    $('#routineReminder').value = routine?.reminderMinutes ?? '';
    $('#routineStartDate').value = routine?.startDate || dateKey();
    $$('#dayPicker input').forEach(input => input.checked = routine ? routine.days.includes(Number(input.value)) : [1,2,3,4,5].includes(Number(input.value)));
    $('#deleteRoutineButton').hidden = !routine;
    openModal('routineModal');
  }

  function openWaitingModal(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    $('#waitingTaskId').value = task.id;
    $('#waitingPerson').value = task.waiting?.person || '';
    $('#waitingDate').value = task.waiting?.followUpDate || addDaysKey(dateKey(), 1);
    $('#waitingNote').value = task.waiting?.note || '';
    openModal('waitingModal');
  }

  function parseNaturalTask(text) {
    let title = String(text || '').trim().replace(/\s+/g, ' ');
    let dueDate = dateKey();
    let dueTime = '';
    let phase = 'any';
    const lower = title.toLowerCase();

    if (/\btomorrow\b/.test(lower)) dueDate = addDaysKey(dateKey(), 1);
    if (/\btonight\b/.test(lower)) phase = 'night';
    else if (/\bthis morning\b|\bmorning\b/.test(lower)) phase = 'morning';
    else if (/\bthis evening\b|\bevening\b/.test(lower)) phase = 'evening';
    else if (/\bthis afternoon\b|\bafternoon\b/.test(lower)) phase = 'day';

    const weekdayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    weekdayNames.forEach((name, index) => {
      if (new RegExp(`\\b(?:next\\s+)?${name}\\b`, 'i').test(title)) {
        const current = actualDateFromKey(dateKey());
        let diff = (index - current.getDay() + 7) % 7;
        if (diff === 0 || new RegExp(`\\bnext\\s+${name}\\b`, 'i').test(title)) diff += 7;
        dueDate = addDaysKey(dateKey(), diff);
      }
    });

    const timeMatch = title.match(/\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i) || title.match(/\b(?:at\s*)?(\d{1,2}):(\d{2})\b/i);
    if (timeMatch) {
      let hour = Number(timeMatch[1]);
      const minute = Number(timeMatch[2] || 0);
      const meridiem = timeMatch[3]?.toLowerCase();
      if (meridiem === 'pm' && hour < 12) hour += 12;
      if (meridiem === 'am' && hour === 12) hour = 0;
      if (hour >= 0 && hour < 24 && minute < 60) dueTime = `${pad(hour)}:${pad(minute)}`;
    }

    title = title
      .replace(/\b(?:tomorrow\s+(?:morning|afternoon|evening|night)|this\s+(?:morning|afternoon|evening)|tomorrow|today|tonight)\b/gi, '')
      .replace(/\b(?:morning|afternoon|evening|night)\b(?=\s*$)/gi, '')
      .replace(/\b(?:next\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
      .replace(/\b(?:at\s*)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, '')
      .replace(/\b(?:at\s*)?\d{1,2}:\d{2}\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, '')
      .trim();

    return { title: title || String(text).trim(), dueDate, dueTime, phase, source: 'hotkey' };
  }

  function addCapturedTask(text) {
    const parsed = parseNaturalTask(text);
    const task = {
      id: uid('task'), title: parsed.title, notes: '', dueDate: parsed.dueDate, dueTime: parsed.dueTime,
      phase: parsed.phase, reminderMinutes: '', status: 'open', createdAt: new Date().toISOString(),
      completedAt: null, originalDueDate: parsed.dueDate, rolledFrom: null, rollCount: 0, source: 'hotkey'
    };
    state.tasks.push(task);
    addActivity('created', task.title, { taskId: task.id, source: 'hotkey' });
    saveState();
    renderAll();
    const when = parsed.dueDate === dateKey() ? 'today' : formatDate(parsed.dueDate, { short: true });
    showToast(`Added for ${when}: ${task.title}`, 'Edit', () => openTaskModal(task.id));
  }

  function renderClock() {
    const now = new Date();
    $('#clockTime').textContent = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(now);
    const phase = phaseFor(now);
    $('#phaseLabel').textContent = `${phase} · ${state.settings.timezone.replace('_', ' ')}`;
    $('#dateLine').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(effectiveDate(now));
  }

  function eventsForDate(key = dateKey()) {
    const start = parseLocalDateTime(key, '00:00').getTime();
    const end = parseLocalDateTime(addDaysKey(key, 1), '00:00').getTime();
    return state.calendarEvents
      .filter(event => new Date(event.start).getTime() < end && new Date(event.end || event.start).getTime() > start)
      .sort((a, b) => new Date(a.start) - new Date(b.start));
  }

  function renderBriefing() {
    const phase = phaseFor();
    const name = state.settings.name || 'Sameh';
    const openTasks = tasksForToday().filter(t => t.status === 'open');
    const openRoutines = routinesForDate().filter(r => r.status === 'open');
    const waitingDueSoon = state.tasks.filter(t => t.status === 'waiting' && t.waiting?.followUpDate <= addDaysKey(dateKey(), 1)).length;
    const events = eventsForDate();
    const now = new Date();
    const futureEvents = events.filter(event => new Date(event.end || event.start) > now);
    const next = futureEvents[0];

    const copy = {
      morning: { eyebrow: 'Morning briefing', headline: `Good morning, ${name}.`, text: `${events.length || 'No'} calendar ${events.length === 1 ? 'item' : 'items'}. ${openTasks.length + openRoutines.length} open checklist ${openTasks.length + openRoutines.length === 1 ? 'item' : 'items'}. ${waitingDueSoon ? `${waitingDueSoon} follow-up${waitingDueSoon === 1 ? '' : 's'} due soon.` : 'No urgent follow-ups.'}` },
      day: { eyebrow: 'Day view', headline: 'Keep the next move clear.', text: `${openTasks.length + openRoutines.length} items remain today. Your Now 3 stays above everything else.` },
      evening: { eyebrow: 'Evening check', headline: 'Finish deliberately.', text: `${openTasks.length} open task${openTasks.length === 1 ? '' : 's'} and ${state.tasks.filter(t => t.status === 'waiting').length} waiting-on item${state.tasks.filter(t => t.status === 'waiting').length === 1 ? '' : 's'}.` },
      night: { eyebrow: 'Night closeout', headline: 'Close the loops, then stop.', text: `${openTasks.length} task${openTasks.length === 1 ? '' : 's'} still need a decision. Nothing will disappear silently.` }
    }[phase];

    $('#briefingEyebrow').textContent = copy.eyebrow;
    $('#briefingHeadline').textContent = copy.headline;
    $('#briefingText').textContent = copy.text;

    let side = '';
    if (next) {
      const start = new Date(next.start);
      const until = start - now;
      side += `<div class="brief-event"><span>Next calendar item</span><strong>${esc(next.summary || 'Busy')}</strong><small>${formatTime(start)}${next.location ? ` · ${esc(next.location)}` : ''}</small></div>`;
      if (until > 0) side += `<div class="brief-free"><span>Clear time</span><strong>${humanDuration(until)} before it starts</strong><small>${openTasks.length ? 'Use it on a Now 3 item.' : 'The list is clear.'}</small></div>`;
    } else if (state.calendarEvents.length) {
      side += `<div class="brief-free"><span>Calendar</span><strong>No more scheduled blocks today</strong><small>${events.length ? `${events.length} item${events.length === 1 ? '' : 's'} completed or passed.` : 'The day is open.'}</small></div>`;
    } else {
      side += `<div class="brief-free"><span>Calendar</span><strong>No calendar connected</strong><small>Add an iCal feed or import an .ics file.</small><button class="brief-calendar-button" type="button" data-open-calendar>Connect calendar</button></div>`;
    }
    $('#briefingSide').innerHTML = side;
  }

  function renderNowThree() {
    removeInvalidPriorities();
    const refs = priorityRefs();
    const slots = [0,1,2].map(index => {
      const ref = refs[index];
      const item = getItemByRef(ref);
      if (!item) return `<button class="now-card is-empty" type="button" data-open-priorities><span class="rank">Priority ${index + 1}</span><strong>Choose an item</strong></button>`;
      const done = item.status === 'done';
      const meta = [];
      if (item.time || item.dueTime) meta.push(formatTime(parseLocalDateTime(item.occurrenceDate || item.dueDate || dateKey(), item.time || item.dueTime)));
      if (item.kind === 'routine') meta.push('Recurring');
      if (item.rolledFrom) meta.push(`Rolled since ${formatShortDate(item.rolledFrom)}`);
      return `<article class="now-card ${done ? 'is-done' : ''}">
        <span class="rank">Priority ${index + 1}</span>
        <button class="now-check ${done ? 'is-checked' : ''}" type="button" data-complete-ref="${esc(item.ref)}" aria-label="${done ? 'Undo' : 'Complete'} ${esc(item.title)}">${done ? '✓' : ''}</button>
        <strong>${esc(item.title)}</strong>
        <div class="now-meta"><span>${esc(meta.join(' · ') || 'Today')}</span><button class="micro-button" type="button" data-remove-priority="${esc(item.ref)}" title="Remove from Now 3">×</button></div>
      </article>`;
    }).join('');
    $('#nowThreeGrid').innerHTML = slots;
  }

  function taskRow(item, { done = false, routine = false } = {}) {
    const title = esc(item.title);
    const ref = item.ref || `t:${item.id}`;
    const meta = [];
    const itemTime = item.time || item.dueTime;
    if (itemTime) meta.push(`<span>◷ ${esc(formatTime(parseLocalDateTime(item.occurrenceDate || item.dueDate || dateKey(), itemTime)))}</span>`);
    if (routine) meta.push('<span>↻ Recurring</span>');
    if (item.rolledFrom) meta.push(`<span class="rolled">↪ Rolled over since ${esc(formatShortDate(item.rolledFrom))}</span>`);
    if (item.returnedFromWaiting) meta.push(`<span class="waiting-tag">↗ Returned from ${esc(item.returnedFromWaiting.person || 'waiting')}</span>`);
    if (done && item.completedAt) meta.push(`<span>Checked ${esc(formatTime(new Date(item.completedAt)))}</span>`);
    const taskActions = !routine && !done ? `<div class="task-actions">
      <button class="micro-button" type="button" data-wait-task="${esc(item.id)}" title="Waiting on someone">↗</button>
      <button class="micro-button" type="button" data-tomorrow-task="${esc(item.id)}" title="Move to tomorrow">→</button>
      <button class="micro-button" type="button" data-edit-task="${esc(item.id)}" title="Edit task">•••</button>
    </div>` : routine && !done ? `<div class="task-actions"><button class="micro-button" type="button" data-edit-routine="${esc(item.id)}" title="Edit routine">•••</button></div>` : `<div class="task-actions"><button class="micro-button" type="button" data-complete-ref="${esc(ref)}" title="Undo completion">↶</button></div>`;

    return `<div class="task-row ${done ? 'is-done' : ''}">
      <button class="task-check ${done ? 'is-checked' : ''}" type="button" data-complete-ref="${esc(ref)}" aria-label="${done ? 'Undo' : 'Complete'} ${title}">${done ? '✓' : ''}</button>
      <button class="task-main" type="button" ${routine ? `data-edit-routine="${esc(item.id)}"` : `data-edit-task="${esc(item.id)}"`} style="text-align:left">
        <span class="task-title">${title}</span>
        ${meta.length ? `<span class="task-meta">${meta.join('')}</span>` : ''}
      </button>
      ${taskActions}
    </div>`;
  }

  function renderCurrentRoutine() {
    const phase = phaseFor();
    const copy = PHASE_COPY[phase];
    $('#routinePhaseEyebrow').textContent = copy.label;
    $('#routinePhaseTitle').textContent = copy.title;
    const items = currentPhaseRoutines();
    $('#routineTaskList').innerHTML = items.length ? items.map(item => taskRow(item, { routine: true, done: item.status === 'done' })).join('') : `<div class="empty-state"><strong>No ${phase} routine items.</strong><span>Add one or leave this part of the day open.</span></div>`;
  }

  function renderTodayTasks() {
    const tasks = tasksForToday().filter(t => t.status === 'open').sort((a, b) => {
      const aPriority = priorityRefs().indexOf(`t:${a.id}`);
      const bPriority = priorityRefs().indexOf(`t:${b.id}`);
      if (aPriority >= 0 || bPriority >= 0) return (aPriority < 0 ? 99 : aPriority) - (bPriority < 0 ? 99 : bPriority);
      if (a.dueTime && b.dueTime) return a.dueTime.localeCompare(b.dueTime);
      if (a.dueTime) return -1;
      if (b.dueTime) return 1;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
    $('#todayTaskList').innerHTML = tasks.map(task => taskRow({ ...task, ref: `t:${task.id}` })).join('');
    $('#todayEmpty').hidden = tasks.length > 0;
  }

  function renderLater() {
    const current = phaseFor();
    const currentIndex = phaseIndex(current);
    const laterPhases = PHASES.filter((phase, index) => index > currentIndex || (current === 'night' && false));
    const groups = laterPhases.map(phase => ({ phase, items: routinesForDate().filter(item => item.phase === phase) })).filter(group => group.items.length);
    const count = groups.reduce((sum, group) => sum + group.items.length, 0);
    $('#laterCount').textContent = count ? `${count}` : '';
    $('#laterTitle').textContent = count ? 'Upcoming routines' : 'Nothing scheduled';
    $('#laterBody').innerHTML = groups.map(group => `<div class="later-phase"><strong>${esc(group.phase)}</strong><div class="later-items">${group.items.map(item => `<div class="later-item"><span>${esc(item.title)}</span><small>${item.time ? esc(formatTime(parseLocalDateTime(dateKey(), item.time))) : ''}</small></div>`).join('')}</div></div>`).join('') || `<div class="empty-state"><span>No more recurring items today.</span></div>`;
  }

  function renderDone() {
    const doneRoutines = routinesForDate().filter(item => item.status === 'done');
    const doneTasks = tasksForToday().filter(task => task.status === 'done').map(task => ({ ...task, kind: 'task', ref: `t:${task.id}` }));
    const done = [...doneRoutines, ...doneTasks].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
    $('#doneCount').textContent = done.length ? `${done.length}` : '';
    $('#doneSummary').textContent = done.length ? `${done.length} completed` : 'No completed items yet';
    $('#doneTaskList').innerHTML = done.map(item => taskRow(item, { done: true, routine: item.kind === 'routine' })).join('') || `<div class="empty-state"><span>Checked items will stay visible here with their completion time.</span></div>`;
  }

  function renderCloseout() {
    const phase = phaseFor();
    const open = tasksForToday().filter(t => t.status === 'open');
    const done = tasksForToday().filter(t => t.status === 'done').length + routinesForDate().filter(r => r.status === 'done').length;
    $('#nightCloseout').hidden = phase !== 'night' || open.length === 0;
    $('#closeoutStats').innerHTML = `<div class="closeout-stat"><strong>${done}</strong><span>Completed</span></div><div class="closeout-stat"><strong>${open.length}</strong><span>Need a decision</span></div><div class="closeout-stat"><strong>${state.tasks.filter(t => t.status === 'waiting').length}</strong><span>Waiting</span></div>`;
  }

  function renderWaiting() {
    const waiting = state.tasks.filter(t => t.status === 'waiting').sort((a, b) => (a.waiting?.followUpDate || '').localeCompare(b.waiting?.followUpDate || ''));
    $('#waitingCount').textContent = waiting.length ? waiting.length : '';
    $('#waitingList').innerHTML = waiting.map(task => {
      const due = task.waiting?.followUpDate;
      const overdue = due && due < dateKey();
      return `<article class="waiting-card">
        <div><div class="person">Waiting for ${esc(task.waiting?.person || 'someone')}</div><strong>${esc(task.title)}</strong>${task.waiting?.note ? `<p>${esc(task.waiting.note)}</p>` : ''}</div>
        <div class="waiting-due"><span>${overdue ? 'Follow-up overdue' : 'Returns'}</span><strong>${due ? esc(formatDate(due, { short: true })) : 'No date'}</strong><div class="waiting-actions"><button class="micro-button" type="button" data-complete-task-id="${esc(task.id)}" title="Mark done">✓</button><button class="micro-button" type="button" data-bring-back="${esc(task.id)}" title="Bring back today">↩</button><button class="micro-button" type="button" data-wait-task="${esc(task.id)}" title="Edit follow-up">•••</button></div></div>
      </article>`;
    }).join('');
    $('#waitingEmpty').hidden = waiting.length > 0;
  }

  function getHistoryDays(count = 7) {
    const today = dateKey();
    return Array.from({ length: count }, (_, index) => addDaysKey(today, index - count + 1));
  }

  function renderHistory() {
    const days = getHistoryDays(7);
    const dayStats = days.map(key => {
      const activities = state.activity.filter(a => a.date === key);
      const done = activities.filter(a => a.type === 'done').length;
      const rolled = activities.filter(a => a.type === 'rolled').length;
      const dropped = activities.filter(a => a.type === 'dropped').length;
      return { key, activities, done, rolled, dropped };
    });
    const totalDone = dayStats.reduce((sum, d) => sum + d.done, 0);
    const totalRolled = dayStats.reduce((sum, d) => sum + d.rolled, 0);
    const totalDropped = dayStats.reduce((sum, d) => sum + d.dropped, 0);
    const denominator = totalDone + totalRolled + totalDropped;
    const rate = denominator ? Math.round(totalDone / denominator * 100) : 0;
    const completionHours = state.activity.filter(a => a.type === 'done' && days.includes(a.date)).map(a => new Date(a.at).getHours());
    const hourBuckets = { morning: 0, day: 0, evening: 0, night: 0 };
    completionHours.forEach(hour => hourBuckets[phaseFor(new Date(2020, 1, 1, hour))]++);
    const bestWindow = Object.entries(hourBuckets).sort((a, b) => b[1] - a[1])[0];

    $('#historyMetrics').innerHTML = `
      <div class="metric-card"><span>Completed</span><strong>${totalDone}</strong><small>Across the last seven days</small></div>
      <div class="metric-card"><span>Completion signal</span><strong>${rate}%</strong><small>Done compared with rolled or dropped decisions</small></div>
      <div class="metric-card"><span>Rolled over</span><strong>${totalRolled}</strong><small>${totalRolled ? 'Look for tasks that keep moving.' : 'No repeated carry-over.'}</small></div>
      <div class="metric-card"><span>Strongest window</span><strong>${bestWindow && bestWindow[1] ? esc(bestWindow[0]) : '—'}</strong><small>Based on actual completion times</small></div>`;

    const maxDone = Math.max(1, ...dayStats.map(d => d.done));
    $('#weekChart').innerHTML = dayStats.map(day => {
      const height = Math.max(3, Math.round(day.done / maxDone * 100));
      return `<div class="chart-day"><div class="chart-bar-wrap"><div class="chart-bar" style="height:${height}%" title="${day.done} completed"></div></div><strong>${esc(formatDate(day.key, { short: true }).split(',')[0])}</strong><small>${day.done}</small></div>`;
    }).join('');

    $('#historyFeed').innerHTML = [...dayStats].reverse().map(day => {
      const meaningful = day.activities.filter(a => ['done','rolled','dropped','returned'].includes(a.type));
      if (!meaningful.length) return '';
      return `<section class="history-day"><div class="history-day-date"><strong>${esc(formatDate(day.key, { short: true }))}</strong><span>${day.done} completed</span></div><div class="history-items">${meaningful.slice(0, 14).map(a => `<div class="history-item"><span>${esc(a.type === 'done' ? `✓ ${a.title}` : a.type === 'rolled' ? `↪ ${a.title}` : a.type === 'returned' ? `↩ ${a.title}` : `× ${a.title}`)}</span><span>${esc(formatTime(new Date(a.at)))}</span></div>`).join('')}</div></section>`;
    }).join('') || `<div class="empty-state large"><strong>No history yet.</strong><span>Checking, rolling, and closing tasks will build a useful record here.</span></div>`;
  }

  function renderRoutines() {
    const filter = ui.activeRoutineFilter;
    $$('#phaseTabs button').forEach(button => button.classList.toggle('is-active', button.dataset.phaseFilter === filter));
    const routines = state.routines.filter(r => r.phase === filter).sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
    $('#routineManager').innerHTML = routines.map(r => `<div class="routine-row"><button class="routine-row-main" type="button" data-edit-routine="${esc(r.id)}" style="text-align:left"><strong>${esc(r.title)}</strong><small>${esc(dayNameList(r.days))}${r.time ? ` · ${esc(formatTime(parseLocalDateTime(dateKey(), r.time)))}` : ''}${r.reminderMinutes !== '' ? ` · reminder ${Number(r.reminderMinutes) ? `${r.reminderMinutes} min before` : 'at time'}` : ''}</small></button><div class="routine-row-actions"><button class="toggle ${r.active ? 'is-on' : ''}" type="button" data-toggle-routine="${esc(r.id)}" aria-label="${r.active ? 'Disable' : 'Enable'} ${esc(r.title)}"></button><button class="micro-button" type="button" data-edit-routine="${esc(r.id)}">•••</button></div></div>`).join('') || `<div class="empty-state large"><strong>No ${esc(filter)} routine yet.</strong><span>Add only the things that should genuinely renew.</span></div>`;
  }

  function renderCounts() {
    const open = tasksForToday().filter(t => t.status === 'open').length + routinesForDate().filter(r => r.status === 'open').length;
    $('#todayCount').textContent = open ? open : '';
  }

  function renderCloseoutModal() {
    const open = tasksForToday().filter(t => t.status === 'open');
    $('#closeoutList').innerHTML = open.map(task => `<article class="closeout-item"><div><strong>${esc(task.title)}</strong><small>${task.rolledFrom ? `Already rolled since ${esc(formatShortDate(task.rolledFrom))}` : 'Due today'}</small></div><div class="closeout-actions"><button class="closeout-action" type="button" data-closeout-action="tomorrow" data-task-id="${esc(task.id)}">Tomorrow</button><button class="closeout-action" type="button" data-closeout-action="schedule" data-task-id="${esc(task.id)}">Schedule</button><button class="closeout-action" type="button" data-closeout-action="waiting" data-task-id="${esc(task.id)}">Waiting</button><button class="closeout-action" type="button" data-closeout-action="drop" data-task-id="${esc(task.id)}">Drop</button></div></article>`).join('') || `<div class="empty-state large"><strong>Everything has a decision.</strong><span>You can close the day.</span></div>`;
  }

  function renderPriorityPicker() {
    const items = allOpenTodayItems();
    const refs = priorityRefs();
    $('#priorityPicker').innerHTML = items.map(item => {
      const currentRank = refs.indexOf(item.ref);
      return `<div class="priority-choice"><div><strong>${esc(item.title)}</strong><small>${item.kind === 'routine' ? `${esc(item.phase)} routine` : item.rolledFrom ? `Rolled since ${esc(formatShortDate(item.rolledFrom))}` : 'One-off task'}</small></div><div class="rank-buttons">${[0,1,2].map(rank => `<button class="rank-button ${currentRank === rank ? 'is-active' : ''}" type="button" data-set-priority="${esc(item.ref)}" data-rank="${rank}">${rank + 1}</button>`).join('')}<button class="rank-button" type="button" data-set-priority="${esc(item.ref)}" data-rank="remove">×</button></div></div>`;
    }).join('') || `<div class="empty-state large"><strong>No open items to rank.</strong><span>Add a task or routine item first.</span></div>`;
  }

  function renderAll() {
    processDayBoundary();
    renderClock();
    renderBriefing();
    renderNowThree();
    renderCurrentRoutine();
    renderTodayTasks();
    renderLater();
    renderDone();
    renderCloseout();
    renderWaiting();
    renderHistory();
    renderRoutines();
    renderCounts();
    if (!$('#priorityModal').hidden) renderPriorityPicker();
    if (!$('#closeoutModal').hidden) renderCloseoutModal();
  }

  function switchView(view) {
    ui.activeView = view;
    $$('.view').forEach(panel => panel.classList.toggle('is-active', panel.dataset.viewPanel === view));
    $$('.nav-item,.mobile-nav button').forEach(button => button.classList.toggle('is-active', button.dataset.view === view));
    const titles = { today: 'Today', waiting: 'Waiting on', history: 'History', routines: 'Routines' };
    $('#viewTitle').textContent = titles[view] || 'Today';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderAll();
  }

  function parseICSDate(value, params = '') {
    if (!value) return null;
    const clean = value.trim();
    if (/^\d{8}$/.test(clean)) {
      const y = Number(clean.slice(0,4)), m = Number(clean.slice(4,6)), d = Number(clean.slice(6,8));
      return new Date(y, m - 1, d, 0, 0, 0);
    }
    const match = clean.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
    if (!match) return new Date(clean);
    const [, y, mo, d, h, mi, s = '00', z] = match;
    return z ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)) : new Date(+y, +mo - 1, +d, +h, +mi, +s);
  }

  function decodeICS(value = '') {
    return value.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
  }

  function parseRRule(value) {
    return Object.fromEntries(String(value || '').split(';').map(part => part.split('=')).filter(pair => pair.length === 2));
  }

  function expandRecurringEvent(event, rangeStart, rangeEnd) {
    if (!event.rrule) return [event];
    const rule = parseRRule(event.rrule);
    const freq = rule.FREQ;
    const interval = Number(rule.INTERVAL || 1);
    const until = rule.UNTIL ? parseICSDate(rule.UNTIL) : rangeEnd;
    const countLimit = Number(rule.COUNT || 1000);
    const duration = new Date(event.end) - new Date(event.start);
    const start = new Date(event.start);
    const results = [];
    let count = 0;
    const dayCodes = ['SU','MO','TU','WE','TH','FR','SA'];

    if (freq === 'WEEKLY') {
      const byDays = (rule.BYDAY || dayCodes[start.getDay()]).split(',').map(code => dayCodes.indexOf(code.replace(/^-?\d+/, ''))).filter(d => d >= 0);
      let cursor = new Date(start);
      cursor.setHours(0,0,0,0);
      while (cursor <= rangeEnd && cursor <= until && count < countLimit) {
        const weeks = Math.floor((cursor - new Date(start.getFullYear(), start.getMonth(), start.getDate())) / 604800000);
        if (weeks >= 0 && weeks % interval === 0 && byDays.includes(cursor.getDay())) {
          const occurrence = new Date(cursor);
          occurrence.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), 0);
          if (occurrence >= start) {
            count++;
            if (occurrence >= rangeStart && occurrence <= rangeEnd) results.push({ ...event, id: `${event.id}_${occurrence.toISOString()}`, start: occurrence.toISOString(), end: new Date(occurrence.getTime() + duration).toISOString() });
          }
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    } else {
      let cursor = new Date(start);
      while (cursor <= rangeEnd && cursor <= until && count < countLimit) {
        count++;
        if (cursor >= rangeStart) results.push({ ...event, id: `${event.id}_${cursor.toISOString()}`, start: cursor.toISOString(), end: new Date(cursor.getTime() + duration).toISOString() });
        if (freq === 'DAILY') cursor.setDate(cursor.getDate() + interval);
        else if (freq === 'MONTHLY') cursor.setMonth(cursor.getMonth() + interval);
        else break;
      }
    }
    return results;
  }

  function parseICS(text) {
    const unfolded = String(text || '').replace(/\r?\n[ \t]/g, '');
    const blocks = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];
    const rawEvents = blocks.map(block => {
      const lines = block.split(/\r?\n/);
      const fields = {};
      for (const line of lines) {
        const colon = line.indexOf(':');
        if (colon < 0) continue;
        const left = line.slice(0, colon);
        const value = line.slice(colon + 1);
        const [key, ...params] = left.split(';');
        if (!fields[key]) fields[key] = [];
        fields[key].push({ value, params: params.join(';') });
      }
      const start = parseICSDate(fields.DTSTART?.[0]?.value, fields.DTSTART?.[0]?.params);
      const end = parseICSDate(fields.DTEND?.[0]?.value, fields.DTEND?.[0]?.params) || (start ? new Date(start.getTime() + 3600000) : null);
      if (!start) return null;
      return {
        id: fields.UID?.[0]?.value || uid('event'),
        summary: decodeICS(fields.SUMMARY?.[0]?.value || 'Busy'),
        location: decodeICS(fields.LOCATION?.[0]?.value || ''),
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: /^\d{8}$/.test(fields.DTSTART?.[0]?.value || ''),
        rrule: fields.RRULE?.[0]?.value || '',
        source: 'calendar'
      };
    }).filter(Boolean);

    const rangeStart = new Date();
    rangeStart.setDate(rangeStart.getDate() - 14);
    const rangeEnd = new Date();
    rangeEnd.setDate(rangeEnd.getDate() + 120);
    return rawEvents.flatMap(event => expandRecurringEvent(event, rangeStart, rangeEnd)).sort((a, b) => new Date(a.start) - new Date(b.start));
  }

  async function syncCalendarFromUrl() {
    const url = $('#calendarUrl').value.trim();
    if (!url) { $('#calendarStatus').textContent = 'Paste your Google Calendar iCal URL first.'; return; }
    ui.calendarSyncing = true;
    $('#syncCalendarButton').disabled = true;
    $('#syncCalendarButton').textContent = 'Syncing…';
    $('#calendarStatus').textContent = 'Fetching calendar…';
    try {
      const response = await fetch('/api/calendar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Calendar sync failed');
      const data = await response.json();
      const events = parseICS(data.ics || '');
      state.settings.calendarUrl = url;
      state.calendarEvents = events;
      state.calendarSyncAt = new Date().toISOString();
      saveState();
      renderAll();
      $('#calendarStatus').textContent = `Synced ${events.length} calendar items. Last updated ${formatTime(new Date())}.`;
    } catch (error) {
      $('#calendarStatus').textContent = error.message || 'Could not sync this calendar. You can import an .ics file instead.';
    } finally {
      ui.calendarSyncing = false;
      $('#syncCalendarButton').disabled = false;
      $('#syncCalendarButton').textContent = 'Sync calendar';
    }
  }

  function importICSFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const events = parseICS(reader.result);
      state.calendarEvents = events;
      state.calendarSyncAt = new Date().toISOString();
      saveState();
      renderAll();
      $('#calendarStatus').textContent = `Imported ${events.length} calendar items from ${file.name}.`;
    };
    reader.onerror = () => { $('#calendarStatus').textContent = 'Could not read that file.'; };
    reader.readAsText(file);
  }

  function buildReminders() {
    const reminders = [];
    const today = dateKey();
    const horizon = addDaysKey(today, 7);

    state.tasks.filter(t => t.status === 'open' && t.dueDate >= today && t.dueDate <= horizon && t.dueTime && t.reminderMinutes !== '').forEach(task => {
      const due = parseLocalDateTime(task.dueDate, task.dueTime);
      const fireAt = new Date(due.getTime() - Number(task.reminderMinutes || 0) * 60000);
      reminders.push({ id: `task_${task.id}_${task.dueDate}_${task.dueTime}`, ref: `t:${task.id}`, title: task.title, when: fireAt.getTime(), due: due.getTime(), url: location.origin });
    });

    for (let offset = 0; offset <= 7; offset++) {
      const key = addDaysKey(today, offset);
      state.routines.filter(r => routineOccursOn(r, key) && r.time && r.reminderMinutes !== '').forEach(routine => {
        const occurrence = getRoutineOccurrence(routine, key);
        if (occurrence.status === 'done') return;
        const due = parseLocalDateTime(key, routine.time);
        const fireAt = new Date(due.getTime() - Number(routine.reminderMinutes || 0) * 60000);
        reminders.push({ id: `routine_${routine.id}_${key}_${routine.time}`, ref: `r:${routine.id}:${key}`, title: routine.title, when: fireAt.getTime(), due: due.getTime(), url: location.origin });
      });
    }
    return reminders.filter(r => r.when > Date.now() - 60000);
  }

  function syncRemindersToExtension() {
    const reminders = buildReminders().map(reminder => ({
      ...reminder,
      timestamp: reminder.when,
      body: reminder.title,
      appUrl: location.origin,
      snoozeMinutes: state.settings.snoozeMinutes || 10
    }));
    window.postMessage({
      source: 'samehs-checklist-web',
      type: 'SAMEH_SYNC_REMINDERS',
      reminders,
      appUrl: location.origin,
      snoozeMinutes: state.settings.snoozeMinutes || 10
    }, '*');
  }

  function requestPendingExtensionCapture() {
    window.postMessage({ source: 'samehs-checklist-web', type: 'SAMEH_GET_PENDING_CAPTURE' }, '*');
  }

  function checkInAppReminders() {
    if (!state.settings.notificationsEnabled) return;
    const now = Date.now();
    for (const reminder of buildReminders()) {
      if (reminder.when <= now && !state.notified[reminder.id]) {
        state.notified[reminder.id] = new Date().toISOString();
        saveState();
        showToast(`Reminder: ${reminder.title}`);
        if ('Notification' in window && Notification.permission === 'granted') {
          const notification = new Notification("Sameh's Checklist", { body: reminder.title, icon: '/icons/icon-192.png', tag: reminder.id, requireInteraction: true });
          notification.onclick = () => { window.focus(); notification.close(); };
        }
      }
    }
  }

  async function enableNotifications() {
    if (!('Notification' in window)) { showToast('This browser does not support notifications.'); return; }
    const permission = await Notification.requestPermission();
    state.settings.notificationsEnabled = permission === 'granted';
    saveState();
    $('#enableNotifications').textContent = permission === 'granted' ? 'Enabled' : 'Blocked';
    showToast(permission === 'granted' ? 'Reminders enabled' : 'Notification permission was not granted');
  }

  function exportData() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), app: "Sameh's Checklist", state }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `samehs-checklist-backup-${dateKey()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        state = normalizeState(parsed.state || parsed);
        processDayBoundary();
        saveState();
        renderAll();
        closeModal();
        showToast('Backup restored');
      } catch { showToast('That backup file could not be read.'); }
    };
    reader.readAsText(file);
  }

  function autoSyncCalendarIfNeeded() {
    const url = state.settings.calendarUrl;
    if (!url || ui.calendarSyncing) return;
    const last = state.calendarSyncAt ? new Date(state.calendarSyncAt).getTime() : 0;
    if (Date.now() - last < 6 * 3600000) return;
    fetch('/api/calendar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) }).then(response => {
      if (!response.ok) throw new Error('Sync failed');
      return response.json();
    }).then(data => {
      state.calendarEvents = parseICS(data.ics || '');
      state.calendarSyncAt = new Date().toISOString();
      saveState();
      renderAll();
    }).catch(() => {});
  }

  function handleExternalQuery() {
    const params = new URLSearchParams(location.search);
    const hashParams = new URLSearchParams(location.hash.replace(/^#\??/, ''));
    const capture = params.get('capture') || hashParams.get('capture');
    const complete = params.get('complete') || hashParams.get('complete');
    const requestedView = params.get('view') || hashParams.get('view');
    const createNew = params.get('new') || hashParams.get('new');
    if (requestedView && ['today', 'waiting', 'history', 'routines'].includes(requestedView)) {
      switchView(requestedView);
      params.delete('view');
      hashParams.delete('view');
    }
    if (createNew === '1') {
      openTaskModal();
      params.delete('new');
      hashParams.delete('new');
    }
    if (capture) {
      addCapturedTask(capture);
      params.delete('capture');
      params.delete('source');
      hashParams.delete('capture');
      hashParams.delete('source');
    }
    if (complete) {
      const item = getItemByRef(complete);
      if (item && item.status !== 'done') completeItem(complete, true);
      params.delete('complete');
      hashParams.delete('complete');
    }
    const next = params.toString();
    const nextHash = hashParams.toString();
    try { history.replaceState({}, '', `${location.pathname}${next ? `?${next}` : ''}${nextHash ? `#${nextHash}` : ''}`); } catch {}
  }

  function openSettingsModal() {
    $('#enableNotifications').textContent = state.settings.notificationsEnabled ? 'Enabled' : 'Enable';
    openModal('settingsModal');
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      const target = event.target.closest('button,a,[data-view]');
      if (!target) return;

      if (target.dataset.view) switchView(target.dataset.view);
      if (target.matches('[data-close-modal]')) closeModal();
      if (target.matches('[data-open-calendar]')) { $('#calendarUrl').value = state.settings.calendarUrl || ''; $('#calendarStatus').textContent = state.calendarSyncAt ? `Last synced ${formatDate(dateKey(new Date(state.calendarSyncAt)), { short: true })} at ${formatTime(new Date(state.calendarSyncAt))}.` : ''; openModal('calendarModal'); }
      if (target.dataset.openPriorities !== undefined || target.matches('[data-open-priorities]')) { renderPriorityPicker(); openModal('priorityModal'); }
      if (target.dataset.completeRef) {
        const item = getItemByRef(target.dataset.completeRef);
        completeItem(target.dataset.completeRef, item?.status !== 'done');
      }
      if (target.dataset.completeTaskId) completeItem(`t:${target.dataset.completeTaskId}`, true);
      if (target.dataset.editTask) openTaskModal(target.dataset.editTask);
      if (target.dataset.editRoutine) openRoutineModal(target.dataset.editRoutine);
      if (target.dataset.waitTask) openWaitingModal(target.dataset.waitTask);
      if (target.dataset.tomorrowTask) moveTaskToTomorrow(target.dataset.tomorrowTask);
      if (target.dataset.bringBack) bringBackWaiting(target.dataset.bringBack);
      if (target.dataset.removePriority) setPriority(target.dataset.removePriority, null);
      if (target.dataset.setPriority) setPriority(target.dataset.setPriority, target.dataset.rank === 'remove' ? null : Number(target.dataset.rank));
      if (target.dataset.toggleRoutine) {
        const routine = state.routines.find(r => r.id === target.dataset.toggleRoutine);
        if (routine) { routine.active = !routine.active; saveState(); renderAll(); }
      }
      if (target.dataset.phaseFilter) { ui.activeRoutineFilter = target.dataset.phaseFilter; renderRoutines(); }
      if (target.dataset.closeoutAction) {
        const id = target.dataset.taskId;
        if (target.dataset.closeoutAction === 'tomorrow') moveTaskToTomorrow(id);
        if (target.dataset.closeoutAction === 'schedule') { closeModal(); openTaskModal(id); }
        if (target.dataset.closeoutAction === 'waiting') { closeModal(); openWaitingModal(id); }
        if (target.dataset.closeoutAction === 'drop') dropTask(id);
        renderCloseoutModal();
      }
    });

    $('#quickCaptureButton').addEventListener('click', () => openTaskModal());
    $('#topSettingsButton').addEventListener('click', openSettingsModal);
    $('#mobileAddButton').addEventListener('click', () => openTaskModal());
    $('#addTaskTop').addEventListener('click', () => openTaskModal());
    $('#editNowThree').addEventListener('click', () => { renderPriorityPicker(); openModal('priorityModal'); });
    $('#manageRoutinesFromToday').addEventListener('click', () => { ui.activeRoutineFilter = phaseFor(); switchView('routines'); });
    $('#addRoutineInline').addEventListener('click', () => openRoutineModal(null, phaseFor()));
    $('#newRoutineButton').addEventListener('click', () => openRoutineModal(null, ui.activeRoutineFilter));
    $('#openSettings').addEventListener('click', openSettingsModal);
    $('#openCalendarSettings').addEventListener('click', () => { $('#calendarUrl').value = state.settings.calendarUrl || ''; closeModal(); setTimeout(() => openModal('calendarModal'), 20); });
    $('#syncCalendarButton').addEventListener('click', syncCalendarFromUrl);
    $('#icsFile').addEventListener('change', event => importICSFile(event.target.files[0]));
    $('#clearCalendarButton').addEventListener('click', () => {
      state.calendarEvents = []; state.settings.calendarUrl = ''; state.calendarSyncAt = null; saveState(); renderAll(); $('#calendarUrl').value = ''; $('#calendarStatus').textContent = 'Calendar data cleared.';
    });
    $('#enableNotifications').addEventListener('click', enableNotifications);
    $('#exportDataButton').addEventListener('click', exportData);
    $('#exportSettingsData').addEventListener('click', exportData);
    $('#importDataFile').addEventListener('change', event => importData(event.target.files[0]));
    $('#resetAppButton').addEventListener('click', () => {
      if (!confirm('Erase all local checklist data on this device?')) return;
      state = defaultState(); saveState(); renderAll(); closeModal(); showToast('Checklist reset');
    });
    $('#startCloseout').addEventListener('click', () => { renderCloseoutModal(); openModal('closeoutModal'); });

    $('#laterToggle').addEventListener('click', event => {
      const button = event.currentTarget; const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!expanded)); $('#laterBody').hidden = expanded;
    });
    $('#doneToggle').addEventListener('click', event => {
      const button = event.currentTarget; const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!expanded)); $('#doneTaskList').hidden = expanded;
    });

    $('#taskForm').addEventListener('submit', event => {
      event.preventDefault();
      const id = $('#taskId').value;
      const existing = id ? state.tasks.find(t => t.id === id) : null;
      const task = existing || { id: uid('task'), status: 'open', createdAt: new Date().toISOString(), completedAt: null, rollCount: 0 };
      const rawTitle = $('#taskTitle').value.trim();
      const understood = !existing ? parseNaturalTask(rawTitle) : null;
      task.title = understood?.title || rawTitle;
      task.notes = $('#taskNotes').value.trim();
      const selectedDate = $('#taskDate').value || dateKey();
      const selectedTime = $('#taskTime').value;
      const selectedPhase = $('#taskPhase').value;
      task.dueDate = !existing && selectedDate === dateKey() && understood?.dueDate !== dateKey() ? understood.dueDate : selectedDate;
      task.dueTime = !existing && !selectedTime && understood?.dueTime ? understood.dueTime : selectedTime;
      task.phase = !existing && selectedPhase === 'any' && understood?.phase !== 'any' ? understood.phase : selectedPhase;
      task.reminderMinutes = $('#taskReminder').value;
      task.originalDueDate = task.originalDueDate || task.dueDate;
      if (!existing) { state.tasks.push(task); addActivity('created', task.title, { taskId: task.id }); }
      const ref = `t:${task.id}`;
      if ($('#taskPriority').checked) addToFirstPriority(ref);
      else state.priorities[dateKey()] = priorityRefs().filter(r => r !== ref);
      saveState(); closeModal(); renderAll(); showToast(existing ? 'Task updated' : 'Task added');
    });

    $('#deleteTaskButton').addEventListener('click', () => {
      const id = $('#taskId').value;
      const index = state.tasks.findIndex(t => t.id === id);
      if (index < 0) return;
      const [removed] = state.tasks.splice(index, 1);
      Object.keys(state.priorities).forEach(key => state.priorities[key] = state.priorities[key].filter(ref => ref !== `t:${id}`));
      saveState(); closeModal(); renderAll(); showToast('Task deleted', 'Undo', () => { state.tasks.push(removed); saveState(); renderAll(); });
    });

    $('#routineForm').addEventListener('submit', event => {
      event.preventDefault();
      const selectedDays = $$('#dayPicker input:checked').map(input => Number(input.value));
      if (!selectedDays.length) { showToast('Choose at least one repeat day.'); return; }
      const id = $('#routineId').value;
      const existing = id ? state.routines.find(r => r.id === id) : null;
      const routine = existing || { id: uid('routine'), active: true, createdAt: new Date().toISOString() };
      routine.title = $('#routineTitle').value.trim();
      routine.phase = $('#routinePhase').value;
      routine.time = $('#routineTime').value;
      routine.days = selectedDays;
      routine.reminderMinutes = $('#routineReminder').value;
      routine.startDate = $('#routineStartDate').value || dateKey();
      if (!existing) state.routines.push(routine);
      saveState(); closeModal(); renderAll(); showToast(existing ? 'Routine updated' : 'Routine added');
    });

    $('#deleteRoutineButton').addEventListener('click', () => {
      const id = $('#routineId').value;
      const index = state.routines.findIndex(r => r.id === id);
      if (index < 0) return;
      const [removed] = state.routines.splice(index, 1);
      Object.keys(state.priorities).forEach(key => state.priorities[key] = state.priorities[key].filter(ref => !ref.startsWith(`r:${id}:`)));
      saveState(); closeModal(); renderAll(); showToast('Routine deleted', 'Undo', () => { state.routines.push(removed); saveState(); renderAll(); });
    });

    $('#waitingForm').addEventListener('submit', event => {
      event.preventDefault();
      const task = state.tasks.find(t => t.id === $('#waitingTaskId').value);
      if (!task) return;
      task.status = 'waiting';
      task.waiting = { person: $('#waitingPerson').value.trim(), followUpDate: $('#waitingDate').value, note: $('#waitingNote').value.trim(), since: new Date().toISOString() };
      addActivity('waiting', task.title, { taskId: task.id, person: task.waiting.person, followUpDate: task.waiting.followUpDate });
      state.priorities[dateKey()] = priorityRefs().filter(ref => ref !== `t:${task.id}`);
      saveState(); closeModal(); renderAll(); showToast(`Waiting on ${task.waiting.person}`);
    });

    document.addEventListener('keydown', event => {
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === 'k') { event.preventDefault(); openTaskModal(); }
      if (event.key === 'Escape' && !$('#modalLayer').hidden) closeModal();
      const windowsCapture = event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'y';
      const macCapture = event.metaKey && event.shiftKey && event.key.toLowerCase() === 'y';
      const selected = window.getSelection()?.toString().trim();
      if ((windowsCapture || macCapture) && selected) {
        event.preventDefault();
        addCapturedTask(selected);
      }
    });

    window.addEventListener('message', event => {
      if (event.source !== window || event.data?.source !== 'samehs-checklist-extension') return;
      if (event.data.type === 'SAMEH_EXTENSION_READY') {
        ui.extensionConnected = true;
        requestPendingExtensionCapture();
        syncRemindersToExtension();
      }
      if (event.data.type === 'SAMEH_PENDING_CAPTURE' && event.data.text?.trim()) {
        addCapturedTask(event.data.text.trim());
      }
      if (event.data.type === 'SAMEH_REMINDERS_SYNCED') {
        ui.extensionConnected = true;
      }
    });
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  function init() {
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detectedTimezone && state.settings.timezone !== detectedTimezone) {
      state.settings.timezone = detectedTimezone;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
    processDayBoundary();
    bindEvents();
    renderAll();
    handleExternalQuery();
    autoSyncCalendarIfNeeded();
    registerServiceWorker();
    window.postMessage({ source: 'samehs-checklist-web', type: 'SAMEH_PING_EXTENSION' }, '*');
    requestPendingExtensionCapture();
    syncRemindersToExtension();
    checkInAppReminders();
    ui.reminderTimer = setInterval(() => { renderClock(); processDayBoundary(); checkInAppReminders(); }, 30000);
    setInterval(() => { if (dateKey() !== state.lastProcessedDate) renderAll(); }, 60000);
    // Boots the app instantly from the local snapshot above, then connects to Supabase in
    // the background (not awaited) so cross-device sync comes online without blocking render.
    initCloudSync();
  }

  init();
})();
