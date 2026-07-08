const state = {
  data: null,
  auditLog: [],
  lastInvoiceId: null,
  authToken: localStorage.getItem('dgiiLocalAuthToken') || '',
  currentUser: null,
  pollingStarted: false,
  activeXmlTab: 'ecf',
  activeLeftTab: 'auditTab',
  latestXmls: {
    ecf: '',
    arecf: '',
    acecf: '',
  },
  purchases: [],
  noteModal: null,
};

const formatter = new Intl.NumberFormat('es-DO', {
  style: 'currency',
  currency: 'DOP',
});

// Jerarquía de roles de la consola local
const ROLE_LEVEL = { visor: 0, operador: 1, admin: 2 };

function roleAtLeast(minRole) {
  const current = state.currentUser?.role;
  return (ROLE_LEVEL[current] ?? -1) >= (ROLE_LEVEL[minRole] ?? 99);
}

// Tipos de comprobante (kind) del modelo Invoice extendido
const INVOICE_KINDS = {
  factura: { label: 'Factura', className: 'badge-kind-factura' },
  nota_credito: { label: 'Nota crédito', className: 'badge-kind-nc' },
  nota_debito: { label: 'Nota débito', className: 'badge-kind-nd' },
};

// Clasificación DGII de bienes y servicios (columna del formato 606)
const TIPO_BIENES_SERVICIOS = {
  '01': 'Gastos de personal',
  '02': 'Gastos por trabajos, suministros y servicios',
  '03': 'Arrendamientos',
  '04': 'Gastos de activos fijos',
  '05': 'Gastos de representación',
  '06': 'Otras deducciones admitidas',
  '07': 'Gastos financieros',
  '08': 'Gastos extraordinarios',
  '09': 'Compras y gastos que forman parte del costo de venta',
  '10': 'Adquisiciones de activos',
  '11': 'Gastos de seguros',
};

const DGII_REPORT_LABELS = {
  606: 'Compras de Bienes y Servicios (606)',
  607: 'Ventas de Bienes y Servicios (607)',
  608: 'Comprobantes Anulados (608)',
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

function toIsoDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

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
  const { skipAuthHandling = false, headers = {}, ...fetchOptions } = options;
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(state.authToken ? { Authorization: `Bearer ${state.authToken}` } : {}),
      ...headers,
    },
    ...fetchOptions,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const errorText = body.error || `Error HTTP ${response.status}`;
    if (response.status === 401 && !skipAuthHandling) {
      clearSession();
      openAuthOverlay('login', 'La sesion local expiro. Vuelve a autenticarte.');
    }
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
  const tabIds = ['auditTab', 'companyTab', 'testsTab', 'purchasesTab', 'reportsTab'];

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

  // Cargas diferidas por pestaña
  if (tabId === 'purchasesTab' && state.authToken) {
    loadPurchases();
  }
  if (tabId === 'reportsTab') {
    ensureReportDates();
  }
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
  renderSession();
  renderStatus();
  renderMetrics();
  renderCompany();
  renderSelectors();
  renderFiscalSequences();
  renderInvoices();
  renderSoftware();
  renderAuditLog();
}

function renderSession() {
  const label = document.querySelector('#currentUserLabel');
  const logoutButton = document.querySelector('#logoutButton');
  if (!label || !logoutButton) {
    return;
  }

  if (state.currentUser) {
    label.textContent = `${state.currentUser.displayName} · ${state.currentUser.role}`;
    logoutButton.disabled = false;
  } else {
    label.textContent = 'Sesion no iniciada';
    logoutButton.disabled = true;
  }

  applyRoleGates();
}

// Habilita/deshabilita acciones estáticas según el rol de la sesión
function applyRoleGates() {
  const canOperate = roleAtLeast('operador');

  const savePurchaseBtn = document.querySelector('#savePurchaseBtn');
  if (savePurchaseBtn) {
    savePurchaseBtn.disabled = !canOperate;
  }

  const purchaseRoleHint = document.querySelector('#purchaseRoleHint');
  if (purchaseRoleHint) {
    purchaseRoleHint.classList.toggle('hidden', canOperate);
  }

  const purchaseForm = document.querySelector('#purchaseForm');
  if (purchaseForm) {
    Array.from(purchaseForm.elements).forEach((element) => {
      if (element.id !== 'savePurchaseBtn') {
        element.disabled = !canOperate;
      }
    });
  }
}

function openAuthOverlay(mode = 'login', message = '') {
  const overlay = document.querySelector('#authOverlay');
  const loginForm = document.querySelector('#loginForm');
  const passwordForm = document.querySelector('#passwordForm');
  const authTitle = document.querySelector('#authTitle');
  const authMessage = document.querySelector('#authMessage');
  if (!overlay || !loginForm || !passwordForm || !authTitle || !authMessage) {
    return;
  }

  document.body.classList.add('auth-locked');
  overlay.classList.add('active');
  authMessage.textContent = message || 'Autentica la consola local antes de operar el facturador.';

  if (mode === 'password') {
    authTitle.textContent = 'Cambiar Contrasena';
    loginForm.classList.add('hidden');
    passwordForm.classList.remove('hidden');
    return;
  }

  authTitle.textContent = 'Iniciar Sesion';
  passwordForm.classList.add('hidden');
  loginForm.classList.remove('hidden');
}

function closeAuthOverlay() {
  const overlay = document.querySelector('#authOverlay');
  document.body.classList.remove('auth-locked');
  if (overlay) {
    overlay.classList.remove('active');
  }
}

function storeSession(token, user) {
  state.authToken = token;
  state.currentUser = user;
  localStorage.setItem('dgiiLocalAuthToken', token);
  renderSession();
}

function clearSession() {
  state.authToken = '';
  state.currentUser = null;
  localStorage.removeItem('dgiiLocalAuthToken');
  renderSession();
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
        <td colspan="7" class="muted" style="text-align: center;">No hay comprobantes emitidos en el facturador.</td>
      </tr>
    `;
    return;
  }

  table.innerHTML = state.data.invoices
    .map((invoice) => {
      const customer = invoice.customer || state.data.customers.find((item) => item.id === invoice.customerId);
      const kind = invoice.kind || 'factura';
      const kindInfo = INVOICE_KINDS[kind] || INVOICE_KINDS.factura;
      const isCancelled = invoice.status === 'anulada';
      const isOk = invoice.fiscalStatus === 'precertificacion_ok';
      const fiscalBadgeClass = isOk ? 'badge badge-success' : 'badge badge-warning';
      const totalAmount = Number(invoice.totals.total);
      const balanceDue = Number(invoice.balanceDue ?? invoice.totals.total);
      const paymentStatus = invoice.paymentStatus || 'pendiente';
      const paymentBadge = paymentStatus === 'pagada' ? 'badge badge-success' : 'badge badge-warning';
      const hasPayments = Array.isArray(invoice.payments)
        ? invoice.payments.length > 0
        : paymentStatus !== 'pendiente' || balanceDue < totalAmount;

      const canPay = !isCancelled && invoice.status === 'emitida' && balanceDue > 0 && roleAtLeast('operador');
      const canIssue = !isCancelled && invoice.status === 'borrador' && roleAtLeast('operador');
      const canNote = !isCancelled && kind === 'factura' && invoice.status === 'emitida' && roleAtLeast('operador');
      const canCancel = !isCancelled && roleAtLeast('admin')
        && (invoice.status === 'borrador' || (invoice.status === 'emitida' && !hasPayments));

      const relatedInfo = [];
      if (invoice.modifiedEncf) {
        relatedInfo.push(`Modifica: ${escapeHtml(invoice.modifiedEncf)}`);
      } else if (invoice.relatedInvoiceId) {
        relatedInfo.push(`Ref: ${escapeHtml(invoice.relatedInvoiceId)}`);
      }

      const statusBadge = isCancelled
        ? `<span class="badge badge-cancelled" title="${escapeHtml(invoice.reason || 'Comprobante anulado')}">anulada</span>`
        : `<span class="${fiscalBadgeClass}">${invoice.fiscalStatus}</span>`;

      const actions = [
        canIssue ? `<button class="btn btn-ghost btn-compact" data-invoice-action="issue" data-invoice-id="${escapeHtml(invoice.id)}">Emitir e-NCF</button>` : '',
        canPay ? `<button class="btn btn-ghost btn-compact" data-invoice-action="pay" data-invoice-id="${escapeHtml(invoice.id)}">Cobrar</button>` : '',
        canNote ? `<button class="btn btn-ghost btn-compact" data-invoice-action="credit" data-invoice-id="${escapeHtml(invoice.id)}">Nota de crédito</button>` : '',
        canNote ? `<button class="btn btn-ghost btn-compact" data-invoice-action="debit" data-invoice-id="${escapeHtml(invoice.id)}">Nota de débito</button>` : '',
        canCancel ? `<button class="btn btn-ghost btn-compact btn-danger-ghost" data-invoice-action="cancel" data-invoice-id="${escapeHtml(invoice.id)}">Anular</button>` : '',
      ].filter(Boolean).join('');

      return `
        <tr class="${isCancelled ? 'row-cancelled' : ''}">
          <td>
            <strong style="font-family: var(--font-mono);">${invoice.encf || 'Pendiente'}</strong>
            ${relatedInfo.length ? `<div class="invoice-related">${relatedInfo.join(' · ')}</div>` : ''}
          </td>
          <td><span class="badge badge-kind ${kindInfo.className}">${kindInfo.label}</span></td>
          <td>${customer?.razonSocial || 'Sin cliente'}</td>
          <td><strong>${formatter.format(invoice.totals.total)}</strong></td>
          <td>${formatter.format(balanceDue)}</td>
          <td>${statusBadge}</td>
          <td>
            <span class="${paymentBadge}">${paymentStatus}</span>
            <div class="invoice-actions">${actions || '<span class="muted invoice-no-actions">Sin acciones</span>'}</div>
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

async function restoreSession() {
  if (!state.authToken) {
    openAuthOverlay('login');
    return false;
  }

  try {
    const result = await request('/api/auth/me', { skipAuthHandling: true });
    state.currentUser = result.user;
    renderSession();

    if (result.user.mustChangePassword) {
      openAuthOverlay(
        'password',
        'La clave inicial debe cambiarse antes de seguir operando la consola.'
      );
    } else {
      closeAuthOverlay();
    }

    return true;
  } catch (error) {
    clearSession();
    openAuthOverlay('login');
    return false;
  }
}

async function loginAction(event) {
  event.preventDefault();

  try {
    showLoader(true, 'Validando sesion local...', { fast: true });
    const payload = {
      username: document.querySelector('#loginUsername').value,
      password: document.querySelector('#loginPassword').value,
    };
    const result = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuthHandling: true,
    });

    storeSession(result.token, result.user);
    document.querySelector('#currentPassword').value = payload.password;

    if (result.user.mustChangePassword) {
      openAuthOverlay(
        'password',
        'La clave inicial debe cambiarse antes de seguir operando la consola.'
      );
    } else {
      closeAuthOverlay();
      await loadDashboard();
      ensurePolling();
      showToast('Sesion Iniciada', `Acceso concedido para ${result.user.displayName}.`);
    }
  } catch (error) {
    // request() already surfaces the error
  } finally {
    showLoader(false);
  }
}

async function changePasswordAction(event) {
  event.preventDefault();

  try {
    showLoader(true, 'Actualizando clave local...', { fast: true });
    const result = await request('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: document.querySelector('#currentPassword').value,
        newPassword: document.querySelector('#newPassword').value,
      }),
    });
    state.currentUser = result.user;
    closeAuthOverlay();
    await loadDashboard();
    ensurePolling();
    showToast('Clave Actualizada', 'La nueva contrasena local quedo registrada.');
  } catch (error) {
    // request() already surfaces the error
  } finally {
    showLoader(false);
  }
}

function logoutAction() {
  clearSession();
  state.data = null;
  state.auditLog = [];
  state.lastInvoiceId = null;
  renderSession();
  openAuthOverlay('login', 'La sesion local fue cerrada.');
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

// Emite (firma y asigna e-NCF) cualquier borrador: facturas y notas de crédito/débito
async function issueInvoiceEcf(invoiceId) {
  try {
    showLoader(true, 'Firma Digital e-CF Activa');
    const result = await request(`/api/invoices/${invoiceId}/issue-ecf`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    state.latestXmls.ecf = result.xml?.ecf || '';
    state.latestXmls.arecf = result.xml?.arecf || '';
    state.latestXmls.acecf = result.xml?.acecf || '';

    // Actualizar visor de XML
    switchXmlTab(state.activeXmlTab);

    await loadDashboard();
    showLoader(false);
    showToast('Firma Local Exitosa', `Comprobante ${result.invoice?.encf || invoiceId} firmado digitalmente.`, 'success');
    return true;
  } catch (error) {
    showLoader(false);
    return false;
  }
}

async function issueLastInvoiceAction() {
  const invoiceId = state.lastInvoiceId || state.data?.invoices[0]?.id;
  if (!invoiceId) {
    showToast('Operacion Invalida', 'Primero debes crear al menos un borrador.', 'error');
    return;
  }

  const issued = await issueInvoiceEcf(invoiceId);
  if (issued) {
    // Forzar foco en tabulación de bitácora
    switchLeftTab('auditTab');
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

// ============================================================
// Notas de crédito/débito y anulación de comprobantes
// ============================================================

function findInvoice(invoiceId) {
  return state.data?.invoices?.find((item) => item.id === invoiceId) || null;
}

function getInvoiceItems(invoice) {
  const items = Array.isArray(invoice?.items) ? invoice.items : [];
  return items.map((item) => ({
    productId: item.productId ?? item.id ?? '',
    descripcion: item.descripcion ?? item.nombre ?? 'Línea de comprobante',
    cantidad: Number(item.cantidad ?? 1),
    precio: Number(item.precio ?? item.precioUnitario ?? 0),
    itbisRate: item.itbisRate,
  }));
}

function openNoteModal(mode, invoiceId) {
  const invoice = findInvoice(invoiceId);
  if (!invoice) {
    showToast('Operacion Invalida', 'No se encontro el comprobante seleccionado.', 'error');
    return;
  }

  state.noteModal = { mode, invoiceId, items: getInvoiceItems(invoice) };

  const overlay = document.querySelector('#noteModal');
  const title = document.querySelector('#noteModalTitle');
  const desc = document.querySelector('#noteModalDesc');
  const reason = document.querySelector('#noteReason');
  const partialRow = document.querySelector('#notePartialRow');
  const partialToggle = document.querySelector('#notePartialToggle');
  const itemsWrap = document.querySelector('#noteItemsWrap');
  const confirmBtn = document.querySelector('#noteModalConfirm');
  if (!overlay || !title || !desc || !reason || !partialRow || !partialToggle || !itemsWrap || !confirmBtn) {
    return;
  }

  reason.value = '';
  partialToggle.checked = false;

  const ref = invoice.encf || invoice.id;
  if (mode === 'credit') {
    title.textContent = 'Nota de Crédito (E34/B04)';
    desc.textContent = `Se creará una nota de crédito sobre ${ref}. Por defecto aplica devolución total; marca la casilla si deseas editar los ítems.`;
    partialRow.classList.remove('hidden');
    itemsWrap.classList.add('hidden');
    confirmBtn.textContent = 'Crear Nota de Crédito';
    confirmBtn.className = 'btn btn-primary';
  } else if (mode === 'debit') {
    title.textContent = 'Nota de Débito (E33/B03)';
    desc.textContent = `Se creará una nota de débito sobre ${ref}. Ajusta cantidades y precios de los cargos adicionales a partir de los ítems del original.`;
    partialRow.classList.add('hidden');
    itemsWrap.classList.remove('hidden');
    renderNoteItems();
    confirmBtn.textContent = 'Crear Nota de Débito';
    confirmBtn.className = 'btn btn-primary';
  } else {
    title.textContent = 'Anular Comprobante';
    desc.textContent = `El comprobante ${ref} quedará anulado y pasará al reporte 608. Esta acción no se puede deshacer.`;
    partialRow.classList.add('hidden');
    itemsWrap.classList.add('hidden');
    confirmBtn.textContent = 'Anular Definitivamente';
    confirmBtn.className = 'btn btn-danger';
  }

  overlay.classList.add('active');
  reason.focus();
}

function closeNoteModal() {
  state.noteModal = null;
  const overlay = document.querySelector('#noteModal');
  if (overlay) {
    overlay.classList.remove('active');
  }
}

function renderNoteItems() {
  const body = document.querySelector('#noteItemsBody');
  if (!body) return;

  const items = state.noteModal?.items || [];
  if (!items.length) {
    body.innerHTML = `<tr><td colspan="4" class="muted" style="text-align: center;">El comprobante original no tiene ítems registrados.</td></tr>`;
    return;
  }

  body.innerHTML = items
    .map((item, index) => `
      <tr>
        <td><input type="checkbox" class="note-item-include" data-index="${index}" checked /></td>
        <td>${escapeHtml(item.descripcion)}</td>
        <td><input type="number" class="note-item-input note-item-qty" data-index="${index}" min="0" step="any" value="${item.cantidad}" /></td>
        <td><input type="number" class="note-item-input note-item-price" data-index="${index}" min="0" step="0.01" value="${item.precio}" /></td>
      </tr>
    `)
    .join('');
}

function collectNoteItems() {
  const body = document.querySelector('#noteItemsBody');
  const source = state.noteModal?.items || [];
  if (!body) return [];

  const selected = [];
  body.querySelectorAll('.note-item-include').forEach((checkbox) => {
    if (!checkbox.checked) return;
    const index = Number(checkbox.dataset.index);
    const original = source[index];
    if (!original) return;

    const qtyInput = body.querySelector(`.note-item-qty[data-index="${index}"]`);
    const priceInput = body.querySelector(`.note-item-price[data-index="${index}"]`);
    const cantidad = Number(qtyInput?.value);
    const precio = Number(priceInput?.value);
    if (!Number.isFinite(cantidad) || cantidad <= 0) return;
    if (!Number.isFinite(precio) || precio < 0) return;

    selected.push({
      productId: original.productId,
      descripcion: original.descripcion,
      cantidad,
      precio,
      itbisRate: original.itbisRate,
    });
  });

  return selected;
}

async function confirmNoteModal() {
  const modal = state.noteModal;
  if (!modal) return;

  const reason = document.querySelector('#noteReason').value.trim();
  if (!reason) {
    showToast('Falta el Motivo', 'Debes indicar el motivo de la operación.', 'error');
    return;
  }

  // Anulación (solo admin)
  if (modal.mode === 'cancel') {
    if (!window.confirm('¿Confirmas la anulación definitiva de este comprobante?')) {
      return;
    }
    try {
      showLoader(true, 'Anulando comprobante...', { fast: true });
      await request(`/api/invoices/${modal.invoiceId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      closeNoteModal();
      await loadDashboard();
      showLoader(false);
      showToast('Comprobante Anulado', 'El comprobante quedó anulado y se reflejará en el reporte 608.');
    } catch (error) {
      showLoader(false);
    }
    return;
  }

  // Notas de crédito/débito (operador o admin)
  const isCredit = modal.mode === 'credit';
  let items;
  if (isCredit) {
    if (document.querySelector('#notePartialToggle').checked) {
      items = collectNoteItems();
      if (!items.length) {
        showToast('Ítems Requeridos', 'Selecciona al menos un ítem con cantidad mayor a cero o desmarca la devolución parcial.', 'error');
        return;
      }
    }
  } else {
    items = collectNoteItems();
    if (!items.length) {
      showToast('Ítems Requeridos', 'La nota de débito requiere al menos un ítem con cantidad mayor a cero.', 'error');
      return;
    }
  }

  const endpoint = isCredit ? 'credit-note' : 'debit-note';
  const label = isCredit ? 'Nota de Crédito' : 'Nota de Débito';

  try {
    showLoader(true, `Creando ${label.toLowerCase()}...`, { fast: true });
    const payload = { reason };
    if (items) {
      payload.items = items;
    }
    const result = await request(`/api/invoices/${modal.invoiceId}/${endpoint}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const note = result?.invoice || result;

    closeNoteModal();
    await loadDashboard();
    showLoader(false);
    showToast(`${label} Creada`, 'La nota quedó en borrador vinculada al comprobante original.');

    if (note?.id && window.confirm(`${label} creada como borrador. ¿Deseas emitir el e-NCF ahora?`)) {
      await issueInvoiceEcf(note.id);
    }
  } catch (error) {
    showLoader(false);
  }
}

// ============================================================
// Compras locales (insumo del reporte 606)
// ============================================================

async function loadPurchases() {
  const tableBody = document.querySelector('#purchaseTable');
  try {
    const result = await request('/api/purchases');
    // El backend puede responder { purchases: [...] } o el array directo
    state.purchases = Array.isArray(result) ? result : (result?.purchases || []);
    renderPurchases();
  } catch (error) {
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="8" class="muted" style="text-align: center;">No se pudieron cargar las compras registradas.</td></tr>`;
    }
  }
}

function renderPurchases() {
  const tableBody = document.querySelector('#purchaseTable');
  if (!tableBody) return;

  if (!state.purchases.length) {
    tableBody.innerHTML = `<tr><td colspan="8" class="muted" style="text-align: center;">No hay compras registradas para el reporte 606.</td></tr>`;
    return;
  }

  tableBody.innerHTML = state.purchases
    .map((purchase) => {
      const tipo = purchase.tipoBienesServicios || '09';
      const tipoLabel = TIPO_BIENES_SERVICIOS[tipo] || 'Clasificación DGII';
      const retenciones = Number(purchase.itbisRetenido || 0) + Number(purchase.isrRetenido || 0);

      return `
        <tr>
          <td style="white-space: nowrap;">${escapeHtml(purchase.date || '-')}</td>
          <td>
            ${escapeHtml(purchase.supplierName || 'Proveedor')}
            <div class="invoice-related">RNC: ${escapeHtml(purchase.supplierRnc || '-')}</div>
          </td>
          <td><strong style="font-family: var(--font-mono);">${escapeHtml(purchase.ncf || '-')}</strong></td>
          <td><span class="badge badge-kind badge-kind-tipo" title="${escapeHtml(tipoLabel)}">${escapeHtml(tipo)}</span></td>
          <td>${formatter.format(Number(purchase.subtotal || 0))}</td>
          <td>${formatter.format(Number(purchase.itbis || 0))}</td>
          <td><strong>${formatter.format(Number(purchase.total || 0))}</strong></td>
          <td>
            ${escapeHtml(purchase.paymentMethod || '-')}
            ${retenciones > 0 ? `<div class="invoice-related">Retenciones: ${formatter.format(retenciones)}</div>` : ''}
          </td>
        </tr>
      `;
    })
    .join('');
}

function initPurchaseForm() {
  const form = document.querySelector('#purchaseForm');
  if (!form) return;

  if (form.elements.date && !form.elements.date.value) {
    form.elements.date.value = toIsoDate(new Date());
  }
  if (form.elements.total) {
    form.elements.total.dataset.manual = '';
  }
}

function bindPurchaseTotals() {
  const form = document.querySelector('#purchaseForm');
  if (!form) return;

  const subtotalEl = form.elements.subtotal;
  const itbisEl = form.elements.itbis;
  const totalEl = form.elements.total;
  if (!subtotalEl || !itbisEl || !totalEl) return;

  const recompute = () => {
    if (totalEl.dataset.manual === '1') return;
    const total = Number(subtotalEl.value || 0) + Number(itbisEl.value || 0);
    totalEl.value = total > 0 ? total.toFixed(2) : '';
  };

  subtotalEl.addEventListener('input', recompute);
  itbisEl.addEventListener('input', recompute);
  totalEl.addEventListener('input', () => {
    totalEl.dataset.manual = totalEl.value === '' ? '' : '1';
  });
}

async function savePurchaseAction(event) {
  event.preventDefault();

  if (!roleAtLeast('operador')) {
    showToast('Permiso Insuficiente', 'El rol visor no puede registrar compras.', 'error');
    return;
  }

  const form = document.querySelector('#purchaseForm');
  const raw = Object.fromEntries(new FormData(form).entries());

  if (!raw.supplierRnc?.trim() || !raw.supplierName?.trim() || !raw.ncf?.trim() || !raw.date) {
    showToast('Datos Incompletos', 'RNC, nombre del proveedor, NCF y fecha son obligatorios.', 'error');
    return;
  }

  const payload = {
    supplierRnc: raw.supplierRnc.trim(),
    supplierName: raw.supplierName.trim(),
    ncf: raw.ncf.trim().toUpperCase(),
    date: raw.date,
    tipoBienesServicios: raw.tipoBienesServicios || '09',
    subtotal: Number(raw.subtotal || 0),
    itbis: Number(raw.itbis || 0),
    total: Number(raw.total || 0),
    paymentMethod: raw.paymentMethod || 'efectivo',
  };
  if (raw.itbisRetenido !== undefined && raw.itbisRetenido !== '') {
    payload.itbisRetenido = Number(raw.itbisRetenido);
  }
  if (raw.isrRetenido !== undefined && raw.isrRetenido !== '') {
    payload.isrRetenido = Number(raw.isrRetenido);
  }
  if (raw.notes?.trim()) {
    payload.notes = raw.notes.trim();
  }

  if (!Number.isFinite(payload.total) || payload.total <= 0) {
    showToast('Montos Invalidos', 'El total de la compra debe ser mayor que cero.', 'error');
    return;
  }

  try {
    showLoader(true, 'Registrando compra local...', { fast: true });
    await request('/api/purchases', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    form.reset();
    initPurchaseForm();
    await loadPurchases();
    showLoader(false);
    showToast('Compra Registrada', 'La compra quedó disponible para el reporte 606.');
  } catch (error) {
    showLoader(false);
  }
}

// ============================================================
// Reportes DGII 606 / 607 / 608 y resumen del período
// ============================================================

function ensureReportDates() {
  const fromEl = document.querySelector('#reportFrom');
  const toEl = document.querySelector('#reportTo');
  if (!fromEl || !toEl) return;
  if (fromEl.value && toEl.value) return;

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  if (!fromEl.value) fromEl.value = toIsoDate(firstDay);
  if (!toEl.value) toEl.value = toIsoDate(now);
}

function getReportRange() {
  ensureReportDates();
  const from = document.querySelector('#reportFrom')?.value;
  const to = document.querySelector('#reportTo')?.value;

  if (!from || !to) {
    showToast('Rango Invalido', 'Selecciona las fechas desde y hasta.', 'error');
    return null;
  }
  if (from > to) {
    showToast('Rango Invalido', 'La fecha inicial no puede ser mayor que la final.', 'error');
    return null;
  }
  return { from, to };
}

async function loadPeriodSummary() {
  const range = getReportRange();
  if (!range) return;

  try {
    showLoader(true, 'Consultando resumen del período...', { fast: true });
    const summary = await request(`/api/reports/period?from=${range.from}&to=${range.to}`);
    renderPeriodSummary(summary);
    showLoader(false);
  } catch (error) {
    showLoader(false);
  }
}

function summaryRow(label, value) {
  return `<div class="summary-row"><span>${label}</span><strong>${value}</strong></div>`;
}

function buildSummaryCard(label, block) {
  if (block === null || block === undefined) return '';

  const money = (value) => formatter.format(Number(value) || 0);
  const rows = [];

  if (typeof block === 'object') {
    if (block.cantidad !== undefined) rows.push(summaryRow('Cantidad', String(block.cantidad)));
    if (block.subtotal !== undefined) rows.push(summaryRow('Subtotal', money(block.subtotal)));
    if (block.itbis !== undefined) rows.push(summaryRow('ITBIS', money(block.itbis)));
    if (block.monto !== undefined) rows.push(summaryRow('Monto', money(block.monto)));
    if (block.total !== undefined) rows.push(summaryRow('Total', money(block.total)));
  } else if (typeof block === 'number') {
    rows.push(summaryRow('Total', money(block)));
  }

  if (!rows.length) return '';

  return `
    <div class="summary-card">
      <div class="summary-card-title">${label}</div>
      <div class="summary-card-rows">${rows.join('')}</div>
    </div>
  `;
}

function renderPeriodSummary(summary) {
  const container = document.querySelector('#periodSummary');
  if (!container) return;

  if (!summary || typeof summary !== 'object') {
    container.innerHTML = '<span class="muted">Sin datos para el período seleccionado.</span>';
    return;
  }

  const cards = [
    buildSummaryCard('Ventas (607)', summary.ventas),
    buildSummaryCard('Notas de Crédito', summary.notasCredito),
    buildSummaryCard('Notas de Débito', summary.notasDebito),
    buildSummaryCard('Compras (606)', summary.compras),
    buildSummaryCard('Cobros', summary.cobros),
    buildSummaryCard('Anulados (608)', { cantidad: summary.anuladas ?? 0 }),
    buildSummaryCard('Cuentas por Cobrar', { monto: summary.cuentasPorCobrar ?? 0 }),
  ].filter(Boolean);

  container.innerHTML = cards.length
    ? cards.join('')
    : '<span class="muted">Sin datos para el período seleccionado.</span>';
}

function formatReportCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && !Number.isInteger(value)) return value.toFixed(2);
  return String(value);
}

async function viewReport(report) {
  const range = getReportRange();
  if (!range) return;

  try {
    showLoader(true, `Generando reporte ${report}...`, { fast: true });
    const result = await request(`/api/reports/dgii/${report}?from=${range.from}&to=${range.to}&format=json`);
    renderReportViewer(report, range, result);
    showLoader(false);
  } catch (error) {
    showLoader(false);
  }
}

function renderReportViewer(report, range, result) {
  const viewer = document.querySelector('#reportViewer');
  const title = document.querySelector('#reportViewTitle');
  const head = document.querySelector('#reportTableHead');
  const body = document.querySelector('#reportTableBody');
  const totalsEl = document.querySelector('#reportTotals');
  if (!viewer || !title || !head || !body || !totalsEl) return;

  const rows = Array.isArray(result?.rows) ? result.rows : [];
  const count = result?.count ?? rows.length;
  title.textContent = `${DGII_REPORT_LABELS[report] || `Reporte ${report}`} · ${range.from} a ${range.to} · ${count} registro(s)`;

  if (!rows.length) {
    head.innerHTML = '';
    body.innerHTML = `<tr><td class="muted" style="text-align: center;">No hay registros en el período seleccionado.</td></tr>`;
  } else {
    const columns = Object.keys(rows[0]);
    head.innerHTML = `<tr>${columns.map((col) => `<th>${escapeHtml(col)}</th>`).join('')}</tr>`;
    body.innerHTML = rows
      .map((row) => `<tr>${columns.map((col) => `<td>${escapeHtml(formatReportCell(row[col]))}</td>`).join('')}</tr>`)
      .join('');
  }

  const totals = result?.totals && typeof result.totals === 'object' ? Object.entries(result.totals) : [];
  totalsEl.innerHTML = totals
    .map(([key, value]) => `<span class="report-total-chip">${escapeHtml(key)}: <strong>${escapeHtml(formatReportCell(value))}</strong></span>`)
    .join('');

  viewer.classList.remove('hidden');
}

// Descarga TXT/CSV con el token en el header (window.open no permite Authorization)
async function downloadReport(report, format) {
  const range = getReportRange();
  if (!range) return;

  try {
    showLoader(true, `Preparando archivo ${format.toUpperCase()} del ${report}...`, { fast: true });
    const response = await fetch(`/api/reports/dgii/${report}?from=${range.from}&to=${range.to}&format=${format}`, {
      headers: {
        ...(state.authToken ? { Authorization: `Bearer ${state.authToken}` } : {}),
      },
    });

    if (!response.ok) {
      const bodyError = await response.json().catch(() => ({}));
      throw new Error(bodyError.error || `Error HTTP ${response.status}`);
    }

    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^";]+)"?/i);
    const filename = match ? match[1] : `DGII_${report}_${range.from}_a_${range.to}.${format}`;

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

    showLoader(false);
    showToast('Descarga Lista', `Reporte ${report} descargado como ${filename}.`);
  } catch (error) {
    showLoader(false);
    showToast('Fallo en Operación', error.message || `No se pudo descargar el reporte ${report}.`, 'error');
  }
}

function bindEvents() {
  document.querySelectorAll('[data-left-tab]').forEach((button) => {
    button.addEventListener('click', () => switchLeftTab(button.dataset.leftTab));
  });
  document.querySelectorAll('[data-xml-tab]').forEach((button) => {
    button.addEventListener('click', () => switchXmlTab(button.dataset.xmlTab));
  });
  document.querySelectorAll('[data-preset]').forEach((button) => {
    button.addEventListener('click', () => loadBusinessPreset(button.dataset.preset));
  });
  document.querySelector('#invoiceTable').addEventListener('click', (event) => {
    const button = event.target.closest('[data-invoice-action]');
    if (!button) return;
    const invoiceId = button.dataset.invoiceId;
    const actions = {
      issue: () => issueInvoiceEcf(invoiceId),
      pay: () => recordInvoicePayment(invoiceId),
      credit: () => openNoteModal('credit', invoiceId),
      debit: () => openNoteModal('debit', invoiceId),
      cancel: () => openNoteModal('cancel', invoiceId),
    };
    actions[button.dataset.invoiceAction]?.();
  });

  document.querySelector('#loginForm').addEventListener('submit', loginAction);
  document.querySelector('#passwordForm').addEventListener('submit', changePasswordAction);
  document.querySelector('#logoutButton').addEventListener('click', logoutAction);
  document.querySelector('#saveCompany').addEventListener('click', saveCompanyForm);
  document.querySelector('#createFiscalSequence').addEventListener('click', createFiscalSequenceAction);
  document.querySelector('#createInvoice').addEventListener('click', createInvoiceAction);
  document.querySelector('#issueLastInvoice').addEventListener('click', issueLastInvoiceAction);
  document.querySelector('#runTests').addEventListener('click', runTestsAction);
  document.querySelector('#refreshAuditBtn').addEventListener('click', loadDashboard);
  document.querySelector('#refreshInvoicesBtn').addEventListener('click', loadDashboard);
  document.querySelector('#copyXmlBtn').addEventListener('click', copyXmlToClipboard);

  // Modal de notas de crédito/débito y anulación
  document.querySelector('#noteModalCancel').addEventListener('click', closeNoteModal);
  document.querySelector('#noteModalConfirm').addEventListener('click', confirmNoteModal);
  document.querySelector('#notePartialToggle').addEventListener('change', (event) => {
    const wrap = document.querySelector('#noteItemsWrap');
    if (event.target.checked) {
      renderNoteItems();
      wrap.classList.remove('hidden');
    } else {
      wrap.classList.add('hidden');
    }
  });

  // Compras (reporte 606)
  document.querySelector('#purchaseForm').addEventListener('submit', savePurchaseAction);
  document.querySelector('#refreshPurchasesBtn').addEventListener('click', loadPurchases);
  bindPurchaseTotals();
  initPurchaseForm();

  // Reportes DGII 606/607/608 y resumen del período
  document.querySelector('#loadPeriodSummaryBtn').addEventListener('click', loadPeriodSummary);
  document.querySelectorAll('.report-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const report = button.dataset.report;
      const action = button.dataset.action;
      if (action === 'view') {
        viewReport(report);
      } else {
        downloadReport(report, action);
      }
    });
  });
}

// Arrancar bucle de refresco cada 5 segundos (Live feedback)
function ensurePolling() {
  if (state.pollingStarted) {
    return;
  }

  state.pollingStarted = true;
  setInterval(() => {
    if (state.authToken) {
      loadDashboard();
    }
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

bindEvents();
restoreSession()
  .then((ready) => {
    if (!ready) {
      return;
    }

    ensurePolling();
    return loadDashboard();
  })
  .catch((error) => showToast('Error Inicial', error.message, 'error'));
