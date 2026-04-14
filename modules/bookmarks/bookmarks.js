import { load, save, uid, renderIcon, attachIconPalette, getIconValue, setIconValue, renderGrip, renderItemActions, renderFormButtons, renderFormWrapper, setupFormKeys } from '../utils.js';

// DATA

/** @returns {Object[]} The links array from storage, or an empty array. */
function loadBookmarks() {
  return load('tab_bookmarks') || [];
}

/**
 * Persists the links array to storage.
 * @param {Object[]} links - The links array to save.
 */
function saveBookmarks(bookmarks) {
  save('tab_bookmarks', bookmarks);
}

// VALIDATION

/**
 * Returns true if the string is a valid http/https URL.
 * @param {string} url - The URL string to validate.
 * @returns {boolean}
 */
function isValidUrl(url) {
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

// EDIT

/**
 * Builds a pre-filled edit form for a bookmark.
 * @param {Object} bookmark - The bookmark object to edit.
 * @returns {HTMLDivElement}
 */
function renderEditForm(bookmark) {
  const { wrapper, form } = renderFormWrapper('edit', 'bookmark');

  const fieldset = document.createElement('div');
  fieldset.className = 'icon-wrapper text-wrapper';

  const iconInput = document.createElement('input');
  iconInput.type = 'text';
  iconInput.name = 'icon';
  iconInput.className = 'field icon';
  iconInput.setAttribute('aria-label', 'Icon');
  iconInput.autocomplete = 'off';
  iconInput.maxLength = 4;
  iconInput.placeholder = '✦';
  if (bookmark.icon) setIconValue(iconInput, bookmark.icon);
  attachIconPalette(iconInput);

  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.name = 'bookmark';
  titleInput.className = 'field text';
  titleInput.setAttribute('aria-label', 'Bookmark title');
  titleInput.value = bookmark.label || '';

  fieldset.append(iconInput, titleInput);

  const urlFieldset = document.createElement('div');
  urlFieldset.className = 'url-wrapper';

  const urlInput = document.createElement('input');
  urlInput.type = 'url';
  urlInput.name = 'url';
  urlInput.className = 'field url';
  urlInput.required = true;
  urlInput.setAttribute('aria-label', 'Link URL');
  urlInput.autocomplete = 'off';
  urlInput.placeholder = 'https://…';
  urlInput.value = bookmark.url;

  urlFieldset.append(urlInput);

  const details = document.createElement('div');
  details.className = 'details';
  details.append(renderFormButtons(true));

  form.append(fieldset, urlFieldset, details);
  return wrapper;
}

/**
 * Removes the edit form and clears the editing state from a bookmark element.
 * @param {HTMLElement} li - The .bookmark list item element.
 */
function closeEdit(li) {
  const next = li.nextElementSibling;
  if (next && next.classList.contains('form-wrapper')) next.remove();
  delete li.dataset.editing;
}

/**
 * Sets up click-to-edit, cancel, Escape, and submit handling for bookmark edit forms.
 * @param {HTMLElement} list - The .list element.
 */
function setupEdit(list) {
  list.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.button.edit');
    if (!editBtn) return;
    const li = editBtn.closest('.bookmark');
    if (!li) return;

    const existing = list.querySelector('.bookmark[data-editing]');
    if (existing && existing !== li) closeEdit(existing);
    if ('editing' in li.dataset) {
      closeEdit(li);
      return;
    }

    const bookmarks = loadBookmarks();
    const bookmark = bookmarks.find((b) => b.id === li.dataset.id);
    if (!bookmark) return;

    li.dataset.editing = '';
    const editForm = renderEditForm(bookmark);
    li.after(editForm);
    setupFormKeys(editForm.querySelector('form'), () => closeEdit(li));
    editForm.querySelector('[name="bookmark"]').focus();
  });

  list.addEventListener('click', (e) => {
    const cancelBtn = e.target.closest('.edit-bookmark .button.cancel');
    if (!cancelBtn) return;
    const li = cancelBtn.closest('.form-wrapper').previousElementSibling;
    if (!li) return;
    closeEdit(li);
  });

  list.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.edit-bookmark .button.delete');
    if (!deleteBtn) return;
    const li = deleteBtn.closest('.form-wrapper').previousElementSibling;
    if (!li) return;
    const bookmarks = loadBookmarks().filter((b) => b.id !== li.dataset.id);
    saveBookmarks(bookmarks);
    render(list);
  });

  list.addEventListener('submit', (e) => {
    const form = e.target.closest('form.edit-bookmark');
    if (!form) return;
    e.preventDefault();

    const li = form.closest('.form-wrapper').previousElementSibling;
    const formData = new FormData(form);
    const url = formData.get('url').trim();
    let label = formData.get('bookmark').trim();
    if (!label) {
      try {
        label = new URL(url).hostname.replace(/^www\./, '');
      } catch {
        label = url;
      }
    }
    const icon = getIconValue(form.elements.icon) || '🔗';

    const bookmarks = loadBookmarks();
    const bookmark = bookmarks.find((b) => b.id === li.dataset.id);
    if (!bookmark) return;

    bookmark.url = url;
    bookmark.label = label;
    bookmark.icon = icon;

    saveBookmarks(bookmarks);
    render(list);
  });
}

// DRAG

/**
 * Enables drag-and-drop reordering for bookmark list items.
 * @param {HTMLElement} list - The bookmark list element.
 * @returns {void}
 */
function setupDragAndDrop(list) {
  let draggedEl = null;

  list.addEventListener('dragstart', (e) => {
    const bookmark = e.target.closest('.bookmark');
    if (!bookmark) return;
    draggedEl = bookmark;
    bookmark.dataset.dragging = '';
    e.dataTransfer.effectAllowed = 'move';
  });

  list.addEventListener('dragend', () => {
    if (draggedEl) delete draggedEl.dataset.dragging;
    draggedEl = null;
  });

  list.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!draggedEl) return;
    const over = e.target.closest('.bookmark');
    if (!over || over === draggedEl) return;
    const { top, height } = over.getBoundingClientRect();
    if (e.clientY < top + height / 2) {
      list.insertBefore(draggedEl, over);
    } else {
      over.after(draggedEl);
    }
  });

  list.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!draggedEl) return;
    const bookmarks = loadBookmarks();
    [...list.querySelectorAll('.bookmark')].forEach((el, i) => {
      const bookmark = bookmarks.find((b) => b.id === el.dataset.id);
      if (bookmark) bookmark.sortOrder = i + 1;
    });
    saveBookmarks(bookmarks);
  });
}

// FORM TOGGLE

/**
 * Collapses the add-bookmark form and updates the toggle button's aria state.
 * @param {HTMLButtonElement} addBtn - The .button.add toggle button.
 * @param {HTMLElement} formWrapper - The .form-wrapper element.
 */
function closeForm(addBtn, formWrapper) {
  delete formWrapper.dataset.open;
  addBtn.setAttribute('aria-expanded', 'false');
}

/**
 * Wires the add button to toggle the form wrapper open/closed.
 * @param {HTMLButtonElement} addBtn - The .button.add toggle button.
 * @param {HTMLElement} formWrapper - The .form-wrapper element.
 */
function setupFormToggle(addBtn, formWrapper) {
  addBtn.addEventListener('click', () => {
    if ('open' in formWrapper.dataset) {
      closeForm(addBtn, formWrapper);
    } else {
      formWrapper.dataset.open = '';
      addBtn.setAttribute('aria-expanded', 'true');
    }
  });

  formWrapper.querySelector('.button.cancel').addEventListener('click', () => {
    closeForm(addBtn, formWrapper);
  });
}

// ADD FORM

/**
 * Wires Enter/Escape key bindings and submit handling on the add-bookmark form.
 * @param {HTMLFormElement} form - The add-bookmark form element.
 * @param {HTMLElement} list - The .list element to re-render after save.
 * @param {HTMLButtonElement} addBtn - The .button.add toggle button.
 * @param {HTMLElement} formWrapper - The .form-wrapper element.
 */
function setupAddForm(form, list, addBtn, formWrapper) {
  attachIconPalette(form.elements.icon);

  setupFormKeys(form, () => {
    form.reset();
    closeForm(addBtn, formWrapper);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const url = formData.get('url').trim();
    if (!isValidUrl(url)) return;

    let label = formData.get('bookmark').trim();
    if (!label) {
      try {
        label = new URL(url).hostname.replace(/^www\./, '');
      } catch {
        label = url;
      }
    }

    const icon = getIconValue(form.elements.icon) || '🔗';

    const bookmarks = loadBookmarks();
    bookmarks.push({ id: uid(), url, label, icon, sortOrder: bookmarks.length + 1 });
    saveBookmarks(bookmarks);
    render(list);
    form.reset();
    closeForm(addBtn, formWrapper);
  });
}

// RENDERING

/**
 * Builds a bookmark list item with its link, icon, and action buttons.
 * @param {Object} bookmark - The bookmark to render.
 * @returns {HTMLLIElement}
 */
function renderBookmark(bookmark) {
  const li = document.createElement('li');
  li.className = 'bookmark';
  li.dataset.id = bookmark.id;
  li.draggable = true;

  li.append(renderGrip());

  const a = document.createElement('a');
  a.className = 'detail s';
  a.href = bookmark.url;
  a.setAttribute('target', '_blank');
  a.setAttribute('rel', 'noopener noreferrer');

  a.append(renderIcon(bookmark.icon));

  const label = document.createElement('span');
  label.textContent = bookmark.label || bookmark.url;
  a.append(label);

  li.append(a);

  li.append(renderItemActions('bookmark'));

  return li;
}

/**
 * Renders the bookmark list in stored sort order.
 * @param {HTMLElement} list - The bookmark list element.
 * @returns {void}
 */
function render(list) {
  const bookmarks = loadBookmarks().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  list.innerHTML = '';
  bookmarks.forEach((bookmark) => list.append(renderBookmark(bookmark)));
}

// ACTIONS

/** Toggles the add-bookmark form open or closed. */
export function toggleForm() {
  document.querySelector('#bookmarks .button.mark').click();
}

// INIT

/**
 * Initializes the bookmarks module.
 * @param {HTMLElement} module - The #bookmarks element.
 */
export function init(module) {
  const addBtn = module.querySelector('.button.mark');
  const formWrapper = module.querySelector('.form-wrapper');
  const form = formWrapper.querySelector('form');
  const list = module.querySelector('.list');

  setupFormToggle(addBtn, formWrapper);
  setupAddForm(form, list, addBtn, formWrapper);
  setupDragAndDrop(list);
  setupEdit(list);
  render(list);
}
