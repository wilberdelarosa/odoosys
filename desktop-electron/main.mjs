import { app, BrowserWindow, dialog, shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isTestMode = process.argv.includes('--test-mode');

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
    const runtime = await waitForRuntime(serviceHandle.port);
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
      ok: true,
      url: `http://127.0.0.1:${serviceHandle.port}/`,
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
    app.quit();
  }
}

async function startEmbeddedService() {
  const serviceRoot = path.resolve(__dirname, 'service');
  const appDataRoot = path.join(app.getPath('appData'), 'DGII-ECF-Desktop');
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
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1120,
    minHeight: 760,
    show: !isTestMode,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  window.webContents.on('did-fail-load', async (_event, code, description) => {
    await dialog.showErrorBox(
      'DGII e-CF Desktop',
      `No se pudo cargar la consola local.\n\nCodigo: ${code}\nDetalle: ${description}`
    );
  });

  await window.loadURL(`http://127.0.0.1:${port}/`);
  if (!isTestMode) {
    window.show();
  }
  return window;
}

async function waitForRuntime(port) {
  const deadline = Date.now() + 20000;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/runtime/status`);
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

main().catch((error) => {
  console.error(error);
  app.exit(1);
});
