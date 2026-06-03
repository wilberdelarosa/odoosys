/** @odoo-module **/

/**
 * ui_refresh_boot.js
 * --------------------
 * Boot ligero del skin Odoo UI Refresh DO.
 * - Marca el <html> con una clase para que el CSS pueda aplicar reglas
 *   condicionales (modo skin activo).
 * - No hace patches en componentes core para mantener compatibilidad
 *   futura con actualizaciones de Odoo.
 */

(function () {
    "use strict";

    const root = document.documentElement;
    const head = document.head;
    const fontHref = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap";

    const ensureLink = (rel, href, crossOrigin) => {
        if (document.querySelector(`link[rel="${rel}"][href="${href}"]`)) {
            return;
        }
        const link = document.createElement("link");
        link.rel = rel;
        link.href = href;
        if (crossOrigin) {
            link.crossOrigin = crossOrigin;
        }
        head.appendChild(link);
    };

    if (!root.classList.contains("od-ui-refresh")) {
        root.classList.add("od-ui-refresh");
    }

    // Google Fonts rompe el bundle SCSS minificado de Odoo por los separadores
    // de la query string, asi que se cargan como <link> runtime.
    ensureLink("preconnect", "https://fonts.googleapis.com");
    ensureLink("preconnect", "https://fonts.gstatic.com", "anonymous");
    ensureLink("stylesheet", fontHref);

    // Pequena ayuda visual: respetar reduce-motion del sistema operativo.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyMotion = () => {
        root.classList.toggle("od-reduce-motion", reduceMotion.matches);
    };
    applyMotion();
    if (reduceMotion.addEventListener) {
        reduceMotion.addEventListener("change", applyMotion);
    }
})();
