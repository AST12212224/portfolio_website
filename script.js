// Theme toggle (remembers the reader's choice) and current-page marker.
(() => {
    const root = document.documentElement;
    try {
        const saved = localStorage.getItem("theme");
        if (saved) root.dataset.theme = saved;
    } catch (e) {}

    const isDark = () =>
        root.dataset.theme
            ? root.dataset.theme === "dark"
            : matchMedia("(prefers-color-scheme: dark)").matches;

    document.addEventListener("DOMContentLoaded", () => {
        const btn = document.querySelector(".theme-toggle");
        const paint = () => {
            if (!btn) return;
            btn.textContent = isDark() ? "☀" : "☾";
            btn.setAttribute("aria-label", isDark() ? "Switch to light theme" : "Switch to dark theme");
        };
        paint();
        btn?.addEventListener("click", () => {
            root.dataset.theme = isDark() ? "light" : "dark";
            try { localStorage.setItem("theme", root.dataset.theme); } catch (e) {}
            paint();
            document.dispatchEvent(new Event("themechange"));
        });
        matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
            paint();
            document.dispatchEvent(new Event("themechange"));
        });

        const page = "/" + location.pathname.split("/").pop().replace(/\.html$/, "").replace(/^index$/, "");
        document.querySelectorAll(".site-nav a").forEach((a) => {
            if (a.getAttribute("href") === page) a.setAttribute("aria-current", "page");
        });

        // Same-page section links: scroll without putting "#id" in the address bar.
        document.addEventListener("click", (e) => {
            const a = e.target.closest("a[href]");
            if (!a || e.metaKey || e.ctrlKey || e.shiftKey || a.target === "_blank") return;
            const url = new URL(a.href, location.href);
            if (!url.hash || url.origin !== location.origin) return;
            const here = (p) => p.replace(/(index)?(\.html)?$/, "");
            if (here(url.pathname) !== here(location.pathname)) return;
            const el = document.getElementById(decodeURIComponent(url.hash.slice(1)));
            if (!el) return;
            e.preventDefault();
            el.scrollIntoView({ behavior: "smooth" });
        });
    });

    // Keep the address bar clean: "/research.html#c2" shows as "/research".
    // Runs after load so the browser has already jumped to the section.
    window.addEventListener("load", () => {
        if (location.protocol === "file:") return;
        const id = decodeURIComponent(location.hash.slice(1));
        const clean = location.pathname.replace(/(index)?\.html$/, "") + location.search;
        if (clean === location.pathname + location.search && !id) return;
        const el = id && document.getElementById(id);
        history.replaceState(null, "", clean);
        if (el) requestAnimationFrame(() => el.scrollIntoView());
    });
})();
