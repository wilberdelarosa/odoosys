import crypto from 'node:crypto';

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

export interface FiscalSequence {
  id: string;
  documentType: string;
  prefix: string;
  nextNumber: number;
  endNumber: number;
  expirationDate: string;
  active: boolean;
  description: string;
}

export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia' | 'cheque' | 'otro';
export type PurchasePaymentMethod = PaymentMethod | 'credito';
export type PaymentStatus = 'pendiente' | 'parcial' | 'pagada';
export type UserRole = 'admin' | 'operador' | 'visor';
export type InvoiceKind = 'factura' | 'nota_credito' | 'nota_debito';

export interface LocalUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  passwordSalt: string;
  passwordHash: string;
  mustChangePassword: boolean;
  active: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  createdAt: string;
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
  sku?: string;
  nombre: string;
  descripcion: string;
  precio: number;
  itbisRate: number;
  trackInventory?: boolean;
  stockOnHand?: number;
  reorderPoint?: number;
}

export type InventoryMovementType = 'entrada' | 'salida' | 'ajuste';

export interface InventoryMovement {
  id: string;
  productId: string;
  type: InventoryMovementType;
  quantity: number;
  reason: string;
  referenceId?: string;
  createdAt: string;
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
  documentType: string;
  kind: InvoiceKind;
  relatedInvoiceId?: string;
  modifiedEncf?: string;
  reason?: string;
  items: InvoiceItem[];
  totals: InvoiceTotals;
  status: 'borrador' | 'emitida' | 'rechazada' | 'anulada';
  fiscalStatus: 'sin_enviar' | 'precertificacion_ok' | 'precertificacion_error';
  encf?: string;
  trackId?: string;
  securityCode?: string;
  createdAt: string;
  issuedAt?: string;
  cancelledAt?: string;
  messages: string[];
}

export interface Purchase {
  id: string;
  supplierRnc: string;
  supplierName: string;
  ncf: string;
  date: string;
  tipoBienesServicios: string;
  subtotal: number;
  itbis: number;
  itbisRetenido?: number;
  isrRetenido?: number;
  total: number;
  paymentMethod: PurchasePaymentMethod;
  notes?: string;
  createdAt: string;
}

export type SaleOrderStatus = 'borrador' | 'confirmada' | 'facturada' | 'cancelada';

export interface SaleOrder {
  id: string;
  customerId: string;
  items: InvoiceItem[];
  totals: InvoiceTotals;
  status: SaleOrderStatus;
  invoiceId?: string;
  createdAt: string;
  confirmedAt?: string;
  messages: string[];
}

export interface JournalLine {
  account: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: string;
  source: 'invoice' | 'payment' | 'credit_note' | 'debit_note' | 'cancellation' | 'purchase';
  referenceId: string;
  description: string;
  createdAt: string;
  lines: JournalLine[];
}

export interface AppData {
  company: CompanyProfile;
  fiscalSequences: FiscalSequence[];
  customers: Customer[];
  products: Product[];
  invoices: Invoice[];
  payments: Payment[];
  inventoryMovements: InventoryMovement[];
  saleOrders: SaleOrder[];
  journalEntries: JournalEntry[];
  purchases: Purchase[];
  users: LocalUser[];
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
    fiscalSequences: [
      {
        id: 'seq-e31-demo',
        documentType: 'E31',
        prefix: 'E31',
        nextNumber: 1,
        endNumber: 9999999999,
        expirationDate: '2026-12-31',
        active: true,
        description: 'Factura de credito fiscal electronica demo',
      },
      {
        id: 'seq-e33-demo',
        documentType: 'E33',
        prefix: 'E33',
        nextNumber: 1,
        endNumber: 9999999999,
        expirationDate: '2026-12-31',
        active: true,
        description: 'Nota de debito electronica demo',
      },
      {
        id: 'seq-e34-demo',
        documentType: 'E34',
        prefix: 'E34',
        nextNumber: 1,
        endNumber: 9999999999,
        expirationDate: '2026-12-31',
        active: true,
        description: 'Nota de credito electronica demo',
      },
    ],
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
        trackInventory: false,
        stockOnHand: 0,
        reorderPoint: 0,
      },
      {
        id: 'licencia-demo',
        nombre: 'Licencia mensual',
        descripcion: 'Servicio mensual de soporte del gateway e-CF',
        precio: 3500,
        itbisRate: 0.18,
        trackInventory: false,
        stockOnHand: 0,
        reorderPoint: 0,
      },
    ],
    invoices: [],
    payments: [],
    inventoryMovements: [],
    saleOrders: [],
    journalEntries: [],
    purchases: [],
    users: [createDefaultAdminUser()],
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
  payload: { customerId: string; documentType?: string; items: Array<Partial<InvoiceItem>> }
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
    documentType: normalizeDocumentType(payload.documentType || 'E31'),
    kind: 'factura',
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

  if (invoice.status === 'emitida') {
    return invoice;
  }

  ensureInvoiceIsIssuable(data, invoice);
  const reservation = reserveFiscalNumber(data, invoice.documentType || 'E31');

  invoice.documentType = reservation.documentType;
  invoice.encf = reservation.encf;
  invoice.status = 'emitida';
  invoice.fiscalStatus = 'precertificacion_ok';
  invoice.issuedAt = new Date().toISOString();
  invoice.trackId = createId('track');
  invoice.securityCode = createSecurityCode(invoice);
  invoice.messages.push(
    `${describeInvoiceKind(invoice)} emitida en ambiente local de precertificacion.`
  );
  applyIssueSideEffects(data, invoice);

  return invoice;
}

export function issueInvoiceWithEncf(
  data: AppData,
  invoiceId: string,
  externalEncf: string
) {
  const invoice = data.invoices.find((item) => item.id === invoiceId);
  if (!invoice) {
    throw new Error('Factura no encontrada');
  }

  const encf = externalEncf.trim().toUpperCase();

  if (!/^E\d{12}$/.test(encf)) {
    throw new Error('El e-NCF enviado por Odoo debe tener formato E + 12 digitos');
  }

  if (data.invoices.some((item) => item.id !== invoice.id && item.encf === encf)) {
    throw new Error(`El e-NCF ${encf} ya existe en otra factura`);
  }

  if (invoice.status === 'emitida') {
    return invoice;
  }

  ensureInvoiceIsIssuable(data, invoice);
  invoice.encf = encf;
  invoice.documentType = normalizeDocumentType(`E${encf.slice(1, 3)}`);
  invoice.status = 'emitida';
  invoice.fiscalStatus = 'precertificacion_ok';
  invoice.issuedAt = new Date().toISOString();
  invoice.trackId = createId('track');
  invoice.securityCode = createSecurityCode(invoice);
  invoice.messages.push('e-NCF recibido desde Odoo y usado para el XML firmado.');
  applyIssueSideEffects(data, invoice);

  return invoice;
}

export function recordPayment(
  data: AppData,
  invoiceId: string,
  payload: { amount?: number; method?: string; reference?: string }
): Payment {
  const invoice = data.invoices.find((item) => item.id === invoiceId);
  if (!invoice) {
    throw new Error('Factura no encontrada');
  }

  if (invoice.status !== 'emitida') {
    throw new Error('Solo se pueden registrar cobros a facturas emitidas');
  }

  if ((invoice.kind || 'factura') === 'nota_credito') {
    throw new Error('No se pueden registrar cobros a una nota de credito');
  }

  const amount = roundMoney(Number(payload.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('El monto cobrado debe ser mayor que cero');
  }

  const balanceDue = getInvoiceBalance(data, invoice);
  if (amount > balanceDue) {
    throw new Error('El cobro excede el saldo pendiente de la factura');
  }

  const payment: Payment = {
    id: createId('cobro'),
    invoiceId: invoice.id,
    amount,
    method: normalizePaymentMethod(payload.method),
    reference: String(payload.reference || '').trim(),
    createdAt: new Date().toISOString(),
  };

  data.payments.unshift(payment);
  invoice.messages.push(
    `Cobro registrado por ${formatMoney(payment.amount)} via ${payment.method}.`
  );
  postPaymentJournalEntry(data, payment, invoice);

  return payment;
}

export function recordInventoryMovement(
  data: AppData,
  payload: {
    productId?: string;
    type?: string;
    quantity?: number;
    reason?: string;
    referenceId?: string;
  }
): InventoryMovement {
  const product = data.products.find((item) => item.id === payload.productId);
  if (!product) {
    throw new Error('Producto no encontrado');
  }

  const type = normalizeInventoryMovementType(payload.type);
  const quantity = roundQuantity(Number(payload.quantity));
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('La cantidad de inventario debe ser mayor que cero');
  }

  const currentStock = Number(product.stockOnHand || 0);
  const nextStock =
    type === 'entrada'
      ? currentStock + quantity
      : type === 'salida'
        ? currentStock - quantity
        : quantity;

  if (nextStock < 0) {
    throw new Error(`Stock insuficiente para ${product.nombre}`);
  }

  product.trackInventory = true;
  product.stockOnHand = roundQuantity(nextStock);

  const movement: InventoryMovement = {
    id: createId('movimiento'),
    productId: product.id,
    type,
    quantity,
    reason: String(payload.reason || 'Movimiento manual'),
    referenceId: payload.referenceId ? String(payload.referenceId) : undefined,
    createdAt: new Date().toISOString(),
  };

  data.inventoryMovements.unshift(movement);
  return movement;
}

export function createSaleOrder(
  data: AppData,
  payload: { customerId?: string; items?: Array<Partial<InvoiceItem>> }
): SaleOrder {
  const customer = data.customers.find((item) => item.id === payload.customerId);
  if (!customer) {
    throw new Error('Cliente no encontrado');
  }

  const items = (payload.items || []).map((item) => normalizeInvoiceItem(data, item));
  if (!items.length) {
    throw new Error('La orden debe tener al menos una linea');
  }

  const saleOrder: SaleOrder = {
    id: createId('orden'),
    customerId: customer.id,
    items,
    totals: calculateTotals(items),
    status: 'borrador',
    createdAt: new Date().toISOString(),
    messages: ['Orden de venta creada en borrador.'],
  };

  data.saleOrders.unshift(saleOrder);
  return saleOrder;
}

export function confirmSaleOrder(data: AppData, saleOrderId: string) {
  const saleOrder = findSaleOrder(data, saleOrderId);
  if (saleOrder.status === 'cancelada') {
    throw new Error('No se puede confirmar una orden cancelada');
  }

  ensureInventoryForItems(data, saleOrder.items);
  saleOrder.status = 'confirmada';
  saleOrder.confirmedAt = new Date().toISOString();
  saleOrder.messages.push('Orden confirmada con inventario disponible.');
  return saleOrder;
}

export function invoiceSaleOrder(
  data: AppData,
  saleOrderId: string,
  documentType = 'E31'
) {
  const saleOrder = findSaleOrder(data, saleOrderId);
  if (saleOrder.invoiceId) {
    return data.invoices.find((invoice) => invoice.id === saleOrder.invoiceId)!;
  }

  if (saleOrder.status === 'borrador') {
    confirmSaleOrder(data, saleOrder.id);
  }

  if (saleOrder.status !== 'confirmada') {
    throw new Error('Solo se pueden facturar ordenes confirmadas');
  }

  const invoice = createInvoice(data, {
    customerId: saleOrder.customerId,
    documentType,
    items: saleOrder.items,
  });
  saleOrder.status = 'facturada';
  saleOrder.invoiceId = invoice.id;
  saleOrder.messages.push(`Orden convertida en factura ${invoice.id}.`);

  return invoice;
}

export function getInventorySummary(data: AppData) {
  return data.products.map((product) => ({
    product,
    stockOnHand: Number(product.stockOnHand || 0),
    reorderPoint: Number(product.reorderPoint || 0),
    lowStock:
      Boolean(product.trackInventory) &&
      Number(product.stockOnHand || 0) <= Number(product.reorderPoint || 0),
    movements: data.inventoryMovements.filter(
      (movement) => movement.productId === product.id
    ),
  }));
}

export function getAccountingSummary(data: AppData) {
  const balances = new Map<string, { debit: number; credit: number; balance: number }>();

  for (const entry of data.journalEntries) {
    for (const line of entry.lines) {
      const current = balances.get(line.account) || {
        debit: 0,
        credit: 0,
        balance: 0,
      };
      current.debit = roundMoney(current.debit + line.debit);
      current.credit = roundMoney(current.credit + line.credit);
      current.balance = roundMoney(current.debit - current.credit);
      balances.set(line.account, current);
    }
  }

  return {
    entries: data.journalEntries,
    balances: Array.from(balances.entries()).map(([account, balance]) => ({
      account,
      ...balance,
    })),
    balanced: data.journalEntries.every((entry) => isBalanced(entry.lines)),
  };
}

export function authenticateLocalUser(
  data: AppData,
  payload: { username?: string; password?: string }
) {
  const username = String(payload.username || '').trim().toLowerCase();
  const password = String(payload.password || '');
  const user = data.users.find(
    (candidate) => candidate.active && candidate.username.toLowerCase() === username
  );

  if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    throw new Error('Credenciales invalidas');
  }

  user.lastLoginAt = new Date().toISOString();
  return user;
}

export function changeLocalUserPassword(
  data: AppData,
  userId: string,
  payload: { currentPassword?: string; newPassword?: string }
) {
  const user = data.users.find((candidate) => candidate.id === userId);
  if (!user || !user.active) {
    throw new Error('Usuario no encontrado');
  }

  const currentPassword = String(payload.currentPassword || '');
  const newPassword = String(payload.newPassword || '');

  if (!verifyPassword(currentPassword, user.passwordSalt, user.passwordHash)) {
    throw new Error('La contrasena actual no es valida');
  }

  validatePasswordStrength(newPassword);
  const next = createPasswordHash(newPassword);
  user.passwordSalt = next.salt;
  user.passwordHash = next.hash;
  user.mustChangePassword = false;
  return user;
}

export function sanitizeLocalUser(user: LocalUser) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    active: user.active,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

export function getInvoicePayments(data: AppData, invoice: Invoice) {
  return data.payments.filter((payment) => payment.invoiceId === invoice.id);
}

export function getInvoicePaidAmount(data: AppData, invoice: Invoice) {
  return roundMoney(
    getInvoicePayments(data, invoice).reduce(
      (total, payment) => total + payment.amount,
      0
    )
  );
}

export function getInvoiceCreditNotes(data: AppData, invoice: Invoice) {
  return data.invoices.filter(
    (item) => item.kind === 'nota_credito' && item.relatedInvoiceId === invoice.id
  );
}

export function getInvoiceCreditedAmount(data: AppData, invoice: Invoice) {
  return roundMoney(
    getInvoiceCreditNotes(data, invoice)
      .filter((note) => note.status === 'emitida')
      .reduce((total, note) => total + note.totals.total, 0)
  );
}

export function getInvoiceBalance(data: AppData, invoice: Invoice) {
  return roundMoney(
    Math.max(
      invoice.totals.total -
        getInvoicePaidAmount(data, invoice) -
        getInvoiceCreditedAmount(data, invoice),
      0
    )
  );
}

export function getInvoicePaymentStatus(
  data: AppData,
  invoice: Invoice
): PaymentStatus {
  const coveredAmount = roundMoney(
    getInvoicePaidAmount(data, invoice) + getInvoiceCreditedAmount(data, invoice)
  );
  if (coveredAmount <= 0) {
    return 'pendiente';
  }

  return coveredAmount >= invoice.totals.total ? 'pagada' : 'parcial';
}

export function createCreditNote(
  data: AppData,
  payload: { invoiceId: string; items?: Array<Partial<InvoiceItem>>; reason?: string }
): Invoice {
  const original = findOriginalInvoiceForNote(data, payload.invoiceId, 'nota de credito');
  const reason = String(payload.reason || '').trim();
  if (!reason) {
    throw new Error('Debe indicar el motivo de la nota de credito');
  }

  const items = normalizeCreditNoteItems(original, payload.items);
  validateCreditNoteQuantities(data, original, items);

  const note: Invoice = {
    id: createId('nota-credito'),
    customerId: original.customerId,
    documentType: resolveCreditNoteDocumentType(original.documentType),
    kind: 'nota_credito',
    relatedInvoiceId: original.id,
    modifiedEncf: original.encf,
    reason,
    items,
    totals: calculateTotals(items),
    status: 'borrador',
    fiscalStatus: 'sin_enviar',
    createdAt: new Date().toISOString(),
    messages: [
      `Nota de credito creada en borrador sobre la factura ${original.encf}. Motivo: ${reason}.`,
    ],
  };

  data.invoices.unshift(note);
  original.messages.push(`Nota de credito ${note.id} creada. Motivo: ${reason}.`);
  return note;
}

export function createDebitNote(
  data: AppData,
  payload: { invoiceId: string; items?: Array<Partial<InvoiceItem>>; reason?: string }
): Invoice {
  const original = findOriginalInvoiceForNote(data, payload.invoiceId, 'nota de debito');
  const reason = String(payload.reason || '').trim();
  if (!reason) {
    throw new Error('Debe indicar el motivo de la nota de debito');
  }

  if (!Array.isArray(payload.items) || !payload.items.length) {
    throw new Error('La nota de debito debe incluir al menos una linea');
  }

  const items = payload.items.map((item) => normalizeInvoiceItem(data, item));

  const note: Invoice = {
    id: createId('nota-debito'),
    customerId: original.customerId,
    documentType: resolveDebitNoteDocumentType(original.documentType),
    kind: 'nota_debito',
    relatedInvoiceId: original.id,
    modifiedEncf: original.encf,
    reason,
    items,
    totals: calculateTotals(items),
    status: 'borrador',
    fiscalStatus: 'sin_enviar',
    createdAt: new Date().toISOString(),
    messages: [
      `Nota de debito creada en borrador sobre la factura ${original.encf}. Motivo: ${reason}.`,
    ],
  };

  data.invoices.unshift(note);
  original.messages.push(`Nota de debito ${note.id} creada. Motivo: ${reason}.`);
  return note;
}

export function cancelInvoice(
  data: AppData,
  payload: { invoiceId: string; reason?: string }
): Invoice {
  const invoice = data.invoices.find((item) => item.id === payload.invoiceId);
  if (!invoice) {
    throw new Error('Factura no encontrada');
  }

  const reason = String(payload.reason || '').trim();
  if (!reason) {
    throw new Error('Debe indicar el motivo de la anulacion');
  }

  if (invoice.status === 'anulada') {
    return invoice;
  }

  if (invoice.status === 'borrador') {
    invoice.status = 'anulada';
    invoice.cancelledAt = new Date().toISOString();
    invoice.reason = reason;
    invoice.messages.push(`Documento en borrador anulado. Motivo: ${reason}.`);
    return invoice;
  }

  if (invoice.status !== 'emitida') {
    throw new Error('Solo se pueden anular documentos en borrador o emitidos');
  }

  if ((invoice.kind || 'factura') !== 'factura') {
    throw new Error('Las notas emitidas no se pueden anular directamente');
  }

  if (getInvoicePayments(data, invoice).length > 0) {
    throw new Error(
      'La factura tiene cobros registrados; para revertirla use una nota de credito'
    );
  }

  if (getInvoiceCreditNotes(data, invoice).some((note) => note.status === 'emitida')) {
    throw new Error(
      'La factura tiene notas de credito emitidas vinculadas; no se puede anular'
    );
  }

  invoice.status = 'anulada';
  invoice.cancelledAt = new Date().toISOString();
  invoice.reason = reason;
  invoice.messages.push(
    `Factura anulada. Motivo: ${reason}. El e-NCF ${invoice.encf} queda registrado para el reporte 608.`
  );
  postCancellationJournalEntry(data, invoice);
  restoreInventoryForInvoice(
    data,
    invoice,
    `Reingreso por anulacion de factura ${invoice.encf || invoice.id}`
  );

  return invoice;
}

export function createPurchase(
  data: AppData,
  payload: {
    supplierRnc?: string;
    supplierName?: string;
    ncf?: string;
    date?: string;
    tipoBienesServicios?: string;
    subtotal?: number;
    itbis?: number;
    itbisRetenido?: number;
    isrRetenido?: number;
    total?: number;
    paymentMethod?: string;
    notes?: string;
  }
): Purchase {
  const supplierRnc = String(payload.supplierRnc || '').replace(/\D/g, '');
  if (!/^(\d{9}|\d{11})$/.test(supplierRnc)) {
    throw new Error('El RNC o cedula del suplidor debe tener 9 u 11 digitos numericos');
  }

  const supplierName = String(payload.supplierName || '').trim();
  if (!supplierName) {
    throw new Error('El nombre del suplidor es requerido');
  }

  const ncf = String(payload.ncf || '').trim().toUpperCase();
  if (!ncf) {
    throw new Error('El NCF de la compra es requerido');
  }

  const date = String(payload.date || new Date().toISOString().slice(0, 10)).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('La fecha de la compra debe tener formato YYYY-MM-DD');
  }

  const tipoBienesServicios = normalizeTipoBienesServicios(payload.tipoBienesServicios);

  const subtotal = roundMoney(Number(payload.subtotal));
  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    throw new Error('El subtotal de la compra debe ser mayor que cero');
  }

  const itbis = roundMoney(Number(payload.itbis ?? 0));
  if (!Number.isFinite(itbis) || itbis < 0) {
    throw new Error('El ITBIS de la compra debe ser mayor o igual que cero');
  }

  const expectedTotal = roundMoney(subtotal + itbis);
  const total =
    payload.total === undefined || payload.total === null
      ? expectedTotal
      : roundMoney(Number(payload.total));
  if (!Number.isFinite(total) || total !== expectedTotal) {
    throw new Error('El total de la compra debe ser igual a subtotal + ITBIS');
  }

  const itbisRetenido = normalizeOptionalAmount(
    payload.itbisRetenido,
    'El ITBIS retenido debe ser un monto mayor o igual que cero'
  );
  const isrRetenido = normalizeOptionalAmount(
    payload.isrRetenido,
    'El ISR retenido debe ser un monto mayor o igual que cero'
  );

  const purchase: Purchase = {
    id: createId('compra'),
    supplierRnc,
    supplierName,
    ncf,
    date,
    tipoBienesServicios,
    subtotal,
    itbis,
    itbisRetenido,
    isrRetenido,
    total,
    paymentMethod: normalizePurchasePaymentMethod(payload.paymentMethod),
    notes: payload.notes ? String(payload.notes).trim() : undefined,
    createdAt: new Date().toISOString(),
  };

  data.purchases.unshift(purchase);
  postPurchaseJournalEntry(data, purchase);
  return purchase;
}

export function createFiscalSequence(
  data: AppData,
  payload: Partial<FiscalSequence>
): FiscalSequence {
  const documentType = normalizeDocumentType(payload.documentType || payload.prefix || '');
  const prefix = normalizeDocumentType(payload.prefix || documentType);
  const nextNumber = Number(payload.nextNumber || 1);
  const endNumber = Number(payload.endNumber || 9999999999);

  validateFiscalSequenceInput(documentType, prefix, nextNumber, endNumber);

  if (
    data.fiscalSequences.some(
      (sequence) => sequence.active && sequence.documentType === documentType
    )
  ) {
    throw new Error(`Ya existe una secuencia activa para ${documentType}`);
  }

  const sequence: FiscalSequence = {
    id: createId('secuencia'),
    documentType,
    prefix,
    nextNumber,
    endNumber,
    expirationDate: String(payload.expirationDate || '2026-12-31'),
    active: payload.active ?? true,
    description: String(payload.description || `Secuencia ${documentType}`),
  };

  data.fiscalSequences.unshift(sequence);
  return sequence;
}

export function updateFiscalSequence(
  data: AppData,
  sequenceId: string,
  payload: Partial<FiscalSequence>
): FiscalSequence {
  const sequence = data.fiscalSequences.find((item) => item.id === sequenceId);
  if (!sequence) {
    throw new Error('Secuencia fiscal no encontrada');
  }

  const documentType = normalizeDocumentType(
    payload.documentType || sequence.documentType
  );
  const prefix = normalizeDocumentType(payload.prefix || sequence.prefix);
  const nextNumber = Number(payload.nextNumber ?? sequence.nextNumber);
  const endNumber = Number(payload.endNumber ?? sequence.endNumber);

  validateFiscalSequenceInput(documentType, prefix, nextNumber, endNumber);

  const active = payload.active ?? sequence.active;
  if (
    active &&
    data.fiscalSequences.some(
      (item) =>
        item.id !== sequence.id &&
        item.active &&
        item.documentType === documentType
    )
  ) {
    throw new Error(`Ya existe una secuencia activa para ${documentType}`);
  }

  sequence.documentType = documentType;
  sequence.prefix = prefix;
  sequence.nextNumber = nextNumber;
  sequence.endNumber = endNumber;
  sequence.expirationDate = String(
    payload.expirationDate || sequence.expirationDate
  );
  sequence.active = active;
  sequence.description = String(payload.description || sequence.description);

  return sequence;
}

export function buildEcfXml(data: AppData, invoice: Invoice) {
  const customer = getInvoiceCustomer(data, invoice);
  const encf = invoice.encf || previewFiscalNumber(data, invoice.documentType || 'E31');
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
    </Totales>${buildReferenceXml(data, invoice)}
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

function buildReferenceXml(data: AppData, invoice: Invoice) {
  const kind = invoice.kind || 'factura';
  if (kind === 'factura' || !invoice.modifiedEncf) {
    return '';
  }

  const original = data.invoices.find((item) => item.id === invoice.relatedInvoiceId);
  const referenceDate = formatDate(
    original?.issuedAt || original?.createdAt || invoice.createdAt
  );

  return `
    <InformacionReferencia>
      <NCFModificado>${escapeXml(invoice.modifiedEncf)}</NCFModificado>
      <FechaNCFModificado>${referenceDate}</FechaNCFModificado>
      <CodigoModificacion>3</CodigoModificacion>
    </InformacionReferencia>`;
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
    {
      name: 'Secuencias e-NCF configuradas',
      ok: data.fiscalSequences.some(
        (sequence) => sequence.active && sequence.nextNumber <= sequence.endNumber
      ),
      detail: 'Debe existir al menos una secuencia e-NCF activa con rango disponible.',
    },
    {
      name: 'Inventario local coherente',
      ok: data.products.every((product) => Number(product.stockOnHand || 0) >= 0),
      detail: 'Los productos inventariables no deben quedar con stock negativo.',
    },
    {
      name: 'Contabilidad balanceada',
      ok: data.journalEntries.every((entry) => isBalanced(entry.lines)),
      detail: 'Cada asiento local debe cumplir partida doble: debitos igual a creditos.',
    },
  ];
}

function findSaleOrder(data: AppData, saleOrderId: string) {
  const saleOrder = data.saleOrders.find((item) => item.id === saleOrderId);
  if (!saleOrder) {
    throw new Error('Orden de venta no encontrada');
  }

  return saleOrder;
}

function ensureInventoryForInvoice(data: AppData, invoice: Invoice) {
  ensureInventoryForItems(data, invoice.items);
}

function ensureInventoryForItems(data: AppData, items: InvoiceItem[]) {
  for (const item of items) {
    const product = data.products.find((candidate) => candidate.id === item.productId);
    if (!product?.trackInventory) {
      continue;
    }

    if (Number(product.stockOnHand || 0) < item.cantidad) {
      throw new Error(`Stock insuficiente para ${product.nombre}`);
    }
  }
}

function consumeInventoryForInvoice(data: AppData, invoice: Invoice) {
  for (const item of invoice.items) {
    const product = data.products.find((candidate) => candidate.id === item.productId);
    if (!product?.trackInventory) {
      continue;
    }

    recordInventoryMovement(data, {
      productId: product.id,
      type: 'salida',
      quantity: item.cantidad,
      reason: `Salida por factura ${invoice.encf || invoice.id}`,
      referenceId: invoice.id,
    });
  }
}

function restoreInventoryForInvoice(data: AppData, invoice: Invoice, reason: string) {
  for (const item of invoice.items) {
    const product = data.products.find((candidate) => candidate.id === item.productId);
    if (!product?.trackInventory) {
      continue;
    }

    recordInventoryMovement(data, {
      productId: product.id,
      type: 'entrada',
      quantity: item.cantidad,
      reason,
      referenceId: invoice.id,
    });
  }
}

function ensureInvoiceIsIssuable(data: AppData, invoice: Invoice) {
  if (invoice.status === 'anulada') {
    throw new Error('No se puede emitir un documento anulado');
  }

  const kind = invoice.kind || 'factura';
  if (kind === 'factura') {
    ensureInventoryForInvoice(data, invoice);
    return;
  }

  if (invoice.relatedInvoiceId) {
    const original = data.invoices.find((item) => item.id === invoice.relatedInvoiceId);
    if (original && original.status === 'anulada') {
      throw new Error('La factura original de la nota esta anulada');
    }
  }
}

function applyIssueSideEffects(data: AppData, invoice: Invoice) {
  const kind = invoice.kind || 'factura';

  if (kind === 'factura') {
    consumeInventoryForInvoice(data, invoice);
    postInvoiceJournalEntry(data, invoice);
    return;
  }

  if (kind === 'nota_credito') {
    restoreInventoryForInvoice(
      data,
      invoice,
      `Reingreso por nota de credito ${invoice.encf || invoice.id}`
    );
    postCreditNoteJournalEntry(data, invoice);
    return;
  }

  postDebitNoteJournalEntry(data, invoice);
}

function describeInvoiceKind(invoice: Invoice) {
  const kind = invoice.kind || 'factura';
  if (kind === 'nota_credito') {
    return 'Nota de credito';
  }
  if (kind === 'nota_debito') {
    return 'Nota de debito';
  }
  return 'Factura';
}

function findOriginalInvoiceForNote(data: AppData, invoiceId: string, label: string) {
  const original = data.invoices.find((item) => item.id === invoiceId);
  if (!original) {
    throw new Error('Factura original no encontrada');
  }

  if ((original.kind || 'factura') !== 'factura') {
    throw new Error(`Solo se puede crear una ${label} sobre una factura`);
  }

  if (original.status !== 'emitida' || !original.encf) {
    throw new Error(`La factura original debe estar emitida con e-NCF para crear una ${label}`);
  }

  return original;
}

function normalizeCreditNoteItems(
  original: Invoice,
  items: Array<Partial<InvoiceItem>> | undefined
): InvoiceItem[] {
  if (!Array.isArray(items) || !items.length) {
    return original.items.map((item) => ({ ...item }));
  }

  return items.map((item) => {
    const originalLine = original.items.find((line) => line.productId === item.productId);
    if (!originalLine) {
      throw new Error(
        `El producto ${item.productId || ''} no pertenece a la factura original`
      );
    }

    const cantidad = roundQuantity(Number(item.cantidad ?? originalLine.cantidad));
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      throw new Error('La cantidad acreditada debe ser mayor que cero');
    }

    return {
      productId: originalLine.productId,
      descripcion: originalLine.descripcion,
      cantidad,
      precio: originalLine.precio,
      itbisRate: originalLine.itbisRate,
    };
  });
}

function validateCreditNoteQuantities(
  data: AppData,
  original: Invoice,
  items: InvoiceItem[]
) {
  const invoicedByProduct = new Map<string, number>();
  for (const line of original.items) {
    invoicedByProduct.set(
      line.productId,
      roundQuantity((invoicedByProduct.get(line.productId) || 0) + line.cantidad)
    );
  }

  const creditedByProduct = new Map<string, number>();
  for (const note of data.invoices) {
    if (note.kind !== 'nota_credito' || note.relatedInvoiceId !== original.id) {
      continue;
    }
    if (note.status === 'anulada' || note.status === 'rechazada') {
      continue;
    }
    for (const line of note.items) {
      creditedByProduct.set(
        line.productId,
        roundQuantity((creditedByProduct.get(line.productId) || 0) + line.cantidad)
      );
    }
  }

  const requestedByProduct = new Map<string, number>();
  for (const line of items) {
    requestedByProduct.set(
      line.productId,
      roundQuantity((requestedByProduct.get(line.productId) || 0) + line.cantidad)
    );
  }

  for (const [productId, requested] of requestedByProduct.entries()) {
    const invoiced = invoicedByProduct.get(productId) || 0;
    const credited = creditedByProduct.get(productId) || 0;
    if (roundQuantity(credited + requested) > invoiced) {
      throw new Error(
        `Las cantidades acreditadas exceden lo facturado para el producto ${productId}`
      );
    }
  }
}

function resolveCreditNoteDocumentType(originalDocumentType: string) {
  const normalized = String(originalDocumentType || '').trim().toUpperCase();
  if (normalized === 'B01' || normalized === 'B02') {
    return 'B04';
  }
  return 'E34';
}

function resolveDebitNoteDocumentType(originalDocumentType: string) {
  const normalized = String(originalDocumentType || '').trim().toUpperCase();
  if (normalized === 'B01' || normalized === 'B02') {
    return 'B03';
  }
  return 'E33';
}

function normalizeTipoBienesServicios(value: string | undefined) {
  const raw = String(value ?? '').trim();
  const normalized = (raw || '09').padStart(2, '0');
  const numeric = Number(normalized);
  if (!/^\d{2}$/.test(normalized) || !Number.isInteger(numeric) || numeric < 1 || numeric > 11) {
    throw new Error('El tipo de bienes y servicios debe ser un codigo entre 01 y 11');
  }
  return normalized;
}

function normalizePurchasePaymentMethod(value: string | undefined): PurchasePaymentMethod {
  const normalized = String(value || 'efectivo').trim().toLowerCase();
  const allowed: PurchasePaymentMethod[] = [
    'efectivo',
    'tarjeta',
    'transferencia',
    'cheque',
    'credito',
    'otro',
  ];

  if (allowed.includes(normalized as PurchasePaymentMethod)) {
    return normalized as PurchasePaymentMethod;
  }

  return 'otro';
}

function normalizeOptionalAmount(value: unknown, message: string) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const amount = roundMoney(Number(value));
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(message);
  }

  return amount;
}

function postInvoiceJournalEntry(data: AppData, invoice: Invoice) {
  if (data.journalEntries.some((entry) => entry.source === 'invoice' && entry.referenceId === invoice.id)) {
    return;
  }

  const lines: JournalLine[] = [
    { account: 'Cuentas por cobrar', debit: invoice.totals.total, credit: 0 },
    { account: 'Ingresos por ventas', debit: 0, credit: invoice.totals.subtotal },
  ];

  if (invoice.totals.itbis > 0) {
    lines.push({ account: 'ITBIS por pagar', debit: 0, credit: invoice.totals.itbis });
  }

  pushBalancedJournalEntry(data, {
    source: 'invoice',
    referenceId: invoice.id,
    description: `Factura ${invoice.encf || invoice.id}`,
    lines,
  });
}

function postCreditNoteJournalEntry(data: AppData, note: Invoice) {
  if (
    data.journalEntries.some(
      (entry) => entry.source === 'credit_note' && entry.referenceId === note.id
    )
  ) {
    return;
  }

  const lines: JournalLine[] = [
    { account: 'Ingresos por ventas', debit: note.totals.subtotal, credit: 0 },
  ];

  if (note.totals.itbis > 0) {
    lines.push({ account: 'ITBIS por pagar', debit: note.totals.itbis, credit: 0 });
  }

  lines.push({ account: 'Cuentas por cobrar', debit: 0, credit: note.totals.total });

  pushBalancedJournalEntry(data, {
    source: 'credit_note',
    referenceId: note.id,
    description: `Nota de credito ${note.encf || note.id} (modifica ${note.modifiedEncf || ''})`,
    lines,
  });
}

function postDebitNoteJournalEntry(data: AppData, note: Invoice) {
  if (
    data.journalEntries.some(
      (entry) => entry.source === 'debit_note' && entry.referenceId === note.id
    )
  ) {
    return;
  }

  const lines: JournalLine[] = [
    { account: 'Cuentas por cobrar', debit: note.totals.total, credit: 0 },
    { account: 'Ingresos por ventas', debit: 0, credit: note.totals.subtotal },
  ];

  if (note.totals.itbis > 0) {
    lines.push({ account: 'ITBIS por pagar', debit: 0, credit: note.totals.itbis });
  }

  pushBalancedJournalEntry(data, {
    source: 'debit_note',
    referenceId: note.id,
    description: `Nota de debito ${note.encf || note.id} (modifica ${note.modifiedEncf || ''})`,
    lines,
  });
}

function postCancellationJournalEntry(data: AppData, invoice: Invoice) {
  if (
    data.journalEntries.some(
      (entry) => entry.source === 'cancellation' && entry.referenceId === invoice.id
    )
  ) {
    return;
  }

  const lines: JournalLine[] = [
    { account: 'Ingresos por ventas', debit: invoice.totals.subtotal, credit: 0 },
  ];

  if (invoice.totals.itbis > 0) {
    lines.push({ account: 'ITBIS por pagar', debit: invoice.totals.itbis, credit: 0 });
  }

  lines.push({ account: 'Cuentas por cobrar', debit: 0, credit: invoice.totals.total });

  pushBalancedJournalEntry(data, {
    source: 'cancellation',
    referenceId: invoice.id,
    description: `Anulacion factura ${invoice.encf || invoice.id}`,
    lines,
  });
}

function postPurchaseJournalEntry(data: AppData, purchase: Purchase) {
  const counterAccount =
    purchase.paymentMethod === 'efectivo'
      ? 'Caja'
      : purchase.paymentMethod === 'credito'
        ? 'Cuentas por pagar'
        : 'Banco';

  const lines: JournalLine[] = [
    { account: 'Compras y gastos', debit: purchase.subtotal, credit: 0 },
  ];

  if (purchase.itbis > 0) {
    lines.push({ account: 'ITBIS adelantado', debit: purchase.itbis, credit: 0 });
  }

  lines.push({ account: counterAccount, debit: 0, credit: purchase.total });

  pushBalancedJournalEntry(data, {
    source: 'purchase',
    referenceId: purchase.id,
    description: `Compra ${purchase.ncf} de ${purchase.supplierName}`,
    lines,
  });
}

function postPaymentJournalEntry(data: AppData, payment: Payment, invoice: Invoice) {
  pushBalancedJournalEntry(data, {
    source: 'payment',
    referenceId: payment.id,
    description: `Cobro factura ${invoice.encf || invoice.id}`,
    lines: [
      { account: payment.method === 'efectivo' ? 'Caja' : 'Banco', debit: payment.amount, credit: 0 },
      { account: 'Cuentas por cobrar', debit: 0, credit: payment.amount },
    ],
  });
}

function pushBalancedJournalEntry(
  data: AppData,
  payload: Omit<JournalEntry, 'id' | 'createdAt'>
) {
  if (!isBalanced(payload.lines)) {
    throw new Error('El asiento contable no esta balanceado');
  }

  data.journalEntries.unshift({
    id: createId('asiento'),
    createdAt: new Date().toISOString(),
    ...payload,
  });
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

function reserveFiscalNumber(data: AppData, requestedDocumentType: string) {
  const documentType = normalizeDocumentType(requestedDocumentType);
  const sequence = data.fiscalSequences.find(
    (item) => item.active && item.documentType === documentType
  );

  if (!sequence) {
    throw new Error(`No hay secuencia e-NCF activa para ${documentType}`);
  }

  if (sequence.nextNumber > sequence.endNumber) {
    throw new Error(`La secuencia ${documentType} no tiene numeros disponibles`);
  }

  const encf = formatEncf(sequence.prefix, sequence.nextNumber);
  sequence.nextNumber += 1;

  if (documentType === 'E31') {
    data.company.nextSequence = sequence.nextNumber;
  }

  return { documentType, encf };
}

function normalizeInventoryMovementType(value: string | undefined): InventoryMovementType {
  const normalized = String(value || 'entrada').trim().toLowerCase();
  if (normalized === 'entrada' || normalized === 'salida' || normalized === 'ajuste') {
    return normalized;
  }

  throw new Error('Tipo de movimiento de inventario invalido');
}

function isBalanced(lines: JournalLine[]) {
  const totals = lines.reduce(
    (acc, line) => {
      acc.debit += line.debit;
      acc.credit += line.credit;
      return acc;
    },
    { debit: 0, credit: 0 }
  );

  return roundMoney(totals.debit) === roundMoney(totals.credit);
}

function previewFiscalNumber(data: AppData, requestedDocumentType: string) {
  const documentType = normalizeDocumentType(requestedDocumentType);
  const sequence = data.fiscalSequences.find(
    (item) => item.active && item.documentType === documentType
  );

  if (!sequence) {
    return formatEncf(documentType, data.company.nextSequence || 1);
  }

  return formatEncf(sequence.prefix, sequence.nextNumber);
}

function formatEncf(prefix: string, sequence: number) {
  return `${normalizeDocumentType(prefix)}${String(sequence).padStart(10, '0')}`;
}

function normalizeDocumentType(value: string) {
  const normalized = String(value || '').trim().toUpperCase();
  if (/^E\d{2}$/.test(normalized)) {
    return normalized;
  }
  if (/^\d{2}$/.test(normalized)) {
    return `E${normalized}`;
  }
  throw new Error('El tipo de documento e-CF debe tener formato E31, E32, E33...');
}

function extractTipoEcf(encf: string) {
  const normalized = encf.trim().toUpperCase();
  return /^E\d{12}$/.test(normalized) ? normalized.slice(1, 3) : '31';
}

function validateFiscalSequenceInput(
  documentType: string,
  prefix: string,
  nextNumber: number,
  endNumber: number
) {
  normalizeDocumentType(documentType);
  normalizeDocumentType(prefix);

  if (!Number.isInteger(nextNumber) || nextNumber < 1) {
    throw new Error('El proximo numero de secuencia debe ser un entero positivo');
  }

  if (!Number.isInteger(endNumber) || endNumber < nextNumber) {
    throw new Error('El numero final de secuencia debe ser mayor o igual al proximo numero');
  }
}

function normalizePaymentMethod(value: string | undefined): PaymentMethod {
  const normalized = String(value || 'efectivo').trim().toLowerCase();
  const allowed: PaymentMethod[] = [
    'efectivo',
    'tarjeta',
    'transferencia',
    'cheque',
    'otro',
  ];

  if (allowed.includes(normalized as PaymentMethod)) {
    return normalized as PaymentMethod;
  }

  return 'otro';
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

function roundQuantity(value: number) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function createDefaultAdminUser(): LocalUser {
  const password = process.env.LOCAL_ADMIN_PASSWORD || 'admin123';
  const hashed = createPasswordHash(password);

  return {
    id: 'usuario-admin-local',
    username: process.env.LOCAL_ADMIN_USERNAME || 'admin',
    displayName: 'Administrador Local',
    role: 'admin',
    passwordSalt: hashed.salt,
    passwordHash: hashed.hash,
    mustChangePassword: true,
    active: true,
    createdAt: new Date().toISOString(),
  };
}

function createPasswordHash(password: string) {
  validatePasswordStrength(password);
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password: string, salt: string, hash: string) {
  const candidate = crypto.scryptSync(String(password || ''), salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(hash, 'hex'));
}

function validatePasswordStrength(password: string) {
  if (String(password || '').length < 8) {
    throw new Error('La contrasena debe tener al menos 8 caracteres');
  }
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
