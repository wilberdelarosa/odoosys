import { AppData, getInvoiceBalance, Invoice } from './facturador.js';

/**
 * Reportes DGII 606 (compras), 607 (ventas) y 608 (anulaciones) mas el resumen
 * por periodo. Todo se calcula 100% local a partir del AppData persistido.
 *
 * Formato de texto plano: cabecera simplificada estilo DGII
 * `<REPORTE>|<RNC>|<PERIODO AAAAMM>|<CANTIDAD_REGISTROS>` seguida de filas
 * pipe-separated. Tambien se ofrece un CSV generico para hojas de calculo.
 */

export type Report606Row = {
  rncCedula: string;
  tipoIdentificacion: '1' | '2';
  tipoBienesServicios: string;
  ncf: string;
  fechaComprobante: string;
  montoFacturado: number;
  itbisFacturado: number;
  itbisRetenido: number;
  isrRetenido: number;
};

export type Report607Row = {
  rncCedula: string;
  tipoIdentificacion: '1' | '2';
  ncf: string;
  ncfModificado: string;
  fechaComprobante: string;
  montoFacturado: number;
  itbisFacturado: number;
};

export type Report608Row = {
  ncf: string;
  fechaAnulacion: string;
  tipoAnulacion: string;
};

export interface DgiiReport<TRow> {
  rows: TRow[];
  totals: Record<string, number>;
  count: number;
}

export function build606(data: AppData, from: string, to: string): DgiiReport<Report606Row> {
  const rows = data.purchases
    .filter((purchase) => isInRange(purchase.date, from, to))
    .map((purchase) => ({
      rncCedula: purchase.supplierRnc,
      tipoIdentificacion: resolveTipoIdentificacion(purchase.supplierRnc),
      tipoBienesServicios: purchase.tipoBienesServicios,
      ncf: purchase.ncf,
      fechaComprobante: toDgiiDate(purchase.date),
      montoFacturado: round(purchase.subtotal),
      itbisFacturado: round(purchase.itbis),
      itbisRetenido: round(purchase.itbisRetenido || 0),
      isrRetenido: round(purchase.isrRetenido || 0),
    }))
    .sort((a, b) => a.fechaComprobante.localeCompare(b.fechaComprobante));

  return {
    rows,
    totals: {
      montoFacturado: sumRows(rows, (row) => row.montoFacturado),
      itbisFacturado: sumRows(rows, (row) => row.itbisFacturado),
      itbisRetenido: sumRows(rows, (row) => row.itbisRetenido),
      isrRetenido: sumRows(rows, (row) => row.isrRetenido),
    },
    count: rows.length,
  };
}

export function build607(data: AppData, from: string, to: string): DgiiReport<Report607Row> {
  const rows = data.invoices
    .filter(
      (invoice) =>
        invoice.status === 'emitida' &&
        Boolean(invoice.encf) &&
        Boolean(invoice.issuedAt) &&
        isInRange(toDateKey(invoice.issuedAt!), from, to)
    )
    .map((invoice) => {
      const customer = data.customers.find((item) => item.id === invoice.customerId);
      const rncCedula = String(customer?.rnc || '').replace(/\D/g, '');
      return {
        rncCedula,
        tipoIdentificacion: resolveTipoIdentificacion(rncCedula),
        ncf: invoice.encf!,
        ncfModificado:
          (invoice.kind || 'factura') === 'factura' ? '' : invoice.modifiedEncf || '',
        fechaComprobante: toDgiiDate(toDateKey(invoice.issuedAt!)),
        montoFacturado: round(invoice.totals.subtotal),
        itbisFacturado: round(invoice.totals.itbis),
      };
    })
    .sort((a, b) => a.fechaComprobante.localeCompare(b.fechaComprobante));

  return {
    rows,
    totals: {
      montoFacturado: sumRows(rows, (row) => row.montoFacturado),
      itbisFacturado: sumRows(rows, (row) => row.itbisFacturado),
    },
    count: rows.length,
  };
}

export function build608(data: AppData, from: string, to: string): DgiiReport<Report608Row> {
  const rows = data.invoices
    .filter(
      (invoice) =>
        invoice.status === 'anulada' &&
        Boolean(invoice.encf) &&
        Boolean(invoice.cancelledAt) &&
        isInRange(toDateKey(invoice.cancelledAt!), from, to)
    )
    .map((invoice) => ({
      ncf: invoice.encf!,
      fechaAnulacion: toDgiiDate(toDateKey(invoice.cancelledAt!)),
      tipoAnulacion: '02',
    }))
    .sort((a, b) => a.fechaAnulacion.localeCompare(b.fechaAnulacion));

  return {
    rows,
    totals: {},
    count: rows.length,
  };
}

export function to606Text(data: AppData, report: DgiiReport<Report606Row>, from: string) {
  const header = `606|${data.company.rnc}|${toPeriod(from)}|${report.count}`;
  const lines = report.rows.map((row) =>
    [
      row.rncCedula,
      row.tipoIdentificacion,
      row.tipoBienesServicios,
      row.ncf,
      row.fechaComprobante,
      formatAmount(row.montoFacturado),
      formatAmount(row.itbisFacturado),
      formatAmount(row.itbisRetenido),
      formatAmount(row.isrRetenido),
    ].join('|')
  );
  return [header, ...lines].join('\r\n');
}

export function to607Text(data: AppData, report: DgiiReport<Report607Row>, from: string) {
  const header = `607|${data.company.rnc}|${toPeriod(from)}|${report.count}`;
  const lines = report.rows.map((row) =>
    [
      row.rncCedula,
      row.tipoIdentificacion,
      row.ncf,
      row.ncfModificado,
      row.fechaComprobante,
      formatAmount(row.montoFacturado),
      formatAmount(row.itbisFacturado),
    ].join('|')
  );
  return [header, ...lines].join('\r\n');
}

export function to608Text(data: AppData, report: DgiiReport<Report608Row>, from: string) {
  const header = `608|${data.company.rnc}|${toPeriod(from)}|${report.count}`;
  const lines = report.rows.map((row) =>
    [row.ncf, row.fechaAnulacion, row.tipoAnulacion].join('|')
  );
  return [header, ...lines].join('\r\n');
}

export function toCsv(rows: object[]): string {
  if (!rows.length) {
    return '';
  }

  const headers = Object.keys(rows[0] as Record<string, unknown>);
  const lines = rows.map((row) =>
    headers
      .map((header) => escapeCsvValue((row as Record<string, unknown>)[header]))
      .join(',')
  );

  return [headers.join(','), ...lines].join('\r\n');
}

export function buildPeriodSummary(data: AppData, from: string, to: string) {
  const issuedInPeriod = data.invoices.filter(
    (invoice) =>
      invoice.status === 'emitida' &&
      Boolean(invoice.issuedAt) &&
      isInRange(toDateKey(invoice.issuedAt!), from, to)
  );

  const ventas = summarizeInvoices(
    issuedInPeriod.filter((invoice) => (invoice.kind || 'factura') === 'factura')
  );
  const notasCredito = summarizeInvoices(
    issuedInPeriod.filter((invoice) => invoice.kind === 'nota_credito')
  );
  const notasDebito = summarizeInvoices(
    issuedInPeriod.filter((invoice) => invoice.kind === 'nota_debito')
  );

  const anuladas = data.invoices.filter(
    (invoice) =>
      invoice.status === 'anulada' &&
      Boolean(invoice.cancelledAt) &&
      isInRange(toDateKey(invoice.cancelledAt!), from, to)
  ).length;

  const paymentsInPeriod = data.payments.filter((payment) =>
    isInRange(toDateKey(payment.createdAt), from, to)
  );
  const cobros = {
    cantidad: paymentsInPeriod.length,
    monto: round(paymentsInPeriod.reduce((total, payment) => total + payment.amount, 0)),
  };

  const purchasesInPeriod = data.purchases.filter((purchase) =>
    isInRange(purchase.date, from, to)
  );
  const compras = {
    cantidad: purchasesInPeriod.length,
    subtotal: round(purchasesInPeriod.reduce((total, item) => total + item.subtotal, 0)),
    itbis: round(purchasesInPeriod.reduce((total, item) => total + item.itbis, 0)),
    total: round(purchasesInPeriod.reduce((total, item) => total + item.total, 0)),
  };

  const cuentasPorCobrar = round(
    data.invoices
      .filter(
        (invoice) =>
          invoice.status === 'emitida' && (invoice.kind || 'factura') !== 'nota_credito'
      )
      .reduce((total, invoice) => total + getInvoiceBalance(data, invoice), 0)
  );

  return {
    from,
    to,
    ventas,
    notasCredito,
    notasDebito,
    anuladas,
    cobros,
    compras,
    cuentasPorCobrar,
  };
}

function summarizeInvoices(invoices: Invoice[]) {
  return {
    cantidad: invoices.length,
    subtotal: round(invoices.reduce((total, invoice) => total + invoice.totals.subtotal, 0)),
    itbis: round(invoices.reduce((total, invoice) => total + invoice.totals.itbis, 0)),
    total: round(invoices.reduce((total, invoice) => total + invoice.totals.total, 0)),
  };
}

function resolveTipoIdentificacion(rncCedula: string): '1' | '2' {
  return rncCedula.replace(/\D/g, '').length === 11 ? '2' : '1';
}

function toDateKey(value: string) {
  return String(value).slice(0, 10);
}

function isInRange(dateKey: string, from: string, to: string) {
  return dateKey >= from && dateKey <= to;
}

function toDgiiDate(dateKey: string) {
  return dateKey.replace(/-/g, '');
}

function toPeriod(from: string) {
  return from.slice(0, 7).replace('-', '');
}

function formatAmount(value: number) {
  return round(value).toFixed(2);
}

function sumRows<TRow>(rows: TRow[], pick: (row: TRow) => number) {
  return round(rows.reduce((total, row) => total + pick(row), 0));
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function escapeCsvValue(value: unknown) {
  const text = value === undefined || value === null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
