import base64
import json

import requests

from odoo import _, fields, models
from odoo.exceptions import UserError


class AccountMove(models.Model):
    _inherit = "account.move"

    dgii_ecf_gateway_state = fields.Selection(
        [("not_sent", "No enviado"), ("sent", "Enviado"), ("error", "Error")],
        string="Estado e-CF DGII",
        default="not_sent",
        copy=False,
        readonly=True,
    )
    dgii_ecf_flow_state = fields.Selection(
        [
            ("needs_config", "Requiere configuracion"),
            ("ready", "Listo para firmar"),
            ("signed", "XML firmado"),
            ("accepted", "Acuse generado"),
            ("error", "Error"),
        ],
        string="Flujo e-CF",
        default="needs_config",
        copy=False,
        readonly=True,
        tracking=True,
    )
    dgii_ecf_track_id = fields.Char(string="TrackId e-CF", copy=False, readonly=True)
    dgii_ecf_gateway_response = fields.Text(string="Respuesta Gateway e-CF", copy=False, readonly=True)
    dgii_ecf_readiness_summary = fields.Text(string="Diagnostico e-CF", copy=False, readonly=True)
    dgii_ecf_signed_xml = fields.Text(string="XML e-CF firmado", copy=False, readonly=True)
    dgii_ecf_arecf_xml = fields.Text(string="ARECF firmado", copy=False, readonly=True)
    dgii_ecf_acecf_xml = fields.Text(string="ACECF firmado", copy=False, readonly=True)
    dgii_ecf_template_id = fields.Many2one(
        "ecf.document.template",
        string="Plantilla e-CF",
        domain="[('template_type', '=', 'invoice'), ('active', '=', True)]",
        copy=False,
    )
    dgii_ecf_rendered_html = fields.Html(string="Representacion renderizada", copy=False, readonly=True)
    dgii_ecf_qr_url = fields.Char(string="URL QR DGII", related="l10n_do_electronic_stamp", readonly=True)

    def action_ecf_check_readiness(self):
        has_errors = False
        for move in self:
            errors, warnings = move._ecf_collect_readiness()
            has_errors = has_errors or bool(errors)
            move.write(
                {
                    "dgii_ecf_flow_state": "needs_config" if errors else "ready",
                    "dgii_ecf_readiness_summary": move._format_readiness(errors, warnings),
                }
            )
        return {
            "type": "ir.actions.client",
            "tag": "display_notification",
            "params": {
                "title": _("Diagnostico e-CF"),
                "message": _("Faltan datos de configuracion.") if has_errors else _("La factura esta lista."),
                "type": "warning" if has_errors else "success",
                "sticky": False,
            },
        }

    def action_ecf_open_configuration(self):
        return {
            "type": "ir.actions.act_window",
            "name": _("Configurar facturacion electronica"),
            "res_model": "res.config.settings",
            "view_mode": "form",
            "target": "current",
            "context": {"module_l10n_do_ecf_gateway": True},
        }

    def action_ecf_run_full_flow(self):
        for move in self:
            errors, warnings = move._ecf_collect_readiness()
            if errors:
                move.write(
                    {
                        "dgii_ecf_flow_state": "needs_config",
                        "dgii_ecf_readiness_summary": move._format_readiness(errors, warnings),
                    }
                )
                raise UserError(move.dgii_ecf_readiness_summary)
            move._send_to_ecf_gateway()
            move.action_ecf_render_template()
        return {
            "type": "ir.actions.client",
            "tag": "display_notification",
            "params": {
                "title": _("e-CF completado"),
                "message": _("XML firmado, acuses, QR y plantilla fueron generados."),
                "type": "success",
                "sticky": False,
            },
        }

    def action_send_to_ecf_gateway(self):
        for move in self:
            move._send_to_ecf_gateway()
        return True

    def action_ecf_render_template(self):
        for move in self:
            template = move.dgii_ecf_template_id or self.env["ecf.document.template"].search(
                [("template_type", "=", "invoice"), ("is_default", "=", True)], limit=1
            )
            if not template:
                template = self.env["ecf.document.template"].search([("template_type", "=", "invoice")], limit=1)
            if not template:
                template = self.env["ecf.document.template"].create(
                    {"name": _("Plantilla e-CF base"), "template_type": "invoice", "is_default": True}
                )
            move.write({"dgii_ecf_template_id": template.id, "dgii_ecf_rendered_html": template.render_for_move(move)})
        return True

    def _send_to_ecf_gateway(self):
        self.ensure_one()
        errors, warnings = self._ecf_collect_readiness(check_gateway=False)
        if errors:
            self.write(
                {
                    "dgii_ecf_gateway_state": "error",
                    "dgii_ecf_flow_state": "needs_config",
                    "dgii_ecf_readiness_summary": self._format_readiness(errors, warnings),
                }
            )
            raise UserError(self.dgii_ecf_readiness_summary)

        gateway_url = self._get_ecf_gateway_url()
        payload = self._prepare_ecf_gateway_payload()
        try:
            response = requests.post("%s/api/odoo/invoices" % gateway_url.rstrip("/"), json=payload, timeout=45)
            response.raise_for_status()
            data = response.json()
        except Exception as exc:
            self.write(
                {
                    "dgii_ecf_gateway_state": "error",
                    "dgii_ecf_flow_state": "error",
                    "dgii_ecf_gateway_response": str(exc),
                }
            )
            raise UserError(_("No se pudo enviar la factura al gateway DGII: %s") % exc)

        invoice = data.get("invoice", {})
        xml = data.get("xml", {}) or {}
        signed_ecf_xml = xml.get("ecf") or ""
        security_code = invoice.get("securityCode") or self._extract_xml_value(signed_ecf_xml, "CodigoSeguridad")
        flow_state = "accepted" if xml.get("arecf") or xml.get("acecf") else "signed"
        self.write(
            {
                "dgii_ecf_gateway_state": "sent",
                "dgii_ecf_flow_state": flow_state,
                "dgii_ecf_track_id": invoice.get("trackId"),
                "dgii_ecf_gateway_response": json.dumps(data, indent=2, ensure_ascii=False),
                "dgii_ecf_signed_xml": signed_ecf_xml,
                "dgii_ecf_arecf_xml": xml.get("arecf"),
                "dgii_ecf_acecf_xml": xml.get("acecf"),
                "l10n_do_ecf_security_code": security_code,
                "l10n_do_ecf_sign_date": fields.Datetime.now(),
                "l10n_do_ecf_edi_file": base64.b64encode(signed_ecf_xml.encode("utf-8")) if signed_ecf_xml else False,
                "l10n_do_ecf_edi_file_name": "%s-ecf.xml" % self.l10n_do_fiscal_number,
                "dgii_ecf_readiness_summary": self._format_readiness([], warnings),
            }
        )

    def _ecf_collect_readiness(self, check_gateway=True):
        self.ensure_one()
        errors = []
        warnings = []
        if self.state != "posted":
            errors.append(_("La factura debe estar publicada."))
        if self.move_type not in ("out_invoice", "out_refund"):
            errors.append(_("Solo aplica a facturas o notas de credito de cliente."))
        if not self.is_ecf_invoice:
            errors.append(_("Selecciona un tipo de documento e-CF en el diario/factura."))
        if not self.l10n_do_fiscal_number:
            errors.append(_("La factura debe tener e-NCF generado antes de firmar."))
        if not self.company_id.vat:
            errors.append(_("Configura RNC de la compania."))
        if not self.company_id.country_id or self.company_id.country_id != self.env.ref("base.do"):
            errors.append(_("La compania debe estar configurada en Republica Dominicana."))
        if not self.partner_id.commercial_partner_id.vat:
            errors.append(_("El cliente debe tener RNC o cedula."))
        if not self.invoice_line_ids.filtered(lambda line: line.display_type in (False, "product")):
            errors.append(_("La factura necesita al menos una linea facturable."))

        gateway_url = self._get_ecf_gateway_url()
        if not gateway_url:
            errors.append(_("Configura la URL del gateway e-CF."))
        elif check_gateway:
            try:
                health = requests.get("%s/health" % gateway_url.rstrip("/"), timeout=8)
                health.raise_for_status()
                certificate = requests.get("%s/api/certificate/status" % gateway_url.rstrip("/"), timeout=8)
                certificate.raise_for_status()
                certificate_data = certificate.json()
                if not certificate_data.get("ok"):
                    errors.append(_("El gateway no tiene certificado cargado."))
                warnings.extend(certificate_data.get("warnings") or [])
            except Exception as exc:
                errors.append(_("Gateway e-CF no disponible: %s") % exc)
        return errors, warnings

    def _format_readiness(self, errors, warnings):
        lines = []
        if errors:
            lines.append(_("Faltan requisitos:"))
            lines.extend("- %s" % item for item in errors)
        else:
            lines.append(_("OK: factura lista para generar XML e-CF, firma digital, acuses y QR."))
        if warnings:
            lines.append("")
            lines.append(_("Alertas:"))
            lines.extend("- %s" % item for item in warnings)
        return "\n".join(lines)

    def _get_ecf_gateway_url(self):
        return self.env["ir.config_parameter"].sudo().get_param("l10n_do_ecf_gateway.url", "http://localhost:3000")

    def _prepare_ecf_gateway_payload(self):
        self.ensure_one()
        partner = self.partner_id.commercial_partner_id
        lines = self.invoice_line_ids.filtered(lambda line: line.display_type in (False, "product"))
        return {
            "externalId": str(self.id),
            "number": self.name,
            "fiscalNumber": self.l10n_do_fiscal_number,
            "documentType": self.l10n_latam_document_type_id.doc_code_prefix,
            "currency": self.currency_id.name,
            "customer": {
                "rnc": partner.vat or "",
                "razonSocial": partner.name or "",
                "correo": partner.email or "",
                "direccion": self._get_partner_address(partner),
            },
            "items": [line._prepare_ecf_gateway_line() for line in lines],
        }

    def _get_partner_address(self, partner):
        return ", ".join(item for item in [partner.street, partner.street2, partner.city, partner.country_id.name] if item)

    def _extract_xml_value(self, xml, tag):
        if not xml or not tag:
            return False
        start = xml.find("<%s>" % tag)
        end = xml.find("</%s>" % tag)
        if start == -1 or end == -1:
            return False
        return xml[start + len(tag) + 2 : end].strip()

    def _get_ecf_template_context(self):
        self.ensure_one()
        partner = self.partner_id.commercial_partner_id
        company_partner = self.company_id.partner_id
        lines = []
        for line in self.invoice_line_ids.filtered(lambda item: item.display_type in (False, "product")):
            lines.append(
                {
                    "name": line.name or line.product_id.display_name,
                    "quantity": line.quantity,
                    "price_unit": self._format_template_money(line.price_unit),
                    "subtotal": self._format_template_money(line.price_subtotal),
                }
            )
        return {
            "invoice": {
                "name": self.name,
                "date": self.invoice_date or fields.Date.today(),
                "document_type": self.l10n_latam_document_type_id.display_name,
                "fiscal_number": self.l10n_do_fiscal_number,
                "track_id": self.dgii_ecf_track_id,
                "state": self.dgii_ecf_flow_state,
            },
            "company": {"name": self.company_id.name, "vat": self.company_id.vat or "", "address": self._get_partner_address(company_partner)},
            "partner": {"name": partner.name, "vat": partner.vat or "", "address": self._get_partner_address(partner)},
            "lines": lines,
            "totals": {
                "untaxed": self._format_template_money(self.amount_untaxed),
                "tax": self._format_template_money(self.amount_tax),
                "total": self._format_template_money(self.amount_total),
            },
            "qr_url": self.l10n_do_electronic_stamp or "",
            "security_code": self.l10n_do_ecf_security_code or "",
            "signed_at": self.l10n_do_ecf_sign_date or "",
        }

    def _format_template_money(self, value):
        self.ensure_one()
        return "%s %s" % (self.currency_id.symbol or self.currency_id.name, "%.2f" % (value or 0.0))


class AccountMoveLine(models.Model):
    _inherit = "account.move.line"

    def _prepare_ecf_gateway_line(self):
        self.ensure_one()
        tax_rate = sum(self.tax_ids.mapped("amount")) / 100 if self.tax_ids else 0.18
        return {
            "name": self.name or self.product_id.display_name,
            "descripcion": self.name or self.product_id.display_name,
            "quantity": self.quantity or 1,
            "cantidad": self.quantity or 1,
            "price": self.price_unit,
            "precio": self.price_unit,
            "taxRate": tax_rate,
            "itbisRate": tax_rate,
        }
