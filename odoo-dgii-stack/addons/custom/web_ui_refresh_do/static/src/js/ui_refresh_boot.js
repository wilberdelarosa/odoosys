/** @odoo-module **/

/**
 * ui_refresh_boot.js
 * --------------------
 * Boot ligero del skin Odoo UI Refresh DO.
 * - Marca el <html> con una clase para que el CSS pueda aplicar reglas
 *   condicionales (modo skin activo).
 * - No hace patches en componentes core para mantener compatibilidad
 *   futura con actualizaciones de Odoo.
 *
 * OFFLINE-FIRST:
 * - La tipografia base usa SIEMPRE una pila de fuentes del sistema operativo
 *   (Segoe UI en Windows) inyectada localmente, sin depender de internet.
 * - Las fuentes de Google solo se intentan como mejora opcional cuando el
 *   navegador reporta conexion. Sin internet la interfaz se ve bien igual y
 *   nunca queda bloqueada esperando un recurso remoto.
 */

(function () {
    "use strict";

    const root = document.documentElement;
    const head = document.head;
    const fontHref = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap";

    // Pila de fuentes local: se aplica siempre y garantiza buena apariencia
    // sin internet. En Windows usa Segoe UI Variable / Segoe UI.
    const localFontStack =
        '"Plus Jakarta Sans", "Segoe UI Variable", "Segoe UI", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif';
    const localMonoStack =
        '"JetBrains Mono", "Cascadia Code", "Consolas", "Segoe UI Mono", monospace';

    const ensureLocalFontStyle = () => {
        if (document.getElementById("od-ui-refresh-local-fonts")) {
            return;
        }
        const style = document.createElement("style");
        style.id = "od-ui-refresh-local-fonts";
        style.textContent =
            ".od-ui-refresh, .od-ui-refresh body { font-family: " + localFontStack + "; }" +
            ".od-ui-refresh code, .od-ui-refresh pre { font-family: " + localMonoStack + "; }";
        head.appendChild(style);
    };

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

    const tryLoadRemoteFonts = () => {
        // navigator.onLine === false es una senal fiable de "sin internet".
        // Si es true pero no hay salida real, el <link> falla en silencio y la
        // pila local sigue activa, asi que tampoco rompe la interfaz.
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
            return;
        }
        try {
            ensureLink("preconnect", "https://fonts.googleapis.com");
            ensureLink("preconnect", "https://fonts.gstatic.com", "anonymous");
            ensureLink("stylesheet", fontHref);
        } catch (error) {
            // Offline o CSP estricta: se ignora, la UI usa la pila local.
        }
    };

    if (!root.classList.contains("od-ui-refresh")) {
        root.classList.add("od-ui-refresh");
    }

    // 1) Tipografia local primero: la UI nunca depende de internet.
    ensureLocalFontStyle();

    // 2) Mejora opcional con Google Fonts solo si hay conexion.
    tryLoadRemoteFonts();
    if (typeof window !== "undefined" && window.addEventListener) {
        // Si la maquina recupera internet mas tarde, se intenta mejorar una vez.
        window.addEventListener("online", tryLoadRemoteFonts, { once: true });
    }

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
