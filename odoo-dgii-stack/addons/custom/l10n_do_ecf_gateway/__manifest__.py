{
    "name": "Dominican e-CF Gateway Connector",
    "summary": "Guided Dominican e-CF flow: readiness, signature, QR, templates and dispatch",
    "version": "17.0.1.0.0",
    "category": "Accounting/Localizations/EDI",
    "license": "LGPL-3",
    "author": "Local DGII Integration",
    "depends": ["account", "stock", "sale_management", "delivery", "l10n_do_accounting"],
    "data": [
        "security/ir.model.access.csv",
        "views/ecf_document_template_views.xml",
        "views/account_move_views.xml",
        "views/stock_picking_views.xml",
    ],
    "installable": True,
    "application": False,
}