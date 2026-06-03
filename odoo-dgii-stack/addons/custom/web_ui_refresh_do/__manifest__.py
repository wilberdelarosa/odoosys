{
    "name": "Odoo UI Refresh DO",
    "summary": "Modern, premium backend skin for Odoo 17 (Dominicana)",
    "description": """
        Capa visual global que moderniza el backend de Odoo 17:
        - Tipografia profesional (Plus Jakarta Sans + JetBrains Mono).
        - Sistema de tokens (colores, radios, sombras, spacing).
        - Navbar, control panel, formularios, listas, kanban, modales y chatter rediseñados.
        - 100% scoped bajo .o_web_client. No reemplaza logica ni rompe vistas estandar.
    """,
    "version": "17.0.1.0.0",
    "category": "Hidden/Tools",
    "author": "DGII Modernization Suite",
    "license": "LGPL-3",
    "depends": ["web"],
    "assets": {
        "web.assets_backend": [
            "web_ui_refresh_do/static/src/scss/00_tokens.scss",
            "web_ui_refresh_do/static/src/scss/01_base.scss",
            "web_ui_refresh_do/static/src/scss/02_navbar.scss",
            "web_ui_refresh_do/static/src/scss/03_control_panel.scss",
            "web_ui_refresh_do/static/src/scss/04_buttons.scss",
            "web_ui_refresh_do/static/src/scss/05_forms.scss",
            "web_ui_refresh_do/static/src/scss/06_lists.scss",
            "web_ui_refresh_do/static/src/scss/07_kanban.scss",
            "web_ui_refresh_do/static/src/scss/08_modals.scss",
            "web_ui_refresh_do/static/src/scss/09_chatter.scss",
            "web_ui_refresh_do/static/src/scss/10_apps_menu.scss",
            "web_ui_refresh_do/static/src/scss/11_mobile.scss",
            "web_ui_refresh_do/static/src/scss/90_utilities.scss",
            "web_ui_refresh_do/static/src/js/ui_refresh_boot.js",
        ],
    },
    "installable": True,
    "application": False,
    "auto_install": False,
}
