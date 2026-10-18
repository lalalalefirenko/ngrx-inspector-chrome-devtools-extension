import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
export const buildRoot = path.join(projectRoot, "dist/ngrx-inspector/browser");
const artifactRoot = process.env.BROWSER_ARTIFACT_DIR
  ? path.resolve(process.env.BROWSER_ARTIFACT_DIR)
  : path.join(projectRoot, "test-results/browser");
export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function writeArtifact(name, value) {
  await mkdir(artifactRoot, { recursive: true });
  await writeFile(path.join(artifactRoot, name), value);
}

/** Serve only the production build, or one isolated inspected-page fixture. */
export async function startServer({ html } = {}) {
  await access(path.join(buildRoot, "index.html")).catch(() => {
    throw new Error(
      "Production build missing. Run npm run build:prod before browser tests.",
    );
  });
  const types = {
    ".js": "text/javascript",
    ".css": "text/css",
    ".html": "text/html",
    ".png": "image/png",
  };
  const server = createServer(async (request, response) => {
    try {
      if (html) {
        response.setHeader("Content-Type", "text/html");
        response.end(html);
        return;
      }
      const pathname = decodeURIComponent(
        new URL(request.url, "http://localhost").pathname,
      );
      const file = path.resolve(
        buildRoot,
        "." + (pathname === "/" ? "/index.html" : pathname),
      );
      if (!file.startsWith(buildRoot + path.sep))
        throw new Error("Invalid path");
      response.setHeader(
        "Content-Type",
        types[path.extname(file)] || "application/octet-stream",
      );
      response.end(await readFile(file));
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    url: `http://127.0.0.1:${server.address().port}/`,
    close: async () => {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

/** Native Chrome with a fresh profile and browser-level CDP connection. */
export async function launchChrome({ extensions = false } = {}) {
  const directory = await mkdtemp(
    path.join(tmpdir(), "ngrx-inspector-browser-"),
  );
  const profile = path.join(directory, "profile");
  const executable =
    process.env.CHROME_BIN ||
    (process.platform === "darwin"
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : process.platform === "win32"
        ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
        : "google-chrome");
  const args = [
    "--headless",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-background-networking",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    "--user-data-dir=" + profile,
  ];
  if (process.env.CHROME_NO_SANDBOX === "1") args.push("--no-sandbox");
  if (extensions) args.push("--enable-unsafe-extension-debugging");
  args.push("about:blank");
  const child = spawn(executable, args, {
    stdio: ["ignore", "ignore", "pipe"],
  });
  let browserLog = "";
  let startupError;
  child.on("error", (error) => {
    startupError = error;
  });
  child.stderr.on("data", (value) => {
    browserLog = (browserLog + value).slice(-8000);
  });
  let socket;
  const pending = new Map();
  const errors = [];
  const contexts = [];
  let sequence = 0;

  const close = async () => {
    socket?.close();
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error("Chrome session closed"));
    }
    pending.clear();
    if (child.pid && child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
      child.kill("SIGTERM");
      try {
        await exited;
      } finally {
        clearTimeout(timer);
      }
    }
    await rm(directory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  };

  try {
    let debuggingPort;
    for (let attempt = 0; attempt < 150; attempt++) {
      if (startupError)
        throw new Error(
          `Cannot start Chrome (${executable}). Set CHROME_BIN.`,
          { cause: startupError },
        );
      if (child.exitCode !== null || child.signalCode !== null)
        throw new Error("Chrome exited: " + browserLog);
      try {
        debuggingPort = Number(
          (
            await readFile(path.join(profile, "DevToolsActivePort"), "utf8")
          ).split("\n")[0],
        );
        break;
      } catch {
        await delay(100);
      }
    }
    if (!debuggingPort)
      throw new Error("Chrome startup timed out: " + browserLog);
    const version = await (
      await fetch(`http://127.0.0.1:${debuggingPort}/json/version`, {
        signal: AbortSignal.timeout(15000),
      })
    ).json();
    socket = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Chrome WebSocket connection timed out")),
        15000,
      );
      socket.onopen = () => {
        clearTimeout(timer);
        resolve();
      };
      socket.onerror = (error) => {
        clearTimeout(timer);
        reject(error);
      };
    });
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.method === "Runtime.exceptionThrown")
        errors.push({
          sessionId: message.sessionId,
          ...message.params.exceptionDetails,
        });
      if (message.method === "Runtime.executionContextCreated")
        contexts.push({
          sessionId: message.sessionId,
          ...message.params.context,
        });
      if (
        message.method === "Runtime.executionContextDestroyed" ||
        message.method === "Runtime.executionContextsCleared"
      ) {
        for (let index = contexts.length - 1; index >= 0; index--) {
          if (
            contexts[index].sessionId === message.sessionId &&
            (message.method === "Runtime.executionContextsCleared" ||
              contexts[index].id === message.params.executionContextId)
          )
            contexts.splice(index, 1);
        }
      }
      if (message.id && pending.has(message.id)) {
        const request = pending.get(message.id);
        clearTimeout(request.timer);
        pending.delete(message.id);
        if (message.error)
          request.reject(new Error(JSON.stringify(message.error)));
        else request.resolve(message.result);
      }
    };
    socket.onclose = () => {
      for (const request of pending.values()) {
        clearTimeout(request.timer);
        request.reject(new Error("Chrome disconnected: " + browserLog));
      }
      pending.clear();
    };
    const rpc = (method, params = {}, sessionId) =>
      new Promise((resolve, reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error("CDP timeout: " + method));
        }, 15000);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params, sessionId }));
      });
    const evaluate = async (sessionId, expression) => {
      const result = await rpc(
        "Runtime.evaluate",
        { expression, awaitPromise: true, returnByValue: true },
        sessionId,
      );
      if (result.exceptionDetails)
        throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const waitFor = async (sessionId, expression) => {
      for (let attempt = 0; attempt < 150; attempt++) {
        try {
          if (await evaluate(sessionId, expression)) return;
        } catch (error) {
          if (
            !/Cannot find context|Execution context was destroyed/.test(
              error.message,
            )
          )
            throw error;
        }
        await delay(100);
      }
      const page = await evaluate(
        sessionId,
        "({url: globalThis.location?.href, body: globalThis.document?.body?.textContent?.slice(0, 1000)})",
      ).catch(() => null);
      throw new Error(
        `Condition timed out: ${expression}\n${JSON.stringify({ page, errors, browserLog })}`,
      );
    };
    const attach = async (targetId) => {
      const { sessionId } = await rpc("Target.attachToTarget", {
        targetId,
        flatten: true,
      });
      await rpc("Runtime.enable", {}, sessionId);
      return sessionId;
    };
    const newPage = async () => {
      const { targetId } = await rpc("Target.createTarget", {
        url: "about:blank",
      });
      const sessionId = await attach(targetId);
      await rpc("Page.enable", {}, sessionId);
      await rpc(
        "Emulation.setFocusEmulationEnabled",
        { enabled: true },
        sessionId,
      );
      return { targetId, sessionId };
    };
    const screenshot = async (sessionId, name, options = {}) => {
      // Wait for the compositor after Angular has updated the DOM.
      await evaluate(
        sessionId,
        "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
      );
      const result = await rpc(
        "Page.captureScreenshot",
        { format: "png", ...options },
        sessionId,
      );
      await writeArtifact(name, Buffer.from(result.data, "base64"));
    };
    return {
      directory,
      version: version.Browser,
      rpc,
      evaluate,
      waitFor,
      attach,
      newPage,
      screenshot,
      errors,
      contexts,
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}
