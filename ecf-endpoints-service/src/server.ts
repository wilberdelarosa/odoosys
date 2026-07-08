import 'dotenv/config';

import crypto from 'node:crypto';
import express, { Request } from 'express';
import forge from 'node-forge';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import CustomAuthentication from './lib/custom-authentication.js';
import P12Reader from './lib/p12-reader.js';
import Signature from './lib/signature.js';
import { ReceivedStatus, SenderReceiver } from './lib/sender-receiver.js';
import { configureAudit, readRecentAudit, recordAudit } from './lib/audit.js';
import {
  AppData,
  buildCommercialApprovalXml,
  buildEcfXml,
  changeLocalUserPassword,
  createFiscalSequence,
  createDefaultData,
  createId,
  createInvoice,
  createSaleOrder,
  authenticateLocalUser,
  Customer,
  confirmSaleOrder,
  getAccountingSummary,
  getInventorySummary,
  getInvoiceBalance,
  getInvoiceCustomer,
  getInvoicePaidAmount,
  getInvoicePaymentStatus,
  getInvoicePayments,
  invoiceSaleOrder,
  Invoice,
  issueInvoice,
  issueInvoiceWithEncf,
  LocalUser,
  Product,
  recordInventoryMovement,
  recordPayment,
  sanitizeLocalUser,
  updateFiscalSequence,
  UserRole,
  validateCompanyReadiness,
} from './lib/facturador.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

app.use(express.json());
app.use((req, res, next) => {
  const allowedOrigin = getAllowedCorsOrigin(req.headers.origin);
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
app.use(
  express.text({
    type: ['application/xml', 'text/xml', 'text/plain'],
    limit: '10mb',
  })
);

const projectRoot = path.resolve(__dirname, '..');
const storageRoot = path.resolve(
  process.env.STORAGE_ROOT || path.resolve(projectRoot, 'storage')
);
const incomingRoot = path.resolve(storageRoot, 'incoming');
const outgoingRoot = path.resolve(storageRoot, 'outgoing');
const backupRoot = path.resolve(storageRoot, 'backups');
const dataFile = path.resolve(storageRoot, 'facturador-data.json');
const authSecretFile = path.resolve(storageRoot, 'local-auth-secret.txt');
const publicRoot = path.resolve(projectRoot, 'public');

const config = {
  port: Number(process.env.PORT || '3000'),
  host: process.env.HOST || '',
  publicBaseUrl: normalizeBaseUrl(
    process.env.PUBLIC_BASE_URL || 'http://localhost:3000'
  ),
  softwareName: process.env.SOFTWARE_NAME || 'Mi ECF Service',
  softwareVersion: process.env.SOFTWARE_VERSION || '1.0.0',
  buyerRnc: process.env.BUYER_RNC || '101010101',
  certPath: process.env.CERT_PATH || '',
  certPassword: process.env.CERT_PASSWORD || '',
  generateDemoCert: (process.env.GENERATE_DEMO_CERT || 'true') === 'true',
  demoCertPath:
    process.env.DEMO_CERT_PATH || path.resolve(storageRoot, 'demo-certificate.p12'),
  demoCertPassword: process.env.DEMO_CERT_PASSWORD || 'demo123',
  authEnabled: (process.env.AUTH_ENABLED || 'true') === 'true',
  authTokenHours: Number(process.env.AUTH_TOKEN_HOURS || '12'),
};

const endpointPaths = {
  seed: '/fe/autenticacion/api/semilla',
  validateSeed: '/fe/autenticacion/api/validacioncertificado',
  receiveInvoice: '/fe/recepcion/api/ecf',
  commercialApproval: '/fe/aprobacioncomercial/api/ecf',
};

async function bootstrap() {
  await ensureDirectory(storageRoot);
  await ensureDirectory(incomingRoot);
  await ensureDirectory(outgoingRoot);
  await ensureDirectory(backupRoot);
  configureAudit(storageRoot);
  const appData = await loadAppData();
  latestAppDataSnapshot = appData;
  const authSecret = await loadOrCreateAuthSecret();

  const certificate = await loadCertificate();
  const customAuthentication = new CustomAuthentication(certificate);
  const senderReceiver = new SenderReceiver();
  const signature = new Signature(certificate.key!, certificate.cert!);

  app.use(express.static(publicRoot));

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      software: config.softwareName,
      version: config.softwareVersion,
      buyerRnc: config.buyerRnc,
      publicBaseUrl: config.publicBaseUrl,
      authEnabled: config.authEnabled,
    });
  });

  app.post('/api/auth/login', async (req, res, next) => {
    try {
      const user = authenticateLocalUser(appData, req.body || {});
      await saveAppData(appData);
      res.json({
        ok: true,
        token: signLocalSession(authSecret, user),
        user: sanitizeLocalUser(user),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/auth/me', requireAuth('visor'), (req, res) => {
    res.json({
      ok: true,
      user: getRequestUser(req),
    });
  });

  app.post('/api/auth/change-password', requireAuth('visor'), async (req, res, next) => {
    try {
      const requestUser = getRequestUser(req);
      const user = changeLocalUserPassword(appData, requestUser.id, req.body || {});
      await saveAppData(appData);
      res.json({
        ok: true,
        user: sanitizeLocalUser(user),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/runtime/status', requireAuth('admin'), (_req, res) => {
    const memory = process.memoryUsage();
    res.json({
      ok: true,
      runtime: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        uptimeSeconds: Math.round(process.uptime()),
      },
      memory: {
        rssMb: toMegabytes(memory.rss),
        heapTotalMb: toMegabytes(memory.heapTotal),
        heapUsedMb: toMegabytes(memory.heapUsed),
        externalMb: toMegabytes(memory.external),
        arrayBuffersMb: toMegabytes(memory.arrayBuffers),
      },
      mode: {
        dockerRequired: false,
        odooRequired: false,
        postgresRequired: false,
        storage: 'local-json-files',
        storageRoot,
      },
    });
  });

  app.get('/software-config', requireAuth('admin'), (_req, res) => {
    res.json(buildSoftwareConfig());
  });

  app.get('/api/audit', requireAuth('admin'), (req, res) => {
    const limit = Number(req.query.limit || '100');
    const event = typeof req.query.event === 'string' ? req.query.event : undefined;
    res.json({
      ok: true,
      events: readRecentAudit({
        limit: Number.isFinite(limit) ? limit : 100,
        event,
      }),
    });
  });

  app.get('/api/certificate/status', requireAuth('admin'), (_req, res) => {
    const configuredPath = config.certPath || config.demoCertPath;
    const usingDemoCertificate = !config.certPath || config.generateDemoCert;

    res.json({
      ok: Boolean(certificate.key && certificate.cert),
      mode: usingDemoCertificate ? 'demo' : 'configured',
      certificateFile: configuredPath ? path.basename(configuredPath) : null,
      generateDemoCert: config.generateDemoCert,
      publicBaseUrl: config.publicBaseUrl,
      httpsReady: config.publicBaseUrl.startsWith('https://'),
      requiredFiles: [
        {
          name: 'Certificado digital tributario',
          format: '.p12',
          requiredFor: 'TesteCF, CerteCF y eCF real',
          env: 'CERT_PATH',
        },
        {
          name: 'Clave del certificado',
          format: 'texto secreto',
          requiredFor: 'leer y firmar con el .p12',
          env: 'CERT_PASSWORD',
        },
      ],
      warnings: [
        usingDemoCertificate
          ? 'El gateway esta usando certificado demo. Sirve para pruebas locales, no para DGII real.'
          : null,
        config.publicBaseUrl.startsWith('https://')
          ? null
          : 'PUBLIC_BASE_URL no usa HTTPS. DGII requiere URL publica HTTPS estable para certificacion/produccion.',
      ].filter(Boolean),
    });
  });

  app.get('/api/testlab/required-files', requireAuth('admin'), (_req, res) => {
    res.json({
      ok: true,
      files: [
        {
          name: 'certificado.p12',
          description: 'Certificado digital para procedimiento tributario emitido para el contribuyente o firmante autorizado.',
          whereToPlace: 'Servidor del gateway, por ejemplo /app/storage/certificados/certificado.p12',
          env: 'CERT_PATH=/app/storage/certificados/certificado.p12',
        },
        {
          name: 'clave del .p12',
          description: 'Contrasena privada entregada con el certificado. No se debe enviar por chat ni subir al repositorio.',
          whereToPlace: 'Variable de entorno segura del gateway.',
          env: 'CERT_PASSWORD=********',
        },
        {
          name: 'URL HTTPS publica',
          description: 'Dominio estable para recepcion, aprobacion comercial y autenticacion durante certificacion DGII.',
          whereToPlace: 'DNS/proxy del servidor publico.',
          env: 'PUBLIC_BASE_URL=https://dgii.tudominio.com',
        },
      ],
      safeLocalMode: {
        generateDemoCert: 'GENERATE_DEMO_CERT=true',
        demoPassword: 'DEMO_CERT_PASSWORD=demo123',
      },
    });
  });

  app.get('/', (_req, res) => {
    res.sendFile(path.resolve(publicRoot, 'index.html'));
  });

  app.get('/api/dashboard', requireAuth('visor'), (_req, res) => {
    const totals = appData.invoices.reduce(
      (acc, invoice) => {
        acc.invoices += 1;
        acc.amount += invoice.totals.total;
        acc.paid += getInvoicePaidAmount(appData, invoice);
        acc.receivable += getInvoiceBalance(appData, invoice);
        if (invoice.fiscalStatus === 'precertificacion_ok') {
          acc.ready += 1;
        }
        return acc;
      },
      { invoices: 0, amount: 0, paid: 0, receivable: 0, ready: 0 }
    );

    res.json({
      company: appData.company,
      fiscalSequences: appData.fiscalSequences,
      customers: appData.customers,
      products: appData.products,
      invoices: appData.invoices.map((invoice) => enrichInvoice(appData, invoice)),
      payments: appData.payments,
      saleOrders: appData.saleOrders,
      inventory: getInventorySummary(appData),
      accounting: getAccountingSummary(appData),
      totals,
      software: buildSoftwareConfig(),
      readiness: validateCompanyReadiness(appData),
    });
  });

  app.post('/api/presets/load', requireAuth('admin'), async (req, res, next) => {
    try {
      const presetKey = String(req.body?.preset || 'default');
      
      const presets: Record<string, { company: any; customers: any[]; products: any[] }> = {
        supermarket: {
          company: {
            rnc: '101010101',
            razonSocial: 'SUPERMERCADO NACIONAL DEL POLLO SRL',
            nombreComercial: 'SUPERMERCADO NACIONAL DEL POLLO',
            direccion: 'Av. Winston Churchill #45, Distrito Nacional',
            provincia: 'Distrito Nacional',
            municipio: 'Santo Domingo de Guzman',
            correo: 'facturacion@nacionaldelpollo.test',
            telefono: '8095551212',
            softwareName: 'Mi ECF Service',
            softwareVersion: '1.0.0',
            nextSequence: 1,
          },
          customers: [
            {
              id: 'cliente-retail',
              rnc: '224000137',
              razonSocial: 'JOSE RAMON COMPRADOR',
              correo: 'jose.ramon@gmail.com',
              direccion: 'Calle Principal 10, Santo Domingo',
            },
            {
              id: 'cliente-institucional',
              rnc: '130862346',
              razonSocial: 'ALIMENTOS Y HOTELES DEL CARIBE SRL',
              correo: 'compras@alimentoscaribe.test',
              direccion: 'Av. George Washington #150, Distrito Nacional',
            }
          ],
          products: [
            {
              id: 'arroz-premium',
              nombre: 'Saco de Arroz Premium 10lb',
              descripcion: 'Saco de Arroz Granulado de Calidad Premium',
              precio: 350,
              itbisRate: 0.18,
            },
            {
              id: 'aceite-cocina',
              nombre: 'Aceite de Cocina 1 Galón',
              descripcion: 'Aceite de Soya Refinado de 1 Galón',
              precio: 650,
              itbisRate: 0.18,
            },
            {
              id: 'huevos-frescos',
              nombre: 'Caja de Huevos Frescos 30 uds',
              descripcion: 'Caja de Huevos de Granja',
              precio: 180,
              itbisRate: 0,
            },
            {
              id: 'pollo-libra',
              nombre: 'Pollo Entero Fresco por Libra',
              descripcion: 'Pollo Fresco Procesado Al Instante',
              precio: 85,
              itbisRate: 0,
            }
          ]
        },
        hardware: {
          company: {
            rnc: '131102931',
            razonSocial: 'CONSTRUCTORA Y FERRETERA EL MARTILLO SRL',
            nombreComercial: 'FERRETERIA EL MARTILLO',
            direccion: 'Av. Luperón #88, Santo Domingo Oeste',
            provincia: 'Distrito Nacional',
            municipio: 'Santo Domingo de Guzman',
            correo: 'ventas@ferreteriamartillo.test',
            telefono: '8096203030',
            softwareName: 'Mi ECF Service',
            softwareVersion: '1.0.0',
            nextSequence: 1,
          },
          customers: [
            {
              id: 'cliente-ing',
              rnc: '130862346',
              razonSocial: 'INGENIERIA Y DISEÑO CONSTRUCTIVO SRL',
              correo: 'contacto@ingdiseno.test',
              direccion: 'Calle Los Constructores #4, Santo Domingo',
            },
            {
              id: 'cliente-log',
              rnc: '101010101',
              razonSocial: 'LOGISTICA Y GRUAS RD SRL',
              correo: 'operaciones@logrd.test',
              direccion: 'Autopista Duarte Km 14, Santo Domingo',
            }
          ],
          products: [
            {
              id: 'cemento-fund',
              nombre: 'Funda de Cemento Gris Portland',
              descripcion: 'Funda de Cemento Estructural Gris Portland de 42.5kg',
              precio: 480,
              itbisRate: 0.18,
            },
            {
              id: 'varilla-ac',
              nombre: 'Varilla de Acero Estructura 3/8',
              descripcion: 'Varilla de Acero de Construcción Estructural',
              precio: 520,
              itbisRate: 0.18,
            },
            {
              id: 'arena-rio',
              nombre: 'Metro Cúbico de Arena de Río',
              descripcion: 'Arena de Río Colada para Limpieza de Mezcla',
              precio: 1800,
              itbisRate: 0.18,
            },
            {
              id: 'pintura-acr',
              nombre: 'Cangilón de Pintura Acrílica Blanca',
              descripcion: 'Sorbete de 5 Galones Pintura Acrílica Lavable',
              precio: 3200,
              itbisRate: 0.18,
            }
          ]
        },
        logistics: {
          company: {
            rnc: '133182664',
            razonSocial: 'LOGISTICA Y OPERACIONES INDUSTRIALES RD SRL',
            nombreComercial: 'OPERACIONES LOGISTICAS RD',
            direccion: 'Autopista Duarte Km 22, Parque Industrial, Hato Nuevo',
            provincia: 'Santo Domingo',
            municipio: 'Santo Domingo Oeste',
            correo: 'billing@logrd.test',
            telefono: '8093339999',
            softwareName: 'Mi ECF Service',
            softwareVersion: '1.0.0',
            nextSequence: 1,
          },
          customers: [
            {
              id: 'cliente-zf',
              rnc: '101010101',
              razonSocial: 'ZONA FRANCA AMERICAS CORP S.A.',
              correo: 'importexport@zfamericas.test',
              direccion: 'Autopista Las Américas Km 20, Santo Domingo',
            },
            {
              id: 'cliente-puer',
              rnc: '130862346',
              razonSocial: 'PUERTO DE SANSON DIRECTO SRL',
              correo: 'operaciones@sansondirecto.test',
              direccion: 'Av. España, Terminal Sansouci, Santo Domingo',
            }
          ],
          products: [
            {
              id: 'montacargas-ho',
              nombre: 'Servicio de Montacargas por Hora',
              descripcion: 'Operación con Operador y Montacargas de 5 Toneladas',
              precio: 4500,
              itbisRate: 0.18,
            },
            {
              id: 'flete-ter',
              nombre: 'Flete Terrestre Contenedor 40pp',
              descripcion: 'Flete Terrestre Contenedor de 40 pies a Nivel Nacional',
              precio: 12000,
              itbisRate: 0.18,
            },
            {
              id: 'almacen-pal',
              nombre: 'Almacenaje de Palets por Mes',
              descripcion: 'Almacenaje Seguro de Palets Estándar en Bodega Climatizada',
              precio: 1500,
              itbisRate: 0.18,
            },
            {
              id: 'cubicaje-qr',
              nombre: 'Servicio de Cubicaje y Escaneo QR',
              descripcion: 'Validación de Inventario y Tracking mediante QR integrado',
              precio: 800,
              itbisRate: 0.18,
            }
          ]
        },
        delivery: {
          company: {
            rnc: '131892113',
            razonSocial: 'FAST BITES PIZZA SRL (PIZZA HUT DEMO)',
            nombreComercial: 'PIZZA HUT DEMO RD',
            direccion: 'Av. Gustavo Mejía Ricart #22, Piantini',
            provincia: 'Distrito Nacional',
            municipio: 'Santo Domingo de Guzman',
            correo: 'delivery@pizzahutdemo.test',
            telefono: '8098884444',
            softwareName: 'Mi ECF Service',
            softwareVersion: '1.0.0',
            nextSequence: 1,
          },
          customers: [
            {
              id: 'cliente-pya',
              rnc: '130862346',
              razonSocial: 'PEDIDOS YA DOMINICANA SRL',
              correo: 'comprobantes@pedidosya.com.do',
              direccion: 'Av. Maximo Gomez #45, Distrito Nacional',
            },
            {
              id: 'cliente-individual',
              rnc: '224000137',
              razonSocial: 'CONSUMIDOR FINAL INDIVIDUAL',
              correo: 'consumidor.final@gmail.com',
              direccion: 'Entrega a Domicilio, Santo Domingo',
            }
          ],
          products: [
            {
              id: 'pizza-pepp',
              nombre: 'Pizza Familiar Pepperoni Suprema',
              descripcion: 'Pizza Familiar de Pepperoni con Borde de Queso',
              precio: 890,
              itbisRate: 0.18,
            },
            {
              id: 'refresco-cola',
              nombre: 'Refresco de Cola 2 Litros',
              descripcion: 'Bebida de Cola de 2 Litros Gigante',
              precio: 120,
              itbisRate: 0.18,
            },
            {
              id: 'alitas-12',
              nombre: 'Alitas Crujientes 12 unidades',
              descripcion: 'Alitas Estilo Buffalo o BBQ Crujientes',
              precio: 450,
              itbisRate: 0.18,
            },
            {
              id: 'delivery-fee',
              nombre: 'Servicio de Delivery / Entrega Rápida',
              descripcion: 'Servicio Premium Express de Entrega de Pedidos',
              precio: 110,
              itbisRate: 0.18,
            }
          ]
        },
        tourism: {
          company: {
            rnc: '132890123',
            razonSocial: 'EXCURSIONES Y TURISMO CARIBEÑO SRL',
            nombreComercial: 'CARIBBEAN EXCURSIONS',
            direccion: 'Av. Alemania #4, Plaza El Dorado, Bávaro, Punta Cana',
            provincia: 'La Altagracia',
            municipio: 'Higüey',
            correo: 'booking@caribbeanexcursions.test',
            telefono: '8095521010',
            softwareName: 'Mi ECF Service',
            softwareVersion: '1.0.0',
            nextSequence: 1,
          },
          customers: [
            {
              id: 'cliente-hotel',
              rnc: '101010101',
              razonSocial: 'HOTEL SOL Y CORAL PUNTA CANA SRL',
              correo: 'purchasing@solycoral.test',
              direccion: 'Bulevar Turístico del Este Km 12, Punta Cana',
            },
            {
              id: 'cliente-turist',
              rnc: '224000137',
              razonSocial: 'TURISTA NACIONAL PARTICULAR',
              correo: 'turista@gmail.com',
              direccion: 'Playa El Cortecito, Bávaro',
            }
          ],
          products: [
            {
              id: 'saona-t',
              nombre: 'Excursión Todo un Día a Isla Saona',
              descripcion: 'Excursión con Transporte en Catamarán, Comida y Bebidas incl.',
              precio: 3900,
              itbisRate: 0.18,
            },
            {
              id: 'trans-priv',
              nombre: 'Transfer Privado Aeropuerto-Hotel',
              descripcion: 'Traslado Terrestre Privado Aeropuerto Punta Cana en Minivan',
              precio: 2500,
              itbisRate: 0.18,
            },
            {
              id: 'buceo-guia',
              nombre: 'Paquete de Buceo con Guía Bilingüe',
              descripcion: 'Certificación PADI, Inmersión de 2 Horas en arrecife coralino',
              precio: 5500,
              itbisRate: 0.18,
            },
            {
              id: 'city-tour',
              nombre: 'City Tour Santo Domingo Zona Colonial',
              descripcion: 'Recorrido Histórico por la Primera Ciudad de América',
              precio: 1400,
              itbisRate: 0.18,
            }
          ]
        },
        furniture: {
          company: {
            rnc: '130777123',
            razonSocial: 'ELEGANCIA EN MADERA Y MUEBLES SRL',
            nombreComercial: 'MUEBLERIA ELEGANCIA',
            direccion: 'Av. 27 de Febrero #204, Distrito Nacional',
            provincia: 'Distrito Nacional',
            municipio: 'Santo Domingo de Guzman',
            correo: 'cobros@muebleriaelegancia.test',
            telefono: '8095647788',
            softwareName: 'Mi ECF Service',
            softwareVersion: '1.0.0',
            nextSequence: 1,
          },
          customers: [
            {
              id: 'cliente-ofic',
              rnc: '130862346',
              razonSocial: 'OFICINAS Y SEGUROS GENERALES SA',
              correo: 'compras@segurosgenerales.test',
              direccion: 'Av. Winston Churchill Esq. Sarasota, Distrito Nacional',
            },
            {
              id: 'cliente-casa',
              rnc: '224000137',
              razonSocial: 'COMPRADOR DE HOGAR INDIVIDUAL',
              correo: 'muebles.hogar@gmail.com',
              direccion: 'Residencial Palmeras, Santo Domingo Este',
            }
          ],
          products: [
            {
              id: 'comedor-caob',
              nombre: 'Mesa de Comedor en Caoba 6 Sillas',
              descripcion: 'Mesa de Comedor Hecha en Caoba Dominicana Tallada a Mano',
              precio: 45000,
              itbisRate: 0.18,
            },
            {
              id: 'escritorio-ej',
              nombre: 'Escritorio Ejecutivo Moderno',
              descripcion: 'Escritorio Ejecutivo Minimalista con Acabado en Roble',
              precio: 12500,
              itbisRate: 0.18,
            },
            {
              id: 'sofa-premium',
              nombre: 'Sofá Modular Premium de Piel',
              descripcion: 'Sofá Modular de 3 Cuerpos en Piel Italiana Premium',
              precio: 32000,
              itbisRate: 0.18,
            },
            {
              id: 'estante-pino',
              nombre: 'Estante de Libros en Madera de Pino',
              descripcion: 'Librero Organizador en Madera de Pino Tratada',
              precio: 8500,
              itbisRate: 0.18,
            }
          ]
        }
      };

      const selected = presets[presetKey];
      if (selected) {
        appData.company = { ...appData.company, ...selected.company };
        appData.customers = [...selected.customers];
        appData.products = selected.products.map((product) => ({
          ...product,
          trackInventory: Boolean(product.trackInventory),
          stockOnHand: Number(product.stockOnHand || 0),
          reorderPoint: Number(product.reorderPoint || 0),
        }));
        appData.invoices = []; // Reset canvas para mejor ambiente de pruebas
        appData.payments = [];
        appData.inventoryMovements = [];
        appData.saleOrders = [];
        appData.journalEntries = [];
        
        recordAudit({
          event: 'preset_loaded',
          outcome: 'ok',
          message: `Consola de Simulación adaptada al Nicho Sectorial: ${presetKey.toUpperCase()}`,
          source: 'local-ui'
        });

        await saveAppData(appData);
        res.json({ ok: true, message: `Preset ${presetKey} cargado exitosamente.` });
      } else {
        res.status(400).json({ error: 'Nicho sectorial no reconocido' });
      }
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/company', requireAuth('admin'), async (req, res, next) => {
    try {
      Object.assign(appData.company, req.body || {});
      await saveAppData(appData);
      res.json(appData.company);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/fiscal-sequences', requireAuth('visor'), (_req, res) => {
    res.json({
      ok: true,
      fiscalSequences: appData.fiscalSequences,
    });
  });

  app.post('/api/fiscal-sequences', requireAuth('admin'), async (req, res, next) => {
    try {
      const sequence = createFiscalSequence(appData, req.body || {});
      await saveAppData(appData);
      res.status(201).json(sequence);
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/fiscal-sequences/:id', requireAuth('admin'), async (req, res, next) => {
    try {
      const sequence = updateFiscalSequence(appData, String(req.params.id), req.body || {});
      await saveAppData(appData);
      res.json(sequence);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/customers', requireAuth('visor'), (_req, res) => {
    res.json({
      ok: true,
      customers: appData.customers,
    });
  });

  app.post('/api/customers', requireAuth('operador'), async (req, res, next) => {
    try {
      validateCustomerPayload(req.body || {});
      const customer: Customer = {
        id: createId('cliente'),
        rnc: String(req.body?.rnc || ''),
        razonSocial: String(req.body?.razonSocial || ''),
        correo: String(req.body?.correo || ''),
        direccion: String(req.body?.direccion || ''),
      };
      appData.customers.unshift(customer);
      await saveAppData(appData);
      res.status(201).json(customer);
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/customers/:id', requireAuth('operador'), async (req, res, next) => {
    try {
      const customer = appData.customers.find((item) => item.id === req.params.id);
      if (!customer) {
        throw new Error('Cliente no encontrado');
      }
      validateCustomerPayload({ ...customer, ...(req.body || {}) });
      customer.rnc = String(req.body?.rnc ?? customer.rnc);
      customer.razonSocial = String(req.body?.razonSocial ?? customer.razonSocial);
      customer.correo = String(req.body?.correo ?? customer.correo);
      customer.direccion = String(req.body?.direccion ?? customer.direccion);
      await saveAppData(appData);
      res.json(customer);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/products', requireAuth('visor'), (_req, res) => {
    res.json({
      ok: true,
      products: appData.products,
    });
  });

  app.post('/api/products', requireAuth('operador'), async (req, res, next) => {
    try {
      validateProductPayload(req.body || {});
      const product: Product = {
        id: createId('producto'),
        sku: req.body?.sku ? String(req.body.sku) : undefined,
        nombre: String(req.body?.nombre || ''),
        descripcion: String(req.body?.descripcion || req.body?.nombre || ''),
        precio: Number(req.body?.precio || 0),
        itbisRate: Number(req.body?.itbisRate ?? 0.18),
        trackInventory: Boolean(req.body?.trackInventory),
        stockOnHand: Number(req.body?.stockOnHand || 0),
        reorderPoint: Number(req.body?.reorderPoint || 0),
      };
      appData.products.unshift(product);
      await saveAppData(appData);
      res.status(201).json(product);
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/products/:id', requireAuth('operador'), async (req, res, next) => {
    try {
      const product = appData.products.find((item) => item.id === req.params.id);
      if (!product) {
        throw new Error('Producto no encontrado');
      }
      validateProductPayload({ ...product, ...(req.body || {}) });
      product.sku = req.body?.sku !== undefined ? String(req.body.sku) : product.sku;
      product.nombre = String(req.body?.nombre ?? product.nombre);
      product.descripcion = String(
        req.body?.descripcion ?? product.descripcion ?? product.nombre
      );
      product.precio = Number(req.body?.precio ?? product.precio);
      product.itbisRate = Number(req.body?.itbisRate ?? product.itbisRate);
      product.trackInventory = Boolean(req.body?.trackInventory ?? product.trackInventory);
      product.stockOnHand = Number(req.body?.stockOnHand ?? product.stockOnHand ?? 0);
      product.reorderPoint = Number(req.body?.reorderPoint ?? product.reorderPoint ?? 0);
      await saveAppData(appData);
      res.json(product);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/inventory', requireAuth('visor'), (_req, res) => {
    res.json({
      ok: true,
      inventory: getInventorySummary(appData),
      movements: appData.inventoryMovements,
    });
  });

  app.post('/api/inventory/movements', requireAuth('operador'), async (req, res, next) => {
    try {
      const movement = recordInventoryMovement(appData, req.body || {});
      await saveAppData(appData);
      recordAudit({
        event: 'inventory_movement',
        outcome: 'ok',
        source: 'local-ui',
        message: movement.reason,
        detail: {
          productId: movement.productId,
          type: movement.type,
          quantity: movement.quantity,
          referenceId: movement.referenceId,
        },
      });
      res.status(201).json({
        ok: true,
        movement,
        inventory: getInventorySummary(appData),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/sale-orders', requireAuth('visor'), (_req, res) => {
    res.json({
      ok: true,
      saleOrders: appData.saleOrders.map((saleOrder) =>
        enrichSaleOrder(appData, saleOrder)
      ),
    });
  });

  app.post('/api/sale-orders', requireAuth('operador'), async (req, res, next) => {
    try {
      const saleOrder = createSaleOrder(appData, req.body || {});
      await saveAppData(appData);
      res.status(201).json(enrichSaleOrder(appData, saleOrder));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/sale-orders/:id/confirm', requireAuth('operador'), async (req, res, next) => {
    try {
      const saleOrder = confirmSaleOrder(appData, String(req.params.id));
      await saveAppData(appData);
      res.json(enrichSaleOrder(appData, saleOrder));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/sale-orders/:id/invoice', requireAuth('operador'), async (req, res, next) => {
    try {
      const invoice = invoiceSaleOrder(
        appData,
        String(req.params.id),
        String(req.body?.documentType || 'E31')
      );
      await saveAppData(appData);
      res.status(201).json(enrichInvoice(appData, invoice));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/accounting/summary', requireAuth('visor'), (_req, res) => {
    res.json({
      ok: true,
      accounting: getAccountingSummary(appData),
    });
  });

  app.get('/api/reports/summary', requireAuth('visor'), (_req, res) => {
    res.json({
      ok: true,
      report: buildReportSummary(appData),
    });
  });

  app.get('/api/invoices', requireAuth('visor'), (_req, res) => {
    res.json({
      ok: true,
      invoices: appData.invoices.map((invoice) => enrichInvoice(appData, invoice)),
    });
  });

  app.get('/api/payments', requireAuth('visor'), (_req, res) => {
    res.json({
      ok: true,
      payments: appData.payments,
    });
  });

  app.post('/api/invoices', requireAuth('operador'), async (req, res, next) => {
    try {
      const invoice = createInvoice(appData, req.body);
      await saveAppData(appData);
      res.status(201).json(enrichInvoice(appData, invoice));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/invoices/:id', requireAuth('visor'), (req, res, next) => {
    try {
      const invoice = findInvoice(appData, String(req.params.id));
      res.json(enrichInvoice(appData, invoice));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/invoices/:id/issue-ecf', requireAuth('operador'), async (req, res, next) => {
    try {
      const invoice = issueInvoice(appData, String(req.params.id));
      const ecfXml = buildEcfXml(appData, invoice);
      const signedEcfXml = signature.signXml(ecfXml, 'ECF');
      const receiver = getInvoiceCustomer(appData, invoice);
      const arecfXml = senderReceiver.getECFDataFromXML(
        signedEcfXml,
        receiver.rnc,
        ReceivedStatus.Recibido
      );
      const signedArecfXml = signature.signXml(arecfXml, 'ARECF');
      const acecfXml = buildCommercialApprovalXml(appData, invoice);
      const signedAcecfXml = signature.signXml(acecfXml, 'ACECF');

      await saveXml('outgoing', `${invoice.encf}-ecf.xml`, signedEcfXml);
      await saveXml('outgoing', `${invoice.encf}-arecf.xml`, signedArecfXml);
      await saveXml('outgoing', `${invoice.encf}-acecf.xml`, signedAcecfXml);
      await saveAppData(appData);

      recordAudit({
        event: 'invoice_issued',
        outcome: 'ok',
        source: 'local-ui',
        encf: invoice.encf,
        trackId: invoice.trackId,
        securityCode: invoice.securityCode,
        customerRnc: receiver.rnc,
        amount: invoice.totals?.total,
      });

      res.json({
        invoice: enrichInvoice(appData, invoice),
        xml: {
          ecf: signedEcfXml,
          arecf: signedArecfXml,
          acecf: signedAcecfXml,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/invoices/:id/payments', requireAuth('operador'), async (req, res, next) => {
    try {
      const payment = recordPayment(appData, String(req.params.id), req.body || {});
      const invoice = findInvoice(appData, String(req.params.id));
      await saveAppData(appData);

      recordAudit({
        event: 'payment_recorded',
        outcome: 'ok',
        source: 'local-ui',
        encf: invoice.encf,
        trackId: invoice.trackId,
        amount: payment.amount,
        message: `Cobro registrado via ${payment.method}`,
        detail: {
          paymentId: payment.id,
          paymentMethod: payment.method,
          reference: payment.reference,
        },
      });

      res.status(201).json({
        ok: true,
        payment,
        invoice: enrichInvoice(appData, invoice),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/odoo/invoices', requireAuth('admin'), async (req, res, next) => {
    try {
      const payload = req.body || {};
      const customer = upsertCustomerFromExternal(appData, payload.customer || {});
      const items = buildItemsFromExternal(appData, payload.items || []);
      const invoice = createInvoice(appData, {
        customerId: customer.id,
        items,
      });
      const externalEncf = String(
        payload.fiscalNumber || payload.encf || payload.documentNumber || ''
      ).trim();

      if (!externalEncf) {
        throw new Error('La factura Odoo debe incluir el e-NCF fiscalNumber');
      }

      issueInvoiceWithEncf(appData, invoice.id, externalEncf);

      const ecfXml = buildEcfXml(appData, invoice);
      const signedEcfXml = signature.signXml(ecfXml, 'ECF');
      const arecfXml = senderReceiver.getECFDataFromXML(
        signedEcfXml,
        customer.rnc,
        ReceivedStatus.Recibido
      );
      const signedArecfXml = signature.signXml(arecfXml, 'ARECF');
      const acecfXml = buildCommercialApprovalXml(appData, invoice);
      const signedAcecfXml = signature.signXml(acecfXml, 'ACECF');

      await saveXml('outgoing', `${invoice.encf}-odoo-ecf.xml`, signedEcfXml);
      await saveXml('outgoing', `${invoice.encf}-odoo-arecf.xml`, signedArecfXml);
      await saveXml('outgoing', `${invoice.encf}-odoo-acecf.xml`, signedAcecfXml);
      await saveAppData(appData);

      recordAudit({
        event: 'odoo_invoice_issued',
        outcome: 'ok',
        source: 'odoo',
        encf: invoice.encf,
        trackId: invoice.trackId,
        securityCode: invoice.securityCode,
        externalId: payload.externalId ? String(payload.externalId) : undefined,
        customerRnc: customer.rnc,
        amount: invoice.totals?.total,
      });

      res.status(201).json({
        ok: true,
        source: 'odoo',
        externalId: payload.externalId || null,
        invoice: enrichInvoice(appData, invoice),
        xml: {
          ecf: signedEcfXml,
          arecf: signedArecfXml,
          acecf: signedAcecfXml,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/precertification/run', requireAuth('admin'), async (_req, res, next) => {
    try {
      const results = await runPrecertificationTests({
        appData,
        customAuthentication,
        senderReceiver,
        signature,
      });
      res.json({
        ok: results.every((result) => result.ok),
        results,
        note: 'Estas pruebas validan preparacion local. La aprobacion final depende de DGII con RNC, certificado y URLs HTTPS reales.',
      });
    } catch (error) {
      next(error);
    }
  });

  app.get(endpointPaths.seed, (_req, res) => {
    res.type('application/xml').send(customAuthentication.generateSeed());
  });

  app.post(
    [endpointPaths.validateSeed, '/fe/autenticacion/api/validarsemilla'],
    upload.single('xml'),
    async (req, res, next) => {
      try {
        const xml = getXmlFromRequest(req);
        const token = await customAuthentication.verifySignedSeed(xml);
        const issuedAt = new Date();
        const expiresAt = new Date(issuedAt.getTime() + 60 * 60 * 1000);

        await saveXml('incoming', 'signed-seed', xml);

        res.json({
          token,
          expedido: issuedAt.toISOString(),
          expira: expiresAt.toISOString(),
        });
      } catch (error) {
        next(error);
      }
    }
  );

  app.post(
    endpointPaths.receiveInvoice,
    upload.single('xml'),
    async (req, res, next) => {
      try {
        const xml = getXmlFromRequest(req);
        const incomingFile = getRequestFileName(req, 'ecf');

        await saveXml('incoming', incomingFile, xml);

        const unsignedReceipt = senderReceiver.getECFDataFromXML(
          xml,
          config.buyerRnc,
          ReceivedStatus.Recibido
        );
        const signedReceipt = signature.signXml(unsignedReceipt, 'ARECF');

        await saveXml('outgoing', `${stripXmlExtension(incomingFile)}-arecf.xml`, signedReceipt);

        recordAudit({
          event: 'ecf_received',
          outcome: 'ok',
          source: 'reception',
          message: incomingFile,
        });

        res.type('application/xml').send(signedReceipt);
      } catch (error) {
        next(error);
      }
    }
  );

  app.post(
    endpointPaths.commercialApproval,
    upload.single('xml'),
    async (req, res, next) => {
      try {
        const xml = getXmlFromRequest(req);
        const incomingFile = getRequestFileName(req, 'acecf');

        await saveXml('incoming', incomingFile, xml);

        const responseXml = xml.includes('<Signature')
          ? xml
          : signature.signXml(xml, 'ACECF');

        await saveXml(
          'outgoing',
          `${stripXmlExtension(incomingFile)}-response.xml`,
          responseXml
        );

        res.type('application/xml').send(responseXml);
      } catch (error) {
        next(error);
      }
    }
  );

  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const message = error instanceof Error ? error.message : 'Unexpected error';
      recordAudit({
        event: 'request_error',
        outcome: 'error',
        source: _req.method + ' ' + _req.path,
        message,
      });
      res.status(400).json({ error: message });
    }
  );

  const onListen = () => {
    const softwareConfig = buildSoftwareConfig();
    console.log('ECF service running');
    console.log(JSON.stringify(softwareConfig, null, 2));
  };

  return await new Promise<http.Server>((resolve) => {
    const updateRuntimeBaseUrl = (server: http.Server) => {
      const address = server.address();
      if (typeof address === 'object' && address) {
        config.port = address.port;
        config.publicBaseUrl = normalizeBaseUrl(
          `http://${config.host || '127.0.0.1'}:${address.port}`
        );
      }
    };

    const server = config.host
      ? app.listen(config.port, config.host, () => {
          updateRuntimeBaseUrl(server);
          onListen();
          resolve(server);
        })
      : app.listen(config.port, () => {
          updateRuntimeBaseUrl(server);
          onListen();
          resolve(server);
        });
  });
}

function buildSoftwareConfig() {
  const publicHost = stripProtocol(config.publicBaseUrl);

  return {
    tipoSoftware: 'PROPIO',
    nombreSoftware: config.softwareName,
    versionSoftware: config.softwareVersion,
    urlRecepcion: joinUrl(config.publicBaseUrl, endpointPaths.receiveInvoice),
    urlAprobacionComercial: joinUrl(
      config.publicBaseUrl,
      endpointPaths.commercialApproval
    ),
    urlAutenticacion: joinUrl(config.publicBaseUrl, '/fe/autenticacion/api'),
    formularioDgii: {
      tipoSoftware: 'PROPIO',
      nombreSoftware: config.softwareName,
      versionSoftware: config.softwareVersion,
      dominioRecepcion: publicHost,
      rutaRecepcion: endpointPaths.receiveInvoice,
      dominioAprobacionComercial: publicHost,
      rutaAprobacionComercial: endpointPaths.commercialApproval,
      dominioAutenticacion: publicHost,
      rutaAutenticacion: '/fe/autenticacion/api/[semilla|validacioncertificado]',
    },
    endpoints: {
      semilla: joinUrl(config.publicBaseUrl, endpointPaths.seed),
      validacioncertificado: joinUrl(config.publicBaseUrl, endpointPaths.validateSeed),
      validarsemilla: joinUrl(config.publicBaseUrl, '/fe/autenticacion/api/validarsemilla'),
    },
  };
}

function stripProtocol(url: string) {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

async function loadCertificate() {
  let filePath = config.certPath;
  let password = config.certPassword;

  if (!filePath) {
    if (!config.generateDemoCert) {
      throw new Error('CERT_PATH no fue definido y GENERATE_DEMO_CERT esta desactivado');
    }

    filePath = path.isAbsolute(config.demoCertPath)
      ? config.demoCertPath
      : path.resolve(projectRoot, config.demoCertPath);
    password = config.demoCertPassword;

    if (!fs.existsSync(filePath)) {
      await createDemoCertificate(filePath, password);
    }
  }

  const reader = new P12Reader(password);
  const certificate = reader.getKeyFromFile(filePath);

  if (!certificate.key || !certificate.cert) {
    throw new Error('No se pudo cargar la llave y el certificado desde el archivo .p12');
  }

  return certificate;
}

async function createDemoCertificate(filePath: string, password: string) {
  await ensureDirectory(path.dirname(filePath));

  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = String(Date.now());
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  const attrs = [
    { name: 'commonName', value: 'ECF Demo Certificate' },
    { name: 'countryName', value: 'DO' },
    { shortName: 'ST', value: 'Distrito Nacional' },
    { name: 'localityName', value: 'Santo Domingo' },
    { name: 'organizationName', value: 'Demo ECF Service' },
    { shortName: 'OU', value: 'Development' },
  ];

  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: 'basicConstraints', cA: true },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
    { name: 'extKeyUsage', serverAuth: true, clientAuth: true },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
    keys.privateKey,
    [cert],
    password,
    { algorithm: '3des' }
  );
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();

  await fs.promises.writeFile(filePath, Buffer.from(p12Der, 'binary'));
}

function getXmlFromRequest(req: Request) {
  if (req.file?.buffer?.length) {
    return req.file.buffer.toString('utf-8');
  }

  if (typeof req.body === 'string' && req.body.trim()) {
    return req.body;
  }

  if (
    req.body &&
    typeof req.body === 'object' &&
    'xml' in req.body &&
    typeof req.body.xml === 'string' &&
    req.body.xml.trim()
  ) {
    return req.body.xml;
  }

  throw new Error('No se encontro un XML en la solicitud');
}

function getRequestFileName(req: Request, prefix: string) {
  if (req.file?.originalname) {
    return req.file.originalname;
  }

  return `${prefix}-${Date.now()}.xml`;
}

async function saveXml(kind: 'incoming' | 'outgoing', fileName: string, xml: string) {
  const safeName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const targetRoot = kind === 'incoming' ? incomingRoot : outgoingRoot;
  await fs.promises.writeFile(path.resolve(targetRoot, safeName), xml, 'utf8');
}

async function ensureDirectory(directoryPath: string) {
  await fs.promises.mkdir(directoryPath, { recursive: true });
}

function normalizeBaseUrl(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function joinUrl(baseUrl: string, route: string) {
  return `${normalizeBaseUrl(baseUrl)}${route}`;
}

function stripXmlExtension(fileName: string) {
  return fileName.toLowerCase().endsWith('.xml') ? fileName.slice(0, -4) : fileName;
}

function toMegabytes(value: number) {
  return Math.round((value / 1024 / 1024) * 100) / 100;
}

function getAllowedCorsOrigin(origin: string | undefined) {
  if (!origin) {
    return '';
  }

  const allowedOrigins = new Set([
    config.publicBaseUrl,
    `http://localhost:${config.port}`,
    `http://127.0.0.1:${config.port}`,
  ]);

  return allowedOrigins.has(origin) ? origin : '';
}

export interface LocalServerHandle {
  close: () => Promise<void>;
  port: number;
  host: string;
  storageRoot: string;
}

let serverHandlePromise: Promise<LocalServerHandle> | null = null;

export async function startServer(): Promise<LocalServerHandle> {
  if (serverHandlePromise) {
    return serverHandlePromise;
  }

  serverHandlePromise = bootstrap().then((server) => {
    const address = server.address();
    return {
      close: () =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }
            serverHandlePromise = null;
            resolve();
          });
        }),
      port: typeof address === 'object' && address ? address.port : config.port,
      host: config.host || '127.0.0.1',
      storageRoot,
    };
  });

  return serverHandlePromise;
}

if (shouldAutoStart()) {
  startServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

async function loadAppData(): Promise<AppData> {
  if (!fs.existsSync(dataFile)) {
    const defaultData = createDefaultData();
    await saveAppData(defaultData);
    return defaultData;
  }

  const data = await readAppDataWithRecovery();
  const defaults = createDefaultData();
  return {
    ...defaults,
    ...data,
    company: { ...defaults.company, ...data.company },
    fiscalSequences:
      data.fiscalSequences && data.fiscalSequences.length
        ? data.fiscalSequences
        : defaults.fiscalSequences,
    customers: data.customers || [],
    products: (data.products || []).map((product) => ({
      ...product,
      trackInventory: Boolean(product.trackInventory),
      stockOnHand: Number(product.stockOnHand || 0),
      reorderPoint: Number(product.reorderPoint || 0),
    })),
    invoices: (data.invoices || []).map((invoice) => ({
      ...invoice,
      documentType: invoice.documentType || 'E31',
    })),
    payments: data.payments || [],
    inventoryMovements: data.inventoryMovements || [],
    saleOrders: data.saleOrders || [],
    journalEntries: data.journalEntries || [],
    users:
      data.users && data.users.length
        ? data.users.map((user) => ({
            ...user,
            mustChangePassword: user.mustChangePassword ?? false,
            active: user.active ?? true,
          }))
        : defaults.users,
  };
}

async function saveAppData(data: AppData) {
  latestAppDataSnapshot = data;
  await ensureDirectory(path.dirname(dataFile));
  await ensureDirectory(backupRoot);

  if (fs.existsSync(dataFile)) {
    const backupFile = path.resolve(
      backupRoot,
      `facturador-data-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    );
    await fs.promises.copyFile(dataFile, backupFile);
    await fs.promises.copyFile(dataFile, `${dataFile}.bak`);
  }

  const tempFile = `${dataFile}.${process.pid}.tmp`;
  await fs.promises.writeFile(tempFile, JSON.stringify(data, null, 2), 'utf8');
  await fs.promises.rename(tempFile, dataFile);
}

async function readAppDataWithRecovery(): Promise<AppData> {
  try {
    const raw = await fs.promises.readFile(dataFile, 'utf8');
    return JSON.parse(raw) as AppData;
  } catch (error) {
    const backupFile = `${dataFile}.bak`;
    if (fs.existsSync(backupFile)) {
      const raw = await fs.promises.readFile(backupFile, 'utf8');
      const recovered = JSON.parse(raw) as AppData;
      recordAudit({
        event: 'storage_recovered',
        outcome: 'ok',
        source: 'local-storage',
        message: 'facturador-data.json fue recuperado desde backup .bak',
      });
      return recovered;
    }

    throw error;
  }
}

function findInvoice(data: AppData, invoiceId: string) {
  const invoice = data.invoices.find((item) => item.id === invoiceId);
  if (!invoice) {
    throw new Error('Factura no encontrada');
  }

  return invoice;
}

function enrichInvoice(data: AppData, invoice: Invoice) {
  return {
    ...invoice,
    customer: data.customers.find((item) => item.id === invoice.customerId),
    payments: getInvoicePayments(data, invoice),
    paidAmount: getInvoicePaidAmount(data, invoice),
    balanceDue: getInvoiceBalance(data, invoice),
    paymentStatus: getInvoicePaymentStatus(data, invoice),
  };
}

function enrichSaleOrder(data: AppData, saleOrder: AppData['saleOrders'][number]) {
  return {
    ...saleOrder,
    customer: data.customers.find((item) => item.id === saleOrder.customerId),
    invoice: saleOrder.invoiceId
      ? data.invoices.find((invoice) => invoice.id === saleOrder.invoiceId)
      : null,
  };
}

function buildReportSummary(data: AppData) {
  const issuedInvoices = data.invoices.filter((invoice) => invoice.status === 'emitida');
  const salesTotal = issuedInvoices.reduce(
    (total, invoice) => total + invoice.totals.total,
    0
  );
  const itbisTotal = issuedInvoices.reduce(
    (total, invoice) => total + invoice.totals.itbis,
    0
  );
  const collectedTotal = data.payments.reduce(
    (total, payment) => total + payment.amount,
    0
  );
  const receivableTotal = issuedInvoices.reduce(
    (total, invoice) => total + getInvoiceBalance(data, invoice),
    0
  );
  const lowStockProducts = getInventorySummary(data).filter((item) => item.lowStock);
  const accounting = getAccountingSummary(data);

  return {
    generatedAt: new Date().toISOString(),
    sales: {
      invoices: issuedInvoices.length,
      subtotal: roundForReport(
        issuedInvoices.reduce((total, invoice) => total + invoice.totals.subtotal, 0)
      ),
      itbis: roundForReport(itbisTotal),
      total: roundForReport(salesTotal),
    },
    receivables: {
      collected: roundForReport(collectedTotal),
      pending: roundForReport(receivableTotal),
    },
    inventory: {
      products: data.products.length,
      lowStock: lowStockProducts.length,
    },
    accounting: {
      entries: accounting.entries.length,
      balanced: accounting.balanced,
    },
  };
}

function requireAuth(requiredRole: UserRole) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!config.authEnabled) {
      return next();
    }

    try {
      const token = extractBearerToken(req);
      if (!token) {
        return res.status(401).json({ error: 'Sesion requerida' });
      }

      const claims = jwt.verify(token, getAuthVerificationSecret()) as {
        sub: string;
        role: UserRole;
        username: string;
      };
      const user = getActiveUserById(claims.sub);
      if (!user) {
        return res.status(401).json({ error: 'Sesion invalida' });
      }

      if (!hasRequiredRole(user.role, requiredRole)) {
        return res.status(403).json({ error: 'Permiso insuficiente' });
      }

      (req as express.Request & { authUser?: ReturnType<typeof sanitizeLocalUser> }).authUser =
        sanitizeLocalUser(user);
      next();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sesion invalida';
      return res.status(401).json({ error: message });
    }
  };
}

function extractBearerToken(req: express.Request) {
  const raw = req.headers.authorization;
  if (!raw || !raw.startsWith('Bearer ')) {
    return '';
  }

  return raw.slice('Bearer '.length).trim();
}

function hasRequiredRole(currentRole: UserRole, requiredRole: UserRole) {
  const hierarchy: Record<UserRole, number> = {
    visor: 1,
    operador: 2,
    admin: 3,
  };

  return hierarchy[currentRole] >= hierarchy[requiredRole];
}

function getRequestUser(req: express.Request) {
  const authUser = (req as express.Request & {
    authUser?: ReturnType<typeof sanitizeLocalUser>;
  }).authUser;

  if (!authUser) {
    throw new Error('Sesion no disponible');
  }

  return authUser;
}

function getActiveUserById(userId: string) {
  const data = cachedAppData();
  return data.users.find((user) => user.id === userId && user.active);
}

function signLocalSession(secret: string, user: LocalUser) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      username: user.username,
    },
    secret,
    {
      algorithm: 'HS256',
      expiresIn: `${config.authTokenHours}h`,
    }
  );
}

let resolvedAuthSecret = '';

function getAuthVerificationSecret() {
  if (!resolvedAuthSecret) {
    throw new Error('El secreto de autenticacion no fue inicializado');
  }

  return resolvedAuthSecret;
}

async function loadOrCreateAuthSecret() {
  if (resolvedAuthSecret) {
    return resolvedAuthSecret;
  }

  if (fs.existsSync(authSecretFile)) {
    resolvedAuthSecret = (await fs.promises.readFile(authSecretFile, 'utf8')).trim();
    if (resolvedAuthSecret) {
      return resolvedAuthSecret;
    }
  }

  resolvedAuthSecret = crypto.randomBytes(32).toString('hex');
  await fs.promises.writeFile(authSecretFile, resolvedAuthSecret, 'utf8');
  return resolvedAuthSecret;
}

let latestAppDataSnapshot: AppData | null = null;

function cachedAppData() {
  if (!latestAppDataSnapshot) {
    throw new Error('Datos de aplicacion no inicializados');
  }

  return latestAppDataSnapshot;
}

function validateCustomerPayload(payload: Record<string, unknown>) {
  const rnc = String(payload.rnc || '').replace(/\D/g, '');
  const razonSocial = String(payload.razonSocial || '').trim();

  if (!/^\d{9,11}$/.test(rnc)) {
    throw new Error('El RNC o cedula del cliente debe tener 9 u 11 digitos');
  }

  if (!razonSocial) {
    throw new Error('La razon social del cliente es requerida');
  }
}

function validateProductPayload(payload: Record<string, unknown>) {
  const nombre = String(payload.nombre || '').trim();
  const precio = Number(payload.precio ?? 0);
  const itbisRate = Number(payload.itbisRate ?? 0.18);
  const stockOnHand = Number(payload.stockOnHand ?? 0);
  const reorderPoint = Number(payload.reorderPoint ?? 0);

  if (!nombre) {
    throw new Error('El nombre del producto es requerido');
  }

  if (!Number.isFinite(precio) || precio < 0) {
    throw new Error('El precio del producto debe ser un numero mayor o igual que cero');
  }

  if (!Number.isFinite(itbisRate) || itbisRate < 0 || itbisRate > 1) {
    throw new Error('La tasa ITBIS debe estar entre 0 y 1');
  }

  if (!Number.isFinite(stockOnHand) || stockOnHand < 0) {
    throw new Error('El stock inicial debe ser mayor o igual que cero');
  }

  if (!Number.isFinite(reorderPoint) || reorderPoint < 0) {
    throw new Error('El punto de reorden debe ser mayor o igual que cero');
  }
}

function roundForReport(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function shouldAutoStart() {
  const entryPoint = process.argv[1];
  if (!entryPoint) {
    return false;
  }

  return path.resolve(entryPoint) === __filename;
}

function upsertCustomerFromExternal(data: AppData, payload: Record<string, unknown>) {
  const rnc = String(payload.rnc || '').replace(/\D/g, '');
  const razonSocial = String(payload.razonSocial || payload.name || '').trim();

  if (!rnc) {
    throw new Error('El cliente enviado por Odoo debe incluir RNC o cedula');
  }

  if (!razonSocial) {
    throw new Error('El cliente enviado por Odoo debe incluir razon social');
  }

  const existing = data.customers.find((customer) => customer.rnc === rnc);
  if (existing) {
    existing.razonSocial = razonSocial;
    existing.correo = String(payload.correo || payload.email || existing.correo || '');
    existing.direccion = String(payload.direccion || payload.address || existing.direccion || '');
    return existing;
  }

  const customer: Customer = {
    id: createId('cliente-odoo'),
    rnc,
    razonSocial,
    correo: String(payload.correo || payload.email || ''),
    direccion: String(payload.direccion || payload.address || ''),
  };
  data.customers.unshift(customer);
  return customer;
}

function buildItemsFromExternal(data: AppData, payload: unknown) {
  if (!Array.isArray(payload) || !payload.length) {
    throw new Error('La factura enviada por Odoo debe incluir al menos una linea');
  }

  return payload.map((line, index) => {
    if (!line || typeof line !== 'object') {
      throw new Error(`Linea de factura Odoo invalida: ${index + 1}`);
    }

    const item = line as Record<string, unknown>;
    const descripcion = String(item.descripcion || item.name || `Linea ${index + 1}`).trim();
    const precio = Number(item.precio ?? item.price ?? 0);
    const cantidad = Number(item.cantidad ?? item.quantity ?? 1);
    const itbisRate = Number(item.itbisRate ?? item.taxRate ?? 0.18);

    if (!descripcion || !Number.isFinite(precio) || precio <= 0) {
      throw new Error(`Linea de factura Odoo invalida: ${index + 1}`);
    }

    const product = upsertProductFromExternal(data, {
      descripcion,
      precio,
      itbisRate,
    });

    return {
      productId: product.id,
      descripcion,
      cantidad,
      precio,
      itbisRate,
    };
  });
}

function upsertProductFromExternal(
  data: AppData,
  payload: { descripcion: string; precio: number; itbisRate: number }
) {
  const existing = data.products.find(
    (product) =>
      product.nombre === payload.descripcion &&
      product.precio === payload.precio &&
      product.itbisRate === payload.itbisRate
  );

  if (existing) {
    return existing;
  }

  const product: Product = {
    id: createId('producto-odoo'),
    nombre: payload.descripcion,
    descripcion: payload.descripcion,
    precio: payload.precio,
    itbisRate: payload.itbisRate,
  };
  data.products.unshift(product);
  return product;
}

async function runPrecertificationTests(context: {
  appData: AppData;
  customAuthentication: CustomAuthentication;
  senderReceiver: SenderReceiver;
  signature: Signature;
}) {
  const results = validateCompanyReadiness(context.appData);
  const invoice =
    context.appData.invoices.find((item) => item.documentType === 'E31') ||
    createInvoice(context.appData, {
      customerId: context.appData.customers[0].id,
      documentType: 'E31',
      items: [{ productId: context.appData.products[0].id, cantidad: 1 }],
    });

  if (!invoice.encf) {
    issueInvoice(context.appData, invoice.id);
  }

  const seed = context.customAuthentication.generateSeed();
  const signedSeed = context.signature.signXml(seed, 'SemillaModel');
  const token = await context.customAuthentication.verifySignedSeed(signedSeed);
  results.push({
    name: 'Semilla y token local',
    ok: Boolean(token),
    detail: 'El sistema genera semilla, firma y valida token localmente.',
  });

  const ecfXml = buildEcfXml(context.appData, invoice);
  const signedEcfXml = context.signature.signXml(ecfXml, 'ECF');
  results.push({
    name: 'XML e-CF firmado',
    ok: signedEcfXml.includes('<Signature'),
    detail: 'La factura se transforma en XML e-CF y se firma digitalmente.',
  });

  const receiver = getInvoiceCustomer(context.appData, invoice);
  const arecfXml = context.senderReceiver.getECFDataFromXML(
    signedEcfXml,
    receiver.rnc,
    ReceivedStatus.Recibido
  );
  const signedArecfXml = context.signature.signXml(arecfXml, 'ARECF');
  results.push({
    name: 'ARECF de recepcion',
    ok: signedArecfXml.includes('<Estado>0</Estado>') && signedArecfXml.includes('<Signature'),
    detail: 'El endpoint receptor puede devolver acuse firmado con estado recibido.',
  });

  const acecfXml = buildCommercialApprovalXml(context.appData, invoice);
  const signedAcecfXml = context.signature.signXml(acecfXml, 'ACECF');
  results.push({
    name: 'ACECF de aprobacion comercial',
    ok: signedAcecfXml.includes('<ACECF') && signedAcecfXml.includes('<Signature'),
    detail: 'El sistema puede generar y firmar aprobacion comercial demo.',
  });

  results.push({
    name: 'URLs HTTPS para DGII',
    ok: config.publicBaseUrl.startsWith('https://'),
    detail: config.publicBaseUrl.startsWith('https://')
      ? 'La URL publica configurada usa HTTPS.'
      : 'Para DGII real falta publicar el servicio en HTTPS estable, no localhost.',
  });

  await saveAppData(context.appData);
  return results;
}
