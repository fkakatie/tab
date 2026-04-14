import { load, save, today, toDateKey, fromDateKey, weekMonday, attachIconPalette, getIconValue, setIconValue, renderIcon, renderFormButtons, renderFormWrapper, setupFormKeys } from '../utils.js';

// STATE

let weekStart;
let totalWeeks;

let calendarEl;
let mobileNavEl;
let weeksWrapperEl;
let weeksEl;
let sentinelEl;
let tooltipEl = null;

const tabletMQ = window.matchMedia('(min-width: 930px)');

// DATA

/** @returns {Object} The notes object from storage, or an empty object. */
function loadNotes() {
  return load('tab_calendar') || {};
}

/**
 * Persists the notes object to storage.
 * @param {Object} notes
 */
function saveNotes(notes) {
  save('tab_calendar', notes);
}

/**
 * Creates or deletes a calendar note. Empty text deletes the key.
 * @param {string} dateKey - A YYYY-MM-DD date string.
 * @param {string} text - The note text. Empty string deletes the note.
 * @param {string|null} [icon] - Emoji or `dot:#rrggbb` indicator for the day cell.
 */
function setNote(dateKey, text, icon) {
  const notes = loadNotes();
  if (!text) {
    delete notes[dateKey];
  } else {
    notes[dateKey] = { text, icon: icon || null };
  }
  saveNotes(notes);
}

// DOM UTILS

/**
 * Get horizontal gap between carousel items.
 * @param {HTMLElement} carousel - Carousel element
 * @returns {number} Gap size in pixels
 */
function getGapSize(carousel) {
  const styles = getComputedStyle(carousel);
  const gap = styles.gap || styles.columnGap;
  return parseFloat(gap) || 0;
}

/**
 * Calculates total width of single slide (including gap to next slide).
 * @param {HTMLElement} carousel - Carousel element
 * @returns {number} Slide width, including the gap, in pixels
 */
function getSlideWidth(carousel) {
  const slide = carousel.querySelector('li');
  return slide ? slide.offsetWidth + getGapSize(carousel) : 0;
}

/**
 * Determines how many slides are currently visible in carousel viewport.
 * @param {HTMLElement} module - Container element
 * @returns {number} Number of fully visible slides
 */
function getVisibleSlides(module) {
  const carousel = module.querySelector('ol');
  const slide = carousel.querySelector('li');
  if (!carousel || !slide) return 1;

  const slideWidthWithGap = slide.offsetWidth + getGapSize(carousel);
  return Math.max(1, Math.round(carousel.clientWidth / slideWidthWithGap));
}

// ACTIVE STATE

/**
 * Returns the day cell currently marked active for editing, if any.
 * @returns {HTMLElement|null}
 */
function getActiveDate() {
  return weeksEl.querySelector('.day[data-active]');
}

/**
 * Returns the YYYY-MM-DD key for the day cell marked active, if any.
 * @returns {string|null}
 */
function getActiveDateKey() {
  const active = getActiveDate();
  return active ? active.dataset.date : null;
}

/**
 * Clears the active marker from whichever day cell has it.
 */
function clearActiveDay() {
  const cell = getActiveDate();
  if (cell) delete cell.dataset.active;
}

/**
 * Marks one day as active for editing; clears any previous active day first.
 * @param {HTMLElement} dayCell - A `.day` button whose `dataset.date` is authoritative.
 */
function setActiveDayCell(dayCell) {
  clearActiveDay();
  dayCell.dataset.active = '';
}

// TOOLTIP

/**
 * Returns the shared tooltip element, creating it on first access.
 * @returns {HTMLDivElement}
 */
function getTooltipEl() {
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'tooltip';
    weeksWrapperEl.append(tooltipEl);
  }
  return tooltipEl;
}

/**
 * Shows the calendar tooltip near a day cell.
 * @param {HTMLElement} cell
 */
function showTooltip(cell) {
  const text = cell.dataset.tooltip;
  if (!text) return;
  const tip = getTooltipEl();
  tip.textContent = text;
  tip.setAttribute('aria-hidden', 'false');

  const rect = cell.getBoundingClientRect();
  const tipRect = tip.getBoundingClientRect();
  const top = rect.bottom + 5;
  let left = rect.left + rect.width / 2 - tipRect.width / 2;
  if (left + tipRect.width > window.innerWidth - 8) left = window.innerWidth - tipRect.width - 8;
  if (left < 8) left = 8;
  tip.style.top = top + 'px';
  tip.style.left = left + 'px';
}

function hideTooltip() {
  if (tooltipEl) tooltipEl.setAttribute('aria-hidden', 'true');
}

// EDITOR

/** Removes the active note editor from the DOM without saving. */
function closeEditor() {
  const editorRow = weeksWrapperEl.querySelector('.form-wrapper');
  if (editorRow) editorRow.remove();
  clearActiveDay();
}

/**
 * Updates the dot or emoji indicator on a day cell after a save.
 * @param {string} dateKey
 * @param {boolean} hasNote
 * @param {string|null} [icon] - Emoji or `dot:#rrggbb` when hasNote is true.
 * @param {string|null} text - The note text used for the tooltip preview.
 * @returns {void}
 */
function updateIndicator(dateKey, hasNote, icon, text) {
  const cell = weeksEl.querySelector(`.day[data-date="${dateKey}"]`);
  if (!cell) return;
  const existing = cell.querySelector('.icon');
  if (existing) existing.remove();
  delete cell.dataset.icon;
  if (hasNote) {
    const indicator = renderIcon(icon);
    cell.prepend(indicator);
    if (indicator.classList.contains('emoji')) cell.dataset.icon = 'emoji';
  }
  const tooltip = writeTooltip(dateKey, hasNote ? text : null);
  cell.dataset.tooltip = tooltip;
  cell.setAttribute('aria-label', tooltip);
}

/**
 * Saves the note editor content and updates the day cell indicator.
 * @param {HTMLFormElement} form - The reminder form (`#add-reminder` or `#edit-reminder`).
 */
function saveEditor(form) {
  const dateKey = getActiveDateKey();
  if (!dateKey) return;
  const iconInput = form.querySelector('[name="icon"]');
  const textInput = form.querySelector('[name="reminder"]');
  const text = textInput.value.trim();
  const icon = getIconValue(iconInput);
  setNote(dateKey, text, icon);
  updateIndicator(dateKey, text.length > 0, icon, text);
  closeEditor();
}

/**
 * Opens the inline note editor for a date, closing any existing editor first.
 * @param {string} dateKey - The YYYY-MM-DD key.
 */
export function openEditor(dateKey) {
  closeEditor();

  const dayCell = weeksEl.querySelector(`.day[data-date="${dateKey}"]`);
  if (!dayCell) return;
  setActiveDayCell(dayCell);

  const activeKey = getActiveDateKey();
  if (!activeKey) return;

  const notes = loadNotes();
  const note = notes[activeKey];
  const text = note ? note.text : '';
  const icon = note ? note.icon : null;

  const editor = renderNoteEditor(activeKey, text, icon);

  const weekRow = dayCell.closest('.week');
  if (!weekRow) return;
  if (tabletMQ.matches) {
    editor.style.top = (weekRow.offsetTop + weekRow.offsetHeight) + 'px';
  }
  weeksWrapperEl.append(editor);

  const form = editor.querySelector('form');
  setupFormKeys(form, closeEditor);
  editor.querySelector('[name="reminder"]').focus();
}

// CAROUSEL

/**
 * Formats a day range for the week nav (one month vs span).
 * @param {Date} start - Range start (first visible day).
 * @param {Date} end - Range end (last visible day).
 * @returns {string} e.g. "Jan 5 - 11" or "Jan 29 - Feb 4".
 */
function formatWeekRangeLabel(start, end) {
  const monthA = start.toLocaleString('en-US', { month: 'short' });
  const monthB = end.toLocaleString('en-US', { month: 'short' });
  const dayA = start.getDate();
  const dayB = end.getDate();
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return monthA + ' ' + dayA + ' - ' + dayB;
  }
  return monthA + ' ' + dayA + ' - ' + monthB + ' ' + dayB;
}

function updateWeekNavLabel() {
  const slideWidth = getSlideWidth(weeksEl);
  let i = Math.round(weeksEl.scrollLeft / slideWidth);
  if (i < 0) i = 0;
  const last = weeksEl.children.length - 1;
  if (i > last) i = last;
  const row = weeksEl.children[i];
  const days = row.querySelectorAll('.day');
  const labelEl = mobileNavEl.querySelector('span');
  labelEl.textContent = formatWeekRangeLabel(
    fromDateKey(days[0].dataset.date),
    fromDateKey(days[days.length - 1].dataset.date),
  );
}

/**
 * Syncs previous button with scroll position.
 */
function updateWeekNavArrows() {
  const [previousBtn] = mobileNavEl.querySelectorAll('button');
  const slideWidth = getSlideWidth(weeksEl);
  const current = Math.round(weeksEl.scrollLeft / slideWidth);
  previousBtn.disabled = current <= 0;
}

/**
 * Updates week nav label and arrow disabled state on scroll.
 */
function onWeeksScroll() {
  updateWeekNavLabel();
  updateWeekNavArrows();
}

/**
 * Scrolls the horizontal week carousel to the row containing today (default single-column layout only).
 */
function scrollToCurrentDay() {
  if (tabletMQ.matches) return;
  const cell = weeksEl.querySelector('.day[aria-current="date"]');
  if (!cell) return;
  const weekLi = cell.closest('li.week');
  const slideWidth = getSlideWidth(weeksEl);
  const index = [...weeksEl.children].indexOf(weekLi);
  if (index < 0) return;
  weeksEl.scrollTo({
    left: index * slideWidth,
    behavior: 'auto',
  });
}

function initMobileCarousel() {
  mobileNavEl = calendarEl.querySelector('nav');

  const buttons = mobileNavEl.querySelectorAll('button');
  weeksEl.addEventListener('scroll', onWeeksScroll);
  buttons.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      const slides = [...weeksEl.children];
      const slideWidth = getSlideWidth(weeksEl);
      const visible = getVisibleSlides(weeksWrapperEl);
      const { scrollLeft } = weeksEl;
      const current = Math.round(scrollLeft / slideWidth);

      closeEditor();

      if (!i) { // Previous button
        if (current <= 0) return;
        weeksEl.scrollBy({
          left: -slideWidth * visible,
          behavior: 'smooth',
        });
      } else {
        if (current >= slides.length - visible) appendWeeks(1);
        weeksEl.scrollBy({
          left: slideWidth * visible,
          behavior: 'smooth',
        });
      }
    });
  });

  scrollToCurrentDay();
  updateWeekNavArrows();
}

/**
 * Appends count more weeks of day cells to the weeks module.
 * @param {number} count
 */
function appendWeeks(count) {
  const notes = loadNotes();
  for (let w = totalWeeks; w < totalWeeks + count; w++) {
    const dates = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + w * 7 + d);
      dates.push(date);
    }

    const weekRow = document.createElement('li');
    weekRow.className = 'week';
    weekRow.setAttribute('role', 'row');

    for (let d = 0; d < 7; d++) {
      weekRow.append(renderDayCell(dates[d], notes));
    }
    weeksEl.append(weekRow);
  }
  totalWeeks += count;
}

function render() {
  const now = new Date();
  weekStart = weekMonday(new Date(now.getFullYear(), now.getMonth(), 1));
  totalWeeks = 0;

  appendWeeks(5);
  if (tabletMQ.matches) {
    while (sentinelEl.getBoundingClientRect().top <= calendarEl.getBoundingClientRect().bottom) {
      appendWeeks(5);
    }
  }

  initMobileCarousel();

  if (tabletMQ.matches) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) appendWeeks(5);
      }
    }, { root: calendarEl });
    observer.observe(sentinelEl);
  }
}

// EVENTS

/**
 * Delegated click handler for day cells and note editor cancel.
 * @param {MouseEvent} e
 */
function onWeeksClick(e) {
  if (e.target.closest('.cancel')) {
    closeEditor();
    return;
  }

  if (e.target.closest('.delete')) {
    const dateKey = getActiveDateKey();
    if (!dateKey) return;
    setNote(dateKey, '', null);
    updateIndicator(dateKey, false, null, null);
    closeEditor();
    return;
  }

  const dayCell = e.target.closest('.day');
  if (dayCell) {
    if (dayCell.dataset.state === 'past') return;
    const dateKey = dayCell.dataset.date;
    if (dateKey === getActiveDateKey()) {
      closeEditor();
    } else {
      openEditor(dateKey);
    }
  }
}

/**
 * Handles form submission from the note editor.
 * @param {SubmitEvent} e
 */
function onWeeksSubmit(e) {
  e.preventDefault();
  const form = e.target.closest('form');
  if (form) saveEditor(form);
}

// RENDERING

/**
 * Builds the tooltip string for a day cell, optionally appending note text.
 * @param {string} dateKey
 * @param {string} [noteText]
 * @returns {string}
 */
function writeTooltip(dateKey, noteText) {
  const label = fromDateKey(dateKey).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  if (!noteText) return label;
  const preview = noteText.length > 32 ? noteText.slice(0, 32) + '…' : noteText;
  return label + ' · ' + preview.toUpperCase();
}

/**
 * Builds and returns a day cell button for a given date.
 * @param {Date} date
 * @param {Object} notes - The full notes object from storage.
 * @returns {HTMLButtonElement}
 */
function renderDayCell(date, notes) {
  const dateKey = toDateKey(date);
  const todayKey = today();

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'day';
  btn.dataset.date = dateKey;

  btn.setAttribute('role', 'gridcell');

  const noteText = notes[dateKey] && notes[dateKey].text;
  const labelText = writeTooltip(dateKey, noteText);
  btn.setAttribute('aria-label', labelText);

  if (dateKey === todayKey) btn.setAttribute('aria-current', 'date');
  if (dateKey < todayKey) {
    btn.dataset.state = 'past';
    btn.disabled = true;
  }
  const now = new Date();
  if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()) {
    btn.dataset.state = 'current-month';
  }
  if (date.getDate() === 1) {
    btn.dataset.position = 'start';
    btn.dataset.month = fromDateKey(dateKey).toLocaleDateString('en-US', { month: 'short' });
  }
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  if (date.getDate() === lastDay) btn.dataset.position = 'end';

  const numEl = document.createElement('span');
  numEl.className = 'num';
  numEl.textContent = date.getDate();

  btn.dataset.tooltip = labelText;

  btn.append(numEl);

  if (notes[dateKey]) {
    const indicator = renderIcon(notes[dateKey].icon);
    btn.prepend(indicator);
    if (indicator.classList.contains('emoji')) btn.dataset.icon = 'emoji';
  }

  return btn;
}

/**
 * Builds and returns the inline note editor row for a given date.
 * @param {string} dateKey - The YYYY-MM-DD key.
 * @param {string} text - The current note text.
 * @param {string|null} [icon] - Current emoji or dot indicator, if any.
 * @returns {HTMLDivElement}
 */
function renderNoteEditor(dateKey, text, icon) {
  const verb = text ? 'edit' : 'add';
  const { wrapper: row, form } = renderFormWrapper(verb, 'reminder');
  row.dataset.date = dateKey;

  const fieldset = document.createElement('div');
  fieldset.className = 'icon-wrapper text-wrapper';

  const iconInput = document.createElement('input');
  iconInput.type = 'text';
  iconInput.name = 'icon';
  iconInput.className = 'field icon';
  iconInput.placeholder = '✦';
  iconInput.setAttribute('aria-label', 'Icon indicator');
  iconInput.maxLength = 4;
  iconInput.autocomplete = 'off';
  if (icon) setIconValue(iconInput, icon);
  attachIconPalette(iconInput);

  const textInput = document.createElement('input');
  textInput.type = 'text';
  textInput.name = 'reminder';
  textInput.className = 'field text';
  textInput.required = true;
  textInput.value = text;
  textInput.placeholder = 'Add a reminder…';
  textInput.setAttribute('aria-label', 'Reminder');

  fieldset.append(iconInput, textInput);

  const buttonWrap = renderFormButtons(!!text);

  form.append(fieldset, buttonWrap);
  return row;
}

// INIT

/**
 * Initializes the calendar module.
 * @param {HTMLElement} module - The #calendar column element.
 */
export function init(module) {
  calendarEl = module;
  weeksWrapperEl = calendarEl.querySelector('.weeks-wrapper');
  weeksEl = weeksWrapperEl.querySelector('.weeks');
  sentinelEl = calendarEl.querySelector('.sentinel');

  weeksWrapperEl.addEventListener('click', onWeeksClick);
  weeksWrapperEl.addEventListener('submit', onWeeksSubmit);
  weeksEl.addEventListener('mouseover', (e) => {
    const cell = e.target.closest('.day');
    if (cell) showTooltip(cell);
  });
  weeksEl.addEventListener('mouseout', (e) => {
    const cell = e.target.closest('.day');
    if (cell && !cell.contains(e.relatedTarget)) hideTooltip();
  });

  tabletMQ.addEventListener('change', scrollToCurrentDay);

  render();
}
