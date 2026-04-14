// DOM UTILS

/**
 * Wires Escape and Enter keyboard behavior onto a form.
 * @param {HTMLFormElement} form
 * @param {function} onEscape - Called when Escape is pressed within the form.
 */
export function setupFormKeys(form, onEscape) {
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      onEscape();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'BUTTON') {
      e.preventDefault();
      form.requestSubmit();
    }
  });
}

// LOCAL STORAGE

/**
 * Loads and parses a JSON value from localStorage.
 * @param {string} key - The localStorage key.
 * @returns {any} The parsed value, or null if missing or unreadable.
 */
export function load(key) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

/**
 * Serializes a value to JSON and writes it to localStorage.
 * @param {string} key - The localStorage key.
 * @param {any} data - The value to store.
 */
export function save(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      console.warn('[tab] localStorage quota exceeded');
    }
  }
}

// DATE HELPERS

/**
 * Returns a YYYY-MM-DD string for a given Date in local time.
 * @param {Date} [date=new Date()] - The date to convert.
 * @returns {string} A YYYY-MM-DD date key.
 */
export function toDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** @returns {string} Today's date as a YYYY-MM-DD key. */
export function today() {
  return toDateKey(new Date());
}

/**
 * Parses a YYYY-MM-DD key into a Date at local midnight.
 * @param {string} key - A YYYY-MM-DD date string.
 * @returns {Date}
 */
export function fromDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Returns the Monday of the week containing the given date.
 * @param {Date} date
 * @returns {Date}
 */
export function weekMonday(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

// ID GEN
/** @returns {string} A short unique ID. */
export function uid() {
  return Math.random().toString(36).slice(2, 6);
}



// EMOJI PICKER

const EMOJI_LIST = [
  '☎️', '💼', '📊', '📋', '📦', '📚', // work
  '🎉', '🎂', '🎯', '🗓', '⭐️', // events
  '♥️', '🌴', '🌎', '🐛', '⚰️', // life
  '🫠', '🙃', '👀', '💥', '🔥', '⚠️', // status
  '✈️', '🚀', '📍', // travel
  '🚨', '🛑', '🚧', '📴', '⏰', // urgent
  '💡', '🧠', '🧪', '🧬', 'ℹ️' // ideas
];

const DOT_COLORS = [
  { name: 'Red',    color: '#e53935' },
  { name: 'Orange', color: '#f4511e' },
  { name: 'Yellow', color: '#f9a825' },
  { name: 'Green',  color: '#43a047' },
  { name: 'Blue',   color: '#1e88e5' },
  { name: 'Indigo', color: '#3949ab' },
  { name: 'Violet', color: '#8e24aa' },
];

/**
 * Returns the canonical emoji/dot value for the input, accounting for dot color state.
 * @param {HTMLInputElement} input
 * @returns {string}
 */
export function getIconValue(input) {
  if (input.dataset.color) return 'dot:' + input.dataset.color;
  return input.value.trim();
}

/**
 * Sets the input's display and internal state for an emoji or dot value.
 * @param {HTMLInputElement} input
 * @param {string} value - An emoji string or 'dot:#rrggbb'.
 */
export function setIconValue(input, value) {
  if (value && value.startsWith('dot:')) {
    const color = value.slice(4);
    input.value = '●';
    input.style.color = color;
    input.dataset.color = color;
  } else {
    input.value = value || '';
    input.style.color = '';
    delete input.dataset.color;
  }
}

/**
 * Attaches a floating icon palette that opens when the input is focused.
 * Selecting an emoji or dot sets the input value and closes the palette.
 * @param {HTMLInputElement} input
 */
export function attachIconPalette(input) {
  let palette = null;

  /**
   * Applies the chosen icon to the input and closes the palette.
   * @param {string} icon - The emoji or `dot:#rrggbb` value to apply.
   * @returns {void}
   */
  function selectIcon(icon) {
    setIconValue(input, icon);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    closePalette();
  }

  function openPalette() {
    if (palette) return;
    palette = document.createElement('div');
    palette.className = 'icon-palette';

    const dotsRow = document.createElement('div');
    dotsRow.className = 'dots';
    for (const entry of DOT_COLORS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('aria-label', entry.name);
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = entry.color;
      btn.append(dot);
      btn.addEventListener('mousedown', function(e) { e.preventDefault(); });
      btn.addEventListener('click', function() { selectIcon('dot:' + entry.color); });
      dotsRow.append(btn);
    }

    const divider = document.createElement('hr');

    palette.append(dotsRow, divider);

    for (const emoji of EMOJI_LIST) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = emoji;
      btn.addEventListener('mousedown', function(e) { e.preventDefault(); });
      btn.addEventListener('click', function() { selectIcon(emoji); });
      palette.append(btn);
    }

    input.parentElement.append(palette);
  }

  function closePalette() {
    if (!palette) return;
    palette.remove();
    palette = null;
  }

  input.addEventListener('focus', openPalette);
  input.addEventListener('click', openPalette);
  input.addEventListener('blur', closePalette);
  input.addEventListener('input', function() {
    if (input.value !== '●') {
      input.style.color = '';
      delete input.dataset.dotColor;
    }
  });
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closePalette();
      e.stopPropagation();
    }
  });
}

// ICON ELEMENT

/**
 * Builds a `<span>` icon element for an emoji or dot indicator value.
 * Returns a dot placeholder span if icon is null or empty.
 * @param {string|null} icon - An emoji string, `dot:#rrggbb`, or null.
 * @returns {HTMLSpanElement}
 */
export function renderIcon(icon) {
  const el = document.createElement('span');
  el.className = 'icon';
  el.setAttribute('aria-hidden', 'true');
  if (icon && icon.startsWith('dot:')) {
    el.classList.add('dot');
    el.style.background = icon.slice(4);
    return el;
  }
  if (icon) {
    el.classList.add('emoji');
    el.textContent = icon;
    return el;
  }
  el.classList.add('dot');
  return el;
}

// RENDER UTILS

/**
 * Builds an img element for a UI chrome SVG icon. 
 * @param {string} name - The SVG filename stem.
 * @returns {HTMLImageElement}
 */
export function renderSvgIcon(name) {
  const img = document.createElement('img');
  img.src = `icons/${name}.svg`;
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  img.dataset.icon = '';
  return img;
}

/**
 * Builds a div.form-wrapper containing a form with id and class derived from verb and noun.
 * @param {string} verb - The form mode ('add' or 'edit').
 * @param {string} noun - The item type ('task', 'bookmark', 'reminder', etc.).
 * @returns {{ wrapper: HTMLDivElement, form: HTMLFormElement }}
 */
export function renderFormWrapper(verb, noun) {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-wrapper';
  const form = document.createElement('form');
  form.id = `${verb}-${noun}`;
  form.className = `${verb} ${verb}-${noun}`;
  wrapper.append(form);
  return { wrapper, form };
}

/**
 * Builds a grip drag handle image element.
 * @returns {HTMLImageElement}
 */
export function renderGrip() {
  return renderSvgIcon('grip');
}

/**
 * Builds a .button-wrapper div with edit and delete icon buttons for a list item.
 * @param {string} noun - The item type label used in aria-labels (e.g. 'task', 'bookmark').
 * @returns {HTMLDivElement}
 */
export function renderItemActions(noun) {
  const actions = document.createElement('div');
  actions.className = 'button-wrapper actions';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'button edit';
  editBtn.setAttribute('aria-label', `Edit ${noun}`);
  editBtn.append(renderSvgIcon('edit'));

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'button delete';
  deleteBtn.setAttribute('aria-label', `Delete ${noun}`);
  deleteBtn.append(renderSvgIcon('delete'));

  actions.append(editBtn, deleteBtn);
  return actions;
}

/**
 * Builds a .button-wrapper div with save, cancel, and optionally delete text buttons.
 * @param {boolean} hasDelete - Whether to include a delete button.
 * @returns {HTMLDivElement}
 */
export function renderFormButtons(hasDelete) {
  const buttons = document.createElement('div');
  buttons.className = 'button-wrapper';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.className = 'button save';
  saveBtn.textContent = 'Save';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'button cancel';
  cancelBtn.textContent = 'Cancel';

  buttons.append(saveBtn, cancelBtn);

  if (hasDelete) {
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'button delete';
    deleteBtn.textContent = 'Delete';
    buttons.append(deleteBtn);
  }

  return buttons;
}

// SVG

/** @type {Map<string, Promise<string>>} */
const svgCache = new Map();

/**
 * Fetches an SVG by URL and returns its source, with caching.
 * @param {string} url
 * @returns {Promise<string>}
 */
function fetchSvg(url) {
  if (!svgCache.has(url)) {
    svgCache.set(url, fetch(url).then(r => r.text()));
  }
  return svgCache.get(url);
}

/**
 * Derives the icon name from an SVG src path (e.g. 'icons/edit.svg' → 'edit').
 * @param {string} src
 * @returns {string}
 */
function iconNameFromSrc(src) {
  return src.split('/').pop().replace(/\.svg$/i, '');
}

/**
 * Replaces the img with the inline SVG.
 * @param {HTMLImageElement} img
 * @returns {Promise<void>}
 */
async function inlineSvg(img) {
  const src = img.src;
  const iconName = iconNameFromSrc(src);

  img.classList.add('icon', iconName);

  if (!img.parentElement || !img.parentElement.classList.contains('icon-wrapper')) {
    const wrapper = document.createElement('span');
    wrapper.className = 'icon-wrapper';
    img.replaceWith(wrapper);
    wrapper.append(img);
  }

  const text = await fetchSvg(src);
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) return;
  svg.setAttribute('class', img.getAttribute('class'));
  if (img.getAttribute('aria-label')) svg.setAttribute('aria-label', img.getAttribute('aria-label'));
  if (img.getAttribute('aria-hidden')) svg.setAttribute('aria-hidden', img.getAttribute('aria-hidden'));
  img.replaceWith(svg);
}

/**
 * Inlines any pending SVG icon images within the given root element.
 * @param {ParentNode} root - The element or document subtree to scan.
 * @returns {void}
 */
function applyIcons(root) {
  for (const img of root.querySelectorAll('img[data-icon]')) inlineSvg(img);
}

const iconObserver = new MutationObserver(mutations => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType !== 1) continue;
      if (node.matches('img[data-icon]')) inlineSvg(node);
      else if (node.querySelector) applyIcons(node);
    }
  }
});

document.addEventListener('DOMContentLoaded', () => {
  applyIcons(document);
  iconObserver.observe(document.body, { childList: true, subtree: true });
});
