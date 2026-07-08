/** @odoo-module **/

import { Component } from "@odoo/owl";

/**
 * MetricCard
 * ----------
 * Tarjeta para mostrar una metrica clave (numero grande + etiqueta + tendencia).
 *
 * Props:
 *  - label: string. Etiqueta de la metrica.
 *  - value: string|number. Valor a mostrar.
 *  - icon: string. Nombre de icono FontAwesome (sin "fa-").
 *  - trend: number opcional. Variacion porcentual (negativa o positiva).
 *  - tone: "primary" | "success" | "warning" | "danger" | "info".
 *  - currency: string opcional. Si se define, formatea como moneda.
 *  - onClick: callback opcional al clickear.
 */
export class MetricCard extends Component {
    static template = "operations_ui_do.MetricCard";
    static props = {
        label: { type: String },
        value: { type: [String, Number] },
        icon: { type: String, optional: true },
        trend: { type: Number, optional: true },
        tone: { type: String, optional: true },
        currency: { type: String, optional: true },
        onClick: { type: Function, optional: true },
    };
    static defaultProps = {
        icon: "chart-line",
        tone: "primary",
    };

    get formattedValue() {
        const v = this.props.value;
        if (typeof v === "number") {
            const opts = this.props.currency
                ? { style: "currency", currency: this.props.currency, maximumFractionDigits: 2 }
                : { maximumFractionDigits: 2 };
            return new Intl.NumberFormat("es-DO", opts).format(v);
        }
        return v;
    }

    get trendClass() {
        if (!this.props.trend && this.props.trend !== 0) return "";
        return this.props.trend >= 0 ? "is-up" : "is-down";
    }

    get trendIcon() {
        if (!this.props.trend && this.props.trend !== 0) return "";
        return this.props.trend >= 0 ? "fa-arrow-up" : "fa-arrow-down";
    }

    onCardClick() {
        if (this.props.onClick) {
            this.props.onClick();
        }
    }
}
