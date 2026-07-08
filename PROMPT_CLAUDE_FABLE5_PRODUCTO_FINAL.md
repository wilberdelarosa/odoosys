# Prompt maestro para Claude Code con Fable 5

Trabaja directamente sobre este repositorio:

`C:\Users\wilbe\Downloads\PRUEBA DGI`

Tu misión es convertir la aplicación existente en un producto comercial de facturación electrónica dominicana listo para instalarse, venderse y mantenerse en muchas computadoras Windows. No quiero una maqueta ni una reescritura superficial: quiero que audites lo existente, conserves lo que funciona y construyas de forma incremental una aplicación final estable, rápida, ligera, segura y verificable.

## Contexto real del proyecto

El producto actual reemplaza una parte del flujo de facturación de Odoo por una aplicación local y autónoma:

- Backend principal: `ecf-endpoints-service` (Node.js, TypeScript y Express).
- Aplicación de escritorio: `desktop-electron` (Electron y electron-builder).
- Launcher alternativo: `desktop-node-local`.
- No necesita Docker, Odoo ni PostgreSQL para funcionar localmente.
- Genera instalador NSIS y ejecutable portable para Windows x64.
- Versión desktop actual: `1.1.0`.
- Persistencia actual basada principalmente en JSON con escritura atómica y backup.
- El almacenamiento de la aplicación instalada vive en `%APPDATA%`.

Ya existen, al menos, estas funciones:

- Usuarios locales, inicio de sesión con JWT, cambio obligatorio de contraseña y roles `admin`, `operador` y `visor`.
- Clientes y productos.
- Facturas e-CF con secuencias e-NCF.
- Cobros y estado de pago.
- Órdenes de venta y conversión a factura.
- Inventario, movimientos y prevención de inventario negativo.
- Asientos contables automáticos y validación de partida doble.
- Notas de crédito y débito relacionadas con el comprobante original.
- Anulaciones y reversos contables.
- Compras.
- Reportes DGII 606, 607 y 608, resumen por período y exportación de archivos.
- Firma/XML y endpoints relacionados con e-CF que deben revisarse contra las reglas oficiales vigentes.
- Pruebas de sistema y smoke tests de la aplicación Electron.

Los builds actuales están en `desktop-electron\release`. El instalador y el portable 1.1.0 ya fueron ejecutados con éxito. Hay cambios sin consolidar en el repositorio; no los descartes ni los sobrescribas a ciegas. Revisa `git status`, el historial, `HANDOFF_PROMPT.md` y los diffs antes de editar.

## Objetivo de producto

La aplicación debe poder instalarse en diferentes negocios y operar durante años sin depender de conocimientos técnicos. Debe ser offline-first para las operaciones locales, soportar la comunicación fiscal cuando exista conexión, proteger la integridad de los datos y ofrecer recuperación clara ante fallos.

El resultado debe sentirse como un producto premium moderno, no como un panel administrativo genérico. Prioriza claridad, rapidez y densidad útil. Evita animaciones excesivas, efectos costosos, gradientes decorativos sin propósito y dependencias pesadas que no aporten valor.

## Forma obligatoria de trabajar

1. Antes de cambiar código, realiza una auditoría completa del repositorio, arquitectura, dependencias, modelo de datos, rutas, seguridad, interfaz, empaquetado y pruebas. Determina qué está realmente terminado, qué es parcial, qué es demo y qué falta.
2. Ejecuta la batería actual para obtener una línea base. Registra tiempos de arranque, consumo de memoria, tamaño del instalador, tiempo de operaciones importantes y resultados de pruebas.
3. Produce un plan priorizado por riesgo y valor. Después comienza a implementarlo; no te detengas únicamente en el análisis.
4. Trabaja en fases pequeñas y verificables. Después de cada fase ejecuta pruebas relevantes y corrige cualquier regresión antes de continuar.
5. No reemplaces Electron, Express, el frontend o el almacenamiento por moda. Si propones Tauri, SQLite, Preact, Lit, React u otra tecnología, primero compara costo de migración, peso, rendimiento, seguridad, mantenibilidad y compatibilidad. Implementa la opción que pueda demostrarse mejor para este producto.
6. Conserva compatibilidad o crea una migración automática y probada para los datos ya existentes. Nunca provoques pérdida silenciosa de información.
7. No inventes requisitos fiscales. Contrasta e-CF, formatos, estados, secuencias, XML, firma, recepción, aprobación comercial, contingencias y reportes contra documentación oficial vigente de la DGII. Separa claramente simulación, pruebas y producción.
8. No declares una función terminada si solo existe visualmente. Debe funcionar de interfaz a API, persistencia, validación, auditoría y recuperación de errores.
9. Mantén el repositorio limpio. Haz commits pequeños y descriptivos cuando cada bloque esté probado. No reviertas trabajo existente que no entiendas.
10. Documenta decisiones, migraciones, instalación, backup, restauración, actualización, diagnóstico y publicación.

## Arquitectura y datos

Evalúa y ejecuta la transición desde JSON a una base local transaccional apropiada, preferiblemente SQLite si el análisis la confirma. La solución final debe incluir:

- Esquema versionado y migraciones automáticas, idempotentes y probadas.
- Transacciones ACID para facturación, inventario, pagos, contabilidad y secuencias fiscales.
- Claves foráneas, índices, restricciones e integridad referencial.
- Modo WAL, manejo de bloqueos y recuperación segura después de cierres abruptos.
- Importación automática y reversible desde los archivos JSON actuales.
- Backups automáticos rotativos, backup manual, restauración validada y prueba real de recuperación.
- Exportación de datos legible para evitar encerrar al cliente en un formato opaco.
- Aislamiento por empresa y soporte para configurar una o varias empresas solo si el modelo de negocio lo requiere. No mezcles datos fiscales entre compañías.
- Auditoría inmutable de acciones sensibles: emisión, anulación, notas, cambios de secuencia, usuarios, permisos, restauraciones y configuración fiscal.

Diseña los módulos con límites claros: identidad y permisos, empresa/configuración, clientes, catálogo, ventas, facturación fiscal, cobros/caja, compras, inventario, contabilidad, reportes, integración DGII, backups, actualizaciones y auditoría. Evita un monolito de funciones en un único archivo, pero tampoco introduzcas microservicios innecesarios para una aplicación local.

## Funcionalidad mínima de un sistema completo

Audita, completa e integra estos flujos de extremo a extremo:

- Asistente de primera instalación: empresa, RNC, datos fiscales, moneda, impuestos, almacén, secuencias autorizadas, certificado, usuario administrador y backup.
- Gestión de usuarios, roles, permisos por acción, bloqueo, cierre de sesión y recuperación administrativa segura.
- Clientes y proveedores con validaciones de RNC/cédula, condiciones fiscales, crédito, contactos y búsqueda rápida.
- Productos y servicios, unidades, impuestos, listas de precios, costos, códigos, inventario mínimo y múltiples almacenes solo si está justificado.
- Cotizaciones, órdenes, facturas, duplicado controlado, impresión, PDF, envío/exportación y trazabilidad entre documentos.
- Comprobantes y e-CF dominicanos correspondientes al alcance comercial definido, con reglas por tipo, secuencias, vencimiento, referencias y estados.
- Notas de crédito/débito, anulaciones, devoluciones y reversos con límites fiscales, contables y de inventario consistentes.
- Cobros parciales, múltiples medios de pago, cuentas por cobrar, vencimientos, recibos, caja, cierre y conciliación básica.
- Compras, cuentas por pagar, costos e impacto correcto en inventario y contabilidad.
- Kardex y valoración de inventario mediante un método documentado y consistente.
- Contabilidad automática trazable, catálogo de cuentas configurable, diario, mayor, balance de comprobación y estados básicos según el alcance definido.
- Reportes 606, 607, 608 y demás reportes fiscales incluidos en el alcance, con validación, vista previa, exportación y conciliación contra documentos.
- Panel útil con ventas, cobros pendientes, impuestos, inventario bajo, documentos rechazados y tareas que requieren atención.
- Búsqueda global, filtros, paginación/virtualización y exportación sin cargar todos los registros en memoria.
- Modo de contingencia y cola local para comunicaciones DGII, con reintentos idempotentes, estados visibles y diagnóstico entendible.

Cada documento debe tener una máquina de estados explícita. Evita que la UI, la API y la base de datos interpreten estados de manera diferente. Toda operación sensible debe ser idempotente para impedir facturas, pagos o envíos duplicados.

## Experiencia visual

Rediseña la interfaz como una aplicación de escritorio profesional de 2026:

- Sistema visual consistente con tokens de color, espaciado, radios, tipografía, elevación y estados.
- Tipografía legible y con personalidad, empaquetada localmente para no depender de internet.
- Navegación clara con acceso rápido a vender, cobrar, comprar, consultar inventario y generar reportes.
- Formularios rápidos para teclado, orden de tabulación correcto, atajos documentados y validación inline.
- Tablas densas y legibles con columnas configurables, estados claros, filtros persistentes y acciones seguras.
- Diseño adaptable desde 1366x768 hasta pantallas grandes, sin romperse con escalado de Windows de 125% o 150%.
- Accesibilidad razonable: contraste, foco visible, etiquetas, mensajes no dependientes solo del color y tamaño de objetivos.
- Estados vacíos, carga, error, sin conexión, reintento y confirmaciones diseñados explícitamente.
- Impresión y PDFs profesionales con identidad de cada negocio.

Selecciona una biblioteca de componentes únicamente después de medir su impacto. Si el frontend actual puede evolucionar con componentes livianos y accesibles, hazlo. Si conviene migrar, realiza la migración por módulos y mantén las pruebas pasando. No cargues una librería completa para usar pocos componentes.

## Rendimiento y ligereza

Define presupuestos medibles y hazlos parte de la verificación. Como objetivo inicial, y ajustándolo con evidencia del hardware de prueba:

- Arranque en frío menor de 3 segundos en una PC empresarial moderna.
- Interacciones comunes con respuesta visual en menos de 100 ms.
- Consultas habituales menores de 300 ms con al menos 100,000 documentos de prueba.
- Memoria estable, sin crecimiento continuo durante una jornada simulada.
- Instalador tan pequeño como sea razonable; justifica cualquier dependencia que aumente significativamente el tamaño.
- Carga diferida de módulos y reportes pesados.
- Listas grandes paginadas o virtualizadas.
- Procesos de firma, PDF, exportación y backup fuera del hilo de render cuando puedan bloquear la interfaz.

Crea datos sintéticos y pruebas de carga representativas. Mide antes y después. No aceptes una mejora de tamaño que sacrifique integridad, seguridad o capacidad de soporte.

## Seguridad y distribución comercial

- Endurece Electron: `contextIsolation`, sandbox cuando sea compatible, sin `nodeIntegration` en renderer, CSP estricta, IPC mínimo validado y navegación/ventanas externas controladas.
- Evita exponer el servidor local a la red. Usa loopback y un puerto dinámico o un canal local seguro; protege las APIs aunque sean locales.
- Almacena secretos, certificados y claves usando mecanismos seguros del sistema operativo cuando sea posible. Nunca los registres en logs.
- Fortalece contraseñas, sesiones, expiración, rate limiting y protección de endpoints administrativos.
- Valida todos los datos en el límite de la API y también las invariantes de dominio.
- Implementa logs estructurados con rotación, identificadores de operación y exportación de un paquete de diagnóstico sin datos fiscales sensibles.
- Configura icono, metadatos, versión, desinstalación limpia y conservación/exportación explícita de datos.
- Prepara firma de código de Windows y un proceso de publicación reproducible. Si no hay certificado disponible, deja configuración y documentación listas sin fingir que el binario está firmado.
- Diseña actualizaciones seguras, firmadas y con rollback o recuperación. Nunca actualices la base sin backup y migración validada.
- Mantén una configuración de licenciamiento desacoplada de la facturación para que un fallo de licencia no corrompa ni elimine datos. No implementes telemetría invasiva.

## Calidad y pruebas

Construye una pirámide de pruebas que cubra:

- Unitarias para impuestos, redondeos, secuencias, estados, vencimientos y reglas fiscales.
- Integración para transacciones de base de datos, migraciones, backups, restauración y cola DGII.
- Contratos de API y validaciones de autorización.
- Flujos completos de UI para primera instalación, venta, cobro, nota, anulación, compra, reporte y recuperación.
- Pruebas de concurrencia e idempotencia.
- Pruebas con cierre abrupto durante operaciones críticas.
- Pruebas de actualización desde la versión 1.1.0 y migración de datos JSON.
- Prueba del instalador y portable en un entorno Windows limpio, sin Node, Docker, Odoo ni PostgreSQL.
- Pruebas de escala con grandes volúmenes de clientes, productos y documentos.

Mantén y amplía los comandos existentes:

```powershell
cd "C:\Users\wilbe\Downloads\PRUEBA DGI\ecf-endpoints-service"
npm.cmd run check
npm.cmd run build
npm.cmd run verify:local-node
npm.cmd run test:system:local

cd "C:\Users\wilbe\Downloads\PRUEBA DGI\desktop-electron"
npm.cmd run test:desktop
npm.cmd run dist:win
```

No consideres una versión lista si las pruebas pasan solo en el código fuente. Verifica el `.exe` portable y una instalación real del `Setup.exe`, incluyendo creación de datos, cierre, reapertura, backup, actualización y restauración.

## Entregables

Mantén estos documentos actualizados dentro del repositorio:

- `PRODUCT_AUDIT.md`: inventario de funciones reales, brechas, riesgos y deuda técnica.
- `PRODUCT_ROADMAP.md`: fases, prioridades, dependencias y criterios de aceptación.
- `ARCHITECTURE.md`: decisiones, límites de módulos, modelo de datos y flujos críticos.
- `SECURITY.md`: modelo de amenazas práctico, manejo de secretos, hardening y publicación.
- `RELEASE.md`: cómo construir, firmar, probar, actualizar y publicar.
- `USER_GUIDE.md`: instalación, configuración, operación, backup y recuperación.

Al final de cada fase informa de forma concreta:

- Qué funciona de extremo a extremo.
- Qué archivos y arquitectura cambiaron.
- Qué migraciones se ejecutaron.
- Qué pruebas pasaron y cuáles faltan.
- Métricas antes/después de memoria, arranque, tamaño y operaciones principales.
- Riesgos o requisitos externos pendientes, especialmente certificación, firma y servicios DGII.
- Hash SHA-256 de cada instalador final.

## Criterio de terminado

El producto solo está terminado cuando un usuario no técnico puede instalarlo en una PC Windows limpia, configurar su empresa, facturar, cobrar, registrar compras, manejar inventario, emitir notas/anulaciones, obtener reportes, cerrar y abrir la aplicación sin perder datos, hacer backup, restaurarlo en otra PC y actualizar de versión sin corrupción. Todos los flujos deben tener permisos, auditoría, mensajes de error útiles y pruebas automatizadas.

La comunicación real con DGII, los certificados oficiales y la firma de código deben marcarse como dependencias externas si las credenciales no están disponibles. No simules éxito de producción. Deja los adaptadores, pruebas y documentación preparados y diferencia claramente ambiente demo, certificación y producción.

Empieza ahora: inspecciona el estado real, ejecuta la línea base, escribe la auditoría y el roadmap, y continúa con la primera fase de mayor impacto. Prioriza primero integridad transaccional, migración segura de datos, seguridad y continuidad operativa; después termina experiencia visual y optimización. Sigue trabajando hasta dejar cada fase implementada y verificada, no solo descrita.
