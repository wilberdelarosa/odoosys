from jinja2.sandbox import SandboxedEnvironment

from odoo import _, api, fields, models
from odoo.exceptions import UserError


class EcfDocumentTemplate(models.Model):
    _name = "ecf.document.template"
    _description = "e-CF Document Template"
    _order = "is_default desc, name"

    name = fields.Char(required=True)
    active = fields.Boolean(default=True)
    is_default = fields.Boolean(string="Plantilla por defecto")
    template_type = fields.Selection(
        [
            ("invoice", "Factura e-CF"),
            ("dispatch", "Despacho / entrega"),
            ("quote", "Cotizacion"),
        ],
        default="invoice",
        required=True,
    )
    body_html = fields.Text(
        string="HTML de plantilla",
        default=lambda self: self._default_body_html(),
        required=True,
    )
    css = fields.Text(string="CSS ligero")
    notes = fields.Text(
        string="Notas de uso",
        default="Usa variables Jinja2: invoice, company, partner, lines, totals, qr_url, security_code, signed_at.",
    )

    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        records.filtered("is_default")._unset_other_defaults()
        return records

    def write(self, vals):
        result = super().write(vals)
        if vals.get("is_default"):
            self.filtered("is_default")._unset_other_defaults()
        return result

    def action_set_default(self):
        self.ensure_one()
        self.write({"is_default": True})
        return True

    def action_preview_with_latest_invoice(self):
        self.ensure_one()
        invoice = self.env["account.move"].search(
            [("move_type", "in", ("out_invoice", "out_refund"))],
            order="invoice_date desc, id desc",
            limit=1,
        )
        if not invoice:
            raise UserError(_("No hay facturas para previsualizar la plantilla."))
        invoice.dgii_ecf_template_id = self.id
        invoice.action_ecf_render_template()
        return {
            "type": "ir.actions.act_window",
            "res_model": "account.move",
            "res_id": invoice.id,
            "view_mode": "form",
            "target": "current",
        }

    def render_for_move(self, move):
        self.ensure_one()
        context = move._get_ecf_template_context()
        environment = SandboxedEnvironment(autoescape=True)
        template = environment.from_string(self._build_document_html())
        return template.render(**context)

    def _unset_other_defaults(self):
        for record in self:
            domain = [
                ("id", "!=", record.id),
                ("template_type", "=", record.template_type),
                ("is_default", "=", True),
            ]
            self.search(domain).write({"is_default": False})

    def _build_document_html(self):
        css = self.css or ""
        return "<style>%s</style>\n%s" % (css, self.body_html or "")

    @api.model
    def _default_body_html(self):
        return """
<section class="ecf-template">
  <header style="display:flex;justify-content:space-between;gap:24px;border-bottom:1px solid #d8dde6;padding-bottom:16px;margin-bottom:18px;">
    <div>
      <h2 style="margin:0 0 4px;">{{ company.name }}</h2>
      <div>RNC: {{ company.vat }}</div>
      <div>{{ company.address }}</div>
    </div>
    <div style="text-align:right;">
      <strong>{{ invoice.document_type }}</strong><br/>
      <span>e-NCF: {{ invoice.fiscal_number }}</span><br/>
      <span>Fecha: {{ invoice.date }}</span>
    </div>
  </header>
  <section style="margin-bottom:18px;">
    <strong>Cliente</strong><br/>
    {{ partner.name }}<br/>
    RNC/Cedula: {{ partner.vat }}<br/>
    {{ partner.address }}
  </section>
  <table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead>
      <tr style="background:#f3f6fa;">
        <th style="text-align:left;padding:8px;border:1px solid #d8dde6;">Descripcion</th>
        <th style="text-align:right;padding:8px;border:1px solid #d8dde6;">Cant.</th>
        <th style="text-align:right;padding:8px;border:1px solid #d8dde6;">Precio</th>
        <th style="text-align:right;padding:8px;border:1px solid #d8dde6;">Total</th>
      </tr>
    </thead>
    <tbody>
      {% for line in lines %}
      <tr>
        <td style="padding:8px;border:1px solid #d8dde6;">{{ line.name }}</td>
        <td style="padding:8px;border:1px solid #d8dde6;text-align:right;">{{ line.quantity }}</td>
        <td style="padding:8px;border:1px solid #d8dde6;text-align:right;">{{ line.price_unit }}</td>
        <td style="padding:8px;border:1px solid #d8dde6;text-align:right;">{{ line.subtotal }}</td>
      </tr>
      {% endfor %}
    </tbody>
  </table>
  <footer style="display:flex;justify-content:space-between;gap:24px;margin-top:20px;">
    <div>
      {% if qr_url %}<div><strong>QR DGII:</strong> {{ qr_url }}</div>{% endif %}
      {% if security_code %}<div><strong>Codigo seguridad:</strong> {{ security_code }}</div>{% endif %}
      {% if signed_at %}<div><strong>Fecha firma:</strong> {{ signed_at }}</div>{% endif %}
    </div>
    <div style="text-align:right;font-size:16px;">
      <strong>Total: {{ totals.total }}</strong>
    </div>
  </footer>
</section>
"""
