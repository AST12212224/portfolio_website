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

        const page = location.pathname.split("/").pop() || "index.html";
        document.querySelectorAll(".site-nav a").forEach((a) => {
            if (a.getAttribute("href") === page) a.setAttribute("aria-current", "page");
        });
    });
})();
