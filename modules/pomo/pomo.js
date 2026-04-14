import { load, save, today, toDateKey, weekMonday } from '../utils.js';

// CONSTANTS

const INTERVALS = {
  work: 25,
  break: 5,
  longBreak: 15,
}

const CYCLE = ['work', 'break', 'work', 'break', 'work', 'break', 'work', 'longBreak'];

// STATE

let state;
let tickHandle = null;

/**
 * Returns the default pomo timer state.
 * @returns {Object} State with intervalType 'work' and secondsLeft for a full work session.
 */
function defaultState() {
  return { cycleIndex: 0, secondsLeft: INTERVALS.work * 60, sessions: {}, lastActiveDate: today() };
}

/**
 * Loads pomo state from storage, falling back to default.
 * Day and week resets are handled by cleanupPomo() in utils.js before this runs.
 * @returns {Object}
 */
function loadState() {
  const saved = load('tab_pomo');
  if (!saved || typeof saved.cycleIndex !== 'number') return defaultState();
  if (!saved.sessions) saved.sessions = {};
  if (!saved.secondsLeft) saved.secondsLeft = INTERVALS[CYCLE[saved.cycleIndex]] * 60;
  return saved;
}

function saveState() {
  state.lastActiveDate = today();
  save('tab_pomo', state);
}

// UTILS

/**
 * Formats a seconds count as a MM:SS string.
 * @param {number} seconds - Total seconds to format.
 * @returns {string} Zero-padded MM:SS string, e.g. "24:59".
 */
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

/** Plays a short ascending chime using the Web Audio API. */
function playChime() {
  const ctx = new AudioContext();
  [523.25, 659.25, 783.99].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t = ctx.currentTime + i * 0.15;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    osc.start(t);
    osc.stop(t + 1.2);
  });
}

// DISPLAY

/**
 * Marks the current cycle step in the progress list with aria-current="step".
 * @param {HTMLElement} progress - The .progress list element.
 */
function updateProgress(progress) {
  const items = progress.querySelectorAll('li');

  items.forEach((item, i) => {
    item.removeAttribute('aria-current');
    if (i < state.cycleIndex) {
      item.dataset.completed = '';
    } else {
      item.removeAttribute('data-completed');
    }
  });

  items[state.cycleIndex].setAttribute('aria-current', 'step');
}

/**
 * Updates the today and week session counts in the stats display.
 * @param {HTMLElement} stats - The .stats element.
 */
function updateStats(stats) {
  const todayKey = today();
  const mondayKey = toDateKey(weekMonday(new Date()));
  const todayCount = state.sessions[todayKey] || 0;
  let weekCount = 0;
  for (const key of Object.keys(state.sessions)) {
    if (key >= mondayKey && key <= todayKey) weekCount += state.sessions[key];
  }
  stats.querySelector('.today').textContent = todayCount;
  stats.querySelector('.week').textContent = weekCount;

  const dayOfWeek = new Date().getDay(); // (mon = 1, fri = 5)
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    stats.querySelector('.average').textContent = (weekCount / dayOfWeek).toFixed(1);
  }
}

// CONTROLS

/**
 * Wires up pomo control buttons.
 * @param {HTMLElement} controls - The .button-wrapper element.
 * @param {HTMLElement} timer - The [role="timer"] display element.
 * @param {HTMLElement} progress - The .progress list element.
 * @param {HTMLElement} stats - The .stats element.
 */
function setupControls(controls, timer, progress, stats) {
  const [back, start, pause, reset, skip] = controls.querySelectorAll('.button');

  function updateButtons() {
    back.disabled = state.cycleIndex === 0;
    reset.disabled = state.secondsLeft === INTERVALS[CYCLE[state.cycleIndex]] * 60;
    start.disabled = tickHandle !== null;
    pause.disabled = tickHandle === null;
  }

  back.addEventListener('click', () => {
    clearInterval(tickHandle);
    tickHandle = null;
    state.cycleIndex--;
    if (CYCLE[state.cycleIndex] === 'work') {
      const key = today();
      state.sessions[key] = Math.max(0, (state.sessions[key] || 0) - 1);
    }
    state.secondsLeft = INTERVALS[CYCLE[state.cycleIndex]] * 60;
    timer.textContent = formatTime(state.secondsLeft);
    updateProgress(progress);
    updateStats(stats);
    saveState();
    updateButtons();
  });

  start.addEventListener('click', () => {
    tickHandle = setInterval(() => {
      state.secondsLeft -= 1;
      if (state.secondsLeft <= 0) {
        playChime();
        const completedIndex = state.cycleIndex;
        state.cycleIndex = (state.cycleIndex + 1) % CYCLE.length;
        if (CYCLE[completedIndex] === 'work') {
          const key = today();
          state.sessions[key] = (state.sessions[key] || 0) + 1;
        }
        state.secondsLeft = INTERVALS[CYCLE[state.cycleIndex]] * 60;
        updateProgress(progress);
        updateStats(stats);
        clearInterval(tickHandle);
        tickHandle = null;
      }
      timer.textContent = formatTime(state.secondsLeft);
      saveState();
      updateButtons();
    }, 1000);
    updateButtons();
  });

  pause.addEventListener('click', () => {
    clearInterval(tickHandle);
    tickHandle = null;
    updateButtons();
  });

  reset.addEventListener('click', () => {
    clearInterval(tickHandle);
    tickHandle = null;
    state.secondsLeft = INTERVALS[CYCLE[state.cycleIndex]] * 60;
    timer.textContent = formatTime(state.secondsLeft);
    saveState();
    updateButtons();
  });

  skip.addEventListener('click', () => {
    clearInterval(tickHandle);
    tickHandle = null;
    const completedIndex = state.cycleIndex;
    state.cycleIndex = (state.cycleIndex + 1) % CYCLE.length;
    if (CYCLE[completedIndex] === 'work') {
      const key = today();
      state.sessions[key] = (state.sessions[key] || 0) + 1;
    }
    state.secondsLeft = INTERVALS[CYCLE[state.cycleIndex]] * 60;
    timer.textContent = formatTime(state.secondsLeft);
    updateProgress(progress);
    updateStats(stats);
    saveState();
    updateButtons();
  });

  updateButtons();
}

// ACTIONS

/** Clicks the back button if it is enabled. */
export function back() {
  const btn = document.querySelector('#pomo .button.back');
  if (btn && !btn.disabled) btn.click();
}

/** Clicks the start button if it is enabled, or the pause button if the timer is running. */
export function toggle() {
  const start = document.querySelector('#pomo .button.start');
  if (start && !start.disabled) { start.click(); return; }
  const pause = document.querySelector('#pomo .button.pause');
  if (pause && !pause.disabled) pause.click();
}

/** Clicks the reset button if it is enabled. */
export function reset() {
  const btn = document.querySelector('#pomo .button.reset');
  if (btn && !btn.disabled) btn.click();
}

/** Clicks the skip button if it is enabled. */
export function skip() {
  const btn = document.querySelector('#pomo .button.skip');
  if (btn && !btn.disabled) btn.click();
}

// INIT

/**
 * Initializes the pomodoro module.
 * @param {HTMLElement} module - The #pomo element.
 */
export function init(module) {
  state = loadState();

  const timer = module.querySelector('[role="timer"]');
  const controls = module.querySelector('.timer-wrapper .button-wrapper');
  const progress = module.querySelector('.progress');
  const stats = module.querySelector('.stats');

  timer.textContent = formatTime(state.secondsLeft);
  updateProgress(progress);
  updateStats(stats);

  setupControls(controls, timer, progress, stats);
}