const state = {
  data: null,
  auditLog: [],
  lastInvoiceId: null,
  activeXmlTab: 'ecf',
  activeLeftTab: 'auditTab',
  latestXmls: {
    ecf: '',
    arecf: '',
    acecf: '',
  },
};

const formatter = new Intl.NumberFormat('es-DO', {
  style: 'currency',
  currency: 'DOP',
});

// Toast Notification engine (Custom fallback for standard alert window)
function showToast(title, message, type = 'success') {
  const container = document.querySelector('#toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
  `;

  container.appendChild(toast);

  // Auto-expire toast notice
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

// Visual Workflow loader overlay
function showLoader(visible, title = 'Procesando e-CF...', options = {}) {
  const overlay = document.querySelector('#loaderOverlay');
  const titleEl = document.querySelector('#loaderTitle');
  
  if (!overlay) return;
  titleEl.textContent = title;

  if (visible) {
    overlay.classList.add('active');
    // Reiniciar completados
    document.querySelectorAll('.loader-step').forEach((el) => {
      el.className = 'loader-step';
    });
    
    // Iniciar con fases simuladas progresivas
    simulateStep(1, 10);
  } else {
    overlay.classList.remove('active');
  }
}

function simulateStep(stepIndex, parentTimeout = 500) {
  const currentStep = document.querySelector(`#step${stepIndex}`);
  if (!currentStep) return;

  // Marcar como activo
  currentStep.className = 'loader-step active';

  setTimeout(() => {
    currentStep.className = 'loader-step completed';
    const nextStep = stepIndex + 1;
    if (document.querySelector(`#step${nextStep}`)) {
      simulateStep(nextStep, parentTimeout + 300);
    }
  }, parentTimeout);
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const errorText = body.error || `Error HTTP ${response.status}`;
    showToast('Fallo en Operación', errorText, 'error');
    throw new Error(errorText);
  }

  return response.json();
}

async function loadDashboard() {
  try {
    state.data = await request('/api/dashboard');
    
    // Obtener la bitácora JSONL del backend
    try {
      const auditRes = await request('/api/audit?limit=25');
      state.auditLog = auditRes.events || [];
    } catch (err) {
      console.warn('No se pudo obtener la bitácora de auditoría:', err);
    }

    renderAll();
  } catch (error) {
    console.error('Error cargando el panel de control:', error);
  }
}

function switchLeftTab(tabId) {
  state.activeLeftTab = tabId;
  const tabIds = ['auditTab', 'companyTab', 'testsTab'];
  
  // Buscar botones de tabulación para dar clase .active
  const buttons = document.querySelectorAll('.nav-tabs .tab-btn');
  buttons.forEach((btn, index) => {
    if (tabIds[index] === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Mostrar el panel correcto
  tabIds.forEach((id) => {
    const el = document.querySelector(`#${id}`);
    if (el) {
      if (id === tabId) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    }
  });
}

function switchXmlTab(tab) {
  state.activeXmlTab = tab;
  const tabs = ['ecf', 'arecf', 'acecf'];
  
  // Actualizar botones de tabs XML
  const buttons = document.querySelectorAll('.xml-tabs .xml-tab-btn');
  buttons.forEach((btn, index) => {
    if (tabs[index] === tab) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  const xmlOutput = document.querySelector('#xmlOutput');
  const xmlContent = state.latestXmls[tab];

  if (xmlContent) {
    // Formatear XML de forma simple e inyectarlo escapado
    xmlOutput.textContent = formatXml(xmlContent);
  } else {
    xmlOutput.textContent = `No hay datos XML generados en la pestaña ${tab.toUpperCase()} aún.`;
  }
}

// Formateador de XML básico
function formatXml(xml) {
  let formatted = '';
  const reg = /(>)(<)(\/*)/g;
  xml = xml.replace(reg, '$1\r\n$2$3');
  let pad = 0;
  jQueryXmlEach(xml.split('\r\n'), (node) => {
    let indent = 0;
    if (node.match(/.+<\/\w[^>]*>$/)) {
      indent = 0;
    } else if (node.match(/^<\/\w/)) {
      if (pad !== 0) {
        pad -= 1;
      }
    } else if (node.match(/^<\w([^>]*[^/])?>.*$/)) {
      indent = 1;
    } else {
      indent = 0;
    }

    let padding = '';
    for (let i = 0; i < pad; i++) {
      padding += '  ';
    }

    formatted += padding + node + '\r\n';
    pad += indent;
  });
  return formatted.trim();
}

function jQueryXmlEach(arr, callback) {
  for (let i = 0; i < arr.length; i++) {
    callback(arr[i]);
  }
}

function renderAll() {
  renderStatus();
  renderMetrics();
  renderCompany();
  renderSelectors();
  renderFiscalSequences();
  renderInvoices();
  renderSoftware();
  renderAuditLog();
}

function renderStatus() {
  const statusEl = document.querySelector('#serviceStatus');
  const urlEl = document.querySelector('#serviceUrl');

  if (state.data && state.data.software) {
    statusEl.textContent = 'Servicio Activo';
    urlEl.textContent = state.data.software.urlAutenticacion;
  }
}

function renderMetrics() {
  const countEl = document.querySelector('#countInvoices');
  const amountEl = document.querySelector('#totalAmount');
  const readyEl = document.querySelector('#readyInvoices');
  const rateEl = document.querySelector('#readinessRate');

  if (state.data) {
    countEl.textContent = state.data.totals.invoices;
    amountEl.textContent = formatter.format(state.data.totals.amount);
    readyEl.textContent = state.data.totals.ready;

    const readinessOk = state.data.readiness.filter((item) => item.ok).length;
    rateEl.textContent = `${readinessOk}/${state.data.readiness.length}`;
  }
}

function renderCompany() {
  const form = document.querySelector('#companyForm');
  if (state.data && state.data.company) {
    Object.entries(state.data.company).forEach(([key, value]) => {
      if (form.elements[key]) form.elements[key].value = value;
    });
  }
}

function renderSelectors() {
  const selectCustomer = document.querySelector('#customerSelect');
  const selectProduct = document.querySelector('#productSelect');
  const selectDocumentType = document.querySelector('#documentTypeSelect');

  if (state.data) {
    selectDocumentType.innerHTML = state.data.fiscalSequences
      .filter((item) => item.active)
      .map((item) => {
        const next = `${item.prefix}${String(item.nextNumber).padStart(10, '0')}`;
        return `<option value="${item.documentType}">${item.documentType} - proximo ${next}</option>`;
      })
      .join('');

    selectCustomer.innerHTML = state.data.customers
      .map((item) => `<option value="${item.id}">${item.razonSocial} (${item.rnc})</option>`)
      .join('');

    selectProduct.innerHTML = state.data.products
      .map((item) => `<option value="${item.id}">${item.nombre} - ${formatter.format(item.precio)}</option>`)
      .join('');
  }
}

function renderFiscalSequences() {
  const list = document.querySelector('#sequenceList');
  if (!list || !state.data?.fiscalSequences?.length) {
    if (list) {
      list.innerHTML = `<span class="muted">No hay secuencias fiscales configuradas.</span>`;
    }
    return;
  }

  list.innerHTML = state.data.fiscalSequences
    .map((sequence) => {
      const next = `${sequence.prefix}${String(sequence.nextNumber).padStart(10, '0')}`;
      const available = Math.max(sequence.endNumber - sequence.nextNumber + 1, 0);
      return `
        <div class="sequence-item">
          <div>
            <strong>${sequence.documentType}</strong>
            <span>${sequence.description || 'Secuencia fiscal'}</span>
          </div>
          <div class="sequence-meta">
            <code>${next}</code>
            <span>${available} disponibles</span>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderInvoices() {
  const table = document.querySelector('#invoiceTable');
  if (!state.data || !state.data.invoices.length) {
    table.innerHTML = `
      <tr>
        <td colspan="6" class="muted" style="text-align: center;">No hay comprobantes emitidos en el facturador.</td>
      </tr>
    `;
    return;
  }

  table.innerHTML = state.data.invoices
    .map((invoice) => {
      const customer = invoice.customer || state.data.customers.find((item) => item.id === invoice.customerId);
      const isOk = invoice.fiscalStatus === 'precertificacion_ok';
      const badgeClass = isOk ? 'badge badge-success' : 'badge badge-warning';
      const balanceDue = Number(invoice.balanceDue ?? invoice.totals.total);
      const paymentStatus = invoice.paymentStatus || 'pendiente';
      const paymentBadge = paymentStatus === 'pagada' ? 'badge badge-success' : 'badge badge-warning';
      const canPay = invoice.status === 'emitida' && balanceDue > 0;
      
      return `
        <tr>
          <td><strong style="font-family: var(--font-mono);">${invoice.encf || 'Pendiente'}</strong></td>
          <td>${customer?.razonSocial || 'Sin cliente'}</td>
          <td><strong>${formatter.format(invoice.totals.total)}</strong></td>
          <td>${formatter.format(balanceDue)}</td>
          <td><span class="${badgeClass}">${invoice.fiscalStatus}</span></td>
          <td>
            <span class="${paymentBadge}">${paymentStatus}</span>
            <button class="btn btn-ghost btn-compact" ${canPay ? '' : 'disabled'} onclick="recordInvoicePayment('${invoice.id}')">
              Cobrar
            </button>
          </td>
        </tr>
      `;
    })
    .join('');
}

function renderSoftware() {
  const box = document.querySelector('#softwareBox');
  if (state.data && state.data.software) {
    const sw = state.data.software;
    box.innerHTML = `
      <div class="meta-item"><span>Tipo</span><code>${sw.tipoSoftware}</code></div>
      <div class="meta-item"><span>Software</span><code>${sw.nombreSoftware}</code></div>
      <div class="meta-item"><span>Version</span><code>${sw.versionSoftware}</code></div>
      <div class="meta-item"><span>Ruta Recepcion</span><code>${sw.formularioDgii.rutaRecepcion}</code></div>
      <div class="meta-item"><span>Ruta Autenticacion</span><code>${sw.formularioDgii.rutaAutenticacion}</code></div>
      <div class="meta-item" style="grid-column: span 2;"><span>Dominio</span><code>${sw.formularioDgii.dominioRecepcion}</code></div>
    `;
  }
}

function renderAuditLog() {
  const list = document.querySelector('#auditList');
  if (!state.auditLog || !state.auditLog.length) {
    list.innerHTML = `<span class="muted">No hay eventos en la bitácora aún. Realiza operaciones en el facturador.</span>`;
    return;
  }

  list.innerHTML = state.auditLog
    .map((item) => {
      const date = new Date(item.ts).toLocaleTimeString('es-DO');
      const isError = item.outcome === 'error';
      const statusClass = isError ? 'error' : 'ok';
      const statusText = isError ? 'ERROR' : 'OK';
      const outcomeBadge = isError ? 'badge-danger' : 'badge-success';

      return `
        <div class="audit-item ${statusClass}">
          <div class="audit-header">
            <span class="audit-event-name" style="color: ${isError ? 'var(--danger)' : 'var(--success)'};">${item.event}</span>
            <span class="badge ${outcomeBadge}">${statusText}</span>
          </div>
          <p class="audit-msg">${item.message || 'Operacion completada exitosamente.'}</p>
          <div class="audit-meta">
            <span class="audit-timestamp">${date}</span>
            ${item.source ? `<span>Origen: <strong>${item.source}</strong></span>` : ''}
            ${item.encf ? `<span>e-NCF: <strong>${item.encf}</strong></span>` : ''}
            ${item.amount ? `<span>Monto: <strong>${formatter.format(item.amount)}</strong></span>` : ''}
          </div>
        </div>
      `;
    })
    .join('');
}

async function saveCompanyForm() {
  try {
    const form = document.querySelector('#companyForm');
    const payload = Object.fromEntries(new FormData(form).entries());
    
    showLoader(true, 'Guardando cambios de perfil...', { fast: true });
    await request('/api/company', { method: 'PUT', body: JSON.stringify(payload) });
    
    await loadDashboard();
    showLoader(false);
    showToast('Empresa Sincronizada', 'La configuracion de perfil se guardo localmente.');
  } catch (error) {
    showLoader(false);
  }
}

async function createInvoiceAction() {
  try {
    const payload = {
      customerId: document.querySelector('#customerSelect').value,
      documentType: document.querySelector('#documentTypeSelect').value,
      items: [
        {
          productId: document.querySelector('#productSelect').value,
          cantidad: Number(document.querySelector('#quantityInput').value || 1),
        },
      ],
    };
    
    showLoader(true, 'Generando factura borrador...');
    const invoice = await request('/api/invoices', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    
    state.lastInvoiceId = invoice.id;
    await loadDashboard();
    showLoader(false);
    showToast('Factura Creada', `Borrador ${invoice.id} encolado para firma e-CF.`);
  } catch (error) {
    showLoader(false);
  }
}

async function createFiscalSequenceAction() {
  try {
    showLoader(true, 'Creando secuencia fiscal E32...', { fast: true });
    await request('/api/fiscal-sequences', {
      method: 'POST',
      body: JSON.stringify({
        documentType: 'E32',
        prefix: 'E32',
        nextNumber: 1,
        endNumber: 100000,
        expirationDate: '2026-12-31',
        description: 'Factura de consumo electronica',
      }),
    });

    await loadDashboard();
    showLoader(false);
    showToast('Secuencia Creada', 'La secuencia E32 quedo disponible para facturacion local.');
  } catch (error) {
    showLoader(false);
  }
}

async function issueLastInvoiceAction() {
  try {
    const invoiceId = state.lastInvoiceId || state.data?.invoices[0]?.id;
    if (!invoiceId) {
      showToast('Operacion Invalida', 'Primero debes crear al menos un borrador.', 'error');
      return;
    }

    showLoader(true, 'Firma Digital e-CF Activa');
    const result = await request(`/api/invoices/${invoiceId}/issue-ecf`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    state.latestXmls.ecf = result.xml.ecf || '';
    state.latestXmls.arecf = result.xml.arecf || '';
    state.latestXmls.acecf = result.xml.acecf || '';

    // Actualizar visor de XML
    switchXmlTab(state.activeXmlTab);

    await loadDashboard();
    
    // Forzar foco en tabulación de bitácora
    switchLeftTab('auditTab');
    
    showLoader(false);
    showToast('Firma Local Exitosa', `Comprobante ${result.invoice.encf} firmado digitalmente.`, 'success');
  } catch (error) {
    showLoader(false);
  }
}

async function recordInvoicePayment(invoiceId) {
  try {
    const invoice = state.data?.invoices.find((item) => item.id === invoiceId);
    if (!invoice) {
      showToast('Operacion Invalida', 'No se encontro la factura seleccionada.', 'error');
      return;
    }

    const amount = Number(invoice.balanceDue ?? invoice.totals.total);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('Cobro no requerido', 'La factura no tiene saldo pendiente.', 'success');
      return;
    }

    showLoader(true, 'Registrando cobro local...', { fast: true });
    await request(`/api/invoices/${invoiceId}/payments`, {
      method: 'POST',
      body: JSON.stringify({
        amount,
        method: 'efectivo',
        reference: 'Cobro registrado desde consola local',
      }),
    });

    await loadDashboard();
    showLoader(false);
    showToast('Cobro Registrado', `Saldo cobrado por ${formatter.format(amount)}.`);
  } catch (error) {
    showLoader(false);
  }
}

async function runTestsAction() {
  try {
    showLoader(true, 'Validando precertificacion...');
    const result = await request('/api/precertification/run', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    document.querySelector('#testResults').innerHTML = result.results
      .map((item) => {
        const badgeStyle = item.ok ? 'badge badge-success' : 'badge badge-danger';
        return `
          <div class="test-item">
            <div class="test-item-header">
              <span class="test-item-title">${item.name}</span>
              <span class="${badgeStyle}">${item.ok ? 'PASO' : 'FALTO'}</span>
            </div>
            <p>${item.detail}</p>
          </div>
        `;
      })
      .join('');

    await loadDashboard();
    showLoader(false);
    
    if (result.ok) {
      showToast('Precertificacion Exitosa', 'Todos los chequeos locales pasaron sin novedad.');
    } else {
      showToast('Puntos Pendientes', 'Algunos chequeos locales requieren tu atencion.', 'error');
    }
  } catch (error) {
    showLoader(false);
  }
}

function copyXmlToClipboard() {
  const content = state.latestXmls[state.activeXmlTab];
  if (!content) {
    showToast('Operacion Invalida', 'No hay XML generado para copiar todavía.', 'error');
    return;
  }

  navigator.clipboard.writeText(content)
    .then(() => {
      showToast('Copiado', `XML de la pestaña ${state.activeXmlTab.toUpperCase()} copiado al portapapeles.`);
    })
    .catch((err) => {
      console.error('Fallo al copiar:', err);
    });
}

function bindEvents() {
  document.querySelector('#saveCompany').addEventListener('click', saveCompanyForm);
  document.querySelector('#createFiscalSequence').addEventListener('click', createFiscalSequenceAction);
  document.querySelector('#createInvoice').addEventListener('click', createInvoiceAction);
  document.querySelector('#issueLastInvoice').addEventListener('click', issueLastInvoiceAction);
  document.querySelector('#runTests').addEventListener('click', runTestsAction);
  document.querySelector('#refreshAuditBtn').addEventListener('click', loadDashboard);
  document.querySelector('#refreshInvoicesBtn').addEventListener('click', loadDashboard);
  document.querySelector('#copyXmlBtn').addEventListener('click', copyXmlToClipboard);
}

// Arrancar bucle de refresco cada 5 segundos (Live feedback)
function startPolling() {
  setInterval(() => {
    loadDashboard();
  }, 5000);
}

async function loadBusinessPreset(presetKey) {
  try {
    showLoader(true, `Cargando catálogo para sector ${presetKey.toUpperCase()}...`, { fast: true });
    
    const result = await request('/api/presets/load', {
      method: 'POST',
      body: JSON.stringify({ preset: presetKey }),
    });

    // Update active visual class on preset cards
    document.querySelectorAll('.preset-card').forEach((card) => {
      if (card.getAttribute('data-preset') === presetKey) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });

    state.lastInvoiceId = null; // Clear last draft reference
    state.latestXmls = { ecf: '', arecf: '', acecf: '' }; // Clear XMLs
    document.querySelector('#xmlOutput').textContent = 'Cale una factura de prueba o use el botón de Odoo para visualizar el XML e-CF firmado digitalmente por este gateway local.';

    await loadDashboard();
    showLoader(false);
    showToast('Giro Comercial Activo', result.message || `Sector ${presetKey} establecido exitosamente.`, 'success');
  } catch (error) {
    showLoader(false);
    showToast('Fallo en Operación', error.message || 'No se pudo cambiar de sector.', 'error');
  }
}

// Global scope bindings for inline HTML clicks
window.switchLeftTab = switchLeftTab;
window.switchXmlTab = switchXmlTab;
window.loadBusinessPreset = loadBusinessPreset;
window.recordInvoicePayment = recordInvoicePayment;

bindEvents();
loadDashboard()
  .then(() => {
    startPolling();
  })
  .catch((error) => showToast('Error Inicial', error.message, 'error'));
