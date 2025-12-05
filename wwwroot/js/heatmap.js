// File: wwwroot/js/heatmap.js

(function () {
    "use strict";

    function drawHeatmap(canvas, frame, paletteName) {
        if (!canvas || !frame || !frame.length) return;

        const ctx = canvas.getContext("2d");
        const n = Math.sqrt(frame.length) | 0;
        const size = n > 0 ? n : 32;

        canvas.width = 256;
        canvas.height = 256;

        let min = Infinity;
        let max = -Infinity;
        for (let i = 0; i < frame.length; i++) {
            const v = frame[i];
            if (v < min) min = v;
            if (v > max) max = v;
        }
        if (!isFinite(min) || !isFinite(max)) {
            min = 0;
            max = 1;
        }
        const range = max - min || 1;

        const img = ctx.createImageData(size, size);

        for (let i = 0; i < frame.length && i < size * size; i++) {
            const v = frame[i];
            const t = (v - min) / range;
            const color = mapColor(t, paletteName || "inferno");
            const idx = i * 4;
            img.data[idx] = color[0];
            img.data[idx + 1] = color[1];
            img.data[idx + 2] = color[2];
            img.data[idx + 3] = 255;
        }

        const tmp = document.createElement("canvas");
        tmp.width = size;
        tmp.height = size;
        tmp.getContext("2d").putImageData(img, 0, 0);

        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);
    }

    function mapColor(t, palette) {
        t = Math.min(1, Math.max(0, t));

        switch (palette) {
            case "viridis":
                return viridis(t);
            case "gray":
                return gray(t);
            case "inferno":
            default:
                return inferno(t);
        }
    }

    // Rough inferno-style gradient: purple -> red -> yellow
    function inferno(t) {
        const r = Math.floor(255 * Math.min(1, Math.max(0, 2 * t)));
        const g = Math.floor(255 * Math.pow(t, 1.5));
        const b = Math.floor(150 * (1 - t * t));
        return [r, g, b];
    }

    // Rough viridis-style gradient: dark blue -> green -> yellow
    function viridis(t) {
        const r = Math.floor(255 * Math.max(0, t - 0.2));
        const g = Math.floor(255 * Math.min(1, t + 0.3));
        const b = Math.floor(255 * (1 - t));
        return [r, g, b];
    }

    function gray(t) {
        const v = Math.floor(255 * t);
        return [v, v, v];
    }

    window.HeatmapSim = {
        drawHeatmap
    };
})();
