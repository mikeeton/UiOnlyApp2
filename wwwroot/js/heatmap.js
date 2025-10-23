// File: wwwroot/js/heatmap.js
// Simulate 32x32 pressure frames + simple KPIs and rendering

(function () {
  const SIZE = 32;
  const MIN = 1, MAX = 255;

  // Thresholds (tweakable)
  const LOWER_THRESH = 25;      // counts toward "contact area %"
  const ALERT_THRESH = 200;     // pixels above this may trigger an alert
  const REGION_MIN_PIXELS = 10; // min cluster size used in PPI/alert heuristics

  // ---- Color Palettes (hsv helpers) ----
  function hsvToRgb(h, s, v) {
    h = (h % 360 + 360) % 360;
    const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
    let [r, g, b] = [0, 0, 0];
    if (0 <= h && h < 60) [r, g, b] = [c, x, 0];
    else if (60 <= h && h < 120) [r, g, b] = [x, c, 0];
    else if (120 <= h && h < 180) [r, g, b] = [0, c, x];
    else if (180 <= h && h < 240) [r, g, b] = [0, x, c];
    else if (240 <= h && h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255)
    ];
  }

  const palettes = {
    inferno: t => hsvToRgb(25 + 235 * t, 1.0, Math.max(0.5, t)),
    viridis: t => hsvToRgb(180 + 120 * t, 0.9, Math.max(0.4, t)),
    gray: t => [t * 255, t * 255, t * 255]
  };

  // ---- Frame Generation (demo) ----
  // Creates a "hot spot" that moves with time; adds gentle noise + border falloff
  function generateFrame(tick = 0) {
    const frame = new Array(SIZE * SIZE);
    const cx = 10 + Math.floor(8 * Math.sin(tick / 15));
    const cy = 16 + Math.floor(10 * Math.cos(tick / 18));

    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const d = Math.hypot(x - cx, y - cy);
        // base intensity + subtle wave noise
        let val = 220 - d * 20 + 10 * Math.sin((x + y + tick) / 7);
        // border falloff (seat outline)
        const mask = (x > 3 && x < SIZE - 4 && y > 3 && y < SIZE - 4) ? 1 : 0.7;
        val = Math.max(MIN, Math.min(MAX, Math.round(val * mask)));
        frame[y * SIZE + x] = val;
      }
    }
    return frame;
  }

  // ---- KPIs / Heuristics ----
  function calcContactAreaPct(frame) {
    const above = frame.filter(v => v >= LOWER_THRESH).length;
    return (above / frame.length) * 100;
  }

  // PPI proxy: median of the top-N pixels (fast & stable for demo)
  function calcPeakPressureIndex(frame) {
    const sorted = [...frame].sort((a, b) => b - a);
    const top = sorted.slice(0, REGION_MIN_PIXELS);
    const median = top[Math.floor(top.length / 2)];
    return median;
  }

  function hasAlert(frame) {
    let count = 0;
    for (const v of frame) {
      if (v >= ALERT_THRESH && ++count >= REGION_MIN_PIXELS) return true;
    }
    return false;
  }

  // ---- Rendering ----
  function drawHeatmap(canvas, frame, paletteName = 'inferno') {
    if (!canvas || !frame) return;
    const pal = palettes[paletteName] || palettes.inferno;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Create 32x32 image
    const img = ctx.createImageData(SIZE, SIZE);
    for (let i = 0; i < frame.length; i++) {
      const t = (frame[i] - MIN) / (MAX - MIN);
      const [r, g, b] = pal(t);
      const o = i * 4;
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = b;
      img.data[o + 3] = 255;
    }

    // Draw pixel-perfect then scale to canvas size without smoothing
    // Use OffscreenCanvas when available for speed; fallback to normal canvas otherwise.
    const srcCanvas = (typeof OffscreenCanvas !== 'undefined')
      ? new OffscreenCanvas(SIZE, SIZE)
      : document.createElement('canvas');
    srcCanvas.width = SIZE; srcCanvas.height = SIZE;
    srcCanvas.getContext('2d').putImageData(img, 0, 0);

    // Match canvas to parent box so it fills the ratio container
    const parent = canvas.parentElement?.getBoundingClientRect?.();
    if (parent) {
      canvas.width = Math.max(1, Math.floor(parent.width));
      canvas.height = Math.max(1, Math.floor(parent.height));
    } else {
      canvas.width = SIZE * 8;
      canvas.height = SIZE * 8;
    }

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(srcCanvas, 0, 0, canvas.width, canvas.height);
  }

  // ---- Public API ----
  window.HeatmapSim = {
    SIZE,
    LOWER_THRESH,
    generateFrame,
    drawHeatmap,
    calcContactAreaPct,
    calcPeakPressureIndex,
    hasAlert
  };
})();
