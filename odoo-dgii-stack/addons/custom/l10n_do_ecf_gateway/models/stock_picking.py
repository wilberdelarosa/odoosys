from odoo import _, fields, models
from odoo.exceptions import UserError


class StockPicking(models.Model):
    _inherit = "stock.picking"

    dgii_logistics_category = fields.Selection(
        [
            ("furniture", "Muebleria"),
            ("heavy_equipment_rental", "Alquiler de equipos pesados"),
            ("aggregates", "Agregados / materiales"),
            ("construction_materials", "Materiales de construccion"),
            ("service_delivery", "Servicio con entrega"),
            ("other", "Otro"),
        ],
        string="Categoria logistica",
        default="other",
        copy=False,
    )
    dgii_dispatch_flow_state = fields.Selection(
        [
            ("planning", "Planificacion"),
            ("ready", "Listo para despacho"),
            ("loaded", "Cargado"),
            ("delivered", "Entregado"),
            ("blocked", "Bloqueado"),
        ],
        string="Flujo despacho",
        default="planning",
        copy=False,
        tracking=True,
    )
    dgii_dispatch_reference = fields.Char(string="Referencia despacho", copy=False)
    dgii_driver_name = fields.Char(string="Chofer / responsable", copy=False)
    dgii_vehicle_plate = fields.Char(string="Placa / equipo", copy=False)
    dgii_route_notes = fields.Text(string="Ruta / instrucciones", copy=False)
    dgii_delivery_proof = fields.Text(string="Evidencia de entrega", copy=False)
    dgii_scheduled_dispatch_date = fields.Datetime(string="Fecha programada", copy=False)
    dgii_source_invoice_id = fields.Many2one(
        "account.move",
        string="Factura relacionada",
        copy=False,
        help="Factura e-CF relacionada al despacho cuando el flujo viene desde venta/facturacion.",
    )

    def action_dgii_prepare_dispatch(self):
        for picking in self:
            picking._dgii_check_dispatch_ready(strict=False)
            picking.dgii_dispatch_flow_state = "ready"
        return True

    def action_dgii_mark_loaded(self):
        for picking in self:
            picking._dgii_check_dispatch_ready(strict=True)
            picking.dgii_dispatch_flow_state = "loaded"
        return True

    def action_dgii_mark_delivered(self):
        for picking in self:
            if picking.state != "done":
                raise UserError(_("Valida la transferencia de inventario antes de marcar entrega final."))
            picking.dgii_dispatch_flow_state = "delivered"
        return True

    def action_dgii_open_related_invoice(self):
        self.ensure_one()
        invoice = self.dgii_source_invoice_id or self._dgii_find_related_invoice()
        if not invoice:
            raise UserError(_("No se encontro factura relacionada para este despacho."))
        return {
            "type": "ir.actions.act_window",
            "res_model": "account.move",
            "res_id": invoice.id,
            "view_mode": "form",
            "target": "current",
        }

    def _dgii_check_dispatch_ready(self, strict=False):
        self.ensure_one()
        missing = []
        if not self.partner_id:
            missing.append(_("cliente/destinatario"))
        if not self.move_ids_without_package:
            missing.append(_("productos a despachar"))
        if strict and not self.dgii_driver_name:
            missing.append(_("chofer o responsable"))
        if strict and not self.dgii_vehicle_plate and self.dgii_logistics_category in (
            "heavy_equipment_rental",
            "aggregates",
            "construction_materials",
        ):
            missing.append(_("placa o equipo"))
        if missing:
            self.dgii_dispatch_flow_state = "blocked"
            raise UserError(_("Completa antes del despacho: %s") % ", ".join(missing))
        return True

    def _dgii_find_related_invoice(self):
        self.ensure_one()
        invoice = self.dgii_source_invoice_id
        if invoice:
            return invoice
        sale = getattr(self, "sale_id", False)
        if sale and sale.invoice_ids:
            invoice = sale.invoice_ids.filtered(lambda move: move.move_type == "out_invoice")[:1]
            if invoice:
                self.dgii_source_invoice_id = invoice.id
                return invoice
        return self.env["account.move"]
