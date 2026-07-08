import json
from datetime import datetime

import requests

from odoo import _, api, fields, models


class EcfTestRun(models.Model):
    _name = "ecf.test.run"
    _description = "e-CF Test Lab Run"
    _order = "create_date desc"

    name = fields.Char(default=lambda self: self._default_name(), required=True)
    state = fields.Selection(
        [
            ("draft", "Borrador"),
            ("success", "OK"),
            ("warning", "Con alertas"),
            ("error", "Error"),
        ],
        default="draft",
        readonly=True,
        copy=False,
    )
    gateway_url = fields.Char(
        string="URL Gateway e-CF",
        required=True,
        default=lambda self: self._default_gateway_url(),
        help="URL base del servicio Node que firma XML y expone endpoints e-CF.",
    )
    environment = fields.Selection(
        [
            ("local", "Local / demo"),
            ("testecf", "TesteCF"),
            ("certecf", "CerteCF"),
            ("ecf", "eCF Produccion"),
        ],
        default="local",
        required=True,
    )
    dry_run = fields.Boolean(
        string="Modo seguro / dry-run",
        default=True,
        help="No envia a produccion DGII desde Odoo; valida contra el gateway configurado.",
    )

    fiscal_number = fields.Char(
        string="e-NCF de prueba",
        default="E310000999999",
        required=True,
        help="Numero fiscal de prueba usado para el payload dry-run. No uses una secuencia productiva real aqui.",
    )
    customer_rnc = fields.Char(string="RNC cliente prueba", default="101010101", required=True)
    customer_name = fields.Char(string="Cliente prueba", default="Cliente Prueba e-CF", required=True)
    line_name = fields.Char(string="Concepto prueba", default="Servicio de prueba e-CF", required=True)
    quantity = fields.Float(default=1.0, required=True)
    price = fields.Float(default=500.0, required=True)
    tax_rate = fields.Float(string="ITBIS", default=0.18, required=True)

    last_run_at = fields.Datetime(readonly=True, copy=False)
    gateway_ok = fields.Boolean(readonly=True, copy=False)
    certificate_ok = fields.Boolean(readonly=True, copy=False)
    precertification_ok = fields.Boolean(readonly=True, copy=False)
    dry_invoice_ok = fields.Boolean(readonly=True, copy=False)

    summary = fields.Text(readonly=True, copy=False)
    result_json = fields.Text(string="Resultado JSON", readonly=True, copy=False)
    signed_ecf_xml = fields.Text(string="XML e-CF firmado", readonly=True, copy=False)
    signed_arecf_xml = fields.Text(string="ARECF firmado", readonly=True, copy=False)
    signed_acecf_xml = fields.Text(string="ACECF firmado", readonly=True, copy=False)
    required_files = fields.Text(string="Archivos requeridos", readonly=True, copy=False)
    next_steps = fields.Text(string="Siguientes pasos", readonly=True, copy=False)

    @api.model
    def _default_name(self):
        return _("Prueba e-CF %s") % fields.Datetime.now()

    @api.model
    def _default_gateway_url(self):
        return self.env["ir.config_parameter"].sudo().get_param(
            "l10n_do_ecf_gateway.url", "http://host.docker.internal:3000"
        )

    def action_run_full_test(self):
        for record in self:
            record._run_full_test()
        return True

    def action_reset(self):
        self.write(
            {
                "state": "draft",
                "last_run_at": False,
                "gateway_ok": False,
                "certificate_ok": False,
                "precertification_ok": False,
                "dry_invoice_ok": False,
                "summary": False,
                "result_json": False,
                "signed_ecf_xml": False,
                "signed_arecf_xml": False,
                "signed_acecf_xml": False,
                "required_files": False,
                "next_steps": False,
            }
        )

    def action_open_gateway(self):
        self.ensure_one()
        return {
            "type": "ir.actions.act_url",
            "url": self.gateway_url,
            "target": "new",
        }

    def _run_full_test(self):
        self.ensure_one()
        steps = []
        evidence = {}

        health = self._run_json_step("Gateway activo", "GET", "/health")
        steps.append(health)
        evidence["health"] = health.get("data")

        config = self._run_json_step("Configuracion DGII", "GET", "/software-config")
        steps.append(config)
        evidence["software_config"] = config.get("data")

        certificate = self._run_json_step("Certificado digital", "GET", "/api/certificate/status")
        steps.append(certificate)
        evidence["certificate"] = certificate.get("data")

        files = self._run_json_step("Archivos requeridos", "GET", "/api/testlab/required-files")
        steps.append(files)
        evidence["required_files"] = files.get("data")

        precertification = self._run_json_step(
            "Precertificacion local", "POST", "/api/precertification/run", {}
        )
        steps.append(precertification)
        evidence["precertification"] = precertification.get("data")

        dry_invoice = self._run_json_step(
            "Factura Odoo dry-run",
            "POST",
            "/api/odoo/invoices",
            self._build_dry_invoice_payload(),
        )
        steps.append(dry_invoice)
        evidence["dry_invoice"] = dry_invoice.get("data")

        dry_data = dry_invoice.get("data") or {}
        xml = dry_data.get("xml") if isinstance(dry_data, dict) else {}
        certificate_data = certificate.get("data") or {}
        precert_data = precertification.get("data") or {}

        hard_failures = [step for step in steps if not step.get("ok")]
        warnings = self._collect_warnings(certificate_data, precert_data)
        state = "success" if not hard_failures and not warnings else "warning"
        if hard_failures:
            state = "error"

        values = {
            "state": state,
            "last_run_at": fields.Datetime.now(),
            "gateway_ok": bool(health.get("ok")),
            "certificate_ok": bool(certificate.get("ok") and certificate_data.get("ok")),
            "precertification_ok": bool(precertification.get("ok") and precert_data.get("ok")),
            "dry_invoice_ok": bool(dry_invoice.get("ok") and dry_data.get("ok")),
            "summary": self._build_summary(steps, warnings),
            "result_json": json.dumps({"steps": steps, "evidence": evidence}, indent=2, ensure_ascii=False),
            "signed_ecf_xml": (xml or {}).get("ecf"),
            "signed_arecf_xml": (xml or {}).get("arecf"),
            "signed_acecf_xml": (xml or {}).get("acecf"),
            "required_files": self._build_required_files_text(files.get("data"), certificate_data),
            "next_steps": self._build_next_steps(state, warnings, hard_failures),
        }
        self.write(values)

    def _run_json_step(self, name, method, path, payload=None):
        try:
            response = requests.request(
                method,
                self._join_url(path),
                json=payload if payload is not None else None,
                timeout=45,
            )
            content_type = response.headers.get("content-type", "")
            data = response.json() if "application/json" in content_type else {"raw": response.text}
            ok = response.ok and bool(data.get("ok", True))
            return {
                "name": name,
                "ok": ok,
                "http_status": response.status_code,
                "detail": data.get("note") or data.get("error") or "OK",
                "data": data,
            }
        except Exception as exc:
            return {
                "name": name,
                "ok": False,
                "http_status": None,
                "detail": str(exc),
                "data": {},
            }

    def _join_url(self, path):
        return "%s%s" % ((self.gateway_url or "").rstrip("/"), path)

    def _build_dry_invoice_payload(self):
        return {
            "externalId": "odoo-test-lab-%s" % self.id,
            "number": "TEST-LAB-%s" % self.id,
            "fiscalNumber": self.fiscal_number,
            "documentType": "31",
            "currency": "DOP",
            "customer": {
                "rnc": self.customer_rnc,
                "razonSocial": self.customer_name,
                "correo": "prueba@example.com",
                "direccion": "Santo Domingo, Republica Dominicana",
            },
            "items": [
                {
                    "descripcion": self.line_name,
                    "cantidad": self.quantity,
                    "precio": self.price,
                    "itbisRate": self.tax_rate,
                }
            ],
        }

    def _collect_warnings(self, certificate_data, precert_data):
        warnings = []
        for warning in certificate_data.get("warnings") or []:
            warnings.append(warning)
        for result in precert_data.get("results") or []:
            if not result.get("ok"):
                warnings.append("%s: %s" % (result.get("name"), result.get("detail")))
        if self.environment == "ecf" and self.dry_run:
            warnings.append("Estas en ambiente eCF pero con dry-run activo. Correcto para prueba; no emite real.")
        return warnings

    def _build_summary(self, steps, warnings):
        lines = []
        for step in steps:
            marker = "OK" if step.get("ok") else "ERROR"
            lines.append("[%s] %s - %s" % (marker, step.get("name"), step.get("detail")))
        if warnings:
            lines.append("")
            lines.append("Alertas:")
            lines.extend("- %s" % warning for warning in warnings)
        return "\n".join(lines)

    def _build_required_files_text(self, files_data, certificate_data):
        lines = [
            "Archivos concretos que debes preparar:",
            "",
            "1. certificado.p12",
            "   - Certificado digital tributario del contribuyente o firmante autorizado.",
            "   - No lo subas al repositorio ni lo envies por chat.",
            "   - En el gateway se referencia con CERT_PATH.",
            "",
            "2. clave del certificado .p12",
            "   - Se configura como CERT_PASSWORD en el gateway.",
            "   - Debe manejarse como secreto.",
            "",
            "3. URL HTTPS publica",
            "   - Se configura como PUBLIC_BASE_URL.",
            "   - Para DGII real no puede ser localhost.",
        ]
        if certificate_data:
            lines.extend(
                [
                    "",
                    "Estado detectado por gateway:",
                    "- Modo certificado: %s" % certificate_data.get("mode"),
                    "- Archivo: %s" % certificate_data.get("certificateFile"),
                    "- HTTPS listo: %s" % ("Si" if certificate_data.get("httpsReady") else "No"),
                ]
            )
        if files_data and files_data.get("files"):
            lines.append("")
            lines.append("Detalle del gateway:")
            for item in files_data.get("files"):
                lines.append("- %s: %s" % (item.get("name"), item.get("env")))
        return "\n".join(lines)

    def _build_next_steps(self, state, warnings, failures):
        if state == "success":
            return "Todo el laboratorio local paso correctamente. Siguiente paso: cambiar a certificado real, PUBLIC_BASE_URL HTTPS y probar en TesteCF/CerteCF."
        lines = []
        if failures:
            lines.append("Corrige primero estos fallos:")
            lines.extend("- %s: %s" % (item.get("name"), item.get("detail")) for item in failures)
        if warnings:
            lines.append("")
            lines.append("Luego revisa estas alertas:")
            lines.extend("- %s" % warning for warning in warnings)
        lines.append("")
        lines.append("No avances a eCF produccion hasta que el laboratorio local y CerteCF pasen sin errores.")
        return "\n".join(lines)
