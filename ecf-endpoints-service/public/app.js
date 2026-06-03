const state = {
  data: null,
  lastInvoiceId: null,
};

const formatter = new Intl.NumberFormat('es-DO', {
  style: 'currency',
  currency: 'DOP',
});

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Error HTTP ${response.status}`);
  }

  return response.json();
}

async function loadDashboard() {
  state.data = await request('/api/dashboard');
  renderAll();
}

function renderAll() {
  renderStatus();
  renderMetrics();
  renderCompany();
  renderSelectors();
  renderInvoices();
  renderSoftware();
}

function renderStatus() {
  document.querySelector('#serviceStatus').textContent = 'Servicio activo';
  document.querySelector('#serviceUrl').textContent = state.data.software.urlAutenticacion;
}

function renderMetrics() {
  const readinessOk = state.data.readiness.filter((item) => item.ok).length;
  document.querySelector('#metrics').innerHTML = `
    <div class="metric"><span>Facturas</span><strong>${state.data.totals.invoices}</strong></div>
    <div class="metric"><span>Total emitido</span><strong>${formatter.format(state.data.totals.amount)}</strong></div>
    <div class="metric"><span>Precertificadas</span><strong>${state.data.totals.ready}</strong></div>
    <div class="metric"><span>Checklist</span><strong>${readinessOk}/${state.data.readiness.length}</strong></div>
  `;
}

function renderCompany() {
  const form = document.querySelector('#companyForm');
  Object.entries(state.data.company).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value;
  });
}

function renderSelectors() {
  document.querySelector('#customerSelect').innerHTML = state.data.customers
    .map((item) => `<option value="${item.id}">${item.razonSocial} (${item.rnc})</option>`)
    .join('');
  document.querySelector('#productSelect').innerHTML = state.data.products
    .map((item) => `<option value="${item.id}">${item.nombre} - ${formatter.format(item.precio)}</option>`)
    .join('');
}

function renderInvoices() {
  document.querySelector('#invoiceTable').innerHTML = state.data.invoices
    .map((invoice) => {
      const customer = state.data.customers.find((item) => item.id === invoice.customerId);
      const badgeClass = invoice.fiscalStatus === 'precertificacion_ok' ? 'badge' : 'badge warn';
      return `
        <tr>
          <td>${invoice.encf || 'Pendiente'}</td>
          <td>${customer?.razonSocial || 'Sin cliente'}</td>
          <td>${formatter.format(invoice.totals.total)}</td>
          <td><span class="${badgeClass}">${invoice.fiscalStatus}</span></td>
          <td>${invoice.trackId || '-'}</td>
        </tr>
      `;
    })
    .join('');
}

function renderSoftware() {
  const software = state.data.software;
  document.querySelector('#softwareBox').innerHTML = `
    <div><strong>Tipo</strong><code>${software.tipoSoftware}</code></div>
    <div><strong>Nombre</strong><code>${software.nombreSoftware}</code></div>
    <div><strong>Version</strong><code>${software.versionSoftware}</code></div>
    <div><strong>Recepcion</strong><code>${software.urlRecepcion}</code></div>
    <div><strong>Aprobacion</strong><code>${software.urlAprobacionComercial}</code></div>
    <div><strong>Autenticacion</strong><code>${software.urlAutenticacion}</code></div>
  `;
}

async function saveCompany() {
  const form = document.querySelector('#companyForm');
  const payload = Object.fromEntries(new FormData(form).entries());
  await request('/api/company', { method: 'PUT', body: JSON.stringify(payload) });
  await loadDashboard();
}

async function createInvoice() {
  const payload = {
    customerId: document.querySelector('#customerSelect').value,
    items: [
      {
        productId: document.querySelector('#productSelect').value,
        cantidad: Number(document.querySelector('#quantityInput').value || 1),
      },
    ],
  };
  const invoice = await request('/api/invoices', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  state.lastInvoiceId = invoice.id;
  await loadDashboard();
}

async function issueLastInvoice() {
  const invoiceId = state.lastInvoiceId || state.data.invoices[0]?.id;
  if (!invoiceId) throw new Error('Primero crea una factura.');

  const result = await request(`/api/invoices/${invoiceId}/issue-ecf`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  document.querySelector('#xmlOutput').textContent = result.xml.ecf;
  await loadDashboard();
}

async function runTests() {
  const result = await request('/api/precertification/run', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  document.querySelector('#testResults').innerHTML = result.results
    .map((item) => `<div class="${item.ok ? 'badge' : 'badge fail'}">${item.ok ? 'OK' : 'FALTA'} - ${item.name}</div><p class="muted">${item.detail}</p>`)
    .join('');
  await loadDashboard();
}

function bindEvents() {
  document.querySelector('#saveCompany').addEventListener('click', saveCompany);
  document.querySelector('#createInvoice').addEventListener('click', createInvoice);
  document.querySelector('#issueLastInvoice').addEventListener('click', issueLastInvoice);
  document.querySelector('#runTests').addEventListener('click', runTests);
  document.querySelector('#refresh').addEventListener('click', loadDashboard);
  document.querySelector('#clearXml').addEventListener('click', () => {
    document.querySelector('#xmlOutput').textContent = 'Emite una factura para ver el XML firmado.';
  });
}

window.addEventListener('error', (event) => {
  alert(event.error?.message || event.message);
});

bindEvents();
loadDashboard().catch((error) => alert(error.message));