# Guia Paso a Paso para Pasar de NCF a e-CF en DGII con Sistema Propio

## Confirmacion Ejecutiva

Si la empresa ya tiene RNC y actualmente emite NCF, si puede pasar a facturacion electronica y emitir e-NCF usando un sistema propio que preparemos.

La condicion real es esta:

1. La empresa debe cumplir los requisitos de DGII.
2. El sistema debe cumplir la especificacion tecnica de DGII.
3. La empresa debe aprobar el proceso de certificacion como Emisor Electronico.
4. La empresa debe quedar autorizada por DGII para producir e-CF.

Importante: el software no queda "validado por si solo". La validez legal la obtiene la empresa contribuyente cuando completa y aprueba el proceso oficial ante DGII.

Este documento esta preparado para una empresa que:

1. Ya tiene RNC.
2. Ya tiene autorizacion para emitir NCF.
3. Quiere migrar de NCF a e-NCF.
4. Va a usar un sistema propio o un sistema preparado especificamente para ella.

## Resultado Esperado

Al finalizar correctamente este proceso, la empresa deberia quedar habilitada para:

1. Emitir e-CF con e-NCF validos en el ambiente productivo de DGII.
2. Consultar el resultado de envio de sus comprobantes.
3. Mantener servicios de autenticacion, recepcion y aprobacion comercial registrados ante DGII.
4. Operar con facturacion electronica conforme a la Ley 32-23, la Norma 01-20 y documentacion complementaria.

## Alcance de Esta Guia

Esta guia cubre la ruta de sistema propio o sistema preparado para la empresa.

No cubre como ruta principal:

1. Facturador Gratuito de DGII.
2. Implementacion mediante un proveedor autorizado ya certificado que opere todo por la empresa.
3. Un ERP general sin integracion especifica e-CF.

Si la empresa va a usar un sistema propio, no debe mezclar esta ruta con la del Facturador Gratuito sin revisar primero su situacion con DGII.

## Respuesta Corta para el Cliente

Si la empresa sigue todos los pasos de este documento y el sistema que preparemos cumple con la especificacion tecnica y pasa el proceso de certificacion, si puede facturar con e-NCF.

La unica reserva correcta es esta: nadie puede prometer un 100 por ciento de aprobacion antes de que DGII termine la certificacion. Lo que si existe es una ruta oficial, valida y correcta para lograrlo.

## Quien Hace Que

### Responsable del cliente

Debe encargarse de:

1. Mantener el RNC activo y actualizado.
2. Estar al dia en obligaciones tributarias.
3. Tener acceso a Oficina Virtual.
4. Tener Alta de NCF.
5. Designar Usuario Administrador de e-CF.
6. Obtener el certificado digital.
7. Completar y firmar formularios oficiales.
8. Aprobar internamente la informacion legal y fiscal que se va a usar.

### Equipo de implementacion

Debe encargarse de:

1. Preparar el sistema.
2. Configurar ambientes de prueba, certificacion y produccion.
3. Generar XML conforme a XSD de DGII.
4. Firmar XML con certificado digital.
5. Consumir servicios de autenticacion, envio y consulta.
6. Implementar endpoints requeridos para recepcion y aprobaciones comerciales cuando apliquen.
7. Acompanar al cliente en el set de pruebas y en la certificacion.

## Punto Critico Sobre Ustedes Como Desarrolladores Externos

Si el sistema sera preparado por terceros externos a la empresa contribuyente, hay un punto que debe definirse antes de llenar la postulacion:

1. Si DGII considerara el software como desarrollado internamente por la empresa.
2. O si se declarara como software adquirido o preparado por un proveedor externo.

En el portal de certificacion existe el campo `Tipo de Software` y, si se indica proveedor externo, existe una seccion de `Datos del Proveedor`.

Recomendacion operativa:

1. Antes de enviar la postulacion, el cliente debe confirmar con DGII como declarar el sistema si fue construido por un equipo externo no constituido formalmente como empresa.
2. Si el sistema quedara bajo control total del cliente y sera usado solo por ese cliente, eso debe documentarse internamente.
3. No improvisar esta respuesta en el formulario. Resolverla antes de someter la postulacion.

Correo util para este tipo de validacion operativa: `facturacionelectronica@dgii.gov.do`

## Requisitos Previos Obligatorios

La empresa debe tener, antes de iniciar formalmente el proceso:

1. RNC activo.
2. Oficina Virtual activa.
3. Autorizacion para emitir NCF.
4. Obligaciones tributarias al dia.
5. Representante o relacion valida registrada en el RNC.
6. Usuario Administrador de e-CF designado.
7. Certificado digital para procedimiento tributario.
8. Un sistema capaz de emitir e-CF conforme a DGII.

## Documentos y Datos que Deben Estar Listos

Antes de sentarse a llenar cualquier solicitud, preparar esta carpeta:

1. Copia del RNC y datos fiscales actualizados.
2. Credenciales de Oficina Virtual.
3. Constancia de Alta de NCF.
4. Registro Mercantil actualizado, preferible si es persona juridica.
5. Carta firmada para designacion del Usuario Administrador de e-CF.
6. Cedula o pasaporte de la persona designada.
7. Certificado digital `.p12` y su clave.
8. Nombre oficial del software.
9. Version del software.
10. URLs del sistema para autenticacion, recepcion y aprobacion comercial.
11. Razon social, RNC y datos del representante.
12. Correo y telefono de contacto operativo.

## Tipos de e-CF Mas Comunes que el Sistema Debe Soportar

Para una implementacion comercial inicial, lo minimo recomendable es soportar:

1. Tipo 31: Factura de Credito Fiscal Electronica.
2. Tipo 32: Factura de Consumo Electronica.
3. Tipo 33: Nota de Debito Electronica.
4. Tipo 34: Nota de Credito Electronica.

DGII tambien define:

1. Tipo 41: Compras.
2. Tipo 43: Gastos Menores.
3. Tipo 44: Regimenes Especiales.
4. Tipo 45: Gubernamental.
5. Tipo 46: Exportaciones.
6. Tipo 47: Pagos al Exterior.

## Lo que Debe Tener el Sistema que Vamos a Preparar

Para que la empresa tenga una ruta real de aprobacion, el sistema debe poder hacer como minimo lo siguiente:

1. Leer el certificado digital `.p12` del contribuyente.
2. Obtener la semilla de DGII.
3. Firmar la semilla y autenticar contra DGII.
4. Generar XML segun formatos oficiales e-CF.
5. Firmar el XML del e-CF.
6. Enviar el e-CF a DGII.
7. Consultar el resultado por `TrackId`.
8. Generar la representacion impresa.
9. Generar QR y codigo de seguridad segun corresponda.
10. Manejar los ambientes `TesteCF`, `CerteCF` y `eCF`.
11. Exponer URL de autenticacion si aplica la comunicacion emisor-receptor.
12. Exponer URL de recepcion de e-CF.
13. Exponer URL de recepcion de aprobaciones o rechazos comerciales.
14. Guardar evidencias de envio, XML firmado, respuesta y estado.
15. Permitir reintentos y correcciones durante la certificacion.

## Ambientes Oficiales de DGII

DGII maneja tres ambientes:

1. `TesteCF`: pre-certificacion.
2. `CerteCF`: certificacion.
3. `eCF`: produccion.

Base de autenticacion por ambiente:

1. `https://ecf.dgii.gov.do/testecf/autenticacion`
2. `https://ecf.dgii.gov.do/certecf/autenticacion`
3. `https://ecf.dgii.gov.do/ecf/autenticacion`

Operaciones clave del flujo tecnico:

1. Obtener semilla.
2. Validar semilla firmada.
3. Enviar e-CF.
4. Consultar resultado.
5. Registrar y usar URLs de servicios para comunicacion.

## Fase 1. Designar el Usuario Administrador de e-CF

Este paso se hace antes de la Solicitud de Autorizacion para ser Emisor Electronico.

### Que es el Usuario Administrador de e-CF

Es la persona que actua en nombre del contribuyente para mantener en DGII la identificacion de firmantes autorizados y ejecutar gestiones relacionadas con e-CF.

### Quien puede solicitarlo

La persona que firme la solicitud debe figurar en el RNC con al menos una relacion valida, por ejemplo:

1. Representante.
2. Socio.
3. Contador.
4. Administrador.
5. Apoderado.
6. Accionista.
7. Responsable por la Solicitud.
8. Usuario Administrador de e-CF.
9. Firmante de e-CF.

### Documentos recomendados

1. Carta de solicitud firmada.
2. Si es persona juridica, la carta debe ir timbrada, firmada y sellada.
3. Copia del Registro Mercantil actualizado, preferible.
4. Identificacion de la persona designada.

### Si la persona designada no aparece en el RNC

Debe hacerse una actualizacion al RNC antes de continuar.

### Pasos por Oficina Virtual

1. Entrar a la Oficina Virtual con usuario y clave.
2. Ir al menu `Solicitudes`.
3. Seleccionar `Actualizacion al RNC`.
4. Completar la `Declaracion Jurada para la Actualizacion de Datos de Sociedades` con la modificacion correspondiente.
5. Guardar cambios.
6. Aceptar terminos y condiciones.
7. Seleccionar `Verificar y Continuar`.
8. Adjuntar los documentos requeridos en un solo archivo PDF, PNG o JPG.
9. Procesar cambios.
10. Guardar el numero de solicitud para seguimiento.

### Requisitos permanentes del Usuario Administrador

La persona designada debe:

1. Mantener su relacion valida en el RNC.
2. Tener clave de Oficina Virtual.
3. Tener certificado digital para procedimiento tributario.

Entidades de certificacion citadas por el instructivo:

1. Viafirma.
2. Digifirma.
3. Novofirma.

## Fase 2. Obtener el Certificado Digital

La empresa debe obtener un certificado digital para procedimiento tributario a nombre de la persona que actuara como firmante o Usuario Administrador, segun el esquema definido.

### Que debe validar antes de comprarlo o emitirlo

1. Que el nombre de la persona coincida con la relacion valida en el RNC.
2. Que el documento de identidad este vigente.
3. Que el certificado se entregue en formato utilizable por el sistema, normalmente `.p12`.
4. Que el cliente guarde de manera segura la clave del certificado.

### Recomendacion de control interno

1. Guardar el certificado en un repositorio seguro.
2. No enviarlo por correo sin cifrado.
3. No hardcodear la clave en el codigo.
4. Definir quien tendra acceso al certificado en produccion.

## Fase 3. Preparar el Sistema Antes de Solicitar la Certificacion

Antes de enviar la solicitud formal, el sistema debe quedar listo para pruebas.

### Checklist tecnico previo

1. Configurar lectura del certificado `.p12`.
2. Configurar emision en ambiente de prueba.
3. Generar XML validos para los tipos de e-CF que usara el cliente.
4. Firmar XML conforme a la estructura requerida.
5. Implementar consulta de `TrackId`.
6. Generar representacion impresa.
7. Definir las URL que se colocaran en postulacion.
8. Probar autenticacion por semilla y token.
9. Probar nombres de archivo XML en el formato esperado por DGII.
10. Preparar logs tecnicos y evidencias.

### URL que deben existir o definirse

DGII pide al menos estas direcciones en la postulacion:

1. `URL Recepcion`: donde el contribuyente recibira e-CF cuando actue como receptor electronico.
2. `URL Aprobacion`: donde recibira aprobaciones o rechazos comerciales de los e-CF emitidos.
3. `URL Autenticacion`: donde se valida identidad usando certificado y semilla para retornar token.

Si vamos a preparar el sistema con una base tecnica como `dgii-ecf`, debemos poder soportar al menos rutas equivalentes a:

1. `/fe/autenticacion/api/semilla`
2. `/fe/autenticacion/api/validacioncertificado`
3. `/fe/recepcion/api/ecf`

## Fase 4. Solicitud Inicial para Ser Emisor Electronico

La empresa debe completar el `Formulario de Solicitud para ser Emisor Electronico (FI-GDF-016)` a traves de la OFV.

### Que pasa despues de enviarlo

Si la solicitud cumple con las especificaciones, DGII enviara por el buzon de Oficina Virtual las instrucciones para acceder al Portal de Certificacion de Facturacion Electronica.

### Que revisar antes de enviar esta solicitud

1. Que el cliente este al dia.
2. Que la OFV funcione.
3. Que el Alta NCF este vigente.
4. Que el Usuario Administrador de e-CF ya este incluido.
5. Que el certificado digital ya exista.
6. Que el sistema ya tenga nombre, version y URLs definidas.

## Fase 5. Acceso al Portal de Certificacion

Una vez aprobada la solicitud inicial, el cliente recibira instrucciones para acceder al Portal de Certificacion.

En este portal se ejecuta el proceso formal de certificacion.

Antes de iniciar formalmente la certificacion, el contribuyente puede hacer pruebas en ambiente de pre-certificacion para confirmar la adecuacion del sistema.

## Fase 6. Completar la Postulacion en el Portal

En el paso inicial del portal, el formulario de postulacion trae prellenados los datos del contribuyente y del representante. Luego se completan los `Datos del software a utilizar`.

### Campos que deben completarse con precision

1. `Tipo de Registro`: indicar que la certificacion sera en calidad de Emisor Electronico.
2. `Tipo de Software`: indicar si el software es de proveedor externo o desarrollado internamente.
3. `Nombre del Software`: nombre comercial u operativo del sistema.
4. `URL Recepcion`: direccion del servicio que recibira e-CF cuando el contribuyente actue como receptor.
5. `URL Aprobacion`: direccion del servicio que recibira aprobaciones o rechazos comerciales.
6. `URL Autenticacion`: direccion del servicio que valida identidad mediante semilla firmada y devuelve token.
7. `Version de Software`: version exacta que se usara en certificacion.
8. `Datos del Proveedor`: completar solo si se indico que el software proviene de un proveedor externo.

### Regla practica

No llenar este formulario hasta que:

1. Las URLs respondan correctamente.
2. La version del sistema este congelada para certificacion.
3. El cliente tenga decidido como declarara el tipo de software.

## Fase 7. Generar, Firmar y Enviar el XML de Postulacion

Despues de completar el formulario en el portal:

1. Seleccionar `Generar archivo`.
2. Descargar el XML de postulacion.
3. Firmar el XML con la herramienta establecida para esos fines.
4. Cargar y enviar el XML firmado.

Si la validacion es satisfactoria, DGII habilitara las pruebas de datos, simulacion y comunicacion.

## Fase 8. Pruebas de Datos

Aqui comienza la validacion real del software.

### Paso operativo

1. Descargar el set de datos de prueba entregado por DGII, normalmente en Excel.
2. Generar los XML de e-CF usando exactamente los campos y el orden requerido.
3. Remitir esos XML a los servicios de recepcion de DGII.

### Regla importante

Si un e-CF generado resulta `Rechazado`, debe corregirse y reiniciarse la generacion del set segun las reglas de DGII.

### Lo que el sistema debe poder mostrar

1. XML generado.
2. XML firmado.
3. Nombre del archivo enviado.
4. Fecha y hora de envio.
5. `TrackId` devuelto.
6. Estado de aceptacion o rechazo.
7. Mensaje de error si aplica.

## Fase 9. Pruebas de Aprobaciones o Rechazos Comerciales

Luego de la prueba de datos del e-CF, el contribuyente debe generar y remitir las Aprobaciones o Rechazos Comerciales en el formato XML definido por DGII.

### Resultado esperado

DGII devolvera un estado que normalmente sera una de estas salidas operativas:

1. `Aceptado`.
2. `Aceptado con Observaciones`.
3. `Rechazado`.

## Fase 10. Pruebas de Simulacion

En esta fase el contribuyente genera y envia comprobantes como si ya estuviera operando.

### Lo que se valida aqui

1. Envio de e-CF.
2. Respuesta de validacion.
3. Consulta de resultado por `TrackId`.
4. Consistencia del contenido del XML.
5. Representacion impresa.

### Representacion impresa

La empresa debe poder remitir al portal la representacion impresa de los e-CF correspondientes.

Si la representacion impresa es rechazada:

1. Corregir formato o inconsistencias.
2. Volver a remitir.

## Fase 11. Actualizacion de URL de Servicios de Prueba

Si durante la certificacion cambia alguna URL del sistema, el contribuyente puede actualizar:

1. URL de recepcion.
2. URL de aprobacion comercial.
3. URL de autenticacion, de manera opcional segun el paso.

Esto es importante si el equipo cambia dominio, ruta o infraestructura durante el proceso.

## Fase 12. Pruebas de Comunicacion

Esta es la fase donde DGII valida la capacidad del sistema para recibir informacion desde fuera.

### Acciones clave

1. De manera opcional, descargar el certificado raiz para validar certificados digitales.
2. Indicar en el portal que el contribuyente esta listo para recibir e-CF.
3. Corregir URLs si fueron modificadas.

### Recepcion de e-CF

DGII enviara comprobantes de prueba al sistema del contribuyente.

El sistema debe:

1. Recibir el e-CF.
2. Procesarlo.
3. Responder con el acuse de recibo correspondiente.

### Recepcion de aprobaciones comerciales

DGII tambien puede remitir aprobaciones comerciales vinculadas a comprobantes recibidos previamente.

El sistema debe recibirlas y responder correctamente en el formato esperado.

## Fase 13. Registrar URL de Produccion

Cuando las pruebas avanzan al paso de produccion, el contribuyente debe completar las URL finales del ambiente productivo:

1. URL de autenticacion.
2. URL de recepcion.
3. URL de aprobacion comercial.

Estas URL quedaran asociadas al directorio de servicios y conectadas con la OFV.

### Recomendacion critica

No registrar en produccion:

1. URLs temporales.
2. Tunnels de prueba.
3. Rutas sin monitoreo.
4. Servicios que no tengan certificado SSL valido.

## Fase 14. Declaracion Jurada

Antes de finalizar, la empresa debe completar la declaracion jurada electronica.

### Contenido general

Es una declaracion bajo fe de juramento donde se hace constar que la certificacion fue realizada de manera integra, sin acciones fraudulentas o irregularidades.

### Pasos

1. Descargar el XML de declaracion jurada.
2. Verificar que incluya RNC y representante correctos.
3. Seleccionar `Generar Archivo`.
4. Firmar el XML con la App de Firma Digital o herramienta equivalente admitida.
5. Cargarlo mediante `Enviar Archivo`.

### Que valida DGII aqui

Que el XML este firmado por el representante indicado en la postulacion o por un representante registrado valido.

## Fase 15. Verificacion Final del Estatus del Contribuyente

Antes del cierre final, DGII revisa que la empresa mantenga el estatus que le permitio entrar al proceso.

### Lo que debe seguir vigente

1. Estar al dia en obligaciones tributarias.
2. Tener acceso a OFV.
3. Tener Alta NCF.
4. Tener representante registrado.

Si algo de esto falla, el cliente debe corregirlo antes de completar la declaracion jurada y el cierre de certificacion.

## Resultado de la Certificacion

Una vez la empresa completa exitosamente las pruebas de datos, simulacion y comunicacion, y la declaracion jurada es aceptada, DGII procede con la autorizacion como Emisor Electronico.

### Que se habilita luego

En Oficina Virtual se habilitan funciones relacionadas con facturacion electronica, incluyendo opciones como:

1. Registro de contingencia.
2. Delegacion.
3. Consulta de e-CF emitidos.
4. Consulta de e-CF recibidos.
5. Consulta de e-CF anulados.
6. Consulta del directorio electronico.
7. Mantenimiento del directorio con las URL productivas.

## Que Debe Hacer la Empresa el Primer Dia de Produccion

1. Verificar que el certificado digital cargado en produccion es el correcto.
2. Verificar que el ambiente del sistema este en `eCF` y no en `TesteCF` ni `CerteCF`.
3. Emitir un comprobante de control interno o de prueba operativa permitida por su flujo.
4. Consultar el resultado por `TrackId`.
5. Confirmar que el e-NCF aparece con la estructura correcta.
6. Confirmar que la representacion impresa y el QR se ven correctamente.
7. Guardar XML firmado, respuesta y evidencia de envio.

## Checklist de Preparacion Rapida para una Persona No Tecnica

Usar esta lista de verificacion antes de iniciar:

- [ ] La empresa tiene RNC activo.
- [ ] La empresa tiene Oficina Virtual funcionando.
- [ ] La empresa tiene Alta NCF.
- [ ] La empresa esta al dia con DGII.
- [ ] La empresa ya definio su Usuario Administrador de e-CF.
- [ ] La empresa ya obtuvo el certificado digital.
- [ ] La empresa ya definio quien sera el firmante.
- [ ] Ya existe nombre y version del sistema.
- [ ] Ya existen las URL del sistema.
- [ ] Ya se definio si el software se declarara como interno o externo.
- [ ] Ya se completo la solicitud inicial FI-GDF-016.
- [ ] Ya se recibio acceso al Portal de Certificacion.
- [ ] Ya se paso postulacion.
- [ ] Ya se completaron pruebas de datos.
- [ ] Ya se completaron pruebas de simulacion.
- [ ] Ya se completaron pruebas de comunicacion.
- [ ] Ya se registraron URL productivas.
- [ ] Ya se firmo y envio la declaracion jurada.
- [ ] DGII ya autorizo a la empresa como Emisor Electronico.

## Errores Frecuentes que Bloquean la Aprobacion

1. El cliente no esta al dia con DGII.
2. El Usuario Administrador no aparece correctamente relacionado en el RNC.
3. El certificado digital no pertenece a una persona con relacion valida.
4. Las URL del sistema no responden o cambian durante el proceso.
5. El XML no cumple exactamente el formato requerido.
6. El archivo esta firmado con certificado incorrecto.
7. El ambiente esta mal configurado.
8. La representacion impresa no coincide con el e-CF enviado.
9. El sistema no responde correctamente a pruebas de recepcion o aprobacion comercial.
10. Se llena incorrectamente el campo `Tipo de Software`.

## Recomendacion de Implementacion para Este Proyecto

Para minimizar riesgo y acelerar salida, la implementacion del sistema debe hacerse con este enfoque:

1. Base tecnica que ya soporte autenticacion, firmado XML, envio y consulta a DGII.
2. Parametrizacion por empresa cliente.
3. Ambientes separados para `TesteCF`, `CerteCF` y `eCF`.
4. Evidencias completas de auditoria.
5. Version congelada para certificacion.
6. No hacer cambios funcionales fuertes en mitad del proceso de certificacion.

## Decision Operativa Final

Si la empresa cliente ya tiene RNC, OFV y Alta NCF, la ruta correcta es:

1. Regularizar Usuario Administrador de e-CF.
2. Obtener certificado digital.
3. Preparar el sistema.
4. Presentar FI-GDF-016.
5. Acceder al Portal de Certificacion.
6. Completar postulacion y firmar XML.
7. Aprobar pruebas de datos, simulacion y comunicacion.
8. Registrar URL de produccion.
9. Firmar y enviar declaracion jurada.
10. Recibir autorizacion y comenzar a emitir e-NCF.

## Fuentes Oficiales Recomendadas

1. Portal principal de Facturacion Electronica DGII: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Paginas/default.aspx`
2. Documentacion sobre e-CF: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Paginas/documentacionSobreE-CF.aspx`
3. Tipos y estructura de e-CF: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Paginas/TipoyEstructurae-CF.aspx`
4. Marco legal: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Paginas/marcoLegal.aspx`
5. Proceso de Certificacion para ser Emisor Electronico: disponible en la seccion de documentacion sobre e-CF.
6. Solicitud Usuario Administrador de e-CF: disponible en la seccion de instructivos sobre Facturacion Electronica.

## Anexo de Enlaces Necesarios

Este anexo agrupa los enlaces mas utiles para el cliente, para el equipo tecnico y para la etapa de certificacion. La recomendacion es guardarlos en favoritos y copiarlos a un documento de trabajo interno.

### 1. Acceso general DGII

1. Portal principal de Facturacion Electronica DGII: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Paginas/default.aspx`
2. Oficina Virtual DGII: `https://dgii.gov.do/ofv/login.aspx`
3. Contacto general DGII: `https://dgii.gov.do/contacto`
4. Comunidad de ayuda DGII sobre facturacion electronica: `https://ayuda.dgii.gov.do/topics/facturacin-electrnica/5f3bfd5e26db9031994e75d3`

### 2. Portales y paginas del proceso

1. Documentacion sobre e-CF: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Paginas/documentacionSobreE-CF.aspx`
2. Tipos y estructura de e-CF: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Paginas/TipoyEstructurae-CF.aspx`
3. Preguntas frecuentes: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Paginas/preguntasFrecuentes.aspx`
4. Herramientas recomendadas: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Paginas/herramientasRecomendadas.aspx`
5. Emisores electronicos autorizados: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Paginas/Emisores-electronicos-certificados.aspx`
6. Proveedores de servicios de FE autorizados: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Paginas/Proveedores-servicios-FE-autorizados.aspx`
7. Facturador Gratuito DGII: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Paginas/facturador-gratuito.aspx`
8. Portal del Facturador Gratuito: `https://fg.dgii.gov.do/ecf/portalfg/`
9. Login del Facturador Gratuito: `https://fg.dgii.gov.do/ecf/PortalFG/login`

### 3. Formularios y tramites que se van a usar

1. Oficina Virtual para iniciar la solicitud FI-GDF-016: `https://dgii.gov.do/ofv/login.aspx`
2. Formulario de Solicitud de Autorizacion para ser Proveedor de Servicios de FE FI-GDF-017: `https://dgii.gov.do/herramientas/formularios/formularioSolicitudes/Documents/Comprobantes%20fiscales/FI-GDF-017.zip`

Nota: el formulario FI-GDF-016 para ser Emisor Electronico se tramita por OFV y luego se continua en el Portal de Certificacion de FE conforme a la notificacion recibida en el buzon de Oficina Virtual.

### 4. Instructivos y guias oficiales que conviene descargar

1. Proceso de Certificacion para ser Emisor Electronico: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Documentaciones%20Proceso%20de%20Certificaci%C3%B3n%20FE/Proceso%20de%20Certificacion%20para%20ser%20Emisor%20Electronico.pdf`
2. Proceso de Certificacion para ser Emisor Electronico con Proveedor Certificado: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Documentaciones%20Proceso%20de%20Certificaci%C3%B3n%20FE/Proceso-Certificacion-EmisorElectronico-Proveedor-Servicios-FECertificado.pdf`
3. Solicitud Usuario Administrador de e-CF: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Instructivos%20sobre%20Facturaci%C3%B3n%20Electr%C3%B3nica/Solicitud%20Usuario%20Administrador%20de%20e-CF.pdf`
4. Firmado de e-CF: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Instructivos%20sobre%20Facturaci%C3%B3n%20Electr%C3%B3nica/Firmado%20de%20e-CF.pdf`
5. Instructivo App Firma Digital: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Instructivos%20sobre%20Facturaci%C3%B3n%20Electr%C3%B3nica/Instructivo%20App%20Firma%20Digital.pdf`
6. Instructivo Delegaciones de Roles de Facturacion Electronica: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Instructivos%20sobre%20Facturaci%C3%B3n%20Electr%C3%B3nica/Instructivo%20Delegaciones%20de%20Roles%20de%20Facturaci%C3%B3n%20Electr%C3%B3nica.pdf`
7. Instructivo de Contingencia FE: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Instructivos%20sobre%20Facturaci%C3%B3n%20Electr%C3%B3nica/Instructivo-Contingencia-FE.pdf`
8. Instructivo del Facturador Gratuito: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Instructivos%20sobre%20Facturaci%C3%B3n%20Electr%C3%B3nica/Instructivo-Facturador-Gratuito-de-FE.pdf`
9. Paso a paso del Facturador Gratuito: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Facturador%20Gratuito/Paso-Paso-Facturador-Gratuito.pdf`
10. Guia basica para ser Emisor Electronico: `https://dgii.gov.do/publicacionesOficiales/bibliotecaVirtual/contribuyentes/facturacion/Documents/Facturaci%C3%B3n%20Electr%C3%B3nica/Guia-Basica-para-ser-Emisor-Electronico.pdf`
11. Guia basica para ser Proveedor de Facturacion Electronica: `https://dgii.gov.do/publicacionesOficiales/bibliotecaVirtual/contribuyentes/facturacion/Documents/Facturaci%C3%B3n%20Electr%C3%B3nica/Guia-Basica-Proveedor-de-Servicios-de-Facturacion-Electronica.pdf`

### 5. Documentacion tecnica oficial que el equipo de desarrollo debe usar

1. Descripcion tecnica de facturacion electronica: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Informe%20y%20Descripci%C3%B3n%20T%C3%A9cnica/Descripcion-tecnica-de-facturacion-electronica.pdf`
2. Informe Tecnico e-CF v1.0: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Informe%20y%20Descripci%C3%B3n%20T%C3%A9cnica/Informe%20T%C3%A9cnico%20e-CF%20v1.0.pdf`
3. Representacion Impresa modelos ilustrativos: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Informe%20y%20Descripci%C3%B3n%20T%C3%A9cnica/Representaci%C3%B3n%20Impresa%20(Modelos%20ilustrativos).pdf`
4. Formato Comprobante Fiscal Electronico e-CF v1.0: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Formatos%20XML/Formato%20Comprobante%20Fiscal%20Electr%C3%B3nico%20(e-CF)%20V1.0.pdf`
5. Formato Acuse de Recibo v1.0: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Formatos%20XML/Formato%20Acuse%20de%20Recibo%20v%201.0.pdf`
6. Formato Aprobacion Comercial v1.0: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Formatos%20XML/Formato%20Aprobaci%C3%B3n%20Comercial%20v1.0.pdf`
7. Formato Anulacion de e-NCF v1.0: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Formatos%20XML/Formato%20Anulaci%C3%B3n%20de%20e-NCF%20v1.0.pdf`
8. Formato Resumen Factura Consumo Electronica v1.0: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Formatos%20XML/Formato%20Resumen%20Factura%20Consumo%20Electr%C3%B3nica%20v1.0.pdf`

### 6. XSD oficiales mas utiles para implementacion inicial

1. e-CF 31 v1.0: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Documentaci%C3%B3n%20T%C3%A9cnica%20(XSD)/e-CF%2031%20v.1.0.xsd`
2. e-CF 32 v1.0: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Documentaci%C3%B3n%20T%C3%A9cnica%20(XSD)/e-CF%2032%20v.1.0.xsd`
3. e-CF 33 v1.0: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Documentaci%C3%B3n%20T%C3%A9cnica%20(XSD)/e-CF%2033%20v.1.0.xsd`
4. e-CF 34 v1.0: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Documentaci%C3%B3n%20T%C3%A9cnica%20(XSD)/e-CF%2034%20v.1.0.xsd`
5. RFCE 32 v1.0: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Documentaci%C3%B3n%20T%C3%A9cnica%20(XSD)/RFCE%2032%20v.1.0.xsd`
6. ARECF v1.0: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Documentaci%C3%B3n%20T%C3%A9cnica%20(XSD)/ARECF%20v1.0.xsd`
7. ACECF v1.0: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Documentaci%C3%B3n%20T%C3%A9cnica%20(XSD)/ACECF%20v.1.0.xsd`
8. ANECF v1.0: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Documentaci%C3%B3n%20T%C3%A9cnica%20(XSD)/ANECF%20v.1.0.xsd`
9. Semilla v1.0: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Documentaci%C3%B3n%20T%C3%A9cnica%20(XSD)/Semilla%20v.1.0.xsd`

### 7. Endpoints base de autenticacion DGII por ambiente

1. TesteCF autenticacion base: `https://ecf.dgii.gov.do/testecf/autenticacion`
2. CerteCF autenticacion base: `https://ecf.dgii.gov.do/certecf/autenticacion`
3. eCF produccion autenticacion base: `https://ecf.dgii.gov.do/ecf/autenticacion`

### 8. Endpoints directos de semilla y validacion de semilla

1. Obtener semilla en TesteCF: `https://ecf.dgii.gov.do/testecf/autenticacion/api/autenticacion/semilla`
2. Validar semilla firmada en TesteCF: `https://ecf.dgii.gov.do/testecf/autenticacion/api/autenticacion/validarsemilla`
3. Obtener semilla en CerteCF: `https://ecf.dgii.gov.do/certecf/autenticacion/api/autenticacion/semilla`
4. Validar semilla firmada en CerteCF: `https://ecf.dgii.gov.do/certecf/autenticacion/api/autenticacion/validarsemilla`
5. Obtener semilla en Produccion: `https://ecf.dgii.gov.do/ecf/autenticacion/api/autenticacion/semilla`
6. Validar semilla firmada en Produccion: `https://ecf.dgii.gov.do/ecf/autenticacion/api/autenticacion/validarsemilla`

### 9. Paginas de ayuda tecnica por ambiente

Estas paginas suelen ser utiles para revisar la ayuda tecnica del servicio segun el ambiente activo.

1. Ayuda tecnica de autenticacion en TesteCF: `https://ecf.dgii.gov.do/testecf/autenticacion/help`
2. Ayuda tecnica de autenticacion en CerteCF: `https://ecf.dgii.gov.do/certecf/autenticacion/help`
3. Ayuda tecnica de autenticacion en Produccion: `https://ecf.dgii.gov.do/ecf/autenticacion/help`

### 10. Consulta y verificacion publica

1. Consulta de NCF y e-NCF: `https://dgii.gov.do/herramientas/consultas/Paginas/NCF-.aspx`
2. Paso a paso para consultar NCF y e-NCF: `https://dgii.gov.do/publicacionesOficiales/bibliotecaVirtual/contribuyentes/facturacion/Documents/Facturaci%C3%B3n%20Electr%C3%B3nica/Paso-a-paso-para-consultar-NCF-y-E-NCF.pdf`

### 11. Marco legal util para soporte y defensa regulatoria

1. Marco legal de Facturacion Electronica: `https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Paginas/marcoLegal.aspx`
2. Ley 32-23: `https://dgii.gov.do/legislacion/leyesTributarias/Documents/Otras%20Leyes%20de%20Inter%c3%a9s/32-23.pdf`
3. Norma General 01-20: `https://dgii.gov.do/legislacion/normasGenerales/Documents/NG%20sobre%20Comprobantes%20Fiscales/Norma01-20.pdf?csf=1&e=fwLyFX`
4. Norma General 06-18: `https://dgii.gov.do/legislacion/normasGenerales/Documents/NG%20sobre%20Comprobantes%20Fiscales/Norma06-18.pdf`
5. Norma General 10-21: `https://dgii.gov.do/legislacion/normasGenerales/Documents/NG%20sobre%20Comprobantes%20Fiscales/Norma10-21.pdf#search=10-2021`
6. Decreto 587-24: `https://dgii.gov.do/legislacion/decretos/Documents/2024/Decreto587-24.pdf`

### 12. Correos y puntos de contacto utiles

1. Correo general DGII: `informacion@dgii.gov.do`
2. Correo util para casos de roles y validaciones operativas de FE: `facturacionelectronica@dgii.gov.do`
3. Centro de Contacto DGII: `(809) 689-3444`
4. Contacto directo FE citado en Facturador Gratuito: `(809) 287-2009`

### 13. Enlaces tecnicos de base open source recomendada

1. Libreria principal `dgii-ecf` para Node.js: `https://github.com/victors1681/dgii-ecf`
2. Paquete npm `dgii-ecf`: `https://www.npmjs.com/package/dgii-ecf`
3. Port a CodeIgniter 4: `https://github.com/jose53691212/apidgiicodeigniter4`

### 14. Enlaces que conviene tener fijados en el navegador el dia de certificacion

1. Oficina Virtual DGII.
2. Portal principal de Facturacion Electronica DGII.
3. Documentacion sobre e-CF.
4. PDF de Proceso de Certificacion para ser Emisor Electronico.
5. PDF de Solicitud Usuario Administrador de e-CF.
6. PDF de Descripcion Tecnica de Facturacion Electronica.
7. Ayuda tecnica de autenticacion del ambiente que se este usando.
8. Endpoint de semilla del ambiente actual.
9. Endpoint de validacion de semilla del ambiente actual.
10. Consulta publica de NCF y e-NCF.

### 15. Recomendacion practica de uso

Crear tres carpetas de favoritos en el navegador:

1. `Cliente y DGII`
2. `Certificacion y PDFs`
3. `Endpoints Tecnicos`

Eso evita perder tiempo el dia en que el cliente empiece a llenar OFV o cuando el equipo de desarrollo este probando la autenticacion, la semilla, la firma y la consulta de resultados.

## Nota Final para el Cliente

La empresa no esta cambiando solo de `NCF` a `e-NCF` como si fuera un cambio de prefijo. Esta entrando a un nuevo modelo operativo de facturacion electronica controlado por DGII.

Si el proceso se ejecuta con orden, el sistema se prepara correctamente y la empresa pasa la certificacion, entonces si podra facturar legalmente con e-NCF.
