import { load, save, today, toDateKey, fromDateKey, weekMonday } from './modules/utils.js';

// UTILS

/**
 * Dynamically loads a stylesheet and resolves when it has finished loading.
 * @param {string} href - Path to the CSS file.
 * @returns {Promise<void>}
 */
function loadStylesheet(href) {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = resolve;
    link.onerror = reject;
    document.head.appendChild(link);
  });
}

/**
 * Fetches a module's HTML fragment and injects it into a container element.
 * @param {string} moduleName - The module directory name.
 * @param {string} containerId - The ID of the target container element.
 * @returns {Promise<void>}
 */
async function loadModule(moduleName, containerId) {
  const base = `./modules/${moduleName}`;

  const [res] = await Promise.all([
    fetch(`${base}/${moduleName}.html`),
    loadStylesheet(`${base}/${moduleName}.css`),
  ]);

  const html = await res.text();
  // fragment files are local and author-controlled, not user input
  document.getElementById(containerId).innerHTML = html;
}

// CLEANUP

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function cleanupTasks() {
  const tasks = load('tab_tasks');
  if (!Array.isArray(tasks)) return;
  const cutoff = Date.now() - 7 * MS_PER_DAY;
  const filtered = tasks.filter((t) => {
    if (t.section !== 'completed') return true;
    if (!t.updatedAt) return false;
    return new Date(t.updatedAt).getTime() > cutoff;
  });
  if (filtered.length !== tasks.length) save('tab_tasks', filtered);
}

function cleanupCalendar() {
  const notes = load('tab_calendar');
  if (!notes || typeof notes !== 'object') return;
  const cutoff = Date.now() - 31 * MS_PER_DAY;
  let changed = false;
  for (const key of Object.keys(notes)) {
    if (fromDateKey(key).getTime() < cutoff) {
      delete notes[key];
      changed = true;
    }
  }
  if (changed) save('tab_calendar', notes);
}

function cleanupPomo() {
  const state = load('tab_pomo');
  if (!state || typeof state !== 'object') return;
  const todayKey = today();
  const thisMonday = toDateKey(weekMonday(new Date()));
  for (const key of Object.keys(state.sessions || {})) {
    if (key < thisMonday) delete state.sessions[key];
  }
  if (state.lastActiveDate !== todayKey) {
    state.cycleIndex = 0;
    state.secondsLeft = 0;
    state.lastActiveDate = todayKey;
  }
  save('tab_pomo', state);
}

/** Purges expired tasks and calendar notes from localStorage. Runs on load. */
function cleanup() {
  cleanupCalendar();
  cleanupTasks();
  cleanupPomo();
}

/** @returns {boolean} True if an input, textarea, or contenteditable is focused. */
function isInputFocused() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}

// EXPORT

/**
 * Imports `tab_` localStorage data from the clipboard and reloads the page.
 * @returns {Promise<void>}
 */
async function importData() {
  try {
    const text = await navigator.clipboard.readText();
    const data = JSON.parse(text);
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith('tab_')) {
        localStorage.setItem(key, JSON.stringify(value));
      }
    }
    location.reload();
  } catch {
    // invalid clipboard content — do nothing
  }
}

/**
 * Exports `tab_` localStorage data to the clipboard as formatted JSON.
 * @returns {Promise<void>}
 */
async function exportData() {
  const data = {};
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('tab_')) {
      try {
        data[key] = JSON.parse(localStorage.getItem(key));
      } catch {
        data[key] = localStorage.getItem(key);
      }
    }
  }
  await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
}

// SHORTCUTS

function toggleShortcutModal() {
  const shortcuts = document.getElementById('shortcuts');

  if (shortcuts.open) shortcuts.close();
  else shortcuts.showModal();
}

/**
 * Registers global keyboard shortcuts for app actions and modal controls.
 * @param {{ openEditor: function }} calendarModule
 * @param {{ focusInput: function }} tasksModule
 * @param {{ back: function, toggle: function, reset: function, skip: function }} pomoModule
 * @param {{ toggleForm: function }} bookmarksModule
 * @returns {void}
 */
function registerShortcuts(calendarModule, tasksModule, pomoModule, bookmarksModule) {
  const shortcuts = document.getElementById('shortcuts');

  shortcuts.addEventListener('click', (e) => {
    if (e.target === shortcuts) shortcuts.close();
  });

  shortcuts.querySelector('.button.close').addEventListener('click', () => {
    shortcuts.close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') return; // dialog handles Escape natively

    if (isInputFocused()) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === 'b' || e.key === 'B') {
      e.preventDefault();
      bookmarksModule.toggleForm();
      return;
    }

    if (e.key === 'n' || e.key === 'N' || e.key === '/') {
      e.preventDefault();
      tasksModule.focusInput();
      return;
    }

    if (e.key === 't' || e.key === 'T') {
      e.preventDefault();
      calendarModule.openEditor(today());
      return;
    }

    if (e.key === '<') {
      pomoModule.back();
      return;
    }

    if (e.key === '>') {
      pomoModule.skip();
      return;
    }

    if (e.key === 'p' || e.key === 'P') {
      pomoModule.toggle();
      return;
    }

    if (e.key === 'r' || e.key === 'R') {
      pomoModule.reset();
      return;
    }

    if (e.key === 'i' || e.key === 'I') {
      e.preventDefault();
      importData();
      return;
    }

    if (e.key === 'x' || e.key === 'X') {
      e.preventDefault();
      exportData();
      return;
    }

    if (e.key === 'h' || e.key === 'H') {
      e.preventDefault();
      document.getElementById('welcome').showModal();
      return;
    }

    if (e.key === '?') {
      toggleShortcutModal();
    }
  });
}

// INIT

/**
 * Loads, initializes, and reveals a module inside its container element.
 * @param {string} name - The module directory and file name.
 * @param {string} id - The ID of the container element.
 * @returns {Promise<object>} The imported module namespace.
 */
async function initModule(name, id) {
  await loadModule(name, id);
  const mod = await import(`./modules/${name}/${name}.js`);
  const el = document.getElementById(id);
  mod.init(el);
  el.removeAttribute('style');
  return mod;
}

/**
 * Initializes the application shell and mounts all modules.
 * @returns {Promise<void>}
 */
async function init() {
  const firstRun = !Object.keys(localStorage).some((k) => k.startsWith('tab_'));

  cleanup();
  document.body.removeAttribute('style');

  const [calendar, tasks, pomo, bookmarks] = await Promise.all([
    initModule('calendar', 'calendar'),
    initModule('tasks', 'tasks'),
    initModule('pomo', 'pomo'),
    initModule('bookmarks', 'bookmarks'),
  ]);

  const welcome = document.getElementById('welcome');
  welcome.addEventListener('click', (e) => {
    if (e.target === welcome) welcome.close();
  });
  [...welcome.querySelectorAll('.button.close')].forEach((btn) => {
    btn.addEventListener('click', () => welcome.close());
  });

  registerShortcuts(calendar, tasks, pomo, bookmarks);

  if (firstRun) welcome.showModal();
}

document.addEventListener('DOMContentLoaded', init);
