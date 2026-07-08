/** @odoo-module **/

import { Component } from "@odoo/owl";

/**
 * QuickAction
 * -----------
 * Tarjeta de accion rapida para el dashboard.
 * Lleva un icono grande, un titulo y una descripcion.
 *
 * Props:
 *  - title: string
 *  - description: string
 *  - icon: string (FontAwesome sin "fa-")
 *  - tone: "primary" | "accent" | "neutral"
 *  - onClick: callback
 */
export class QuickAction extends Component {
    static template = "operations_ui_do.QuickAction";
    static props = {
        title: { type: String },
        description: { type: String, optional: true },
        icon: { type: String, optional: true },
        tone: { type: String, optional: true },
        onClick: { type: Function, optional: true },
    };
    static defaultProps = {
        icon: "bolt",
        tone: "primary",
        description: "",
    };

    onClick() {
        if (this.props.onClick) this.props.onClick();
    }
}
