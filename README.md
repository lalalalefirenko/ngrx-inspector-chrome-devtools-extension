# NgRx Inspector — Chrome DevTools Extension

A lightweight Chrome DevTools extension for real-time inspection of NgRx actions and state changes in Angular applications.

Designed as a simple, fast, and NgRx-native tool.

## Features

- Live stream of dispatched NgRx actions
- Action payloads and state snapshots
- State diffs with array change and move detection
- Search and configurable action prefix filters
- Pinnable paths in the state tree
- Capture pauses while the inspector panel is hidden

## Installation

[Install from Chrome Web Store](https://chromewebstore.google.com/detail/ngrx-inspector/bmhafdgiifbmjgdpmbicgcfjglmcmlma?hl=ru&utm_source=ext_sidebar)

## Connecting Your Angular App

Install the companion bridge library:

```bash
npm install ngrx-inspector
```

Register the provider:

```ts
import { provideNgRxInspector } from "ngrx-inspector";

bootstrapApplication(AppComponent, {
  providers: [provideNgRxInspector()],
});
```

Open Chrome DevTools and select **NgRx Inspector**.

## Author

[Lev Alefirenko](https://www.linkedin.com/in/lev-alefirenko)
