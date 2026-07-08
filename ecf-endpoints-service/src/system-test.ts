const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`${path} failed with HTTP ${response.status}: ${await response.text()}`);
  }

  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('application/json') ? response.json() : response.text();
}

async function main() {
  const health = await request('/health');
  assert(health.ok, 'health endpoint should be ok');

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

  console.log(JSON.stringify({ ok: true, baseUrl, tests: tests.results }, null, 2));
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
