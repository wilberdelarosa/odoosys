# Integraciones Odoo + DGII habilitadas y recomendadas

Fecha de verificacion: 2026-05-10.

## Base actual

La base quedo montada sobre:

- Odoo Community 17.
- PostgreSQL 15.
- Localizacion dominicana `l10n-dominicana`.
- Conector propio `l10n_do_ecf_gateway`.
- Gateway Node/TypeScript para e-CF, ARECF y ACECF.

## Integraciones ya instaladas

Estas quedaron activas en la base `dgii_demo`:

- `account`: contabilidad y facturacion.
- `sale_management`: ventas y cotizaciones.
- `purchase`: compras.
- `stock`: inventario.
- `l10n_do_accounting`: fiscalidad dominicana.
- `l10n_do_ecf_gateway`: conector e-CF DGII.
- `contacts`: gestion formal de contactos y empresas.
- `calendar`: agenda, reuniones, recordatorios.
- `crm`: prospectos y oportunidades.
- `sale_crm`: oportunidades conectadas a cotizaciones/ventas.
- `project`: proyectos y tareas postventa.
- `website`: sitio web corporativo.
- `website_sale`: catalogo y eCommerce.
- `point_of_sale`: punto de venta.
- `delivery`: costos de entrega y transportistas.

## Que valor comercial agrega cada una

### 1. CRM + Ventas

Permite:

- captar leads,
- mover oportunidades por embudo,
- convertir oportunidad en cotizacion,
- convertir cotizacion en venta,
- facturar luego con NCF/e-CF.

Es una de las mejores integraciones para venderle a empresas de servicios, comercios B2B y distribuidores.

### 2. Contacts + Calendar

Permite:

- tener padrón comercial interno de clientes y suplidores,
- centralizar RNC, correos, telefonos y direcciones,
- registrar actividades y seguimiento,
- agendar llamadas, reuniones y recordatorios.

No sustituye una consulta oficial de padrón DGII en línea, pero sí estructura mejor el maestro de clientes.

### 3. Project

Permite:

- manejar implementación, soporte, onboarding y postventa,
- dar seguimiento a tickets internos aunque no tengas Helpdesk,
- ligar tareas a clientes y ventas.

Sirve mucho si vas a vender el sistema con iguala mensual o soporte recurrente.

### 4. Website + eCommerce

Permite:

- página corporativa,
- catálogo online,
- formularios de contacto,
- carrito y pedidos web,
- pasar del sitio a la venta y luego a la factura.

Es muy útil para vender un paquete completo: web + ERP + facturación.

### 5. Point of Sale

Permite:

- caja rápida para mostrador,
- ventas presenciales,
- integración con productos, clientes y stock,
- posterior adaptación fiscal dominicana si decides desarrollar el flujo POS fiscal.

Ojo: está instalado, pero una empresa retail real normalmente requerirá ajuste específico para su flujo fiscal y operativo.

### 6. Delivery

Permite:

- reglas de entrega,
- costos de envío,
- integración posterior con transportistas.

Aporta valor para tiendas, distribución y eCommerce.

## Integraciones que son buenas pero no quedaron activadas

### Helpdesk

- Estado actual: `uninstallable` en esta base.
- Conclusión: no lo tomaría como parte del paquete Community actual sin revisar otra edición o addon adicional.

### Barcode

- Estado actual: `uninstallable`.
- Conclusión: no lo vendería como disponible hoy en esta base sin adaptar otra solución.

## Qué es gratis y qué puede costar

### Gratis dentro de esta base actual

Sin costo de licencia adicional por módulo en esta instalación actual:

- CRM
- Contacts
- Calendar
- Project
- Website
- eCommerce
- POS
- Delivery
- Sales
- Purchase
- Inventory
- Invoicing
- Localización dominicana open source
- Conector e-CF propio

### Lo que sí puede generar costo aunque el módulo esté instalado

- dominio web,
- hosting y backups,
- correo SMTP,
- certificado SSL,
- certificado digital `.p12`,
- integraciones con pasarelas de pago,
- integraciones con couriers,
- desarrollos a medida,
- soporte y mantenimiento.

O sea: el módulo puede ser libre, pero la operación real y los terceros no necesariamente son gratis.

## Integraciones recomendadas para vender mejor

### Paquete base comercial

Recomendado para casi cualquier pyme:

- Contabilidad + facturación dominicana.
- Ventas.
- Compras.
- Inventario.
- CRM.
- Contacts.
- Calendar.

### Paquete comercial pro

Para empresas de servicio o distribución:

- Todo lo anterior.
- Project.
- Delivery.
- Automatización de seguimiento.
- Dashboard fiscal y comercial.

### Paquete comercial retail / omnicanal

Para tiendas y comercios con venta física y web:

- Todo lo anterior según aplique.
- Point of Sale.
- Website.
- eCommerce.
- Integración stock-tiendas-web.

## Qué falta para dejar algunas integraciones realmente productivas

### Para CRM

- embudo comercial real,
- etapas,
- responsables,
- correos salientes,
- actividades y automatizaciones.

### Para Website/eCommerce

- branding,
- páginas reales,
- catálogo,
- imágenes,
- métodos de pago,
- política de entrega,
- términos y privacidad.

### Para POS

- sesión de caja,
- métodos de pago,
- impresora o layout,
- flujo fiscal dominicano definido,
- perfiles de cajero.

### Para Delivery

- reglas de envío,
- zonas,
- operadores reales,
- tarifas.

## Conclusión práctica

La base ya quedó integrada eficientemente para un paquete muy vendible en Community:

- ERP,
- CRM,
- ventas,
- compras,
- inventario,
- facturación dominicana,
- e-CF,
- proyectos,
- sitio web,
- eCommerce,
- POS,
- entregas.

No todo está listo para producción en cada módulo solo por estar instalado. Lo correcto es venderlo como plataforma integrada y luego activar/configurar por tipo de cliente.

## Recomendación final

Si quieres vender esto bien, yo lo ofrecería por vertical:

- distribuidora,
- tienda retail,
- empresa de servicios,
- ferretería,
- repuestos,
- comercializadora,
- suplidor B2B.

Cada vertical usa la misma base, pero se le activan módulos y automatizaciones distintas.
