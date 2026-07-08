from odoo import _, fields, models
from odoo.exceptions import UserError


class StockScanDoWizard(models.TransientModel):
    _name = "stock.scan.do.wizard"
    _description = "Stock Scan Wizard"

    picking_id = fields.Many2one(
        "stock.picking", string="Operacion", required=True, readonly=True
    )
    scan_code = fields.Char(string="Codigo escaneado")
    qty_increment = fields.Float(string="Incremento", default=1.0, required=True)
    last_scan_code = fields.Char(string="Ultimo codigo", readonly=True)
    last_message = fields.Char(string="Resultado", readonly=True)

    def action_apply_scan(self):
        self.ensure_one()
        if self.qty_increment <= 0:
            raise UserError(_("El incremento debe ser mayor que cero."))

        scanned_code = self.scan_code
        result = self.picking_id._stock_scan_do_apply_code(
            scanned_code, increment=self.qty_increment
        )
        self.write(
            {
                "last_scan_code": scanned_code,
                "last_message": result["message"],
                "scan_code": False,
            }
        )

        return {
            "type": "ir.actions.client",
            "tag": "display_notification",
            "params": {
                "title": _("Escaneo registrado"),
                "message": result["message"],
                "type": "success",
                "sticky": False,
                "next": {
                    "type": "ir.actions.act_window",
                    "name": _("Escaneo de inventario"),
                    "res_model": "stock.scan.do.wizard",
                    "res_id": self.id,
                    "view_mode": "form",
                    "target": "new",
                },
            },
        }