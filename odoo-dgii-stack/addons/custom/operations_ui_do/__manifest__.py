{
    "name": "Operations UI DO",
    "summary": "Hub operativo moderno: dashboard, ventas rapidas, escaneo QR e historico",
    "description": """
        Modulo de UI operativa construido sobre OWL nativo de Odoo 17.
        Provee acciones cliente con un dashboard premium, accesos rapidos
        a ventas, inventario y trazabilidad.
        Pensado para usuarios operativos (no contables) en empresas dominicanas.
    """,
    "version": "17.0.1.0.0",
    "category": "Operations",
    "author": "DGII Modernization Suite",
    "license": "LGPL-3",
    "depends": ["web", "base", "web_ui_refresh_do", "stock_scan_do"],
    "data": [
        "views/operations_menu.xml",
    ],
    "assets": {
        "web.assets_backend": [
            "operations_ui_do/static/src/apps/dashboard/dashboard.scss",
            "operations_ui_do/static/src/apps/inventory_scan/inventory_scan.scss",
            "operations_ui_do/static/src/components/metric_card/metric_card.scss",
            "operations_ui_do/static/src/components/quick_action/quick_action.scss",
            "operations_ui_do/static/src/components/metric_card/metric_card.xml",
            "operations_ui_do/static/src/components/metric_card/metric_card.js",
            "operations_ui_do/static/src/components/quick_action/quick_action.xml",
            "operations_ui_do/static/src/components/quick_action/quick_action.js",
            "operations_ui_do/static/src/apps/inventory_scan/inventory_scan.xml",
            "operations_ui_do/static/src/apps/inventory_scan/inventory_scan.js",
            "operations_ui_do/static/src/apps/dashboard/dashboard.xml",
            "operations_ui_do/static/src/apps/dashboard/dashboard.js",
        ],
    },
    "installable": True,
    "application": True,
    "auto_install": False,
}
