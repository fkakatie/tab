# Tab

Tab is a browser start page built with plain HTML, CSS, and JavaScript. It includes four modules: tasks, calendar notes, a pomodoro timer, and bookmarks.

Everything runs in the browser and stores data in `localStorage`. There is no backend, account system, or build step.

## Overview

The app is split into small modules under `modules/`. Each feature has its own HTML, CSS, and JavaScript file, and the main shell loads them at runtime. Shared helpers live in `modules/utils.js`.

This is a static frontend project. Most of the code is DOM rendering, event handling, local storage helpers, and small date utilities.

## Features

- Add tasks with optional due dates and links.
- Move tasks between prioritized, parking, and completed sections.
- Add a short note or reminder to a calendar day.
- Track pomodoro sessions with work and break intervals.
- Store bookmarks and reorder them with drag and drop.
- Use keyboard shortcuts for common actions.
- Import and export stored data through the clipboard.

## Structure

```text
├── index.html (defines the shell layout and dialog markup)
├── style.css (contains shared layout, form, dialog, and UI styles)
├── scripts.js (loads module assets, runs startup cleanup, and registers shortcuts)
└── modules/ (each feature directory contains its own `.html`, `.css`, and `.js`)
    ├── calendar/
    ├── tasks/
    ├── pomo/
    ├── bookmarks/
    └── utils.js (contains shared helpers)
```

## Running Locally

Because the app uses `fetch()` and ES modules, it should be served over a local web server.

Any static server will work. There are no dependencies to install.

## Data Storage

User data is stored under `tab_*` keys in `localStorage`. That keeps the project self-contained, but it also means the data belongs to the current browser profile unless it is exported.
