import { load, save, uid, today, toDateKey, fromDateKey, renderSvgIcon, renderGrip, renderItemActions, renderFormButtons, renderFormWrapper, setupFormKeys } from '../utils.js';

/**
 * Formats a YYYY-MM-DD key as a short human-readable date string.
 * @param {string} key - A YYYY-MM-DD date string.
 * @returns {string}
 */
function formatDate(key) {
  return fromDateKey(key).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

// DATA

/** @returns {Object[]} The full task array from storage, or an empty array. */
function loadTasks() {
  return load('tab_tasks') || [];
}

/**
 * Persists the full task array to storage.
 * @param {Object[]} tasks - The task array to save.
 */
function saveTasks(tasks) {
  save('tab_tasks', tasks);
}

// MARKDOWN

/**
 * Builds a formatted element with plain-text content.
 * @param {string} tagName - The HTML tag to create.
 * @param {string} text - The text content for the element.
 * @returns {HTMLElement}
 */
function createFormattedNode(tagName, text) {
  const el = document.createElement(tagName);
  el.textContent = text;
  return el;
}

/**
 * Builds one formatted node from an inline markdown token.
 * @param {string} token - One matched markdown token including its markers.
 * @returns {HTMLElement}
 */
function createMarkdownNode(token) {
  if (token.startsWith('**') && token.endsWith('**')) {
    return createFormattedNode('strong', token.slice(2, -2));
  }

  if (token.startsWith('*') && token.endsWith('*')) {
    return createFormattedNode('em', token.slice(1, -1));
  }

  if (token.startsWith('_') && token.endsWith('_')) {
    return createFormattedNode('u', token.slice(1, -1));
  }

  return createFormattedNode('code', token.slice(1, -1));
}

/**
 * Parses a small subset of inline markdown into safe DOM nodes.
 * @param {string} text - The task text to format.
 * @returns {DocumentFragment}
 */
export function parseMarkdown(text) {
  const fragment = document.createDocumentFragment();
  const pattern = /\*\*.+?\*\*|\*.+?\*|_.+?_|`.+?`/g;
  let lastIndex = 0;
  let match = pattern.exec(text);

  while (match) {
    if (match.index > lastIndex) {
      fragment.append(document.createTextNode(text.slice(lastIndex, match.index)));
    }

    fragment.append(createMarkdownNode(match[0]));

    lastIndex = pattern.lastIndex;
    match = pattern.exec(text);
  }

  if (lastIndex < text.length) {
    fragment.append(document.createTextNode(text.slice(lastIndex)));
  }

  return fragment;
}

// DRAG

/**
 * Enables drag-and-drop reordering across non-completed task lists.
 * @param {HTMLElement} wrapper - The `.lists` wrapper element.
 * @returns {void}
 */
function setupDragAndDrop(wrapper) {
  let draggedEl = null;

  wrapper.addEventListener('dragstart', (e) => {
    const task = e.target.closest('.task');
    if (!task) return;
    draggedEl = task;
    task.dataset.dragging = '';
    e.dataTransfer.effectAllowed = 'move';
  });

  wrapper.addEventListener('dragend', () => {
    if (draggedEl) delete draggedEl.dataset.dragging;
    draggedEl = null;
  });

  wrapper.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!draggedEl) return;

    const overTask = e.target.closest('.task');
    if (overTask && overTask !== draggedEl) {
      const container = overTask.closest('.tasks-list');
      if (container.closest('.list').classList.contains('completed')) return;
      const { top, height } = overTask.getBoundingClientRect();
      if (e.clientY < top + height / 2) {
        container.insertBefore(draggedEl, overTask);
      } else {
        overTask.after(draggedEl);
      }
      return;
    }

    const overList = e.target.closest('.tasks-list');
    if (!overList || overList.closest('.list').classList.contains('completed')) return;
    overList.append(draggedEl);
  });

  wrapper.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!draggedEl) return;
    const container = e.target.closest('.tasks-list');
    if (!container) return;

    const section = ['prioritized', 'parking'].find((s) => container.closest('.list').classList.contains(s));
    if (!section) return;

    const tasks = loadTasks();
    [...container.querySelectorAll('.task')].forEach((el, i) => {
      const task = tasks.find((t) => t.id === el.dataset.id);
      if (task) {
        task.section = section;
        task.sortOrder = i + 1;
      }
    });
    saveTasks(tasks);
  });
}

// EDIT

/**
 * Builds the edit form for a task, pre-filled with the task's current values.
 * @param {Object} task - The task object to edit.
 * @returns {HTMLFormElement}
 */
function renderEditForm(task) {
  const { text, dueDate, url, section } = task;

  const { wrapper, form } = renderFormWrapper('edit', 'task');

  const textWrapper = document.createElement('div');
  textWrapper.className = 'text-wrapper';
  const textarea = document.createElement('textarea');
  textarea.name = 'task';
  textarea.className = 'field text';
  textarea.required = true;
  textarea.setAttribute('aria-label', 'Edit task');
  textarea.rows = 1;
  textarea.value = text;
  textWrapper.append(textarea);

  const details = document.createElement('div');
  details.className = 'details';

  const meta = document.createElement('div');
  meta.className = 'meta';

  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.name = 'due-date';
  dateInput.className = 'field date';
  dateInput.setAttribute('aria-label', 'Due date');
  if (dueDate) dateInput.value = dueDate;

  const urlInput = document.createElement('input');
  urlInput.type = 'url';
  urlInput.name = 'url';
  urlInput.className = 'field url';
  urlInput.setAttribute('aria-label', 'Link URL');
  urlInput.autocomplete = 'off';
  urlInput.placeholder = 'https://…';
  if (url) urlInput.value = url;

  const sectionGroup = document.createElement('div');
  sectionGroup.className = 'field toggle';
  sectionGroup.setAttribute('role', 'group');
  sectionGroup.setAttribute('aria-label', 'Section');

  for (const { value, label } of [
    { value: 'prioritized', label: 'Prioritized' },
    { value: 'parking', label: 'Parking Lot' },
  ]) {
    const labelEl = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'section';
    radio.value = value;
    if (section === value) radio.checked = true;
    const span = document.createElement('span');
    span.textContent = label;
    labelEl.append(radio, span);
    sectionGroup.append(labelEl);
  }

  meta.append(dateInput, urlInput, sectionGroup);

  details.append(meta, renderFormButtons(true));
  form.append(textWrapper, details);
  return wrapper;
}

/**
 * Removes the edit form and clears the editing state from a task element.
 * @param {HTMLElement} li - The .task list item element.
 */
function closeEdit(li) {
  const form = li.querySelector('form.edit');
  if (form) form.closest('.form-wrapper').remove();
  delete li.dataset.editing;
  li.draggable = true;
}

/**
 * Sets up click-to-edit behavior on task labels using event delegation.
 * @param {HTMLElement} wrapper - The .lists wrapper element.
 */
function setupEdit(wrapper) {
  wrapper.addEventListener('click', (e) => {
    const btn = e.target.closest('form.edit .button.cancel');
    if (!btn) return;
    const li = btn.closest('.task');
    if (!li) return;
    closeEdit(li);
  });

  wrapper.addEventListener('click', (e) => {
    const btn = e.target.closest('form.edit .button.delete');
    if (!btn) return;
    const li = btn.closest('.task');
    if (!li) return;

    const tasks = loadTasks().filter((t) => t.id !== li.dataset.id);
    saveTasks(tasks);
    render(wrapper);
  });

  wrapper.addEventListener('click', (e) => {
    const btn = e.target.closest('.button.edit');
    if (!btn || btn.closest('form.edit')) return;
    const li = btn.closest('.task');
    if (!li || li.closest('.list.completed')) return;

    const existing = wrapper.querySelector('.task[data-editing]');
    if (existing && existing !== li) closeEdit(existing);
    if ('editing' in li.dataset) return;

    const tasks = loadTasks();
    const task = tasks.find((t) => t.id === li.dataset.id);
    if (!task) return;

    li.dataset.editing = '';
    li.draggable = false;
    const editForm = renderEditForm(task);
    li.append(editForm);
    setupFormKeys(editForm.querySelector('form'), () => closeEdit(li));
    editForm.querySelector('textarea').focus();
  });

  wrapper.addEventListener('click', (e) => {
    const btn = e.target.closest('.button.delete');
    if (!btn || btn.closest('form.edit')) return;
    const li = btn.closest('.task');
    if (!li) return;
    const tasks = loadTasks().filter((t) => t.id !== li.dataset.id);
    saveTasks(tasks);
    render(wrapper);
  });

  wrapper.addEventListener('submit', (e) => {
    const form = e.target.closest('form.edit');
    if (!form) return;
    e.preventDefault();

    const li = form.closest('.task');
    const formData = new FormData(form);

    const tasks = loadTasks();
    const task = tasks.find((t) => t.id === li.dataset.id);
    if (!task) return;

    task.text = formData.get('task').trim();
    task.dueDate = formData.get('due-date') || null;
    task.url = formData.get('url') || null;
    task.section = formData.get('section');
    task.updatedAt = new Date().toISOString();

    saveTasks(tasks);
    render(wrapper);
  });
}

// COMPLETE

/**
 * Sets up checkbox completion behavior on tasks using event delegation.
 * @param {HTMLElement} wrapper - The .lists wrapper element.
 */
function setupComplete(wrapper) {
  wrapper.addEventListener('change', (e) => {
    const checkbox = e.target.closest('.complete-task input[type="checkbox"]');
    if (!checkbox) return;
    const li = checkbox.closest('.task');
    if (!li) return;

    const tasks = loadTasks();
    const task = tasks.find((t) => t.id === li.dataset.id);
    if (!task) return;

    if (checkbox.checked) {
      task.section = 'completed';
      task.updatedAt = new Date().toISOString();
    } else {
      task.section = 'parking';
      task.updatedAt = new Date().toISOString();
    }
    saveTasks(tasks);
    render(wrapper);
    if (checkbox.checked) {
      const completedList = wrapper.querySelector('details.completed');
      if (completedList) completedList.open = true;
    }
  });
}

// ADD FORM

/**
 * Wires add-task form interactions, visibility, and submission behavior.
 * @param {HTMLFormElement} form
 * @param {HTMLElement} lists - The .lists wrapper element, used to re-render after submission.
 * @returns {void}
 */
function setupAddForm(form, lists) {
  const fields = form.elements;
  const details = form.querySelector('.details');

  const { task } = fields;

  setupFormKeys(form, () => form.reset());

  // show details on focus or input
  task.addEventListener('focus', () => {
    details.removeAttribute('hidden');
  });

  task.addEventListener('input', () => {
    details.removeAttribute('hidden');
  });

  // hide details on blur
  form.addEventListener('focusout', (e) => {
    const { relatedTarget } = e;
    const inForm = form.contains(relatedTarget);
    if (inForm) return;
    const formData = new FormData(form);
    let hasDetails = false;

    for (const [key, value] of formData.entries()) {
      const hasValue = key === 'due-date' || key === 'url';
      const isCustomSection = key === 'section' && value !== 'prioritized';

      if ((hasValue && value) || isCustomSection) {
        hasDetails = true;
        break;
      }
    }

    if (!hasDetails) details.setAttribute('hidden', '');
  });

  // submit form
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const task = Object.fromEntries(formData);
    if (task.task.trim() !== '') {
      const tasks = loadTasks();
      tasks.push({
        id: uid(),
        createdAt: new Date().toISOString(),
        text: task.task,
        dueDate: task['due-date'] || null,
        url: task.url || null,
        section: task.section,
        sortOrder: tasks.length + 1,
      });
      saveTasks(tasks);
      render(lists);
      form.reset();
    }
  });

  // reset form
  form.addEventListener('reset', () => {
    details.setAttribute('hidden', '');
  });
}

// RENDERING

/**
 * Builds an <a> element for a URL.
 * @param {string} url
 * @returns {HTMLAnchorElement}
 */
function renderUrlLink(url) {
  const knownHosts = {
    'github.com': 'github',
    'slack.com': 'slack',
  };

  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener noreferrer';

  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    a.textContent = url;
    return a;
  }

  const matchedHost = Object.keys(knownHosts).find((host) =>
    hostname === host || hostname.endsWith('.' + host)
  );

  if (matchedHost) {
    a.className = 'button';
    a.setAttribute('aria-label', hostname);
    a.append(renderSvgIcon(knownHosts[matchedHost]));
  } else {
    a.textContent = hostname.startsWith('www.') ? hostname.replace('www.', '') : hostname;
  }

  return a;
}

/**
 * Builds a task list item with completion, metadata, and action controls.
 * @param {Object} task - The task to render.
 * @returns {HTMLLIElement}
 */
function renderTask(task) {
  const { id, text, dueDate, url, section, updatedAt } = task;

  const li = document.createElement('li');
  li.className = 'task';
  li.dataset.id = id;
  li.draggable = section !== 'completed';

  li.append(renderGrip());

  const form = document.createElement('form');
  form.className = 'complete complete-task';

  const fieldset = document.createElement('div');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = `task-${id}`;
  checkbox.name = 'completed';
  checkbox.checked = section === 'completed';
  const pseudoCheckbox = document.createElement('span');
  const label = document.createElement('label');
  label.htmlFor = `task-${id}`;
  label.append(parseMarkdown(text));
  fieldset.append(checkbox, pseudoCheckbox, label);

  const details = document.createElement('div');
  details.className = 'details';
  if (section === 'completed' && updatedAt) {
    const completedP = document.createElement('p');
    const completedTime = document.createElement('time');
    completedTime.classList.add('completed-date');
    completedTime.dateTime = updatedAt;
    completedTime.textContent = formatDate(updatedAt.slice(0, 10));
    completedP.append(completedTime);
    details.append(completedP);
  }
  if (dueDate) {
    const dueDateP = document.createElement('p');
    const todayKey = today();
    const time = document.createElement('time');
    time.dateTime = dueDate;
    time.textContent = formatDate(dueDate);
    if (dueDate <= todayKey) time.dataset.due = 'overdue';
    else {
      const in7Days = new Date();
      in7Days.setDate(in7Days.getDate() + 7);
      if (dueDate <= toDateKey(in7Days)) time.dataset.due = 'upcoming';
    }
    dueDateP.append(time);
    details.append(dueDateP);
  }
  if (url) {
    const urlP = document.createElement('p');
    urlP.append(renderUrlLink(url));
    details.append(urlP);
  }

  form.append(fieldset);
  if (details.children.length > 0) form.append(details);
  li.append(form);

  if (section !== 'completed') {
    li.append(renderItemActions('task'));
  }

  return li;
}

/**
 * Appends one rendered task into a section list and increments its counter.
 * @param {Object} task - The task to append.
 * @param {HTMLElement} section - The target section element.
 * @returns {void}
 */
function appendTask(task, section) {
  const list = section.querySelector('.tasks-list');
  const li = renderTask(task);
  list.appendChild(li);
  const counter = section.querySelector('.counter');
  counter.textContent = parseInt(counter.textContent) + 1;
}

/**
 * Renders all task sections from storage and refreshes their counters.
 * @param {HTMLElement} wrapper - The `.lists` wrapper element.
 * @returns {void}
 */
function render(wrapper) {
  const lists = wrapper.querySelectorAll('.list');
  // reset counters
  lists.forEach((list) => {
    list.querySelector('.counter').textContent = 0;
  });
  // clear lists
  lists.forEach((list) => {
    list.querySelector('.tasks-list').innerHTML = '';
  });

  // render tasks
  const tasks = loadTasks().sort((a, b) => a.sortOrder - b.sortOrder);
  tasks.forEach((task) => {
    const { section } = task;
    const list = [...lists].find((list) => list.classList.contains(section));
    appendTask(task, list);
  });
}

// ACTIONS

/** Focuses the add-task input. */
export function focusInput() {
  document.getElementById('add-task-title').focus();
}

// INIT

/**
 * Initializes the tasks module.
 * @param {HTMLElement} module - The #tasks column element.
 */
export function init(module) {
  const lists = module.querySelector('.lists');
  const addForm = module.querySelector('form#add-task');

  setupAddForm(addForm, lists);
  setupDragAndDrop(lists);
  setupEdit(lists);
  setupComplete(lists);
  render(lists);
}
