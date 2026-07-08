# DGII e-CF Node Local Desktop

Launcher local para correr `ecf-endpoints-service` como aplicacion de escritorio ligera sin Docker, Odoo ni PostgreSQL.

## Uso

```powershell
cd "C:\Users\wilbe\Downloads\PRUEBA DGI\desktop-node-local"
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-dgii-node-desktop.ps1
```

El launcher compila el servicio si falta `dist/server.js`, guarda datos en `%APPDATA%\DGII-ECF-Node` y abre `http://127.0.0.1:3069/`.

## Detener

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\stop-dgii-node-desktop.ps1
```

## Acceso Directo

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-shortcut.ps1
```

## Verificacion

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\test-dgii-node-desktop.ps1
```

Este launcher no usa `desktop-app` ni `windows-native`; esas rutas siguen dependiendo de Docker/Odoo o de Odoo/PostgreSQL nativo.
