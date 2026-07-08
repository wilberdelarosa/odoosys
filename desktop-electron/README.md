# DGII e-CF Desktop Electron

Empaquetado desktop real del servicio local `ecf-endpoints-service`.

## Desarrollo

```powershell
cd "C:\Users\wilbe\Downloads\PRUEBA DGI\desktop-electron"
npm install
npm run dev
```

## Prueba desktop

```powershell
npm run test:desktop
```

La prueba headless valida que Electron levanta el backend Node embebido, carga la UI local y reporta memoria/runtime sin Docker, Odoo ni PostgreSQL.

## Build desktop

```powershell
npm run dist:dir
npm run dist:win
```

`dist:dir` genera la app desempaquetada para validar arranque. `dist:win` genera instalador NSIS y portable en `release\`.

Artefactos verificados en esta maquina:

- `release\win-unpacked\DGII e-CF Desktop.exe`
- `release\DGII-eCF-Desktop-Portable-1.0.0-x64.exe`
- `release\DGII-eCF-Desktop-Setup-1.0.0-x64.exe`
