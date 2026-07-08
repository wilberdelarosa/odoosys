# Arquitectura desktop ligera

## Base elegida

- Shell: Tauri 2 sobre WebView2 nativo de Windows.
- Backend: ejecutable autónomo Node 22 generado con `@yao-pkg/pkg`; no requiere Node instalado.
- Datos: SQLite local con transacciones, WAL, sincronización completa, backups en línea y recuperación automática.
- Instalación: NSIS por usuario, sin Docker, Odoo, PostgreSQL ni servicios de Windows.
- Compatibilidad: Windows 10/11 x64. El instalador descarga el bootstrapper de WebView2 únicamente si el equipo no lo tiene.

## Flujo de ejecución

1. `dgii-ecf-desktop.exe` reserva un puerto local dinámico.
2. Inicia `ecf-service.exe` limitado a `127.0.0.1`.
3. El backend abre `%APPDATA%\com.dgii.ecf.desktop\storage\facturador.sqlite`.
4. WebView2 navega a la interfaz local cuando el puerto está listo.
5. Al cerrar la ventana, Tauri termina el backend. Una segunda instancia reutiliza la primera.

La primera ejecución copia datos desde `%APPDATA%\DGII-ECF-Desktop\storage` si existe una versión Electron anterior. El JSON se migra a SQLite y se conserva como `.migrated.bak`.

## Artefactos verificados

- Instalador: `desktop-tauri\src-tauri\target\release\bundle\nsis\DGII e-CF Desktop_1.2.0_x64-setup.exe`.
- Tamaño del instalador: aproximadamente 21 MB.
- Tamaño instalado: aproximadamente 69 MB.
- Verificación: `desktop-tauri\scripts\test-release.ps1`.

La prueba cubre clientes, productos, órdenes, facturas e-CF, cobros, inventario, contabilidad, notas E33/E34, anulaciones, compras, reportes 606/607/608, migración JSON, integridad SQLite, recuperación de backups, instancia única y cierre sin procesos huérfanos.

## Límites de producción

El instalador y los flujos locales están operativos, pero una empresa real todavía necesita certificado digital válido, secuencias autorizadas, configuración fiscal propia, firma de código del instalador y certificación oficial DGII. Las pruebas locales no sustituyen esas aprobaciones externas.
