# NgRx Inspector — Chrome DevTools Extension

A lightweight Chrome DevTools extension for real-time inspection of **NgRx actions and state changes** in Angular applications.

Designed as a simple, fast, and NgRx-native alternative to Redux DevTools.

---

## Features

- Live stream of dispatched NgRx actions
- Action payloads and full state snapshots
- State diffs against the preceding action
- Search and configurable action prefix filters
- Pinnable paths in the state tree
- Bounded history with a virtualized action list

Selecting an action keeps its payload, state and diff available while new actions
arrive, filters change or older records leave the history. If the selected action
is outside the current list, it appears in a separate row. Click **Latest action**
to inspect the newest matching event. Clearing history or navigating the inspected
page releases the selection.

---

## Installation

### From Chrome Web Store

[_(Download the extension via Chrome Web Store)_](https://chromewebstore.google.com/detail/ngrx-inspector/bmhafdgiifbmjgdpmbicgcfjglmcmlma?hl=ru&utm_source=ext_sidebar)

---

### Manual Installation (Development)

1. Clone the repository:

```bash
git clone https://github.com/lalalalefirenko/ngrx-inspector-chrome-devtools-extension.git
cd ngrx-inspector-chrome-devtools-extension
```

2. Install dependencies:

```bash
npm ci
```

3. Build extension:

```bash
npm run build:prod
```

4. Open Chrome:

```bash
chrome://extensions
```

5. Enable Developer Mode

6. Click Load unpacked

7. Select the dist/ngrx-inspector/browser

## How It Works

The extension listens for messages sent from an Angular application via a small NgRx bridge library.

When enabled, your app sends messages like:

```js
window.postMessage({
  source: "ngrx-inspector",
  payload: {
    id: 1,
    type: action.type,
    payload: action,
    state,
    timestamp: Date.now(),
  },
});
```

The extension captures these events and displays them inside a dedicated DevTools panel.
Records must have a finite numeric `id` and `timestamp`, a nonempty string `type`,
and a `state` property. The action payload may be omitted. Malformed records are ignored.

## Connecting Your Angular App

Install the companion bridge library:

```bash
npm install ngrx-inspector
```

Register the provider:

```js
import { provideNgRxInspector } from "ngrx-inspector";

bootstrapApplication(AppComponent, {
  providers: [provideNgRxInspector()],
});
```

Done — no extra setup required.

## Development

The extension UI uses Angular 22. Node.js must satisfy
`^22.22.3 || ^24.15.0 || >=26.0.0`. See the
[Angular compatibility table](https://angular.dev/reference/versions).

Run the UI with mock actions outside DevTools:

```bash
npm run start
```

Rebuild the unpacked extension when source files change:

```bash
npm run watch
```

Production build

```
npm run build:prod
```

Run all regression tests (Angular components/services and Chrome scripts):

```bash
npm run test:ci
```

Run Angular tests interactively with `npm test`, or Chrome script tests separately
with `npm run test:extension`. Chrome APIs are simulated in the automated tests.

Check TypeScript, HTML templates and extension scripts:

```bash
npm run lint
```

## Author

Lev Alefirenko

LinkedIn:
https://www.linkedin.com/in/lev-alefirenko

## Support

If this project helps you:

- Star the repository
- Open issues
- Share feedback
