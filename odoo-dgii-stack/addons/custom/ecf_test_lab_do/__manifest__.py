{
    "name": "e-CF Test Lab DO",
    "summary": "Laboratorio automatico para validar firma, gateway y e-CF antes de produccion",
    "description": """
        Centro de pruebas para facturacion electronica dominicana.
        Automatiza validaciones contra el gateway e-CF existente sin reinventar
        la firma digital: salud del servicio, certificado, configuracion DGII,
        precertificacion local, dry-run de factura Odoo y evidencia XML.
    """,
    "version": "17.0.1.0.0",
    "category": "Accounting/Localizations/EDI",
    "author": "DGII Modernization Suite",
    "license": "LGPL-3",
    "depends": ["account", "l10n_do_ecf_gateway", "web_ui_refresh_do"],
    "data": [
        "security/ir.model.access.csv",
        "views/ecf_test_lab_views.xml",
    ],
    "installable": True,
    "application": True,
    "auto_install": False,
}
