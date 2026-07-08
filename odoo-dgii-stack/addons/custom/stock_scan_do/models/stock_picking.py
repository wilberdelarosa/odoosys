from odoo import _, fields, models
from odoo.exceptions import UserError


class StockPicking(models.Model):
    _inherit = "stock.picking"

    stock_scan_last_code = fields.Char(
        string="Ultimo codigo escaneado", copy=False, readonly=True
    )
    stock_scan_last_message = fields.Char(
        string="Resultado ultimo escaneo", copy=False, readonly=True
    )

    def action_open_stock_scan_wizard(self):
        self.ensure_one()
        return {
            "type": "ir.actions.act_window",
            "name": _("Escaneo de inventario"),
            "res_model": "stock.scan.do.wizard",
            "view_mode": "form",
            "target": "new",
            "context": {
                "default_picking_id": self.id,
            },
        }

    def _stock_scan_do_find_product(self, scanned_code):
        product = self.env["product.product"].search(
            [("barcode", "=", scanned_code)], limit=1
        )
        if product:
            return product
        return self.env["product.product"].search(
            [("default_code", "=", scanned_code)], limit=1
        )

    def _stock_scan_do_apply_code(self, scanned_code, increment=1.0):
        self.ensure_one()

        if self.state in ("done", "cancel"):
            raise UserError(
                _("No se puede escanear una operacion que ya esta completada o cancelada.")
            )

        scanned_code = (scanned_code or "").strip()
        if not scanned_code:
            raise UserError(_("Debes escanear o escribir un codigo valido."))

        product = self._stock_scan_do_find_product(scanned_code)
        if not product:
            raise UserError(
                _("No se encontro un producto con el codigo '%s'.") % scanned_code
            )

        candidate_moves = self.move_ids_without_package.filtered(
            lambda move: move.product_id == product and move.state not in ("done", "cancel")
        )
        if not candidate_moves:
            raise UserError(
                _("El producto %s no forma parte de esta operacion.")
                % product.display_name
            )

        line = self.move_line_ids.filtered(
            lambda move_line: move_line.product_id == product
            and not move_line.lot_id
            and not move_line.lot_name
        )[:1]

        if line:
            line.quantity += increment
        else:
            move = candidate_moves[:1]
            line = self.env["stock.move.line"].create(
                {
                    "picking_id": self.id,
                    "move_id": move.id,
                    "product_id": product.id,
                    "product_uom_id": move.product_uom.id,
                    "quantity": increment,
                    "location_id": self.location_id.id,
                    "location_dest_id": self.location_dest_id.id,
                }
            )

        message = _("%s actualizado a %s %s.") % (
            product.display_name,
            line.quantity,
            line.product_uom_id.name,
        )
        self.write(
            {
                "stock_scan_last_code": scanned_code,
                "stock_scan_last_message": message,
            }
        )
        return {
            "product_id": product.id,
            "product_name": product.display_name,
            "quantity": line.quantity,
            "uom_name": line.product_uom_id.name,
            "message": message,
        }

    def action_stock_scan_do_apply_rpc(self, scanned_code, increment=1.0):
        self.ensure_one()
        return self._stock_scan_do_apply_code(scanned_code, increment=increment)