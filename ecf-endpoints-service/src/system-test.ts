const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';
let authToken = '';

async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`${path} failed with HTTP ${response.status}: ${await response.text()}`);
  }

  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('application/json') ? response.json() : response.text();
}

async function main() {
  const healthResponse = await fetch(`${baseUrl}/health`);
  const health = await healthResponse.json();
  assert(health.ok, 'health endpoint should be ok');
  assert(
    healthResponse.headers.get('x-content-type-options') === 'nosniff',
    'responses should include security headers'
  );
  assert(
    !healthResponse.headers.has('x-powered-by'),
    'responses should not disclose Express'
  );

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username: 'admin',
      password: 'admin123',
    }),
  });
  assert(login.token, 'login should return a token');
  authToken = login.token;

  if (login.user.mustChangePassword) {
    const forcedChangeResponse = await fetch(`${baseUrl}/api/runtime/status`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert(
      forcedChangeResponse.status === 403,
      'temporary password should not authorize operational endpoints'
    );

    const temporaryToken = authToken;
    const passwordChanged = await request('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: 'admin123',
        newPassword: 'admin12345',
      }),
    });
    assert(!passwordChanged.user.mustChangePassword, 'password should be updated');

    const invalidatedSessionResponse = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${temporaryToken}` },
    });
    assert(
      invalidatedSessionResponse.status === 401,
      'password change should invalidate the previous session'
    );

    const relogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: 'admin',
        password: 'admin12345',
      }),
    });
    authToken = relogin.token;
  }

  const concurrentCustomers = await Promise.all(
    Array.from({ length: 12 }, (_, index) =>
      request('/api/customers', {
        method: 'POST',
        body: JSON.stringify({
          rnc: String(131560000 + index),
          razonSocial: `CLIENTE CONCURRENTE ${index}`,
          correo: `concurrente.${index}@test.local`,
          direccion: 'Santo Domingo',
        }),
      })
    )
  );
  const customerIds = new Set(concurrentCustomers.map((customer) => customer.id));
  assert(customerIds.size === concurrentCustomers.length, 'concurrent writes should all succeed');
  const customersAfterConcurrency = await request('/api/customers');
  assert(
    concurrentCustomers.every((customer) =>
      customersAfterConcurrency.customers.some((stored: { id: string }) => stored.id === customer.id)
    ),
    'concurrent writes should all remain persisted'
  );

  const dashboard = await request('/api/dashboard');
  assert(dashboard.customers.length > 0, 'dashboard should include demo customer');
  assert(dashboard.products.length > 0, 'dashboard should include demo product');
  assert(
    dashboard.fiscalSequences.length > 0,
    'dashboard should include fiscal sequences'
  );

  const sequences = await request('/api/fiscal-sequences');
  assert(sequences.fiscalSequences.length > 0, 'should list fiscal sequences');

  const customer = await request('/api/customers', {
    method: 'POST',
    body: JSON.stringify({
      rnc: '131555555',
      razonSocial: `CLIENTE NODE ${Date.now()}`,
      correo: 'cliente.node@test.local',
      direccion: 'Santo Domingo',
    }),
  });
  assert(customer.id, 'customer should be created through Node API');

  const product = await request('/api/products', {
    method: 'POST',
    body: JSON.stringify({
      nombre: `Servicio Node ${Date.now()}`,
      descripcion: 'Servicio creado por prueba Node-only',
      precio: 1250,
      itbisRate: 0.18,
      trackInventory: true,
      stockOnHand: 5,
      reorderPoint: 1,
    }),
  });
  assert(product.id, 'product should be created through Node API');

  const saleOrder = await request('/api/sale-orders', {
    method: 'POST',
    body: JSON.stringify({
      customerId: customer.id,
      items: [{ productId: product.id, cantidad: 2 }],
    }),
  });
  assert(saleOrder.id, 'sale order should be created');

  const confirmedSaleOrder = await request(`/api/sale-orders/${saleOrder.id}/confirm`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  assert(confirmedSaleOrder.status === 'confirmada', 'sale order should be confirmed');

  const invoice = await request(`/api/sale-orders/${saleOrder.id}/invoice`, {
    method: 'POST',
    body: JSON.stringify({ documentType: 'E31' }),
  });
  assert(invoice.id, 'invoice should be created');

  const issued = await request(`/api/invoices/${invoice.id}/issue-ecf`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  assert(issued.invoice.encf?.startsWith('E31'), 'issued invoice should have e-NCF');
  assert(issued.xml.ecf.includes('<Signature'), 'issued XML should be signed');
  assert(issued.xml.arecf.includes('<Estado>0</Estado>'), 'ARECF should be received');

  const inventory = await request('/api/inventory');
  const inventoryProduct = inventory.inventory.find(
    (item: any) => item.product.id === product.id
  );
  assert(inventoryProduct.stockOnHand === 3, 'issued invoice should consume inventory');

  const payment = await request(`/api/invoices/${invoice.id}/payments`, {
    method: 'POST',
    body: JSON.stringify({
      amount: issued.invoice.balanceDue,
      method: 'transferencia',
      reference: 'system-test',
    }),
  });
  assert(payment.payment.id, 'payment should be created');
  assert(payment.invoice.paymentStatus === 'pagada', 'invoice should be paid');
  assert(payment.invoice.balanceDue === 0, 'paid invoice should have zero balance');

  const payments = await request('/api/payments');
  assert(payments.payments.length > 0, 'payments endpoint should list payments');

  const accounting = await request('/api/accounting/summary');
  assert(accounting.accounting.balanced, 'journal entries should stay balanced');
  assert(
    accounting.accounting.entries.length >= 2,
    'invoice and payment should create accounting entries'
  );

  const report = await request('/api/reports/summary');
  assert(report.report.sales.invoices >= 1, 'report should include issued invoices');
  assert(report.report.receivables.pending === 0, 'report should include receivable balance');
  assert(report.report.accounting.balanced, 'report should include accounting status');

  const tests = await request('/api/precertification/run', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  assert(tests.results.length >= 8, 'precertification should run multiple checks');

  await runOdooParityTests(customer, product);

  console.log(JSON.stringify({ ok: true, baseUrl, tests: tests.results }, null, 2));
}

async function runOdooParityTests(customer: any, untrackedFlowProduct: any) {
  console.log('--- Paridad Odoo: notas, anulacion, compras y reportes DGII ---');

  const today = new Date().toISOString().slice(0, 10);

  const trackedProduct = await request('/api/products', {
    method: 'POST',
    body: JSON.stringify({
      nombre: `Producto Inventariable ${Date.now()}`,
      descripcion: 'Producto con inventario para pruebas de notas',
      precio: 1000,
      itbisRate: 0.18,
      trackInventory: true,
      stockOnHand: 10,
      reorderPoint: 1,
    }),
  });
  check(trackedProduct.id, 'producto inventariable creado con stock 10');

  const invoiceForCredit = await request('/api/invoices', {
    method: 'POST',
    body: JSON.stringify({
      customerId: customer.id,
      documentType: 'E31',
      items: [{ productId: trackedProduct.id, cantidad: 4 }],
    }),
  });
  check(invoiceForCredit.id, 'factura E31 con producto inventariable creada');

  const issuedForCredit = await request(`/api/invoices/${invoiceForCredit.id}/issue-ecf`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  check(issuedForCredit.invoice.encf?.startsWith('E31'), 'factura E31 emitida con e-NCF');

  const stockAfterIssue = await getStock(trackedProduct.id);
  check(stockAfterIssue === 6, `stock descontado tras emision (esperado 6, actual ${stockAfterIssue})`);

  const creditNoteResponse = await request(`/api/invoices/${invoiceForCredit.id}/credit-note`, {
    method: 'POST',
    body: JSON.stringify({ reason: 'Devolucion total de mercancia' }),
  });
  const creditNote = creditNoteResponse.creditNote;
  check(
    creditNote.kind === 'nota_credito' && creditNote.status === 'borrador',
    'nota de credito creada en borrador'
  );
  check(creditNote.documentType === 'E34', 'nota de credito usa tipo de documento E34');
  check(
    creditNote.modifiedEncf === issuedForCredit.invoice.encf,
    'nota de credito referencia el e-NCF original'
  );

  const issuedCreditNote = await request(`/api/invoices/${creditNote.id}/issue-ecf`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  check(
    issuedCreditNote.invoice.encf?.startsWith('E34'),
    'nota de credito emitida con secuencia E34'
  );
  check(
    issuedCreditNote.xml.ecf.includes('<NCFModificado>') &&
      issuedCreditNote.xml.ecf.includes(issuedForCredit.invoice.encf),
    'XML de la nota incluye InformacionReferencia con el NCF modificado'
  );

  const stockAfterCredit = await getStock(trackedProduct.id);
  check(
    stockAfterCredit === 10,
    `stock restaurado por nota de credito (esperado 10, actual ${stockAfterCredit})`
  );

  const originalAfterCredit = await request(`/api/invoices/${invoiceForCredit.id}`);
  check(originalAfterCredit.balanceDue === 0, 'factura original queda con balance 0 tras la nota');
  check(
    originalAfterCredit.paymentStatus === 'pagada',
    'factura original queda saldada tras la nota'
  );

  const accountingAfterCredit = await request('/api/accounting/summary');
  check(
    accountingAfterCredit.accounting.balanced,
    'partida doble global sigue cuadrada tras la nota de credito'
  );
  check(
    accountingAfterCredit.accounting.entries.some(
      (entry: any) => entry.source === 'credit_note' && entry.referenceId === creditNote.id
    ),
    'asiento de reverso de la nota de credito registrado'
  );

  let overCreditRejected = false;
  try {
    await request(`/api/invoices/${invoiceForCredit.id}/credit-note`, {
      method: 'POST',
      body: JSON.stringify({
        reason: 'Intento de sobre-acreditar',
        items: [{ productId: trackedProduct.id, cantidad: 1 }],
      }),
    });
  } catch {
    overCreditRejected = true;
  }
  check(overCreditRejected, 'se rechaza acreditar mas cantidades de las facturadas');

  const debitNoteResponse = await request(`/api/invoices/${invoiceForCredit.id}/debit-note`, {
    method: 'POST',
    body: JSON.stringify({
      reason: 'Cargo adicional por flete',
      items: [{ productId: untrackedFlowProduct.id, cantidad: 1 }],
    }),
  });
  const debitNote = debitNoteResponse.debitNote;
  check(
    debitNote.kind === 'nota_debito' && debitNote.documentType === 'E33',
    'nota de debito E33 creada en borrador'
  );

  const stockBeforeDebit = await getStock(untrackedFlowProduct.id);
  const issuedDebitNote = await request(`/api/invoices/${debitNote.id}/issue-ecf`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  check(
    issuedDebitNote.invoice.encf?.startsWith('E33'),
    'nota de debito emitida con secuencia E33'
  );
  const stockAfterDebit = await getStock(untrackedFlowProduct.id);
  check(stockAfterDebit === stockBeforeDebit, 'la nota de debito no toca inventario');

  const invoiceToCancel = await request('/api/invoices', {
    method: 'POST',
    body: JSON.stringify({
      customerId: customer.id,
      documentType: 'E31',
      items: [{ productId: trackedProduct.id, cantidad: 2 }],
    }),
  });
  const issuedToCancel = await request(`/api/invoices/${invoiceToCancel.id}/issue-ecf`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  check(issuedToCancel.invoice.encf?.startsWith('E31'), 'segunda factura E31 emitida para anular');

  const stockBeforeCancel = await getStock(trackedProduct.id);
  check(
    stockBeforeCancel === 8,
    `stock descontado antes de anular (esperado 8, actual ${stockBeforeCancel})`
  );

  const cancelled = await request(`/api/invoices/${invoiceToCancel.id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason: 'Error de digitacion en la factura' }),
  });
  check(cancelled.invoice.status === 'anulada', 'factura emitida sin pagos queda anulada');
  check(Boolean(cancelled.invoice.cancelledAt), 'factura anulada registra cancelledAt');

  const stockAfterCancel = await getStock(trackedProduct.id);
  check(
    stockAfterCancel === 10,
    `stock restaurado por anulacion (esperado 10, actual ${stockAfterCancel})`
  );

  const accountingAfterCancel = await request('/api/accounting/summary');
  check(accountingAfterCancel.accounting.balanced, 'contabilidad balanceada tras la anulacion');
  check(
    accountingAfterCancel.accounting.entries.some(
      (entry: any) => entry.source === 'cancellation' && entry.referenceId === invoiceToCancel.id
    ),
    'asiento de reverso de la anulacion registrado'
  );

  let cancelWithPaymentsRejected = false;
  try {
    await request(`/api/invoices/${invoiceForCredit.id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'No debe permitirse' }),
    });
  } catch {
    cancelWithPaymentsRejected = true;
  }
  check(
    cancelWithPaymentsRejected,
    'no se puede anular una factura con notas de credito emitidas vinculadas'
  );

  const purchaseResponse = await request('/api/purchases', {
    method: 'POST',
    body: JSON.stringify({
      supplierRnc: '101010101',
      supplierName: 'SUPLIDOR DEMO SRL',
      ncf: 'B0100000123',
      date: today,
      tipoBienesServicios: '09',
      subtotal: 10000,
      itbis: 1800,
      total: 11800,
      paymentMethod: 'credito',
      notes: 'Compra de prueba de sistema',
    }),
  });
  check(purchaseResponse.purchase?.id, 'compra registrada con asiento contable');

  const purchases = await request('/api/purchases');
  check(
    purchases.purchases.some((item: any) => item.id === purchaseResponse.purchase.id),
    'la compra aparece en el listado de compras'
  );

  const accountingAfterPurchase = await request('/api/accounting/summary');
  check(
    accountingAfterPurchase.accounting.balanced &&
      accountingAfterPurchase.accounting.entries.some(
        (entry: any) => entry.source === 'purchase' && entry.referenceId === purchaseResponse.purchase.id
      ),
    'asiento de la compra registrado y balanceado'
  );

  const report606 = await request(`/api/reports/dgii/606?from=${today}&to=${today}`);
  check(
    report606.report.rows.some((row: any) => row.ncf === 'B0100000123'),
    'la compra aparece en el reporte 606'
  );

  const report607 = await request(`/api/reports/dgii/607?from=${today}&to=${today}`);
  check(
    report607.report.rows.some((row: any) => row.ncf === issuedForCredit.invoice.encf),
    'la factura aparece en el reporte 607'
  );
  check(
    report607.report.rows.some(
      (row: any) =>
        row.ncf === issuedCreditNote.invoice.encf &&
        row.ncfModificado === issuedForCredit.invoice.encf
    ),
    'la nota de credito aparece en el 607 con el NCF modificado'
  );

  const report608 = await request(`/api/reports/dgii/608?from=${today}&to=${today}`);
  check(
    report608.report.rows.some((row: any) => row.ncf === issuedToCancel.invoice.encf),
    'la factura anulada aparece en el reporte 608'
  );

  const periodReport = await request(`/api/reports/period?from=${today}&to=${today}`);
  check(
    periodReport.period.notasCredito.cantidad === 1 &&
      periodReport.period.notasCredito.total === creditNote.totals.total,
    'el resumen del periodo cuadra las notas de credito'
  );
  check(
    periodReport.period.compras.cantidad === 1 && periodReport.period.compras.total === 11800,
    'el resumen del periodo cuadra las compras'
  );
  check(periodReport.period.anuladas === 1, 'el resumen del periodo cuenta las anuladas');
  check(
    periodReport.period.ventas.cantidad >= 2 && periodReport.period.ventas.total > 0,
    'el resumen del periodo incluye las ventas emitidas'
  );
  check(periodReport.period.cobros.cantidad >= 1, 'el resumen del periodo incluye los cobros');

  const txt607 = await request(`/api/reports/dgii/607?from=${today}&to=${today}&format=txt`);
  check(
    typeof txt607 === 'string' && txt607.startsWith('607|'),
    'descarga txt del 607 con cabecera DGII'
  );
  check(
    typeof txt607 === 'string' && txt607.includes(issuedForCredit.invoice.encf),
    'descarga txt del 607 incluye el e-NCF emitido'
  );
}

async function getStock(productId: string) {
  const inventory = await request('/api/inventory');
  const item = inventory.inventory.find((entry: any) => entry.product.id === productId);
  return item ? item.stockOnHand : null;
}

function check(condition: unknown, message: string): asserts condition {
  if (condition) {
    console.log(`OK   - ${message}`);
    return;
  }

  console.error(`FAIL - ${message}`);
  throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
