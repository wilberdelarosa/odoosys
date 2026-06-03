/** @odoo-module **/

import { Component, useState, onWillStart } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { MetricCard } from "@operations_ui_do/components/metric_card/metric_card";
import { QuickAction } from "@operations_ui_do/components/quick_action/quick_action";

/**
 * OperationsDashboard
 * --------------------
 * Accion cliente principal: Hub Operativo.
 *
 * Carga metricas en vivo desde Odoo via ORM (read_group), usando solo modelos
 * estandar (sale.order, account.move, stock.picking, res.partner). Si algun
 * modulo no esta instalado, el bloque correspondiente se oculta sin romper.
 */
export class OperationsDashboard extends Component {
    static template = "operations_ui_do.Dashboard";
    static components = { MetricCard, QuickAction };
    static props = ["*"];

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");

        this.state = useState({
            loading: true,
            today: this.formatToday(),
            sales: { today: 0, monthCount: 0, monthAmount: 0, trend: 0 },
            invoices: { pendingCount: 0, pendingAmount: 0 },
            inventory: { pickingsToday: 0, lowStock: 0 },
            partners: { newThisMonth: 0 },
            modules: { sale: false, account: false, stock: false },
        });

        onWillStart(async () => {
            await this.loadData();
        });
    }

    formatToday() {
        return new Intl.DateTimeFormat("es-DO", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        }).format(new Date());
    }

    isoDate(d) {
        return d.toISOString().slice(0, 10);
    }

    async hasModel(model) {
        try {
            await this.orm.call("ir.model", "search_count", [[["model", "=", model]]]);
            const count = await this.orm.searchCount("ir.model", [["model", "=", model]]);
            return count > 0;
        } catch (e) {
            return false;
        }
    }

    async loadData() {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const startOfPrevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const endOfPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        const [hasSale, hasAccount, hasStock] = await Promise.all([
            this.hasModel("sale.order"),
            this.hasModel("account.move"),
            this.hasModel("stock.picking"),
        ]);

        this.state.modules = { sale: hasSale, account: hasAccount, stock: hasStock };

        // SALES
        if (hasSale) {
            try {
                const todaySales = await this.orm.searchRead(
                    "sale.order",
                    [
                        ["date_order", ">=", this.isoDate(startOfDay) + " 00:00:00"],
                        ["state", "in", ["sale", "done"]],
                    ],
                    ["amount_total"],
                );
                this.state.sales.today = todaySales.reduce((s, o) => s + (o.amount_total || 0), 0);

                const monthSales = await this.orm.searchRead(
                    "sale.order",
                    [
                        ["date_order", ">=", this.isoDate(startOfMonth) + " 00:00:00"],
                        ["state", "in", ["sale", "done"]],
                    ],
                    ["amount_total"],
                );
                this.state.sales.monthCount = monthSales.length;
                this.state.sales.monthAmount = monthSales.reduce((s, o) => s + (o.amount_total || 0), 0);

                const prevSales = await this.orm.searchRead(
                    "sale.order",
                    [
                        ["date_order", ">=", this.isoDate(startOfPrevMonth) + " 00:00:00"],
                        ["date_order", "<=", this.isoDate(endOfPrevMonth) + " 23:59:59"],
                        ["state", "in", ["sale", "done"]],
                    ],
                    ["amount_total"],
                );
                const prevTotal = prevSales.reduce((s, o) => s + (o.amount_total || 0), 0);
                if (prevTotal > 0) {
                    this.state.sales.trend = ((this.state.sales.monthAmount - prevTotal) / prevTotal) * 100;
                }
            } catch (e) { /* sale module no disponible */ }
        }

        // INVOICES (cuentas por cobrar pendientes)
        if (hasAccount) {
            try {
                const pendingInvoices = await this.orm.searchRead(
                    "account.move",
                    [
                        ["move_type", "=", "out_invoice"],
                        ["state", "=", "posted"],
                        ["payment_state", "in", ["not_paid", "partial"]],
                    ],
                    ["amount_residual"],
                );
                this.state.invoices.pendingCount = pendingInvoices.length;
                this.state.invoices.pendingAmount = pendingInvoices.reduce((s, i) => s + (i.amount_residual || 0), 0);
            } catch (e) { /* */ }
        }

        // INVENTORY
        if (hasStock) {
            try {
                this.state.inventory.pickingsToday = await this.orm.searchCount("stock.picking", [
                    ["scheduled_date", ">=", this.isoDate(startOfDay) + " 00:00:00"],
                    ["state", "in", ["assigned", "confirmed", "waiting"]],
                ]);
            } catch (e) { /* */ }
        }

        // PARTNERS
        try {
            this.state.partners.newThisMonth = await this.orm.searchCount("res.partner", [
                ["create_date", ">=", this.isoDate(startOfMonth)],
                ["customer_rank", ">", 0],
            ]);
        } catch (e) { /* */ }

        this.state.loading = false;
    }

    // ---------- Acciones rapidas ----------

    openQuickSale() {
        if (!this.state.modules.sale) return this.warnNoModule("Ventas");
        this.action.doAction({
            name: "Nueva Venta",
            type: "ir.actions.act_window",
            res_model: "sale.order",
            views: [[false, "form"]],
            target: "current",
            context: { default_state: "draft" },
        });
    }

    openInvoices() {
        if (!this.state.modules.account) return this.warnNoModule("Facturacion");
        this.action.doAction({
            name: "Facturas",
            type: "ir.actions.act_window",
            res_model: "account.move",
            views: [[false, "list"], [false, "form"]],
            domain: [["move_type", "=", "out_invoice"]],
            target: "current",
        });
    }

    openInventory() {
        if (!this.state.modules.stock) return this.warnNoModule("Inventario");
        this.action.doAction({
            name: "Movimientos de Inventario",
            type: "ir.actions.act_window",
            res_model: "stock.picking",
            views: [[false, "list"], [false, "form"]],
            target: "current",
        });
    }

    openInventoryScan() {
        if (!this.state.modules.stock) return this.warnNoModule("Inventario");
        this.action.doAction("operations_ui_do.action_operations_inventory_scan");
    }

    openCustomers() {
        this.action.doAction({
            name: "Clientes",
            type: "ir.actions.act_window",
            res_model: "res.partner",
            views: [[false, "kanban"], [false, "list"], [false, "form"]],
            domain: [["customer_rank", ">", 0]],
            target: "current",
        });
    }

    openProducts() {
        this.action.doAction({
            name: "Productos",
            type: "ir.actions.act_window",
            res_model: "product.template",
            views: [[false, "kanban"], [false, "list"], [false, "form"]],
            target: "current",
        });
    }

    openSalesList() {
        if (!this.state.modules.sale) return this.warnNoModule("Ventas");
        this.action.doAction({
            name: "Ordenes de Venta",
            type: "ir.actions.act_window",
            res_model: "sale.order",
            views: [[false, "list"], [false, "form"]],
            target: "current",
        });
    }

    warnNoModule(name) {
        this.notification.add(`El modulo "${name}" no esta instalado en este sistema.`, {
            type: "warning",
            sticky: false,
        });
    }
}

registry.category("actions").add("operations_ui_do.dashboard", OperationsDashboard);
