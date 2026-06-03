# Plan Comercial y Operativo QR Odoo DGII

## Resumen ejecutivo

La base actual sirve para vender una solucion real de gestion + facturacion dominicana sobre Odoo Community, pero todavia no esta lista para decir que aplica a cualquier empresa sin ajustes.

Lo que si tienes hoy:

- Ventas, compras, inventario, POS, website y eCommerce funcionando en Odoo Community.
- Facturacion dominicana con localizacion open source.
- Envio de e-CF desde Odoo hacia el gateway fiscal propio.
- QR fiscal en la representacion impresa de la factura dominicana.
- Soporte de codigo de barras en productos.

Lo que no debes prometer como si ya estuviera resuelto:

- App nativa de Barcode de Odoo para inventario, porque `stock_barcode` aparece como no instalable en esta base.
- Suscripciones nativas de Odoo para manejar planes, porque `sale_subscription` aparece como no instalable.
- Uso productivo para cualquier empresa sin certificacion DGII real, certificado real y despliegue seguro.

## Estrategia correcta para QR y control de inventario

### Regla practica

No conviene usar QR para todo por defecto. Para inventario rapido normalmente funciona mejor:

- `Code128` o `EAN13` para productos de venta rapida.
- `QR` para activos, lotes, series o documentos.
- `QR fiscal` para facturas e-CF.

### Como manejar inventario sin inventar piezas

El control serio se logra con proceso, no solo con un lector.

1. Cada producto debe tener al menos:
   - referencia interna,
   - unidad de medida,
   - costo,
   - politica de reposicion si aplica,
   - codigo escaneable en el campo de barcode.
2. Toda entrada debe venir por compra o recepcion.
3. Toda salida debe venir por venta, consumo interno o ajuste autorizado.
4. Los ajustes de inventario deben quedar restringidos y con motivo.
5. Si el producto es sensible, usar lotes o numeros de serie.

### Integracion recomendada sin subir a Odoo Enterprise

La ruta correcta es un modulo propio pequeno para escaneo, en vez de depender del modulo nativo no disponible.

Modulo sugerido: `stock_scan_do`

Funciones minimas:

- recepcion por escaneo,
- conteo fisico por escaneo,
- transferencia interna por escaneo,
- busqueda rapida por codigo,
- impresion de etiquetas,
- soporte para lector USB tipo teclado o camara de celular.

### Hardware recomendado

- Nivel economico: lector USB 1D/2D tipo teclado.
- Nivel medio: lector inalambrico 2D.
- Nivel alto: handheld Android industrial.

Si el cliente insiste en QR para todo, se puede hacer, pero debes avisar que no todos los lectores baratos leen QR igual de rapido que un Code128.

## Impresion para negocios

Hay que separar dos escenarios:

### Factura legal o administrativa

- Formato recomendado: A4 o media carta en PDF.
- Uso: cuentas por cobrar, facturas formales, reimpresion, auditoria.
- Ya tienes base para esto con el reporte fiscal dominicano y su QR.

### Ticket o impresion termica

- Formato recomendado: 80mm.
- Uso: colmados, tiendas, caja rapida, POS.
- Para esto conviene usar POS o un reporte termico propio.

### Recomendacion realista

1. Mantener la factura formal en formato A4.
2. Crear un reporte termico adicional para ticket de venta.
3. Para impresoras termicas Epson o equivalentes, priorizar impresoras de red o por Windows con pruebas reales por cliente.

No mezcles la promesa de factura fiscal formal con ticket termico como si fueran exactamente el mismo documento visual. Se pueden derivar del mismo movimiento, pero normalmente requieren plantillas distintas.

## Esta completo para venderlo a cualquier empresa

Respuesta corta: no a cualquiera todavia.

Respuesta seria: si puedes venderlo ya a clientes piloto o clientes pequenos y medianos con alcance controlado, pero no debes venderlo como producto totalmente cerrado para cualquier vertical sin completar lo siguiente:

### Falta cerrar para venta seria

- certificado digital `.p12` real por empresa,
- endpoints y certificacion real DGII por empresa,
- HTTPS, dominio y politicas de backup,
- monitoreo y logs operativos,
- manual de onboarding,
- plantillas de impresion finales,
- politicas de soporte y SLA,
- paquete de datos maestros por sector,
- flujo de escaneo para inventario si ese cliente lo necesita.

### A quien si se lo venderia ya

- comercios pequenos,
- tiendas de repuestos,
- distribuidoras pequenas,
- negocios de servicios con inventario ligero,
- empresas que necesiten e-CF + inventario + ventas + compras.

### A quien no se lo venderia todavia como paquete cerrado

- manufactura compleja,
- retail multi-sucursal con operaciones intensivas de handheld scanning,
- empresas con SLA muy alto sin antes montar monitoreo y soporte formales.

## Como personalizarlo

Tu ventaja comercial esta en vender verticales, no una sola version genérica.

### Personalizacion que si conviene

- logo, colores y dominio,
- formato de factura y ticket,
- campos de cliente y producto,
- flujo comercial por sector,
- reportes por sector,
- automatizaciones de cobro, compras y alertas,
- permisos por rol,
- integracion con WhatsApp, correo o pasarela de pago si aplica.

### Personalizacion que debes modularizar

Conviene manejar addons pequenos y separados:

- `l10n_do_ecf_gateway`: conector fiscal,
- `stock_scan_do`: escaneo y conteo,
- `product_label_do`: etiquetas QR o Code128,
- `account_move_thermal_do`: ticket termico,
- `service_plan_do`: control interno de planes y vencimientos,
- `branding_cliente_x`: capa visual si un cliente grande la paga.

## Como venderlo por planes

Como `sale_subscription` no esta disponible en esta base, no dependas de una suscripcion nativa de Odoo para tu modelo comercial. Maneja los planes como producto comercial y contrato de soporte.

### Plan 1: Base Fiscal

Para quien:

- empresa que solo quiere facturar y cumplir.

Incluye:

- facturacion dominicana,
- clientes y productos,
- ventas,
- compras basicas,
- inventario basico,
- reportes basicos,
- soporte limitado.

### Plan 2: Operacion Comercial

Para quien:

- negocio que necesita caja, inventario y seguimiento comercial.

Incluye todo lo anterior mas:

- POS,
- CRM,
- delivery,
- cuentas por cobrar,
- reportes operativos,
- parametrizacion adicional.

### Plan 3: Operacion con Escaneo

Para quien:

- tienda, ferreteria, repuestos, distribucion.

Incluye todo lo anterior mas:

- modulo de escaneo,
- etiquetas,
- flujos de recepcion y conteo,
- capacitacion operativa,
- soporte ampliado.

### Plan 4: Personalizado

Para quien:

- empresa que quiere integraciones, branding o flujos especiales.

Incluye:

- desarrollos a medida,
- integraciones externas,
- reportes especiales,
- soporte premium,
- ambientes separados.

## Como usar Odoo para ayudarte a vender y operar tus propios planes

Odoo te sirve tambien a ti como sistema de venta e implementacion.

### CRM

Usalo para:

- manejar prospectos,
- pipeline de cierres,
- clasificar por sector,
- registrar demo, propuesta y cierre.

### Sales

Usalo para:

- crear cotizaciones por paquete,
- manejar add-ons,
- dejar por escrito el alcance contratado.

### Project

Usalo para:

- onboarding,
- checklist de implementacion,
- tareas de migracion,
- seguimiento postventa.

### Invoicing

Usalo para:

- facturar implementacion,
- facturar soporte mensual,
- facturar mejoras y bolsas de horas.

### Website

Usalo para:

- publicar planes,
- mostrar demo,
- capturar leads,
- vender por formulario.

## Modelo comercial recomendado

No vendas solo instalacion. Vende tres cosas:

1. implementacion inicial,
2. mensualidad de soporte,
3. extras por vertical o automatizacion.

### Formula simple

- Setup inicial.
- Pago mensual por soporte y hosting.
- Pago adicional por usuarios extra, sucursales extra o modulos especiales.

## Siguiente roadmap recomendable

1. Cerrar produccion DGII real.
2. Crear modulo `stock_scan_do`.
3. Crear reporte termico 80mm.
4. Crear catalogo comercial de planes.
5. Estandarizar despliegue por cliente.
6. Preparar demo vertical: tienda, repuestos y servicios.

## Conclusión

Si puedes vender esta base, pero como solucion implementable por sector, no como producto universal terminado.

La jugada inteligente es:

- mantener Odoo Community,
- usar tu gateway fiscal propio,
- vender por paquetes,
- cobrar implementacion + mensualidad,
- desarrollar solo los addons que te den ventaja comercial real.
