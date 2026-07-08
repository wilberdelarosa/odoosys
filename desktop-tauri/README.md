# DGII e-CF Desktop Tauri

Cliente Windows ligero sin Docker, Odoo, PostgreSQL ni Node instalado. Tauri usa WebView2 y arranca el backend autónomo `ecf-service.exe`, que guarda los datos en SQLite dentro del perfil del usuario.

## Compilar

```powershell
npm install
npm run build
```

El instalador NSIS se genera bajo `src-tauri\target\release\bundle\nsis`.

La instalación de producción usa el WebView2 presente en Windows 10/11; el instalador puede descargar su bootstrapper si falta.

## Datos y actualizaciones

Los datos se guardan en `%APPDATA%\com.dgii.ecf.desktop\storage`. La primera ejecución copia automáticamente la información de `%APPDATA%\DGII-ECF-Desktop\storage` si detecta una instalación Electron anterior; el JSON heredado se migra después a SQLite sin borrar el original.

Solo puede ejecutarse una instancia por sesión de Windows. Al cerrar la ventana, el backend local también termina.

## Verificación de producción

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\test-release.ps1
```

La prueba usa almacenamiento temporal, ejecuta los flujos funcionales completos y confirma que el proceso auxiliar se detiene al cerrar la ventana.
