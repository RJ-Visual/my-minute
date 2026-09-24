(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MinuteCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MINUTE = 60000;
  const DAY = 86400000;
  const ICONS = ['book', 'activity', 'focus', 'leaf'];
  const COLORS = ['green', 'amber', 'blue', 'rose'];
  const MAX_ARRAYS = { habits: 1000, tasks: 20000, goals: 5000, logs: 100000 };

  function uid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return 'm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }

  function timestamp(value, label) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < -62135596800000 || value > 253402300799999) {
      throw new Error((label || 'Time') + ' must be a valid timestamp between years 1 and 9999.');
    }
    return value;
  }

  function dateBounds(key) {
    if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new Error('Date must use YYYY-MM-DD format.');
    const [year, month, day] = key.split('-').map(Number);
    if (year < 1) throw new Error('Date is outside the supported range.');
    const d = new Date(0);
    d.setFullYear(year, month - 1, day);
    d.setHours(0, 0, 0, 0);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) throw new Error('Date does not exist.');
    const start = d.getTime();
    // Advance the local calendar rather than adding 24 hours: DST days differ in length.
    d.setDate(d.getDate() + 1);
    return { start, end: d.getTime() };
  }

  function dayKey(value) {
    const d = new Date(timestamp(value, 'Date'));
    return String(d.getFullYear()).padStart(4, '0') + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function dayStart(value) { return dateBounds(dayKey(value)).start; }

  function durationParts(ms) {
    const total = Math.floor(Math.max(0, Number.isFinite(ms) ? ms : 0) / 1000);
    return { hours: Math.floor(total / 3600), minutes: Math.floor(total / 60) % 60, seconds: total % 60 };
  }

  function formatDuration(ms) {
    const p = durationParts(ms);
    return [p.hours, p.minutes, p.seconds].map(n => String(n).padStart(2, '0')).join(':');
  }

  function createState(now = Date.now()) {
    timestamp(now);
    return {
      version: 1,
      habits: [
        { id: uid(), name: 'Reading', icon: 'book', color: 'green', targetMinutes: 30, createdAt: now },
        { id: uid(), name: 'Move your body', icon: 'activity', color: 'amber', targetMinutes: 20, createdAt: now },
        { id: uid(), name: 'Deep work', icon: 'focus', color: 'blue', targetMinutes: 45, createdAt: now }
      ],
      tasks: [], goals: [], logs: [], timer: null, revision: 0
    };
  }

  function overlap(start, end, rangeStart, rangeEnd) {
    return Math.max(0, Math.min(end, rangeEnd) - Math.max(start, rangeStart));
  }

  function measuredMinutes(state, habitId, start, end, now) {
    let elapsed = 0;
    for (const log of state.logs) {
      if (habitId === null || log.habitId === habitId) elapsed += overlap(log.startedAt, log.endedAt, start, end);
    }
    if (state.timer && (habitId === null || state.timer.habitId === habitId)) {
      elapsed += overlap(state.timer.startedAt, Math.max(state.timer.startedAt, now), start, end);
    }
    return elapsed / MINUTE;
  }

  function minutesForHabit(state, habitId, dateKey, now = Date.now()) {
    const bounds = dateBounds(dateKey);
    return measuredMinutes(state, habitId, bounds.start, bounds.end, timestamp(now));
  }

  function totalMinutes(state, dateKey, now = Date.now()) {
    const bounds = dateBounds(dateKey);
    return measuredMinutes(state, null, bounds.start, bounds.end, timestamp(now));
  }

  function requireHabit(state, habitId) {
    if (!state.habits.some(h => h.id === habitId)) throw new Error('This habit no longer exists.');
  }

  function bump(state) { state.revision = (state.revision || 0) + 1; }

  function stopTimer(state, now = Date.now()) {
    timestamp(now);
    if (!state.timer) return null;
    const active = state.timer;
    const endedAt = Math.max(active.startedAt, now);
    let log = null;
    if (endedAt > active.startedAt) {
      log = { id: uid(), habitId: active.habitId, startedAt: active.startedAt, endedAt, durationMs: endedAt - active.startedAt, source: 'timer' };
      state.logs.push(log);
    }
    state.timer = null;
    bump(state);
    return log;
  }

  function startTimer(state, habitId, now = Date.now()) {
    timestamp(now);
    requireHabit(state, habitId);
    if (state.timer && state.timer.habitId === habitId) return state.timer;
    if (state.timer) stopTimer(state, now);
    state.timer = { habitId, startedAt: now };
    bump(state);
    return state.timer;
  }

  function addMinutes(state, habitId, minutes, dateKey, now = Date.now()) {
    requireHabit(state, habitId);
    if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0 || minutes > 1440) {
      throw new Error('Enter a number of minutes greater than 0 and no more than 1,440.');
    }
    timestamp(now);
    const bounds = dateBounds(dateKey);
    let remaining = minutes * MINUTE;
    const dayLength = bounds.end - bounds.start;
    const saved = [];
    // Manual credits belong wholly to the selected date. A 24-hour credit on a
    // 23-hour DST day becomes two overlapping intervals inside that same day.
    while (remaining > 0) {
      const duration = Math.min(remaining, dayLength);
      const desiredEnd = Math.min(bounds.end, Math.max(bounds.start, now));
      const startedAt = Math.max(bounds.start, Math.min(desiredEnd - duration, bounds.end - duration));
      const endedAt = startedAt + duration;
      const log = { id: uid(), habitId, startedAt, endedAt, durationMs: endedAt - startedAt, source: 'manual' };
      state.logs.push(log);
      saved.push(log);
      remaining -= duration;
    }
    bump(state);
    return saved;
  }

  function countdown(deadline, now = Date.now()) {
    timestamp(deadline, 'Deadline');
    timestamp(now);
    const remainingMs = Math.max(0, deadline - now);
    const seconds = Math.ceil(remainingMs / 1000);
    return {
      days: Math.floor(seconds / 86400), hours: Math.floor(seconds / 3600) % 24,
      minutes: Math.floor(seconds / 60) % 60, seconds: seconds % 60,
      expired: deadline <= now, remainingMs
    };
  }

  function goalProgress(state, goal, now = Date.now()) {
    timestamp(now);
    const minutes = measuredMinutes(state, goal.habitId == null ? null : goal.habitId, goal.startAt, Math.min(goal.deadline, now), now);
    return { minutes, percent: Math.min(100, Math.max(0, goal.targetMinutes > 0 ? minutes / goal.targetMinutes * 100 : 0)) };
  }

  function object(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object.');
    return value;
  }

  function cleanText(value, label, max) {
    if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(label + ' must contain 1–' + max + ' characters.');
    return value.trim();
  }

  function positive(value, label, maximum) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > maximum) throw new Error(label + ' must be greater than 0 and at most ' + maximum.toLocaleString('en-US') + '.');
    return value;
  }

  function boolean(value, label) {
    if (typeof value !== 'boolean') throw new Error(label + ' must be true or false.');
    return value;
  }

  function choice(value, options, label) {
    if (!options.includes(value)) throw new Error(label + ' is not recognized.');
    return value;
  }

  function validateState(input) {
    object(input, 'Backup');
    if (input.version !== 1) throw new Error('This backup version is not supported.');
    if (!Number.isSafeInteger(input.revision) || input.revision < 0) throw new Error('Backup revision is invalid.');
    for (const key of Object.keys(MAX_ARRAYS)) {
      if (!Array.isArray(input[key]) || input[key].length > MAX_ARRAYS[key]) throw new Error('Backup ' + key + ' must be a list with no more than ' + MAX_ARRAYS[key].toLocaleString('en-US') + ' items.');
    }
    const allIds = new Set();
    function itemId(value) {
      const id = cleanText(value, 'Item ID', 120);
      if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('Item IDs may contain only letters, digits, underscores, and hyphens.');
      if (allIds.has(id)) throw new Error('The backup contains duplicate item IDs.');
      allIds.add(id);
      return id;
    }
    const habits = input.habits.map(raw => {
      const h = object(raw, 'Habit');
      return { id: itemId(h.id), name: cleanText(h.name, 'Habit name', 120), icon: choice(h.icon, ICONS, 'Habit icon'), color: choice(h.color, COLORS, 'Habit color'), targetMinutes: positive(h.targetMinutes, 'Daily target', 1440), createdAt: timestamp(h.createdAt, 'Habit creation time') };
    });
    const habitIds = new Set(habits.map(h => h.id));
    function habitRef(id, nullable) {
      if (nullable && id === null) return null;
      if (typeof id !== 'string' || !habitIds.has(id)) throw new Error('A saved entry refers to a missing habit.');
      return id;
    }
    const tasks = input.tasks.map(raw => {
      const t = object(raw, 'Task');
      dateBounds(t.date);
      return { id: itemId(t.id), title: cleanText(t.title, 'Task title', 240), date: t.date, priority: choice(t.priority, ['high', 'normal', 'low'], 'Task priority'), done: boolean(t.done, 'Task completion'), createdAt: timestamp(t.createdAt, 'Task creation time') };
    });
    const goals = input.goals.map(raw => {
      const g = object(raw, 'Goal');
      const startAt = timestamp(g.startAt, 'Goal start time');
      const deadline = timestamp(g.deadline, 'Goal deadline');
      if (deadline <= startAt) throw new Error('A goal deadline must be after its start time.');
      return { id: itemId(g.id), title: cleanText(g.title, 'Goal title', 240), startAt, deadline, targetMinutes: positive(g.targetMinutes, 'Goal target', 52560000), habitId: habitRef(g.habitId, true), done: boolean(g.done, 'Goal completion'), createdAt: timestamp(g.createdAt, 'Goal creation time') };
    });
    const logs = input.logs.map(raw => {
      const l = object(raw, 'Time entry');
      const startedAt = timestamp(l.startedAt, 'Entry start time');
      const endedAt = timestamp(l.endedAt, 'Entry end time');
      if (endedAt <= startedAt || typeof l.durationMs !== 'number' || !Number.isFinite(l.durationMs) || l.durationMs <= 0 || Math.abs(l.durationMs - (endedAt - startedAt)) > 0.01) {
        throw new Error('A time entry has an invalid duration.');
      }
      return { id: itemId(l.id), habitId: habitRef(l.habitId, false), startedAt, endedAt, durationMs: endedAt - startedAt, source: choice(l.source, ['timer', 'manual'], 'Entry source') };
    });
    let timer = null;
    if (input.timer !== null) {
      const t = object(input.timer, 'Active timer');
      timer = { habitId: habitRef(t.habitId, false), startedAt: timestamp(t.startedAt, 'Timer start time') };
    }
    return { version: 1, habits, tasks, goals, logs, timer, revision: input.revision };
  }

  return { uid, createState, dayKey, dayStart, durationParts, formatDuration, minutesForHabit, totalMinutes, startTimer, stopTimer, addMinutes, countdown, goalProgress, validateState };
});
