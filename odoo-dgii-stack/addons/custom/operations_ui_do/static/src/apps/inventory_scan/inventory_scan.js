/** @odoo-module **/

import { Component, onWillStart, onWillUnmount, useRef, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

export class OperationsInventoryScan extends Component {
    static template = "operations_ui_do.InventoryScan";
    static props = ["*"];

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");
        this.videoRef = useRef("video");
        this.scanFrame = null;
        this.detector = null;
        this.stream = null;
        this.lastScanAt = 0;
        this.scanBusy = false;

        this.state = useState({
            loading: true,
            pickings: [],
            selectedPickingId: null,
            scanCode: "",
            qty: 1,
            cameraActive: false,
            cameraSupported: true,
            productQuery: "",
            products: [],
            lastResult: null,
            applying: false,
        });

        onWillStart(async () => {
            await this.loadPickings();
        });

        onWillUnmount(() => {
            this.stopScanner();
        });
    }

    async loadPickings() {
        const pickings = await this.orm.searchRead(
            "stock.picking",
            [["state", "in", ["assigned", "confirmed", "waiting"]]],
            ["name", "partner_id", "scheduled_date", "state", "picking_type_id"],
            { limit: 40, order: "scheduled_date asc, id desc" },
        );
        this.state.pickings = pickings;
        this.state.selectedPickingId = pickings.length ? pickings[0].id : null;
        this.state.loading = false;
    }

    get selectedPicking() {
        return this.state.pickings.find((picking) => picking.id === Number(this.state.selectedPickingId));
    }

    getRelName(value, fallback = "") {
        return Array.isArray(value) ? value[1] : fallback;
    }

    onPickingChange(ev) {
        this.state.selectedPickingId = Number(ev.target.value) || null;
    }

    onScanCodeInput(ev) {
        this.state.scanCode = ev.target.value;
    }

    onQtyInput(ev) {
        const qty = Number(ev.target.value);
        this.state.qty = qty > 0 ? qty : 1;
    }

    async onProductSearchInput(ev) {
        this.state.productQuery = ev.target.value;
        await this.searchProducts();
    }

    async searchProducts() {
        const query = (this.state.productQuery || "").trim();
        if (query.length < 2) {
            this.state.products = [];
            return;
        }
        this.state.products = await this.orm.searchRead(
            "product.product",
            [
                "|", "|",
                ["barcode", "ilike", query],
                ["default_code", "ilike", query],
                ["name", "ilike", query],
            ],
            ["display_name", "default_code", "barcode", "qty_available", "uom_id"],
            { limit: 12 },
        );
    }

    useProductCode(product) {
        this.state.scanCode = product.barcode || product.default_code || "";
        this.state.productQuery = product.display_name;
        this.state.products = [];
    }

    async applyManualScan() {
        await this.applyScan(this.state.scanCode);
    }

    async applyScan(rawCode) {
        const code = (rawCode || "").trim();
        if (!this.state.selectedPickingId) {
            this.notification.add("Selecciona una operacion de inventario antes de escanear.", { type: "warning" });
            return;
        }
        if (!code) {
            this.notification.add("Escanea o escribe un codigo valido.", { type: "warning" });
            return;
        }
        if (this.state.applying) return;

        this.state.applying = true;
        try {
            const result = await this.orm.call(
                "stock.picking",
                "action_stock_scan_do_apply_rpc",
                [[this.state.selectedPickingId], code],
                { increment: Number(this.state.qty) || 1 },
            );
            this.state.lastResult = result;
            this.state.scanCode = "";
            this.notification.add(result.message, { type: "success" });
        } catch (error) {
            const message = error.message || (error.data && error.data.message) || "No se pudo registrar el escaneo.";
            this.notification.add(message, { type: "danger", sticky: false });
        } finally {
            this.state.applying = false;
        }
    }

    async startScanner() {
        if (!("BarcodeDetector" in window)) {
            this.state.cameraSupported = false;
            this.notification.add("Este navegador no soporta escaneo por camara. Usa un lector USB o entrada manual.", { type: "warning" });
            return;
        }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.state.cameraSupported = false;
            this.notification.add("No hay acceso a camara en este navegador.", { type: "warning" });
            return;
        }

        try {
            this.detector = new window.BarcodeDetector({
                formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e"],
            });
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: "environment" } },
                audio: false,
            });
            const video = this.videoRef.el;
            video.srcObject = this.stream;
            await video.play();
            this.state.cameraActive = true;
            this.scanLoop();
        } catch (error) {
            this.notification.add("No se pudo activar la camara. Revisa permisos del navegador.", { type: "danger" });
        }
    }

    stopScanner() {
        if (this.scanFrame) {
            cancelAnimationFrame(this.scanFrame);
            this.scanFrame = null;
        }
        if (this.stream) {
            for (const track of this.stream.getTracks()) {
                track.stop();
            }
        }
        this.stream = null;
        this.state.cameraActive = false;
    }

    async scanLoop() {
        if (!this.state.cameraActive || !this.detector || !this.videoRef.el) return;
        const now = Date.now();
        if (!this.scanBusy && now - this.lastScanAt > 1400) {
            this.scanBusy = true;
            try {
                const codes = await this.detector.detect(this.videoRef.el);
                const value = codes.length ? codes[0].rawValue : null;
                if (value) {
                    this.lastScanAt = now;
                    this.state.scanCode = value;
                    await this.applyScan(value);
                }
            } catch (error) {
                // Algunos frames pueden fallar mientras la camara estabiliza.
            } finally {
                this.scanBusy = false;
            }
        }
        this.scanFrame = requestAnimationFrame(() => this.scanLoop());
    }

    openPicking() {
        if (!this.state.selectedPickingId) return;
        this.action.doAction({
            type: "ir.actions.act_window",
            res_model: "stock.picking",
            res_id: this.state.selectedPickingId,
            views: [[false, "form"]],
            target: "current",
        });
    }
}

registry.category("actions").add("operations_ui_do.inventory_scan", OperationsInventoryScan);
