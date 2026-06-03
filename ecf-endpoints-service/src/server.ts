import 'dotenv/config';

import express, { Request } from 'express';
import forge from 'node-forge';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import CustomAuthentication from './lib/custom-authentication.js';
import P12Reader from './lib/p12-reader.js';
import Signature from './lib/signature.js';
import { ReceivedStatus, SenderReceiver } from './lib/sender-receiver.js';
import {
  AppData,
  buildCommercialApprovalXml,
  buildEcfXml,
  createDefaultData,
  createId,
  createInvoice,
  Customer,
  getInvoiceCustomer,
  Invoice,
  issueInvoice,
  issueInvoiceWithEncf,
  Product,
  validateCompanyReadiness,
} from './lib/facturador.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());
app.use(
  express.text({
    type: ['application/xml', 'text/xml', 'text/plain'],
    limit: '10mb',
  })
);

const projectRoot = path.resolve(__dirname, '..');
const storageRoot = path.resolve(projectRoot, 'storage');
const incomingRoot = path.resolve(storageRoot, 'incoming');
const outgoingRoot = path.resolve(storageRoot, 'outgoing');
const dataFile = path.resolve(storageRoot, 'facturador-data.json');
const publicRoot = path.resolve(projectRoot, 'public');

const config = {
  port: Number(process.env.PORT || '3000'),
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
  const appData = await loadAppData();

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
    });
  });

  app.get('/software-config', (_req, res) => {
    res.json(buildSoftwareConfig());
  });

  app.get('/api/certificate/status', (_req, res) => {
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

  app.get('/api/testlab/required-files', (_req, res) => {
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

  app.get('/api/dashboard', (_req, res) => {
    const totals = appData.invoices.reduce(
      (acc, invoice) => {
        acc.invoices += 1;
        acc.amount += invoice.totals.total;
        if (invoice.fiscalStatus === 'precertificacion_ok') {
          acc.ready += 1;
        }
        return acc;
      },
      { invoices: 0, amount: 0, ready: 0 }
    );

    res.json({
      company: appData.company,
      customers: appData.customers,
      products: appData.products,
      invoices: appData.invoices,
      totals,
      software: buildSoftwareConfig(),
      readiness: validateCompanyReadiness(appData),
    });
  });

  app.put('/api/company', async (req, res, next) => {
    try {
      Object.assign(appData.company, req.body || {});
      await saveAppData(appData);
      res.json(appData.company);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/customers', async (req, res, next) => {
    try {
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

  app.post('/api/products', async (req, res, next) => {
    try {
      const product: Product = {
        id: createId('producto'),
        nombre: String(req.body?.nombre || ''),
        descripcion: String(req.body?.descripcion || req.body?.nombre || ''),
        precio: Number(req.body?.precio || 0),
        itbisRate: Number(req.body?.itbisRate ?? 0.18),
      };
      appData.products.unshift(product);
      await saveAppData(appData);
      res.status(201).json(product);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/invoices', async (req, res, next) => {
    try {
      const invoice = createInvoice(appData, req.body);
      await saveAppData(appData);
      res.status(201).json(enrichInvoice(appData, invoice));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/invoices/:id', (req, res, next) => {
    try {
      const invoice = findInvoice(appData, req.params.id);
      res.json(enrichInvoice(appData, invoice));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/invoices/:id/issue-ecf', async (req, res, next) => {
    try {
      const invoice = issueInvoice(appData, req.params.id);
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

  app.post('/api/odoo/invoices', async (req, res, next) => {
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

  app.post('/api/precertification/run', async (_req, res, next) => {
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
      res.status(400).json({ error: message });
    }
  );

  app.listen(config.port, () => {
    const softwareConfig = buildSoftwareConfig();
    console.log('ECF service running');
    console.log(JSON.stringify(softwareConfig, null, 2));
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

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function loadAppData(): Promise<AppData> {
  if (!fs.existsSync(dataFile)) {
    const defaultData = createDefaultData();
    await saveAppData(defaultData);
    return defaultData;
  }

  const raw = await fs.promises.readFile(dataFile, 'utf8');
  const data = JSON.parse(raw) as AppData;
  return {
    ...createDefaultData(),
    ...data,
    company: { ...createDefaultData().company, ...data.company },
    customers: data.customers || [],
    products: data.products || [],
    invoices: data.invoices || [],
  };
}

async function saveAppData(data: AppData) {
  await fs.promises.writeFile(dataFile, JSON.stringify(data, null, 2), 'utf8');
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
  };
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
    context.appData.invoices[0] ||
    createInvoice(context.appData, {
      customerId: context.appData.customers[0].id,
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