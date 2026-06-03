{
    "name": "Stock Scan DO",
    "summary": "Community barcode scanning for stock operations",
    "version": "17.0.1.0.0",
    "category": "Inventory/Inventory",
    "license": "LGPL-3",
    "author": "Local DGII Integration",
    "depends": ["stock"],
    "data": [
        "security/ir.model.access.csv",
        "views/stock_scan_wizard_views.xml",
        "views/stock_picking_views.xml",
    ],
    "installable": True,
    "application": False,
}