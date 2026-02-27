# 🧭 NgRx Inspector — Chrome DevTools Extension

![Chrome](https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome)
![Angular](https://img.shields.io/badge/Angular-21+-red?logo=angular)
![NgRx](https://img.shields.io/badge/NgRx-supported-purple)
![License](https://img.shields.io/badge/license-MIT-green)
![Status](https://img.shields.io/badge/status-early--stage-orange)

A lightweight Chrome DevTools extension for real-time inspection of **NgRx actions and state changes** in Angular applications.

Designed as a simple, fast, and NgRx-native alternative to Redux DevTools.

---

## ✨ Features

✅ Live stream of dispatched NgRx actions  
✅ Full state snapshots  
✅ Action timeline with timestamps  
✅ Zero-config Angular integration  
✅ Lightweight — no instrumentation overhead  
✅ Works only in development mode

---

## 📸 Preview

_(add screenshots later)_

---

## 📦 Installation

### From Chrome Web Store

_(coming soon)_

---

### Manual Installation (Development)

1️⃣ Clone the repository:

```bash
git clone https://github.com/lalalalefirenko/ngrx-inspector-chrome-devtools-extension.git
cd ngrx-inspector-chrome-devtools-extension
```

2️⃣ Install dependencies:

```bash
npm install
```

3️⃣ Build extension:

```bash
npm run build:prod
```

4️⃣ Open Chrome:

```bash
chrome://extensions
```

5️⃣ Enable Developer Mode

6️⃣ Click Load unpacked

7️⃣ Select the dist/ngrx-inspector/browser

# 🧩 How It Works

The extension listens for messages sent from an Angular application via a small NgRx bridge library.

When enabled, your app sends messages like:
The extension listens for messages sent from an Angular application via a small NgRx bridge library.

When enabled, your app sends messages like:

```js
window.postMessage({
  source: "ngrx-inspector",
  payload: { action, state },
});
```

The extension captures these events and displays them inside a dedicated DevTools panel.

# ⚙️ Connecting Your Angular App

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

# 🛠 Development

Run in watch mode

```bash
npm run start
```

Production build

```
npm run build:prod
```

# 👤 Author

Lev Alefirenko

LinkedIn:
https://www.linkedin.com/in/lalefirenko/

# ⭐ Support

If this project helps you:

⭐ Star the repository

🐛 Open issues

💬 Share feedback
