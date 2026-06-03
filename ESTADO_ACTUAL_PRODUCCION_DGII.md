# Estado actual del sistema Odoo + DGII e-CF

Fecha de verificacion: 2026-05-10.

## Base utilizada

La base real del sistema es:

- Odoo Community 17.0 como ERP e interfaz principal.
- PostgreSQL 15 como base de datos real.
- Localizacion dominicana abierta `indexa-git/l10n-dominicana` rama 17.0.
- Modulo propio `l10n_do_ecf_gateway` para conectar Odoo con el gateway e-CF.
- Gateway Node/TypeScript `ecf-endpoints-service` para generar XML e-CF, firmar, ARECF, ACECF y endpoints estilo DGII.

No es una interfaz inventada desde cero. Odoo es el sistema de trabajo; el gateway es la capa fiscal electronica.

## Datos reales vs datos de prueba

El sistema ya usa una base PostgreSQL real y Odoo real. No es una maqueta solo en memoria.

Estado de datos actual:

- Empresa configurada: `EMPRESA RNC 133206692`.
- RNC configurado en Odoo: `133206692`.
- RNC configurado en el perfil fiscal del gateway: `133206692`.
- El RNC `133206692` pasa la validacion local de formato y digito verificador dominicano.
- La razon social legal real todavia debe confirmarse contra DGII o por documentos del cliente.
- El nombre usado ahora es placeholder: `EMPRESA RNC 133206692`.

## Modulos instalados

Instalados y verificados:

- Contabilidad: `account`.
- Localizacion fiscal dominicana: `l10n_do_accounting`.
- Conector e-CF: `l10n_do_ecf_gateway`.
- Ventas: `sale_management`.
- Inventario: `stock`.
- Compras: `purchase`.
- Contactos: `contacts`.
- Calendario: `calendar`.
- CRM: `crm`.
- CRM a cotizacion: `sale_crm`.
- Proyectos: `project`.
- Website corporativo: `website`.
- eCommerce: `website_sale`.
- Punto de venta: `point_of_sale`.
- Costos de entrega: `delivery`.

## Contabilidad y comprobantes

La localizacion dominicana cargo:

- 289 cuentas contables.
- 8 diarios.
- Diario de ventas fiscal `INV` con documentos fiscales dominicanos.
- NCF tradicionales: B01, B02, B03, B04, B12, B14, B15, B16.
- e-CF electronicos: E31, E32, E33, E34, E44, E45, E46.

Facturas publicadas:

| Odoo | Tipo | Fiscal | Total | Gateway |
| --- | --- | --- | ---: | --- |
| INV/2026/0001 | B01 | B0100000001 | 1180.00 | No enviado |
| INV/2026/0002 | B01 | B0100000002 | 2950.00 | No enviado |
| INV/2026/0003 | E31 | E310000000001 | 2124.00 | Enviado |
| INV/2026/0004 | E31 | E310000000002 | 2596.00 | Enviado |

Factura electronica validada localmente:

- Odoo e-NCF: `E310000000001`.
- Gateway e-NCF: `E310000000001`.
- TrackId local: `track-1778441479295-a8bb5b`.
- XML e-CF firmado: si.
- El XML firmado contiene el mismo e-NCF que Odoo: si.

Prueba final usando el metodo real del boton de Odoo:

- Odoo e-NCF: `E310000000002`.
- Gateway e-NCF: `E310000000002`.
- TrackId local: `track-1778441584905-c75a79`.
- XML e-CF firmado: si.
- El XML firmado contiene el mismo e-NCF que Odoo: si.

## Inventario y ventas

Ciclo operativo creado:

- Producto inventariable: `INV-DEMO-001 - Equipo fiscal demo inventariable`.
- Existencia cargada: 25 unidades.
- Reservado por venta: 2 unidades.
- Orden de venta: `S00001`.
- Estado de venta: confirmada.
- Total orden de venta: 8260.00.
- Entrega generada: si.

## Estado de cuenta

Cliente de prueba:

- Cliente: `CLIENTE FISCAL DE PRUEBA SRL`.
- RNC: `131566332`.
- Saldo por cobrar: 8850.00.

Ese saldo viene de facturas contables publicadas en Odoo, no de datos sueltos insertados en una pantalla.

## Pruebas ejecutadas

Gateway:

- `npm run check`: correcto.
- Health `http://localhost:3000/health`: correcto.
- Precertificacion local: casi completa.

Resultado de precertificacion local:

- RNC empresa: OK.
- Datos fiscales empresa: OK.
- Clientes configurados: OK.
- Productos configurados: OK.
- Semilla y token local: OK.
- XML e-CF firmado: OK.
- ARECF firmado: OK.
- ACECF firmado: OK.
- HTTPS publico DGII: pendiente.

Odoo:

- URL `http://localhost:8069/web`: responde 200.
- Base `dgii_demo`: activa.
- Modulos fiscales y operativos instalados.
- Factura E31 enviada al gateway y persistida con TrackId.

## Que falta para produccion real

No esta listo para enviar facturas reales a DGII todavia. Falta:

1. Confirmar razon social legal exacta del RNC `133206692` en DGII.
2. Configurar direccion fiscal, telefono, correo real y datos legales completos.
3. Instalar certificado digital `.p12` real del contribuyente y su clave.
4. Desactivar certificado demo (`GENERATE_DEMO_CERT=false`) y apuntar `CERT_PATH`/`CERT_PASSWORD` al certificado real.
5. Publicar el gateway con dominio HTTPS estable, no `localhost` ni tunnel temporal.
6. Configurar ambiente DGII correcto: certificacion primero, produccion despues.
7. Solicitar/autorizacion DGII para e-CF y secuencias e-NCF reales.
8. Cargar el primer numero autorizado de cada secuencia fiscal real en Odoo.
9. Validar los XML contra XSD oficiales DGII y reglas de negocio finales.
10. Ejecutar y aprobar la certificacion oficial DGII para el RNC cliente.
11. Configurar backups automaticos de PostgreSQL y archivos XML.
12. Configurar usuarios, permisos, auditoria, correo saliente, logs y monitoreo.
13. Revisar impuestos/cuentas con el contador antes de emitir comprobantes reales.

## Conclusion

La base tecnica ya es real: Odoo + PostgreSQL + localizacion dominicana + gateway e-CF. Ya genera NCF B01, e-CF E31, inventario, ventas, saldos y XML firmado local.

Lo que falta para produccion no es la interfaz ni la base ERP; falta la autorizacion fiscal real de DGII, certificado real, secuencias reales, HTTPS estable y validacion/certificacion oficial con el contribuyente.
