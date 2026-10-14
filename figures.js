/* Interactive figures. Each <figure class="fig" data-fig="name"> gets wired up here.
   Every figure is computed from the mathematics of the project it illustrates. */
(() => {
    "use strict";

    const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const FIGS = {};

    // ---------- helpers ----------
    function palette(el) {
        const cs = getComputedStyle(el);
        const v = (n) => cs.getPropertyValue(n).trim();
        return {
            ink: v("--ink"), ink2: v("--ink-2"), ink3: v("--ink-3"),
            rule: v("--rule"), paper: v("--paper"), paper2: v("--paper-2"),
            c: v("--c"), c2: v("--c2"), c3: v("--c3"),
            mono: v("--mono"), sans: v("--sans"), serif: v("--serif"),
        };
    }

    function surface(fig, draw) {
        const c = fig.querySelector("canvas");
        const ctx = c.getContext("2d");
        const s = { c, ctx, w: 0, h: 0, mouse: null, draw };
        const fit = () => {
            const r = c.getBoundingClientRect();
            const d = window.devicePixelRatio || 1;
            c.width = Math.max(1, Math.round(r.width * d));
            c.height = Math.max(1, Math.round(r.height * d));
            ctx.setTransform(d, 0, 0, d, 0, 0);
            s.w = r.width;
            s.h = r.height;
        };
        s.redraw = () => {
            s.p = palette(fig);
            ctx.clearRect(0, 0, s.w, s.h);
            s.draw(s);
        };
        fit();
        new ResizeObserver(() => { fit(); s.redraw(); }).observe(c);
        const pos = (e) => {
            const r = c.getBoundingClientRect();
            return { x: e.clientX - r.left, y: e.clientY - r.top };
        };
        c.addEventListener("pointermove", (e) => { s.mouse = pos(e); s.redraw(); });
        c.addEventListener("pointerleave", () => { s.mouse = null; s.redraw(); });
        c.addEventListener("click", (e) => s.onclick && s.onclick(pos(e)));
        document.addEventListener("themechange", () => s.redraw());
        return s;
    }

    // run frame(dt) on rAF while the figure is on screen; frame returns false to stop
    function animator(fig, frame) {
        let raf = 0, visible = false, active = false, last = 0;
        new IntersectionObserver((es) => {
            visible = es[0].isIntersecting;
            if (visible && active) kick();
        }).observe(fig);
        function tick(ts) {
            raf = 0;
            if (!visible || !active) { last = 0; return; }
            const dt = last ? Math.min(50, ts - last) : 16;
            last = ts;
            active = frame(dt) !== false;
            if (active) raf = requestAnimationFrame(tick);
            else last = 0;
        }
        function kick() { if (!raf) raf = requestAnimationFrame(tick); }
        return {
            start() { active = true; if (visible) kick(); },
            stop() { active = false; },
            get running() { return active; },
        };
    }

    function bar(fig) {
        let b = fig.querySelector(".controls");
        if (!b) {
            b = document.createElement("div");
            b.className = "controls";
            const anchor = fig.querySelector("canvas, .term");
            anchor.after(b);
        }
        return b;
    }

    function slider(fig, label, opts, on) {
        const { min, max, step = 1, value, fmt = (v) => v } = opts;
        const l = document.createElement("label");
        const out = document.createElement("output");
        const i = Object.assign(document.createElement("input"), { type: "range", min, max, step, value });
        i.setAttribute("aria-label", label);
        l.append(label, i, out);
        bar(fig).append(l);
        const sync = () => { out.textContent = fmt(+i.value); on(+i.value); };
        i.addEventListener("input", sync);
        out.textContent = fmt(+i.value);
        return i;
    }

    function button(fig, label, on) {
        const b = Object.assign(document.createElement("button"), { className: "btn", type: "button", textContent: label });
        b.addEventListener("click", on);
        bar(fig).append(b);
        return b;
    }

    function readout(fig) {
        const r = document.createElement("span");
        r.className = "readout";
        bar(fig).append(r);
        return r;
    }

    function text(ctx, str, x, y, { font, color, align = "left", base = "alphabetic" } = {}) {
        if (font) ctx.font = font;
        if (color) ctx.fillStyle = color;
        ctx.textAlign = align;
        ctx.textBaseline = base;
        ctx.fillText(str, x, y);
    }

    function tooltip(s, lines) {
        if (!s.mouse) return;
        const { ctx, p } = s;
        ctx.font = `12px ${p.mono}`;
        const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14;
        const h = lines.length * 16 + 10;
        let x = s.mouse.x + 12, y = s.mouse.y + 12;
        if (x + w > s.w - 4) x = s.mouse.x - w - 12;
        if (y + h > s.h - 4) y = s.mouse.y - h - 12;
        ctx.fillStyle = p.paper;
        ctx.strokeStyle = p.ink3;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 4);
        ctx.fill();
        ctx.stroke();
        lines.forEach((l, i) => text(ctx, l, x + 7, y + 19 + i * 16, { color: p.ink }));
    }

    const isPrime = (n) => {
        if (n < 2) return false;
        if (n % 2 === 0) return n === 2;
        if (n % 3 === 0) return n === 3;
        for (let i = 5; i * i <= n; i += 6) if (n % i === 0 || n % (i + 2) === 0) return false;
        return true;
    };

    const binom = (n, k) => {
        if (k < 0 || k > n) return 0n;
        let r = 1n;
        for (let i = 1n; i <= BigInt(k); i++) r = (r * (BigInt(n) - i + 1n)) / i;
        return r;
    };

    const fib = (n) => { let a = 0, b = 1; for (let i = 0; i < n; i++) [a, b] = [b, a + b]; return a; };

    const fmtBig = (v) => {
        const s = v.toString();
        const neg = s[0] === "-";
        const d = neg ? s.slice(1) : s;
        if (d.length <= 6) return s;
        return (neg ? "-" : "") + d[0] + "." + d.slice(1, 3) + "e" + (d.length - 1);
    };

    // ---------- C2: recursive prime decomposition ----------
    // p = 2q + r (q < p/2), falling back to p = 2q - r (q < p); q, r ∈ {1} ∪ primes.
    function c2Split(p) {
        if (p <= 2) return null;
        for (let q = Math.floor((p - 1) / 2); q >= 1; q--) {
            if (q !== 1 && !isPrime(q)) continue;
            const r = p - 2 * q;
            if (r === 1 || isPrime(r)) return { q, r, op: "+" };
        }
        for (let q = p - 1; q >= 1; q--) {
            if (q !== 1 && !isPrime(q)) continue;
            const r = 2 * q - p;
            if (r >= 1 && (r === 1 || isPrime(r))) return { q, r, op: "−" };
        }
        return null;
    }
    function c2Tree(p) {
        const s = c2Split(p);
        if (!s) return { v: p, kids: [] };
        return { v: p, split: s, kids: [c2Tree(s.q), c2Tree(s.r)] };
    }

    FIGS.c2 = (fig) => {
        let tree, nodes = [], reveal = 1, additive = 0;
        const s = surface(fig, draw);
        const input = Object.assign(document.createElement("input"), { type: "number", value: 127, min: 3, max: 9999991 });
        input.setAttribute("aria-label", "prime p");
        const lab = document.createElement("label");
        lab.append("p =", input);
        bar(fig).append(lab);
        const ro = readout(fig);

        function build(p) {
            if (!isPrime(p) || p < 3) { ro.textContent = `${p} is not an odd prime`; return; }
            tree = c2Tree(p);
            nodes = [];
            let leaf = 0, maxD = 0;
            (function lay(n, d) {
                n.d = d; maxD = Math.max(maxD, d);
                if (!n.kids.length) { n.x = leaf++; }
                else { n.kids.forEach((k) => lay(k, d + 1)); n.x = (n.kids[0].x + n.kids[1].x) / 2; }
                nodes.push(n);
            })(tree, 0);
            tree.leaves = leaf; tree.depth = maxD;
            const steps = nodes.filter((n) => n.split);
            additive = steps.every((n) => n.split.op === "+");
            ro.textContent = `${nodes.length} nodes · depth ${maxD} · ${additive ? "additive" : "mixed ±"}`;
            reveal = REDUCED ? maxD + 1 : 0;
            anim.start();
        }

        function draw({ ctx, w, h, p }) {
            if (!tree) return;
            const pad = 26;
            const sx = (x) => pad + (tree.leaves > 1 ? (x / (tree.leaves - 1)) * (w - 2 * pad) : (w - 2 * pad) / 2);
            const sy = (d) => pad + (tree.depth ? (d / tree.depth) * (h - 2 * pad) : 0);
            const r = Math.max(9, Math.min(15, (w - 2 * pad) / tree.leaves / 2.4));
            let hover = null;
            for (const n of nodes) {
                if (n.d > reveal) continue;
                for (const [i, k] of n.kids.entries()) {
                    if (k.d > reveal) continue;
                    const t = Math.min(1, reveal - n.d);
                    ctx.strokeStyle = i === 0 ? p.c : p.c2;
                    ctx.setLineDash(i === 0 ? [] : [3, 3]);
                    ctx.lineWidth = 1.4;
                    ctx.beginPath();
                    ctx.moveTo(sx(n.x), sy(n.d));
                    ctx.lineTo(sx(n.x) + (sx(k.x) - sx(n.x)) * t, sy(n.d) + (sy(k.d) - sy(n.d)) * t);
                    ctx.stroke();
                }
            }
            ctx.setLineDash([]);
            for (const n of nodes) {
                if (n.d > reveal) continue;
                const x = sx(n.x), y = sy(n.d);
                const leaf = !n.kids.length;
                ctx.fillStyle = leaf ? p.paper2 : p.paper;
                ctx.strokeStyle = leaf ? p.ink3 : p.ink;
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke();
                const label = String(n.v);
                const fs = Math.min(12, (r * 2.6) / Math.max(2, label.length));
                text(ctx, label, x, y + 0.5, { font: `${fs}px ${p.mono}`, color: p.ink, align: "center", base: "middle" });
                if (s.mouse && Math.hypot(s.mouse.x - x, s.mouse.y - y) < r + 2) hover = n;
            }
            if (hover) {
                tooltip(s, hover.split
                    ? [`${hover.v} = 2·${hover.split.q} ${hover.split.op} ${hover.split.r}`]
                    : [`${hover.v}: leaf`]);
            }
        }

        const anim = animator(fig, (dt) => {
            reveal += dt / 220;
            s.redraw();
            return reveal < tree.depth + 1;
        });
        input.addEventListener("change", () => build(+input.value));
        button(fig, "random prime", () => {
            let n;
            do n = 3 + Math.floor(Math.random() * 20000); while (!isPrime(n));
            input.value = n;
            build(n);
        });
        bar(fig).append(ro);
        build(127);
    };

    // ---------- DSRS: ∏ ΔL(n)/ΔU(n) with L=⌊n²/μ⌋, U=⌈n²/μ⌉ ----------
    FIGS.dsrs = (fig) => {
        const N = 40000;
        let mu = 2, series = [], drawn = 0;
        const s = surface(fig, draw);
        const ro = readout(fig);

        function compute(m) {
            const L = (n) => Math.floor((n * n) / m), U = (n) => Math.ceil((n * n) / m);
            let n0 = 1;
            for (let n = 1; n <= m + 2; n++) if (L(n) - L(n - 1) === 0 || U(n) - U(n - 1) === 0) n0 = n + 1;
            const out = [];
            let P = 1;
            for (let n = n0; n <= N; n++) {
                P *= (L(n) - L(n - 1)) / (U(n) - U(n - 1));
                out.push([n, P]);
            }
            return { n0, out };
        }

        function set(m) {
            mu = m;
            const r = compute(m);
            series = r.out;
            const last = series[series.length - 1][1];
            const lim = m === 1 || m % 4 === 0 ? "1" : "π/2";
            ro.textContent = `μ ≡ ${m % 4} (mod 4) · P ≈ ${last.toFixed(6)} → ${lim}`;
            drawn = REDUCED ? series.length : 0;
            anim.start();
        }

        function draw({ ctx, w, h, p }) {
            const L = 44, R = 14, T = 16, B = 30;
            const xmin = 0, xmax = Math.log10(N);
            const ymin = 0.55, ymax = 2.05;
            const X = (n) => L + ((Math.log10(n) - xmin) / (xmax - xmin)) * (w - L - R);
            const Y = (v) => T + (1 - (v - ymin) / (ymax - ymin)) * (h - T - B);
            ctx.font = `11px ${p.mono}`;
            ctx.strokeStyle = p.rule;
            ctx.lineWidth = 1;
            for (let k = 0; k <= 4; k++) {
                const x = X(10 ** k);
                ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, h - B); ctx.stroke();
                text(ctx, k === 0 ? "1" : `10${"⁰¹²³⁴"[k]}`, x, h - B + 16, { color: p.ink3, align: "center" });
            }
            text(ctx, "N", w - R, h - B + 16, { color: p.ink3, align: "right" });
            for (const [v, lab] of [[Math.PI / 2, "π/2"], [1, "1"]]) {
                ctx.setLineDash([4, 4]);
                ctx.strokeStyle = p.ink3;
                ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(w - R, Y(v)); ctx.stroke();
                ctx.setLineDash([]);
                text(ctx, lab, L - 6, Y(v) + 4, { color: p.ink2, align: "right" });
            }
            ctx.lineWidth = 2;
            ctx.strokeStyle = p.c;
            ctx.beginPath();
            const n = Math.min(drawn, series.length);
            let step = Math.max(1, Math.floor(series.length / 1500));
            for (let i = 0; i < n; i += step) {
                const [k, v] = series[i];
                const y = Y(Math.max(ymin, Math.min(ymax, v)));
                i ? ctx.lineTo(X(k), y) : ctx.moveTo(X(k), y);
            }
            ctx.stroke();
            text(ctx, `P_N(μ = ${mu})`, L + 8, T + 12, { color: p.c, font: `12px ${p.mono}` });
            if (s.mouse && s.mouse.x > L && s.mouse.x < w - R) {
                const nn = Math.round(10 ** (xmin + ((s.mouse.x - L) / (w - L - R)) * (xmax - xmin)));
                const pt = series.find((q) => q[0] >= nn) || series[series.length - 1];
                if (pt[0] <= series[n - 1]?.[0]) {
                    ctx.fillStyle = p.c;
                    ctx.beginPath(); ctx.arc(X(pt[0]), Y(Math.max(ymin, Math.min(ymax, pt[1]))), 3.5, 0, 7); ctx.fill();
                    tooltip(s, [`N = ${pt[0]}`, `P = ${pt[1].toFixed(7)}`]);
                }
            }
        }

        const anim = animator(fig, (dt) => {
            drawn += Math.max(30, drawn * 0.06) * (dt / 16);
            s.redraw();
            return drawn < series.length;
        });
        slider(fig, "μ", { min: 1, max: 64, value: 2 }, set);
        bar(fig).append(ro);
        set(2);
    };

    // ---------- 2-polytopes: point nearer centroid or boundary ----------
    FIGS.polytope = (fig) => {
        let n = 6, pts = [], target = 5000, rot = 0;
        const s = surface(fig, draw);
        const ro = readout(fig);
        const exact = (k) => {
            const t = Math.tan(Math.PI / (2 * k));
            return (t + t ** 3 / 3) / (2 * Math.tan(Math.PI / k));
        };
        function sample() {
            const a = Math.cos(Math.PI / n);
            for (;;) {
                const x = Math.random() * 2 - 1, y = Math.random() * 2 - 1;
                if (x * x + y * y > 1) continue;
                let dmin = Infinity;
                for (let k = 0; k < n; k++) {
                    const th = (2 * k * Math.PI) / n + rot; // outward normal of edge k
                    dmin = Math.min(dmin, a - (x * Math.cos(th) + y * Math.sin(th)));
                }
                if (dmin < 0) continue;
                return [x, y, Math.hypot(x, y) < dmin];
            }
        }
        function reset() { pts = []; rot = -Math.PI / 2 - Math.PI / n; anim.start(); if (REDUCED) while (pts.length < target) pts.push(sample()); }
        function draw({ ctx, w, h, p }) {
            const R = Math.min(w, h) / 2 - 18, cx = w / 2, cy = h / 2;
            const sz = R > 120 ? 2.2 : 1.8;
            let inside = 0;
            for (const [x, y, c] of pts) {
                ctx.fillStyle = c ? p.c : p.ink3;
                ctx.globalAlpha = c ? 0.85 : 0.45;
                ctx.fillRect(cx + x * R - sz / 2, cy + y * R - sz / 2, sz, sz);
                if (c) inside++;
            }
            ctx.globalAlpha = 1;
            ctx.strokeStyle = p.ink;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let k = 0; k <= n; k++) {
                const th = (2 * k * Math.PI) / n + rot + Math.PI / n;
                const x = cx + R * Math.cos(th), y = cy + R * Math.sin(th);
                k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            }
            ctx.stroke();
            ctx.fillStyle = p.ink;
            ctx.beginPath(); ctx.arc(cx, cy, 3, 0, 7); ctx.fill();
            const emp = pts.length ? inside / pts.length : 0;
            ro.textContent = `simulated ${(emp * 100).toFixed(1)}% · exact ${(exact(n) * 100).toFixed(2)}%`;
            text(ctx, `n = ${n}`, 12, 20, { font: `12px ${p.mono}`, color: p.ink2 });
            text(ctx, `${pts.length} points`, 12, 36, { font: `12px ${p.mono}`, color: p.ink3 });
        }
        const anim = animator(fig, (dt) => {
            for (let i = 0; i < 90 * (dt / 16); i++) pts.push(sample());
            s.redraw();
            return pts.length < target;
        });
        slider(fig, "sides", { min: 3, max: 16, value: 6 }, (v) => { n = v; reset(); });
        button(fig, "resample", reset);
        bar(fig).append(ro);
        reset();
    };

    // ---------- Layered Pascal transform triangles: Δ^ℓ(x^p) ----------
    FIGS.layers = (fig) => {
        let layer = 0, alpha = 1;
        const ROWS = 8;
        const OEIS = { 2: "A000918", 3: "A001117", 4: "A000919", 5: "A000920" };
        const s = surface(fig, draw);
        const ro = readout(fig);
        // coefficient of x^k in Δ^ℓ x^p = C(p,k) Σ_j (-1)^(ℓ-j) C(ℓ,j) j^(p-k)
        // layer 0 is Pascal's triangle itself: the coefficients of (x+1)^p
        const coef = (l, p, k) => {
            if (l === 0) return binom(p, k);
            let sum = 0n;
            for (let j = 0; j <= l; j++) {
                const sign = (l - j) % 2 ? -1n : 1n;
                const pw = p - k === 0 ? 1n : BigInt(j) ** BigInt(p - k);
                sum += sign * binom(l, j) * pw;
            }
            return binom(p, k) * sum;
        };
        function rows() {
            const out = [];
            for (let i = 0; i < ROWS; i++) {
                const p = layer + i;
                const r = [];
                for (let k = p - layer; k >= 0; k--) r.push({ k, v: coef(layer, p, k), p });
                out.push(r);
            }
            return out;
        }
        function draw({ ctx, w, h, p }) {
            const data = rows();
            const cellW = Math.min(64, (w - 24) / ROWS), cellH = (h - 34) / ROWS;
            const maxLog = Math.log10(Number(data[ROWS - 1].reduce((m, c) => (c.v > m ? c.v : m), 1n)) + 1);
            ctx.globalAlpha = alpha;
            let hover = null;
            data.forEach((row, i) => {
                const y = 14 + i * cellH;
                const x0 = w / 2 - (row.length * cellW) / 2;
                text(ctx, `p=${row[0].p}`, 8, y + cellH / 2 + 4, { font: `10px ${p.mono}`, color: p.ink3 });
                row.forEach((cell, j) => {
                    const x = x0 + j * cellW;
                    const t = Math.log10(Number(cell.v) + 1) / (maxLog || 1);
                    const isConst = cell.k === 0 && layer >= 2 && OEIS[layer];
                    ctx.fillStyle = isConst ? p.c : p.c2;
                    ctx.globalAlpha = alpha * (isConst ? 0.18 + 0.5 * t : 0.06 + 0.32 * t);
                    ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
                    ctx.globalAlpha = alpha;
                    const fs = Math.min(12, cellH * 0.45, cellW / 4.6);
                    text(ctx, fmtBig(cell.v), x + cellW / 2, y + cellH / 2 + 1, { font: `${fs}px ${p.mono}`, color: p.ink, align: "center", base: "middle" });
                    if (s.mouse && s.mouse.x >= x && s.mouse.x < x + cellW && s.mouse.y >= y && s.mouse.y < y + cellH) hover = cell;
                });
            });
            ctx.globalAlpha = 1;
            text(ctx, layer === 0 ? "Layer 0: (x+1)ᵖ = Pascal's triangle" : `Layer ${layer}: rows of Δ${"⁰¹²³⁴⁵⁶⁷"[layer]}(xᵖ)`, w - 10, h - 10, { font: `11px ${p.mono}`, color: p.ink2, align: "right" });
            if (hover) tooltip(s, [`[x^${hover.k}] ${layer ? `Δ${"⁰¹²³⁴⁵⁶⁷"[layer]}(x^${hover.p})` : `(x+1)^${hover.p}`}`, `= ${hover.v.toString()}`]);
        }
        function set(l) {
            layer = l;
            ro.textContent = OEIS[l] ? `constant terms (red) = OEIS ${OEIS[l]}` : l === 0 ? "binomial coefficients C(p,k)" : "";
            alpha = REDUCED ? 1 : 0.15;
            anim.start();
        }
        const anim = animator(fig, (dt) => { alpha = Math.min(1, alpha + dt / 260); s.redraw(); return alpha < 1; });
        slider(fig, "layer ℓ", { min: 0, max: 6, value: 0 }, set);
        bar(fig).append(ro);
        set(0);
    };

    // ---------- Fibonacci from Pascal rows: Σ cᵢ C(n−1,i) = Fₙ, cᵢ ∈ {−1,0,1} ----------
    FIGS.pascalfib = (fig) => {
        let n = 8, sols = [], idx = 0, flip = 1;
        const s = surface(fig, draw);
        const ro = readout(fig);
        function solve(m) {
            const row = [];
            for (let i = 0; i < m; i++) row.push(Number(binom(m - 1, i)));
            const F = fib(m), out = [];
            const c = new Array(m).fill(-1);
            const total = 3 ** m;
            for (let t = 0; t < total; t++) {
                let sum = 0;
                for (let i = 0; i < m; i++) sum += c[i] * row[i];
                if (sum === F && out.length < 5000) out.push(c.slice());
                for (let i = 0; i < m; i++) { if (c[i] < 1) { c[i]++; break; } c[i] = -1; }
            }
            return { row, F, out, total };
        }
        let cur;
        function set(m) {
            n = m;
            cur = solve(m);
            sols = cur.out;
            idx = 0;
            ro.textContent = `${sols.length.toLocaleString()}${sols.length >= 5000 ? "+" : ""} of 3^${m} = ${cur.total.toLocaleString()} work`;
            pulse();
        }
        function pulse() { flip = REDUCED ? 1 : 0; anim.start(); }
        function draw({ ctx, w, h, p }) {
            if (!cur) return;
            const { row, F } = cur;
            const c = sols[idx] || [];
            const cw = Math.min(58, (w - 30) / row.length), ch = 46;
            const x0 = w / 2 - (row.length * cw) / 2, y0 = h / 2 - 44;
            text(ctx, `row ${n - 1} of Pascal's triangle`, w / 2, y0 - 22, { font: `12px ${p.sans}`, color: p.ink3, align: "center" });
            row.forEach((v, i) => {
                const x = x0 + i * cw;
                const ci = c[i];
                const col = ci === 1 ? p.c : ci === -1 ? p.c2 : p.ink3;
                const sc = i / row.length < flip ? 1 : 0.4;
                ctx.globalAlpha = ci === 0 ? 0.35 : 1;
                ctx.strokeStyle = col;
                ctx.lineWidth = ci === 0 ? 1 : 1.8;
                ctx.strokeRect(x + 3, y0, cw - 6, ch);
                ctx.fillStyle = col;
                ctx.globalAlpha = (ci === 0 ? 0.04 : 0.12) * sc;
                ctx.fillRect(x + 3, y0, cw - 6, ch);
                ctx.globalAlpha = ci === 0 ? 0.45 : 1;
                text(ctx, String(v), x + cw / 2, y0 + ch / 2 + 1, { font: `${Math.min(13, cw / 3.4)}px ${p.mono}`, color: p.ink, align: "center", base: "middle" });
                text(ctx, ci === 1 ? "+1" : ci === -1 ? "−1" : "0", x + cw / 2, y0 + ch + 18, { font: `12px ${p.mono}`, color: col, align: "center" });
                ctx.globalAlpha = 1;
            });
            const terms = row.map((v, i) => (c[i] ? (c[i] > 0 ? "+" : "−") + v : "")).filter(Boolean).join(" ").replace(/^\+/, "");
            const eq = `${terms || "0"} = ${F} = F${String(n).replace(/\d/g, (d) => "₀₁₂₃₄₅₆₇₈₉"[d])}`;
            let fs = 14;
            ctx.font = `${fs}px ${p.mono}`;
            while (ctx.measureText(eq).width > w - 20 && fs > 8) ctx.font = `${--fs}px ${p.mono}`;
            text(ctx, eq, w / 2, y0 + ch + 56, { color: p.ink, align: "center" });
            text(ctx, sols.length ? `solution ${idx + 1} / ${sols.length}` : "no solution", w / 2, y0 + ch + 78, { font: `11px ${p.sans}`, color: p.ink3, align: "center" });
        }
        const anim = animator(fig, (dt) => { flip = Math.min(1, flip + dt / 300); s.redraw(); return flip < 1; });
        slider(fig, "n", { min: 3, max: 12, value: 8, fmt: (v) => `F${v} = ${fib(v)}` }, set);
        button(fig, "next solution", () => { if (sols.length) { idx = (idx + 1) % sols.length; pulse(); } });
        bar(fig).append(ro);
        set(8);
    };

    // ---------- Escaping the killer: Archimedean spiral r = R − mθ/2π ----------
    const killerL = (R, m) => {
        const a = m / (2 * Math.PI);
        return (Math.PI * R * R / m) * Math.sqrt(1 + (a / R) ** 2) + (m / (4 * Math.PI)) * Math.log((R / a) * (1 + Math.sqrt(1 + (a / R) ** 2)));
    };

    FIGS.killer = (fig) => {
        const R = 6;
        let m = 0.5, t = 0, playing = true;
        const s = surface(fig, draw);
        const ro = readout(fig);
        const total = () => (2 * Math.PI * R) / m;
        function draw({ ctx, w, h, p }) {
            const cx = w / 2, cy = h / 2, sc = (Math.min(w, h) / 2 - 22) / R;
            const th = Math.min(t, total());
            ctx.strokeStyle = p.rule;
            ctx.setLineDash([3, 4]);
            ctx.beginPath(); ctx.arc(cx, cy, R * sc, 0, 7); ctx.stroke();
            ctx.setLineDash([]);
            ctx.strokeStyle = p.c;
            ctx.globalAlpha = 0.85;
            ctx.lineWidth = m < 0.08 ? 0.6 : 1.2;
            ctx.beginPath();
            const steps = Math.max(200, Math.ceil(th * 14));
            for (let i = 0; i <= steps; i++) {
                const a = (th * i) / steps, r = R - (m * a) / (2 * Math.PI);
                const x = cx + r * sc * Math.cos(a), y = cy - r * sc * Math.sin(a);
                i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            }
            ctx.stroke();
            ctx.globalAlpha = 1;
            const r = R - (m * th) / (2 * Math.PI);
            const kx = cx + r * sc * Math.cos(th), ky = cy - r * sc * Math.sin(th);
            // you, at B
            ctx.fillStyle = p.ink;
            ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 7); ctx.fill();
            text(ctx, "B (you)", cx + 7, cy - 7, { font: `11px ${p.sans}`, color: p.ink2 });
            // the killer
            ctx.strokeStyle = p.ink3;
            ctx.setLineDash([2, 3]);
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(kx, ky); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = p.c;
            ctx.beginPath(); ctx.arc(kx, ky, 5, 0, 7); ctx.fill();
            const walked = killerL(R, m) - (r > 1e-9 ? killerL(r, m) : 0);
            text(ctx, `distance to B  ${r.toFixed(3)}`, 12, 20, { font: `12px ${p.mono}`, color: p.ink2 });
            text(ctx, `distance walked ${walked.toFixed(1)}`, 12, 37, { font: `12px ${p.mono}`, color: p.c });
            text(ctx, `turns ${(th / (2 * Math.PI)).toFixed(1)} / ${(R / m).toFixed(0)}`, 12, 54, { font: `12px ${p.mono}`, color: p.ink3 });
        }
        function set(v) {
            m = v;
            t = REDUCED ? total() : 0;
            ro.textContent = `R = 6 · L = ${killerL(R, m).toFixed(1)}`;
            anim.start();
        }
        const anim = animator(fig, (dt) => {
            if (!playing) return false;
            const speed = total() / 6000; // whole walk in ~6s
            t += speed * dt;
            s.redraw();
            return t < total();
        });
        slider(fig, "m", { min: -1.7, max: 0.3, step: 0.01, value: Math.log10(0.5), fmt: (v) => (10 ** v).toFixed(3) }, (v) => set(10 ** v));
        button(fig, "replay", () => set(m));
        bar(fig).append(ro);
        set(0.5);
    };

    // L(m) on log–log axes
    FIGS.killerplot = (fig) => {
        const R = 6;
        let mm = 0.05;
        const s = surface(fig, draw);
        const ro = readout(fig);
        const table = [1, 0.8, 0.5, 0.2, 0.1, 0.05, 0.001];
        function draw({ ctx, w, h, p }) {
            const L = 50, Rr = 14, T = 14, B = 32;
            const x0 = -3.2, x1 = 0.3, y0 = 1.5, y1 = 5.5;
            const X = (m) => L + ((Math.log10(m) - x0) / (x1 - x0)) * (w - L - Rr);
            const Y = (v) => T + (1 - (Math.log10(v) - y0) / (y1 - y0)) * (h - T - B);
            ctx.font = `11px ${p.mono}`;
            ctx.strokeStyle = p.rule;
            for (let k = -3; k <= 0; k++) {
                ctx.beginPath(); ctx.moveTo(X(10 ** k), T); ctx.lineTo(X(10 ** k), h - B); ctx.stroke();
                text(ctx, `10${k < 0 ? "⁻" : ""}${"⁰¹²³"[Math.abs(k)]}`, X(10 ** k), h - B + 15, { color: p.ink3, align: "center" });
            }
            for (let k = 2; k <= 5; k++) {
                ctx.beginPath(); ctx.moveTo(L, Y(10 ** k)); ctx.lineTo(w - Rr, Y(10 ** k)); ctx.stroke();
                text(ctx, `10${"⁰¹²³⁴⁵"[k]}`, L - 6, Y(10 ** k) + 4, { color: p.ink3, align: "right" });
            }
            text(ctx, "m →", w - Rr, h - 6, { color: p.ink3, align: "right" });
            text(ctx, "L", L - 30, T + 10, { color: p.ink3 });
            ctx.strokeStyle = p.c;
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i <= 200; i++) {
                const m = 10 ** (x0 + ((x1 - x0) * i) / 200);
                const y = Y(killerL(R, m));
                i ? ctx.lineTo(X(m), y) : ctx.moveTo(X(m), y);
            }
            ctx.stroke();
            for (const m of table) {
                ctx.fillStyle = p.paper; ctx.strokeStyle = p.ink; ctx.lineWidth = 1.2;
                ctx.beginPath(); ctx.arc(X(m), Y(killerL(R, m)), 3.5, 0, 7); ctx.fill(); ctx.stroke();
            }
            ctx.fillStyle = p.c;
            ctx.beginPath(); ctx.arc(X(mm), Y(killerL(R, mm)), 5, 0, 7); ctx.fill();
            text(ctx, "L ~ πR²/m  →  ∞ as m → 0⁺", L + 10, h - B - 10, { font: `12px ${p.mono}`, color: p.ink2 });
        }
        slider(fig, "m", { min: -3, max: 0, step: 0.01, value: Math.log10(0.05), fmt: (v) => (10 ** v).toFixed(4) }, (v) => {
            mm = 10 ** v;
            ro.textContent = `L = ${killerL(R, mm).toFixed(4)}`;
            s.redraw();
        });
        bar(fig).append(ro);
        ro.textContent = `L = ${killerL(R, mm).toFixed(4)}`;
        s.redraw();
    };

    // ---------- AIDEAS-OEIS: three-verifier pipeline ----------
    FIGS.aideas = (fig) => {
        const TOTAL = 2041;
        const CATS = [
            { name: "HIGH_CONFIDENCE_VALID", p: 0.516, col: "c" },
            { name: "NEEDS_HUMAN_REVIEW", p: 0.403, col: "c3" },
            { name: "LLM_INTERPRETATION_ERROR", p: 0.081, col: "c2" },
        ];
        const STAGES = ["LODA", "LLM → code", "SymPy"];
        let dots = [], spawned = 0, counts = [0, 0, 0];
        const s = surface(fig, draw);
        const wilson = (ph, n) => {
            const z = 1.96, d = 1 + (z * z) / n;
            const c = (ph + (z * z) / (2 * n)) / d;
            const e = (z * Math.sqrt((ph * (1 - ph)) / n + (z * z) / (4 * n * n))) / d;
            return [c - e, c + e];
        };
        function pick() {
            const r = Math.random();
            return r < CATS[0].p ? 0 : r < CATS[0].p + CATS[1].p ? 1 : 2;
        }
        function reset() {
            dots = []; spawned = 0; counts = [0, 0, 0];
            if (REDUCED) { spawned = TOTAL; counts = CATS.map((c) => Math.round(c.p * TOTAL)); }
            anim.start();
        }
        function draw({ ctx, w, h, p }) {
            const split = w * 0.56;
            const gx = STAGES.map((_, i) => 20 + ((split - 40) * (i + 0.5)) / STAGES.length);
            ctx.font = `11px ${p.sans}`;
            STAGES.forEach((st, i) => {
                ctx.strokeStyle = p.rule;
                ctx.lineWidth = 8;
                ctx.beginPath(); ctx.moveTo(gx[i], 40); ctx.lineTo(gx[i], h - 30); ctx.stroke();
                text(ctx, st, gx[i], 26, { color: p.ink2, align: "center", font: `11px ${p.sans}` });
            });
            ctx.lineWidth = 1;
            for (const d of dots) {
                ctx.fillStyle = p[CATS[d.cat].col];
                ctx.globalAlpha = d.x > gx[2] ? 0.9 : 0.5;
                ctx.beginPath(); ctx.arc(d.x, d.y, 2.2, 0, 7); ctx.fill();
            }
            ctx.globalAlpha = 1;
            // result bars with Wilson 95% intervals
            const done = counts.reduce((a, b) => a + b, 0);
            const bx = split + 10, bw = w - bx - 14;
            CATS.forEach((c, i) => {
                const y = 50 + i * ((h - 70) / 3);
                const ph = done ? counts[i] / done : 0;
                text(ctx, c.name.replace(/_/g, " ").toLowerCase(), bx, y, { color: p.ink2, font: `11px ${p.sans}` });
                ctx.fillStyle = p.rule;
                ctx.fillRect(bx, y + 8, bw, 12);
                ctx.fillStyle = p[c.col];
                ctx.fillRect(bx, y + 8, bw * ph, 12);
                if (done > 30) {
                    const [lo, hi] = wilson(ph, done);
                    ctx.strokeStyle = p.ink;
                    ctx.beginPath();
                    ctx.moveTo(bx + bw * lo, y + 14); ctx.lineTo(bx + bw * hi, y + 14);
                    ctx.moveTo(bx + bw * lo, y + 9); ctx.lineTo(bx + bw * lo, y + 19);
                    ctx.moveTo(bx + bw * hi, y + 9); ctx.lineTo(bx + bw * hi, y + 19);
                    ctx.stroke();
                }
                text(ctx, `${(ph * 100).toFixed(1)}%  (${counts[i]})`, bx, y + 36, { color: p.ink, font: `12px ${p.mono}` });
            });
            text(ctx, `${done} / ${TOTAL} sequences`, w - 14, h - 10, { color: p.ink3, align: "right", font: `11px ${p.mono}` });
        }
        const anim = animator(fig, (dt) => {
            const split = s.w * 0.56;
            for (let i = 0; i < 3 && spawned < TOTAL; i++, spawned++) {
                dots.push({ x: 10, y: 44 + Math.random() * (s.h - 78), v: 1.3 + Math.random() * 1.4, cat: pick() });
            }
            for (const d of dots) d.x += d.v * (dt / 16);
            dots = dots.filter((d) => {
                if (d.x < split - 16) return true;
                counts[d.cat]++;
                return false;
            });
            s.redraw();
            return spawned < TOTAL || dots.length > 0;
        });
        button(fig, "run 2,041 sequences", reset);
        reset();
    };

    // ---------- Lucas: Fibonacci from Pascal's shallow diagonals ----------
    FIGS.lucas = (fig) => {
        let n = 9;
        const ROWS = 13;
        const s = surface(fig, draw);
        const ro = readout(fig);
        function draw({ ctx, w, h, p }) {
            const ch = (h - 20) / ROWS, cw = Math.min(40, (w - 20) / ROWS);
            const hit = new Set();
            const terms = [];
            for (let k = 0; 2 * k <= n - 1; k++) { hit.add(`${n - 1 - k},${k}`); terms.push(Number(binom(n - 1 - k, k))); }
            for (let r = 0; r < ROWS; r++) {
                for (let k = 0; k <= r; k++) {
                    const x = w / 2 + (k - r / 2) * cw, y = 14 + r * ch + ch / 2;
                    const on = hit.has(`${r},${k}`);
                    if (on) {
                        ctx.fillStyle = p.c;
                        ctx.globalAlpha = 0.16;
                        ctx.beginPath(); ctx.arc(x, y, Math.min(cw, ch) * 0.48, 0, 7); ctx.fill();
                        ctx.globalAlpha = 1;
                    }
                    const v = String(binom(r, k));
                    text(ctx, v, x, y + 1, { font: `${Math.min(11, cw / Math.max(2.2, v.length * 0.7))}px ${p.mono}`, color: on ? p.c : p.ink3, align: "center", base: "middle" });
                }
            }
            // the diagonal
            ctx.strokeStyle = p.c; ctx.lineWidth = 1;
            ctx.beginPath();
            let first = true;
            for (let k = 0; 2 * k <= n - 1; k++) {
                const r = n - 1 - k;
                const x = w / 2 + (k - r / 2) * cw, y = 14 + r * ch + ch / 2;
                first ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                first = false;
            }
            ctx.stroke();
            ro.textContent = `${terms.join(" + ")} = ${fib(n)} = F${n}`;
        }
        slider(fig, "n", { min: 1, max: ROWS, value: 9 }, (v) => { n = v; s.redraw(); });
        bar(fig).append(ro);
        s.redraw();
    };

    // ---------- Manim: Fourier epicycles building a square wave ----------
    FIGS.epicycles = (fig) => {
        let terms = 4, t = 0, wave = [];
        const s = surface(fig, draw);
        function draw({ ctx, w, h, p }) {
            const cx = Math.min(w * 0.26, 150), cy = h / 2, A = Math.min(h * 0.3, cx * 0.62);
            let x = cx, y = cy;
            ctx.lineWidth = 1;
            for (let i = 0; i < terms; i++) {
                const k = 2 * i + 1, r = (A * 4) / (Math.PI * k);
                ctx.strokeStyle = p.ink3; ctx.globalAlpha = 0.5;
                ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
                ctx.globalAlpha = 1;
                const nx = x + r * Math.cos(k * t), ny = y - r * Math.sin(k * t);
                ctx.strokeStyle = p.c2;
                ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(nx, ny); ctx.stroke();
                x = nx; y = ny;
            }
            const wx = cx + A * 1.9;
            ctx.strokeStyle = p.ink3; ctx.setLineDash([2, 3]);
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(wx, y); ctx.stroke();
            ctx.setLineDash([]);
            ctx.strokeStyle = p.c; ctx.lineWidth = 2;
            ctx.beginPath();
            wave.forEach((v, i) => { const xx = wx + i * 1.2; i ? ctx.lineTo(xx, v) : ctx.moveTo(xx, v); });
            ctx.stroke();
            s.tipY = y; s.wx = wx;
            text(ctx, `Σ (4/πk)·sin(kt), k odd ≤ ${2 * terms - 1}`, w - 10, h - 10, { font: `11px ${p.mono}`, color: p.ink2, align: "right" });
        }
        const anim = animator(fig, (dt) => {
            t += dt * 0.0018;
            s.redraw();
            wave.unshift(s.tipY);
            const max = Math.max(10, Math.floor((s.w - s.wx - 10) / 1.2));
            if (wave.length > max) wave.length = max;
            return true;
        });
        slider(fig, "circles", { min: 1, max: 30, value: 4 }, (v) => { terms = v; wave = []; if (!anim.running) s.redraw(); });
        if (REDUCED) { for (let i = 0; i < 400; i++) { t += 0.03; s.redraw(); wave.unshift(s.tipY); } s.redraw(); }
        else anim.start();
    };

    // ---------- Django-POL Agro: wholesalers ↔ farmers ----------
    FIGS.agro = (fig) => {
        const W = ["Wholesaler A", "Wholesaler B", "Wholesaler C"];
        const F = 9;
        let pulses = [], answered = 0, clock = 0;
        const s = surface(fig, draw);
        const ro = readout(fig);
        const pos = (side, i, n) => ({ x: side ? s.w - 70 : 90, y: 36 + (i + 0.5) * ((s.h - 50) / n) });
        function send(fi) {
            const wi = Math.floor(Math.random() * W.length);
            pulses.push({ fi, wi, t: 0, back: false });
        }
        function draw({ ctx, w, h, p }) {
            text(ctx, "wholesalers", 90, 20, { font: `11px ${p.sans}`, color: p.ink3, align: "center" });
            text(ctx, "farmers (click one)", w - 70, 20, { font: `11px ${p.sans}`, color: p.ink3, align: "center" });
            ctx.strokeStyle = p.rule; ctx.lineWidth = 1;
            for (let i = 0; i < W.length; i++) for (let j = 0; j < F; j++) {
                const a = pos(0, i, W.length), b = pos(1, j, F);
                ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            }
            for (const q of pulses) {
                const a = pos(0, q.wi, W.length), b = pos(1, q.fi, F);
                const t = q.back ? q.t : 1 - q.t;
                ctx.fillStyle = q.back ? p.c : p.c3;
                ctx.beginPath(); ctx.arc(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 4, 0, 7); ctx.fill();
            }
            W.forEach((n, i) => {
                const a = pos(0, i, W.length);
                ctx.fillStyle = p.paper; ctx.strokeStyle = p.c; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.roundRect(a.x - 62, a.y - 13, 124, 26, 4); ctx.fill(); ctx.stroke();
                text(ctx, n, a.x, a.y + 1, { font: `11px ${p.sans}`, color: p.ink, align: "center", base: "middle" });
            });
            for (let j = 0; j < F; j++) {
                const b = pos(1, j, F);
                const hot = s.mouse && Math.hypot(s.mouse.x - b.x, s.mouse.y - b.y) < 14;
                ctx.fillStyle = hot ? p.c3 : p.paper; ctx.strokeStyle = p.c3; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(b.x, b.y, 9, 0, 7); ctx.fill(); ctx.stroke();
            }
            ro.textContent = `${answered} queries answered`;
        }
        s.onclick = (m) => {
            for (let j = 0; j < F; j++) {
                const b = pos(1, j, F);
                if (Math.hypot(m.x - b.x, m.y - b.y) < 16) { send(j); anim.start(); }
            }
        };
        const anim = animator(fig, (dt) => {
            clock += dt;
            if (clock > 650) { clock = 0; send(Math.floor(Math.random() * F)); }
            for (const q of pulses) {
                q.t += dt / 900;
                if (q.t >= 1 && !q.back) { q.back = true; q.t = 0; }
            }
            pulses = pulses.filter((q) => { if (q.back && q.t >= 1) { answered++; return false; } return true; });
            s.redraw();
            return true;
        });
        bar(fig).append(ro);
        if (REDUCED) s.redraw(); else anim.start();
    };

    // ---------- finite differences: every xᵖ collapses to p! ----------
    FIGS.diff = (fig) => {
        let pw = 3;
        const COLS = 9;
        const s = surface(fig, draw);
        const ro = readout(fig);
        function draw({ ctx, w, h, p }) {
            let row = Array.from({ length: COLS }, (_, i) => BigInt(i + 1) ** BigInt(pw));
            const rows = [row];
            while (row.length > 1 && rows.length <= pw + 1) {
                row = row.slice(1).map((v, i) => v - row[i]);
                rows.push(row);
            }
            const rh = Math.min(30, (h - 20) / rows.length), cw = (w - 70) / COLS;
            rows.forEach((r, d) => {
                const y = 18 + d * rh + rh / 2;
                text(ctx, d === 0 ? `n${"⁰¹²³⁴⁵⁶⁷"[pw]}` : `Δ${d > 1 ? "⁰¹²³⁴⁵⁶⁷"[d] : ""}`, 10, y + 4, { font: `12px ${p.mono}`, color: p.ink3 });
                r.forEach((v, i) => {
                    const x = 60 + (i + d / 2) * cw + cw / 2;
                    const isConst = d === pw;
                    const zero = d > pw;
                    text(ctx, fmtBig(v), x, y + 4, { font: `${Math.min(12, cw / 4)}px ${p.mono}`, color: isConst ? p.c : zero ? p.rule : p.ink, align: "center" });
                });
            });
            let f = 1n;
            for (let i = 2n; i <= BigInt(pw); i++) f *= i;
            ro.textContent = `Δ${"⁰¹²³⁴⁵⁶⁷"[pw]}(n${"⁰¹²³⁴⁵⁶⁷"[pw]}) = ${pw}! = ${f}`;
        }
        slider(fig, "p", { min: 1, max: 7, value: 3 }, (v) => { pw = v; s.redraw(); });
        bar(fig).append(ro);
        s.redraw();
    };

    // ---------- Ulam spiral with C2 on hover (home page) ----------
    FIGS.ulam = (fig) => {
        const s = surface(fig, draw);
        const ro = readout(fig);
        let cells = [];
        function draw({ ctx, w, h, p }) {
            const size = Math.min(w, h);
            const N = 41, cell = size / N;
            const ox = (w - size) / 2, oy = (h - size) / 2;
            cells = [];
            let x = 0, y = 0, dx = 1, dy = 0, seg = 1, segPassed = 0, turns = 0;
            let hover = null;
            for (let n = 1; n <= N * N; n++) {
                const px = ox + (x + (N - 1) / 2) * cell + cell / 2, py = oy + (-y + (N - 1) / 2) * cell + cell / 2;
                const pr = isPrime(n);
                ctx.fillStyle = pr ? p.c : p.rule;
                ctx.beginPath(); ctx.arc(px, py, pr ? cell * 0.36 : cell * 0.12, 0, 7); ctx.fill();
                if (s.mouse && Math.abs(s.mouse.x - px) < cell / 2 && Math.abs(s.mouse.y - py) < cell / 2) hover = { n, pr, px, py };
                x += dx; y += dy;
                if (++segPassed === seg) { segPassed = 0; [dx, dy] = [-dy, dx]; if (++turns % 2 === 0) seg++; }
            }
            if (hover) {
                ctx.strokeStyle = p.ink; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(hover.px, hover.py, cell * 0.6, 0, 7); ctx.stroke();
                const sp = hover.pr ? c2Split(hover.n) : null;
                tooltip(s, [hover.pr ? `${hover.n} is prime` : `${hover.n}`, ...(sp ? [`${hover.n} = 2·${sp.q} ${sp.op} ${sp.r}`] : [])]);
            }
        }
        ro.textContent = "hover a red dot";
        s.redraw();
    };

    // ---------- myBash: a tiny terminal ----------
    FIGS.bash = (fig) => {
        const term = fig.querySelector(".term");
        const FILES = {
            "about.txt": "Aadesh Tikhe — number theory, algorithms, interpretability.\nBCA, Amity University Mumbai (2023–2026).",
            "c2.txt": "Every prime p > 2 is 2q ± r with q, r ∈ {1} ∪ primes, q < p.\nVerified for 1,008,309,544 primes. 0 counterexamples.",
            ".bashrc": "alias ll='ls -lah'\nalias gs='git status'\nexport EDITOR=vim",
            "crontab": "0 9 1 * * brew update && brew upgrade  # monthly Homebrew refresh",
        };
        const CMDS = {
            help: () => "commands: ls, cat <file>, whoami, date, primes <n>, crontab -l, clear",
            ls: () => Object.keys(FILES).filter((f) => f !== "crontab").join("  "),
            whoami: () => "aadesh",
            date: () => new Date().toString(),
            cat: (a) => FILES[a] ?? `cat: ${a || ""}: No such file or directory`,
            crontab: (a) => (a === "-l" ? FILES.crontab : "usage: crontab -l"),
            primes: (a) => {
                const n = Math.min(500, Math.max(2, +a || 50));
                const out = [];
                for (let i = 2; i <= n; i++) if (isPrime(i)) out.push(i);
                return out.join(" ");
            },
        };
        const esc = (t) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
        const log = document.createElement("div");
        const line = document.createElement("div");
        const inp = Object.assign(document.createElement("input"), { spellcheck: false, autocomplete: "off" });
        inp.setAttribute("aria-label", "terminal input");
        line.innerHTML = '<span class="p">aadesh@portfolio:~$ </span>';
        line.append(inp);
        term.append(log, line);
        const print = (cmd, out) => {
            log.insertAdjacentHTML("beforeend", `<div><span class="p">aadesh@portfolio:~$ </span>${esc(cmd)}</div>${out ? `<div>${esc(out)}</div>` : ""}`);
            term.scrollTop = term.scrollHeight;
        };
        print("help", CMDS.help());
        inp.addEventListener("keydown", (e) => {
            if (e.key !== "Enter") return;
            const raw = inp.value.trim();
            inp.value = "";
            if (raw === "clear") { log.innerHTML = ""; return; }
            const [c, ...args] = raw.split(/\s+/);
            print(raw, !c ? "" : CMDS[c] ? CMDS[c](args.join(" ")) : `${c}: command not found`);
        });
        term.addEventListener("click", () => inp.focus({ preventScroll: true }));
    };

    // ---------- Dimensional primality: N as a genuine n-dimensional box ----------
    const factorize = (N) => {
        const f = [];
        for (let p = 2; p * p <= N; p++) while (N % p === 0) { f.push(p); N /= p; }
        if (N > 1) f.push(N);
        return f;
    };

    FIGS.dimprime = (fig) => {
        const STRIP = 64;
        let N = 24, dim = 3;
        const s = surface(fig, draw);
        const ro = readout(fig);

        // split the prime factors into `dim` groups with balanced products; extra sides are 1
        function sides() {
            const f = factorize(N).sort((a, b) => b - a);
            const g = new Array(dim).fill(1);
            f.forEach((p, i) => {
                if (i < dim) { g[i] *= p; return; }
                let j = 0;
                for (let k = 1; k < dim; k++) if (g[k] < g[j]) j = k;
                g[j] *= p;
            });
            return g.sort((a, b) => b - a);
        }

        function box(ctx, p, ox, oy, a, b, c, u, col, flat) {
            // isometric box a × b × c of unit cubes, size u, front-bottom corner at (ox, oy)
            const ix = (x, y, z) => ox + (x - y) * u * 0.87;
            const iy = (x, y, z) => oy - z * u + (x + y) * u * 0.5 - (a + b) * u * 0.5;
            const face = (pts, alpha) => {
                ctx.beginPath();
                pts.forEach(([x, y, z], i) => (i ? ctx.lineTo(ix(x, y, z), iy(x, y, z)) : ctx.moveTo(ix(x, y, z), iy(x, y, z))));
                ctx.closePath();
                ctx.globalAlpha = alpha; ctx.fillStyle = col; ctx.fill();
                ctx.globalAlpha = 1; ctx.strokeStyle = flat ? p.c2 : p.ink; ctx.lineWidth = 1.1; ctx.stroke();
            };
            face([[0, 0, c], [a, 0, c], [a, b, c], [0, b, c]], 0.32);
            face([[a, 0, 0], [a, b, 0], [a, b, c], [a, 0, c]], 0.18);
            face([[0, b, 0], [a, b, 0], [a, b, c], [0, b, c]], 0.08);
            ctx.globalAlpha = 0.35; ctx.strokeStyle = p.ink; ctx.lineWidth = 0.6;
            const line = (A, B) => { ctx.beginPath(); ctx.moveTo(ix(...A), iy(...A)); ctx.lineTo(ix(...B), iy(...B)); ctx.stroke(); };
            if (a * b * c <= 4096) {
                for (let i = 1; i < a; i++) { line([i, 0, c], [i, b, c]); line([i, b, 0], [i, b, c]); }
                for (let j = 1; j < b; j++) { line([0, j, c], [a, j, c]); line([a, j, 0], [a, j, c]); }
                for (let k = 1; k < c; k++) { line([a, 0, k], [a, b, k]); line([0, b, k], [a, b, k]); }
            }
            ctx.globalAlpha = 1;
        }

        function draw({ ctx, w, h, p }) {
            const om = factorize(N).length;
            const g = sides();
            const genuine = dim <= om;
            const topH = h * 0.62;

            // --- the box ---
            const [a, b, c] = [g[0], g[1] ?? 1, g[2] ?? 1];
            const copies = g.slice(3).reduce((m, v) => m * v, 1);
            const showCopies = Math.min(copies, 12);
            const cols = Math.min(showCopies, 4), rows = Math.ceil(showCopies / cols);
            const cw = (w - 40) / cols, chh = (topH - 46) / rows;
            const isoW = (a + b) * 0.87, isoH = c + (a + b) * 0.5;
            const u = Math.max(1.2, Math.min(cw / (isoW + 0.6), chh / (isoH + 0.4), 26));
            for (let k = 0; k < showCopies; k++) {
                // centre the box's isometric bounding box in its cell
                const cx = 20 + (k % cols) * cw + cw / 2;
                const cy = 34 + Math.floor(k / cols) * chh + chh / 2;
                const ox = cx - ((a - b) * 0.87 * u) / 2;
                const oy = cy + (isoH * u) / 2;
                box(ctx, p, ox, oy, a, b, c, u, genuine ? p.c : p.c2, !genuine);
            }
            const sideStr = g.join(" × ");
            text(ctx, `${N} = ${sideStr}`, 14, 20, { font: `13px ${p.mono}`, color: p.ink });
            text(ctx, genuine ? `genuine ${dim}-D box` : `collapses: ${dim - om} side${dim - om > 1 ? "s" : ""} = 1`, w - 14, 20,
                { font: `12px ${p.sans}`, color: genuine ? p.c : p.c2, align: "right" });
            if (copies > 1) text(ctx, `dims 4…${dim} = ${copies} stacked 3-D boxes${copies > showCopies ? ` (first ${showCopies} shown)` : ""}`, 14, topH - 6, { font: `11px ${p.sans}`, color: p.ink3 });

            // --- the hierarchy strip: Ω(k) for k = 1..64, threshold line at n ---
            const y0 = topH + 14, y1 = h - 22, bw = (w - 28) / STRIP;
            const maxO = 6, unit = (y1 - y0) / maxO;
            let hover = null;
            for (let k = 1; k <= STRIP; k++) {
                const o = k === 1 ? 0 : factorize(k).length;
                const x = 14 + (k - 1) * bw;
                const inD = o >= dim;
                ctx.fillStyle = inD ? p.c : p.ink3;
                ctx.globalAlpha = k === N ? 1 : inD ? 0.7 : 0.3;
                ctx.fillRect(x + 1, y1 - o * unit, bw - 2, o * unit);
                ctx.globalAlpha = 1;
                if ((k & (k - 1)) === 0) {
                    ctx.strokeStyle = p.ink; ctx.lineWidth = 1;
                    ctx.strokeRect(x + 0.5, y1 - o * unit - 0.5, bw - 1, o * unit + 1);
                }
                if (k === N) text(ctx, "▲", x + bw / 2, y1 + 13, { font: `10px ${p.sans}`, color: p.ink, align: "center" });
                if (s.mouse && s.mouse.x >= x && s.mouse.x < x + bw && s.mouse.y > y0 - 6) hover = { k, o };
            }
            ctx.strokeStyle = p.c; ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(14, y1 - dim * unit); ctx.lineTo(w - 14, y1 - dim * unit); ctx.stroke();
            ctx.setLineDash([]);
            text(ctx, `Ω ≥ ${dim}: D${"₀₁₂₃₄₅₆₇"[dim]}`, 16, y1 - dim * unit - 4, { font: `11px ${p.mono}`, color: p.c });
            if (hover) tooltip(s, [`${hover.k} = ${hover.k === 1 ? "1" : factorize(hover.k).join("·")}`, `Ω = ${hover.o}  ${hover.o >= dim ? `∈ D${dim}` : `${dim}-dimensionally prime`}`, "click to draw it"]);
            ro.textContent = `Ω(${N}) = ${om} · smallest in D${dim} is 2${"⁰¹²³⁴⁵⁶⁷"[dim]} = ${2 ** dim}`;
        }

        const nIn = Object.assign(document.createElement("input"), { type: "number", value: N, min: 2, max: 4096 });
        nIn.setAttribute("aria-label", "N");
        const lab = document.createElement("label");
        lab.append("N =", nIn);
        bar(fig).append(lab);
        nIn.addEventListener("input", () => { const v = Math.max(2, Math.min(4096, Math.floor(+nIn.value) || 2)); N = v; s.redraw(); });
        slider(fig, "dimension n", { min: 1, max: 6, value: dim }, (v) => { dim = v; s.redraw(); });
        bar(fig).append(ro);
        s.onclick = (m) => {
            const bw = (s.w - 28) / STRIP;
            if (m.y < s.h * 0.62) return;
            const k = Math.floor((m.x - 14) / bw) + 1;
            if (k >= 2 && k <= STRIP) { N = k; nIn.value = k; s.redraw(); }
        };
        s.redraw();
    };

    // ---------- LabourVala: contractor ↔ worker matching ----------
    FIGS.labour = (fig) => {
        let workers = [], phase = "idle", t = 0, need = 3, radius = 0.45, jobs = 0;
        const s = surface(fig, draw);
        const ro = readout(fig);
        const site = { x: 0.5, y: 0.52 };
        function seed() {
            workers = Array.from({ length: 34 }, () => ({
                x: 0.06 + Math.random() * 0.88, y: 0.12 + Math.random() * 0.8,
                rating: 3 + Math.random() * 2, state: "idle",
            }));
        }
        const dist = (w) => Math.hypot((w.x - site.x) * 1.6, w.y - site.y);
        function post() {
            workers.forEach((w) => (w.state = "idle"));
            const near = workers.filter((w) => dist(w) < radius).sort(() => Math.random() - 0.5);
            near.forEach((w, i) => (w.state = "notified"));
            phase = "notify"; t = 0;
            anim.start();
        }
        function step(dt) {
            t += dt;
            const near = workers.filter((w) => w.state !== "idle");
            if (phase === "notify" && t > 700) {
                near.forEach((w) => { if (Math.random() < 0.75) w.state = "applied"; });
                phase = "apply"; t = 0;
            } else if (phase === "apply" && t > 900) {
                workers.filter((w) => w.state === "applied").sort((a, b) => b.rating - a.rating)
                    .slice(0, need).forEach((w) => (w.state = "matched"));
                phase = "match"; t = 0;
            } else if (phase === "match" && t > 1100) {
                workers.filter((w) => w.state === "matched").forEach((w) => (w.state = "arrived"));
                phase = "arrive"; t = 0; jobs++;
            } else if (phase === "arrive" && t > 1600) {
                phase = "done";
            }
        }
        function draw({ ctx, w, h, p }) {
            const X = (v) => v * w, Y = (v) => v * h;
            ctx.strokeStyle = p.rule; ctx.setLineDash([3, 4]);
            ctx.beginPath(); ctx.ellipse(X(site.x), Y(site.y), (radius / 1.6) * w, radius * h, 0, 0, 7); ctx.stroke();
            ctx.setLineDash([]);
            for (const wk of workers) {
                const x = X(wk.x), y = Y(wk.y);
                if (["applied", "matched", "arrived"].includes(wk.state)) {
                    ctx.strokeStyle = wk.state === "applied" ? p.c3 : p.c;
                    ctx.setLineDash(wk.state === "applied" ? [2, 3] : []);
                    ctx.lineWidth = wk.state === "applied" ? 1 : 1.8;
                    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(X(site.x), Y(site.y)); ctx.stroke();
                    ctx.setLineDash([]);
                }
                const col = wk.state === "idle" ? p.ink3 : wk.state === "notified" || wk.state === "applied" ? p.c3 : p.c;
                ctx.fillStyle = col;
                ctx.globalAlpha = wk.state === "idle" ? 0.45 : 1;
                ctx.beginPath(); ctx.arc(x, y, wk.state === "idle" ? 4 : 5.5, 0, 7); ctx.fill();
                ctx.globalAlpha = 1;
                if (wk.state === "matched") text(ctx, "📞", x + 7, y - 6, { font: `11px ${p.sans}` });
                if (wk.state === "arrived") text(ctx, "✓", x + 8, y - 6, { font: `bold 12px ${p.sans}`, color: p.c });
            }
            ctx.fillStyle = p.paper; ctx.strokeStyle = p.ink; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.roundRect(X(site.x) - 44, Y(site.y) - 13, 88, 26, 4); ctx.fill(); ctx.stroke();
            text(ctx, "contractor", X(site.x), Y(site.y) + 1, { font: `11px ${p.sans}`, color: p.ink, align: "center", base: "middle" });
            const msg = {
                idle: "Post a job: the contractor sets the work, date and daily rate.",
                notify: "Verified workers nearby see the job. Phone numbers stay hidden.",
                apply: "Workers apply (dashed). Contact is still hidden.",
                match: `Contractor accepts ${need}: only now are numbers revealed.`,
                arrive: "Each worker confirms arrival on site with a 4-digit code.",
                done: "Both sides rate each other, which builds their trust scores.",
            }[phase];
            text(ctx, msg, 12, h - 12, { font: `12px ${p.sans}`, color: p.ink2 });
            ro.textContent = `${jobs} job${jobs === 1 ? "" : "s"} filled`;
        }
        const anim = animator(fig, (dt) => { step(dt); s.redraw(); return phase !== "done"; });
        button(fig, "post a job", post);
        slider(fig, "workers needed", { min: 1, max: 6, value: need }, (v) => (need = v));
        slider(fig, "radius", { min: 0.2, max: 0.7, step: 0.05, value: radius, fmt: (v) => `${Math.round(v * 20)} km` }, (v) => { radius = v; s.redraw(); });
        bar(fig).append(ro);
        s.onclick = () => { if (phase === "idle" || phase === "done") post(); };
        seed();
        s.redraw();
        if (!REDUCED) post(); // plays once when it scrolls into view
    };

    // ---------- boot ----------
    document.querySelectorAll("figure.fig[data-fig]").forEach((fig) => {
        const f = FIGS[fig.dataset.fig];
        if (f) f(fig);
    });
})();
