import { app, BrowserWindow, dialog, shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isTestMode = process.argv.includes('--test-mode');

// App de formularios locales: la aceleracion GPU no aporta y su proceso
// dedicado consume ~70 MB de working set. Render por software.
app.disableHardwareAcceleration();

if (isTestMode) {
  app.commandLine.appendSwitch('disable-gpu');
}

let serviceHandle = null;
let mainWindow = null;

const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (!BrowserWindow.getAllWindows().length && serviceHandle) {
    void createMainWindow(serviceHandle.port);
  }
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  }
});

app.on('before-quit', async () => {
  if (serviceHandle) {
    await serviceHandle.close().catch(() => {});
    serviceHandle = null;
  }
});

async function main() {
  await app.whenReady();
  serviceHandle = await startEmbeddedService();
  mainWindow = await createMainWindow(serviceHandle.port);

  if (isTestMode) {
    const consoleErrors = [];
    mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      if (level >= 3) {
        consoleErrors.push({ message, line, sourceId });
      }
    });
    const session = await loginForTestMode(serviceHandle.port);
    const runtime = await waitForRuntime(serviceHandle.port, session.token);
    const uiSmoke = await runUiSmoke(mainWindow);
    // Margen para que el renderer termine de ejecutar app.js y reporte errores.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const appMetrics = app.getAppMetrics().map((metric) => ({
      pid: metric.pid,
      type: metric.type,
      memory: metric.memory
        ? {
            workingSetSizeKb: metric.memory.workingSetSize,
            privateBytesKb: metric.memory.privateBytes,
          }
        : null,
    }));
    const payload = {
      ok: consoleErrors.length === 0 && uiSmoke.ok === true,
      url: `http://127.0.0.1:${serviceHandle.port}/`,
      consoleErrors,
      uiSmoke,
      runtime,
      appMetrics,
    };

    if (process.env.DESKTOP_TEST_OUTPUT) {
      await fs.writeFile(
        process.env.DESKTOP_TEST_OUTPUT,
        JSON.stringify(payload, null, 2),
        'utf8'
      );
    }

    console.log(JSON.stringify(payload, null, 2));

    await serviceHandle.close();
    serviceHandle = null;
    if (!payload.ok) {
      app.exit(1);
      return;
    }
    app.quit();
  }
}

async function startEmbeddedService() {
  const serviceRoot = path.resolve(__dirname, 'service');
  const appDataRoot = isTestMode
    ? path.join(app.getPath('temp'), 'DGII-ECF-Desktop-Test')
    : path.join(app.getPath('appData'), 'DGII-ECF-Desktop');
  if (isTestMode) {
    await fs.rm(appDataRoot, { recursive: true, force: true });
  }
  process.env.PORT = '0';
  process.env.HOST = '127.0.0.1';
  process.env.PUBLIC_BASE_URL = 'http://127.0.0.1:0';
  process.env.STORAGE_ROOT = path.join(appDataRoot, 'storage');
  process.env.GENERATE_DEMO_CERT = process.env.GENERATE_DEMO_CERT || 'true';

  const serviceModule = await import(pathToFileURL(path.join(serviceRoot, 'dist', 'server.js')).href);
  const handle = await serviceModule.startServer();
  process.env.PUBLIC_BASE_URL = `http://127.0.0.1:${handle.port}`;
  return handle;
}

async function createMainWindow(port) {
  const localOrigin = `http://127.0.0.1:${port}`;
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1120,
    minHeight: 760,
    show: !isTestMode,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      devTools: isTestMode,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`${localOrigin}/`)) {
      event.preventDefault();
    }
  });

  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  window.webContents.on('did-fail-load', async (_event, code, description) => {
    await dialog.showErrorBox(
      'DGII e-CF Desktop',
      `No se pudo cargar la consola local.\n\nCodigo: ${code}\nDetalle: ${description}`
    );
  });

  await window.loadURL(`${localOrigin}/`);
  if (!isTestMode) {
    window.show();
  }
  return window;
}

function isSafeExternalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

async function runUiSmoke(window) {
  try {
    return await window.webContents.executeJavaScript(`(async () => {
      const out = { ok: true, steps: [] };
      const step = (name, ok) => { out.steps.push({ name, ok }); if (!ok) out.ok = false; };
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const visible = (el) => Boolean(el && el.offsetParent !== null);
      try {
        const username = document.querySelector('#loginUsername');
        const password = document.querySelector('#loginPassword');
        const form = document.querySelector('#loginForm');
        step('formulario de login presente', Boolean(username && password && form));
        if (!out.ok) return out;
        username.value = 'admin';
        password.value = 'admin12345';
        form.requestSubmit();
        let loggedIn = false;
        for (let i = 0; i < 24; i += 1) {
          await sleep(250);
          if (!visible(document.querySelector('#authOverlay'))) { loggedIn = true; break; }
        }
        step('login desde la UI', loggedIn);
        if (!loggedIn) return out;
        const tabs = Array.from(document.querySelectorAll('.nav-tabs button'));
        step('5 pestañas de navegacion', tabs.length === 5);
        for (const tab of tabs) { tab.click(); await sleep(350); }
        tabs[3] && tabs[3].click();
        await sleep(400);
        step('panel de compras visible', visible(document.querySelector('#purchaseForm')));
        tabs[4] && tabs[4].click();
        await sleep(400);
        step('panel de reportes visible', visible(document.querySelector('#reportFrom')));
        const summaryBtn = document.querySelector('#loadPeriodSummaryBtn');
        step('boton de resumen presente', Boolean(summaryBtn));
        if (summaryBtn) {
          summaryBtn.click();
          let summaryLoaded = false;
          for (let i = 0; i < 20; i += 1) {
            await sleep(300);
            const summary = document.querySelector('#periodSummary');
            if (summary && summary.children.length > 0) { summaryLoaded = true; break; }
          }
          step('resumen del periodo cargado via UI', summaryLoaded);
        }
      } catch (error) {
        out.ok = false;
        out.error = String((error && error.message) || error);
      }
      return out;
    })()`);
  } catch (error) {
    return { ok: false, error: String((error && error.message) || error) };
  }
}

async function waitForRuntime(port, token) {
  const deadline = Date.now() + 20000;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/runtime/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        return await response.json();
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw lastError || new Error('No se pudo validar /api/runtime/status');
}

async function loginForTestMode(port) {
  let login = null;
  for (const password of ['admin123', 'admin12345']) {
    try {
      login = await requestJson(`http://127.0.0.1:${port}/api/auth/login`, {
        method: 'POST',
        body: JSON.stringify({
          username: 'admin',
          password,
        }),
      });
      break;
    } catch (error) {
      if (!String(error.message).includes('HTTP 400')) {
        throw error;
      }
    }
  }

  if (!login) {
    throw new Error('No se pudo iniciar sesion local en modo de prueba.');
  }

  if (login.user.mustChangePassword) {
    await requestJson(`http://127.0.0.1:${port}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${login.token}`,
      },
      body: JSON.stringify({
        currentPassword: 'admin123',
        newPassword: 'admin12345',
      }),
    });

    return await requestJson(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        username: 'admin',
        password: 'admin12345',
      }),
    });
  }

  return login;
}

async function requestJson(url, options = {}) {
  const { headers = {}, ...fetchOptions } = options;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    ...fetchOptions,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} en ${url}`);
  }

  return await response.json();
}

main().catch((error) => {
  console.error(error);
  app.exit(1);
});
