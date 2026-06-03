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

  const invoice = await request('/api/invoices', {
    method: 'POST',
    body: JSON.stringify({
      customerId: dashboard.customers[0].id,
      items: [{ productId: dashboard.products[0].id, cantidad: 2 }],
    }),
  });
  assert(invoice.id, 'invoice should be created');

  const issued = await request(`/api/invoices/${invoice.id}/issue-ecf`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  assert(issued.invoice.encf?.startsWith('E31'), 'issued invoice should have e-NCF');
  assert(issued.xml.ecf.includes('<Signature'), 'issued XML should be signed');
  assert(issued.xml.arecf.includes('<Estado>0</Estado>'), 'ARECF should be received');

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