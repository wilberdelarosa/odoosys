export interface CompanyProfile {
  rnc: string;
  razonSocial: string;
  nombreComercial: string;
  direccion: string;
  provincia: string;
  municipio: string;
  correo: string;
  telefono: string;
  softwareName: string;
  softwareVersion: string;
  nextSequence: number;
}

export interface Customer {
  id: string;
  rnc: string;
  razonSocial: string;
  correo: string;
  direccion: string;
}

export interface Product {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  itbisRate: number;
}

export interface InvoiceItem {
  productId: string;
  descripcion: string;
  cantidad: number;
  precio: number;
  itbisRate: number;
}

export interface InvoiceTotals {
  subtotal: number;
  itbis: number;
  total: number;
}

export interface Invoice {
  id: string;
  customerId: string;
  items: InvoiceItem[];
  totals: InvoiceTotals;
  status: 'borrador' | 'emitida' | 'rechazada';
  fiscalStatus: 'sin_enviar' | 'precertificacion_ok' | 'precertificacion_error';
  encf?: string;
  trackId?: string;
  securityCode?: string;
  createdAt: string;
  issuedAt?: string;
  messages: string[];
}

export interface AppData {
  company: CompanyProfile;
  customers: Customer[];
  products: Product[];
  invoices: Invoice[];
}

export interface CertificationTestResult {
  name: string;
  ok: boolean;
  detail: string;
}

export function createDefaultData(): AppData {
  return {
    company: {
      rnc: '101010101',
      razonSocial: 'EMPRESA DEMO SRL',
      nombreComercial: 'EMPRESA DEMO',
      direccion: 'Av. Demo 123, Santo Domingo',
      provincia: 'Distrito Nacional',
      municipio: 'Santo Domingo de Guzman',
      correo: 'facturacion@empresa-demo.test',
      telefono: '8090000000',
      softwareName: 'Mi ECF Service',
      softwareVersion: '1.0.0',
      nextSequence: 1,
    },
    customers: [
      {
        id: 'cliente-demo',
        rnc: '130862346',
        razonSocial: 'CLIENTE DEMO SRL',
        correo: 'compras@cliente-demo.test',
        direccion: 'Calle Comprador 45, Santo Domingo',
      },
    ],
    products: [
      {
        id: 'servicio-demo',
        nombre: 'Servicio de implementacion',
        descripcion: 'Implementacion y soporte de facturacion electronica',
        precio: 15000,
        itbisRate: 0.18,
      },
      {
        id: 'licencia-demo',
        nombre: 'Licencia mensual',
        descripcion: 'Servicio mensual de soporte del gateway e-CF',
        precio: 3500,
        itbisRate: 0.18,
      },
    ],
    invoices: [],
  };
}

export function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function calculateTotals(items: InvoiceItem[]): InvoiceTotals {
  const subtotal = roundMoney(
    items.reduce((total, item) => total + item.cantidad * item.precio, 0)
  );
  const itbis = roundMoney(
    items.reduce(
      (total, item) => total + item.cantidad * item.precio * item.itbisRate,
      0
    )
  );

  return {
    subtotal,
    itbis,
    total: roundMoney(subtotal + itbis),
  };
}

export function createInvoice(
  data: AppData,
  payload: { customerId: string; items: Array<Partial<InvoiceItem>> }
): Invoice {
  const customer = data.customers.find((item) => item.id === payload.customerId);
  if (!customer) {
    throw new Error('Cliente no encontrado');
  }

  const items = payload.items.map((item) => normalizeInvoiceItem(data, item));
  if (!items.length) {
    throw new Error('La factura debe tener al menos una linea');
  }

  const invoice: Invoice = {
    id: createId('factura'),
    customerId: customer.id,
    items,
    totals: calculateTotals(items),
    status: 'borrador',
    fiscalStatus: 'sin_enviar',
    createdAt: new Date().toISOString(),
    messages: ['Factura creada en modo borrador.'],
  };

  data.invoices.unshift(invoice);
  return invoice;
}

export function issueInvoice(data: AppData, invoiceId: string) {
  const invoice = data.invoices.find((item) => item.id === invoiceId);
  if (!invoice) {
    throw new Error('Factura no encontrada');
  }

  const encf = generateEncf(data.company.nextSequence);
  data.company.nextSequence += 1;

  invoice.encf = encf;
  invoice.status = 'emitida';
  invoice.fiscalStatus = 'precertificacion_ok';
  invoice.issuedAt = new Date().toISOString();
  invoice.trackId = createId('track');
  invoice.securityCode = createSecurityCode(invoice);
  invoice.messages.push('Factura emitida en ambiente local de precertificacion.');

  return invoice;
}

export function issueInvoiceWithEncf(
  data: AppData,
  invoiceId: string,
  externalEncf: string
) {
  const invoice = issueInvoice(data, invoiceId);
  const encf = externalEncf.trim().toUpperCase();

  if (!/^E\d{12}$/.test(encf)) {
    throw new Error('El e-NCF enviado por Odoo debe tener formato E + 12 digitos');
  }

  invoice.encf = encf;
  invoice.securityCode = createSecurityCode(invoice);
  invoice.messages.push('e-NCF recibido desde Odoo y usado para el XML firmado.');

  return invoice;
}

export function buildEcfXml(data: AppData, invoice: Invoice) {
  const customer = getInvoiceCustomer(data, invoice);
  const encf = invoice.encf || generateEncf(data.company.nextSequence);
  const tipoeCF = extractTipoEcf(encf);
  const issueDate = formatDate(invoice.issuedAt || invoice.createdAt);
  const issueDateTime = formatDateTime(invoice.issuedAt || invoice.createdAt);

  const lines = invoice.items
    .map((item, index) => {
      const amount = roundMoney(item.cantidad * item.precio);
      return `
    <Detalle>
      <NumeroLinea>${index + 1}</NumeroLinea>
      <NombreItem>${escapeXml(item.descripcion)}</NombreItem>
      <CantidadItem>${item.cantidad}</CantidadItem>
      <PrecioUnitarioItem>${formatMoney(item.precio)}</PrecioUnitarioItem>
      <MontoItem>${formatMoney(amount)}</MontoItem>
    </Detalle>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="utf-8"?>
<ECF xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <Encabezado>
    <Version>1.0</Version>
    <IdDoc>
      <TipoeCF>${tipoeCF}</TipoeCF>
      <eNCF>${encf}</eNCF>
      <FechaVencimientoSecuencia>31-12-2026</FechaVencimientoSecuencia>
    </IdDoc>
    <Emisor>
      <RNCEmisor>${escapeXml(data.company.rnc)}</RNCEmisor>
      <RazonSocialEmisor>${escapeXml(data.company.razonSocial)}</RazonSocialEmisor>
      <NombreComercial>${escapeXml(data.company.nombreComercial)}</NombreComercial>
      <DireccionEmisor>${escapeXml(data.company.direccion)}</DireccionEmisor>
      <Municipio>${escapeXml(data.company.municipio)}</Municipio>
      <Provincia>${escapeXml(data.company.provincia)}</Provincia>
      <CorreoEmisor>${escapeXml(data.company.correo)}</CorreoEmisor>
      <FechaEmision>${issueDate}</FechaEmision>
    </Emisor>
    <Comprador>
      <RNCComprador>${escapeXml(customer.rnc)}</RNCComprador>
      <RazonSocialComprador>${escapeXml(customer.razonSocial)}</RazonSocialComprador>
      <CorreoComprador>${escapeXml(customer.correo)}</CorreoComprador>
      <DireccionComprador>${escapeXml(customer.direccion)}</DireccionComprador>
    </Comprador>
    <Totales>
      <MontoGravadoTotal>${formatMoney(invoice.totals.subtotal)}</MontoGravadoTotal>
      <TotalITBIS>${formatMoney(invoice.totals.itbis)}</TotalITBIS>
      <MontoTotal>${formatMoney(invoice.totals.total)}</MontoTotal>
    </Totales>
  </Encabezado>
  <DetallesItems>${lines}
  </DetallesItems>
  <FechaHoraFirma>${issueDateTime}</FechaHoraFirma>
  <TipoeCF>${tipoeCF}</TipoeCF>
  <eNCF>${encf}</eNCF>
  <RNCEmisor>${escapeXml(data.company.rnc)}</RNCEmisor>
  <RNCComprador>${escapeXml(customer.rnc)}</RNCComprador>
</ECF>`;
}

export function buildCommercialApprovalXml(data: AppData, invoice: Invoice) {
  const customer = getInvoiceCustomer(data, invoice);
  return `<?xml version="1.0" encoding="utf-8"?>
<ACECF xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <DetalleAprobacionComercial>
    <Version>1.0</Version>
    <RNCEmisor>${escapeXml(data.company.rnc)}</RNCEmisor>
    <eNCF>${escapeXml(invoice.encf || '')}</eNCF>
    <FechaEmision>${formatDate(invoice.issuedAt || invoice.createdAt)}</FechaEmision>
    <MontoTotal>${formatMoney(invoice.totals.total)}</MontoTotal>
    <RNCComprador>${escapeXml(customer.rnc)}</RNCComprador>
    <Estado>1</Estado>
    <FechaHoraAprobacionComercial>${formatDateTime(new Date().toISOString())}</FechaHoraAprobacionComercial>
  </DetalleAprobacionComercial>
</ACECF>`;
}

export function getInvoiceCustomer(data: AppData, invoice: Invoice) {
  const customer = data.customers.find((item) => item.id === invoice.customerId);
  if (!customer) {
    throw new Error('Cliente de la factura no encontrado');
  }

  return customer;
}

export function validateCompanyReadiness(data: AppData): CertificationTestResult[] {
  return [
    {
      name: 'RNC de empresa',
      ok: /^\d{9,11}$/.test(data.company.rnc),
      detail: 'El RNC debe tener 9 u 11 digitos numericos.',
    },
    {
      name: 'Datos fiscales de empresa',
      ok: Boolean(data.company.razonSocial && data.company.direccion && data.company.correo),
      detail: 'Razon social, direccion y correo deben estar completos.',
    },
    {
      name: 'Clientes configurados',
      ok: data.customers.length > 0,
      detail: 'Debe existir al menos un cliente receptor.',
    },
    {
      name: 'Productos configurados',
      ok: data.products.length > 0,
      detail: 'Debe existir al menos un producto o servicio facturable.',
    },
  ];
}

function normalizeInvoiceItem(data: AppData, item: Partial<InvoiceItem>): InvoiceItem {
  const product = data.products.find((candidate) => candidate.id === item.productId);
  if (!product) {
    throw new Error(`Producto no encontrado: ${item.productId || ''}`);
  }

  const cantidad = Number(item.cantidad || 1);
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    throw new Error('La cantidad debe ser mayor que cero');
  }

  return {
    productId: product.id,
    descripcion: item.descripcion || product.descripcion || product.nombre,
    cantidad,
    precio: Number(item.precio || product.precio),
    itbisRate: Number(item.itbisRate ?? product.itbisRate),
  };
}

function generateEncf(sequence: number) {
  return `E31${String(sequence).padStart(10, '0')}`;
}

function extractTipoEcf(encf: string) {
  const normalized = encf.trim().toUpperCase();
  return /^E\d{12}$/.test(normalized) ? normalized.slice(1, 3) : '31';
}

function createSecurityCode(invoice: Invoice) {
  return Buffer.from(`${invoice.id}-${invoice.totals.total}`)
    .toString('base64')
    .replace(/[^A-Z0-9]/gi, '')
    .slice(0, 6)
    .toUpperCase();
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatMoney(value: number) {
  return roundMoney(value).toFixed(2);
}

function formatDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Santo_Domingo',
  }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'America/Santo_Domingo',
  }).formatToParts(date);
  const map = parts.reduce<Record<string, string>>((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  return `${map.day}-${map.month}-${map.year} ${map.hour}:${map.minute}:${map.second}`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
