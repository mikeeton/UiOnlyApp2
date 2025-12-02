// File: wwwroot/js/sensor-metrics.js
// ----------------------------------
// Reads per-patient CSV sensor files and turns them into:
//  - multiple 32x32 frames per CSV (for video)
//  - per-session metrics (PPI + Contact Area)
//  - patient time-series for charts

(function () {
    const GRID_SIZE = 32;

    // Mapping of patient IDs to their CSV files + email
    const INDEX = {
        patients: {
            "1c0fd777": {
                name: "Michael Eton",
                email: "michael.eton@patient.demo",
                files: {
                    "2025-10-11": "1c0fd777_20251011.csv",
                    "2025-10-12": "1c0fd777_20251012.csv",
                    "2025-10-13": "1c0fd777_20251013.csv"
                }
            },
            "71e66ab3": {
                name: "Jason Ghanian",
                email: "jason.ghanian@patient.demo",
                files: {
                    "2025-10-11": "71e66ab3_20251011.csv",
                    "2025-10-12": "71e66ab3_20251012.csv",
                    "2025-10-13": "71e66ab3_20251013.csv"
                }
            },
            "543d4676": {
                name: "Alex Jenkins",
                email: "alex.jenkins@patient.demo",
                files: {
                    "2025-10-11": "543d4676_20251011.csv",
                    "2025-10-12": "543d4676_20251012.csv",
                    "2025-10-13": "543d4676_20251013.csv"
                }
            },
            "d13043b3": {
                name: "Richard Afana",
                email: "richard.afana@patient.demo",
                files: {
                    "2025-10-11": "d13043b3_20251011.csv",
                    "2025-10-12": "d13043b3_20251012.csv",
                    "2025-10-13": "d13043b3_20251013.csv"
                }
            },
            "de0e9b2c": {
                name: "De Luca",
                email: "de.luca@patient.demo",
                files: {
                    "2025-10-11": "de0e9b2c_20251011.csv",
                    "2025-10-12": "de0e9b2c_20251012.csv",
                    "2025-10-13": "de0e9b2c_20251013.csv"
                }
            }
        }
    };

    // ---------------- Basic helpers ----------------

    async function fetchCsv(filename) {
        const url = `/sensor-data/${filename}`;
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`Failed to load ${url}: ${res.status} ${res.statusText}`);
        }
        return res.text();
    }

    function ensureRow32(row) {
        const r = row.slice(0, GRID_SIZE);
        while (r.length < GRID_SIZE) r.push(0);
        return r;
    }

    function flattenGrid(grid) {
        const frame = [];
        for (let y = 0; y < GRID_SIZE; y++) {
            const row = grid[y] || [];
            for (let x = 0; x < GRID_SIZE; x++) {
                frame.push(row[x] || 0);
            }
        }
        return frame;
    }

    // -------------- CSV → multiple frames ----------------
    // We treat each *block of 32 rows* as one frame.
    // If there are < 32 rows total, we just build a single snapshot.

    function parseFramesFromCsv(text) {
        const lines = text
            .split(/\r?\n/)
            .map(l => l.trim())
            .filter(l => l.length);

        if (!lines.length) {
            const empty = emptyGrid();
            return { frames: [empty], lastGrid: empty, lastFrame: flattenGrid(empty) };
        }

        const rows = lines.map(line =>
            line.split(",").map(v => {
                const n = Number(v);
                return Number.isFinite(n) ? n : 0;
            })
        );

        const totalRows = rows.length;

        // Not enough rows for 1 full frame → fallback to single snapshot from last rows
        if (totalRows < GRID_SIZE) {
            const slice = rows.slice(-GRID_SIZE);
            while (slice.length < GRID_SIZE) {
                slice.unshift(new Array(GRID_SIZE).fill(0));
            }
            const grid = slice.map(ensureRow32);
            return { frames: [grid], lastGrid: grid, lastFrame: flattenGrid(grid) };
        }

        const frameCount = Math.floor(totalRows / GRID_SIZE);
        const frames = [];

        for (let f = 0; f < frameCount; f++) {
            const start = f * GRID_SIZE;
            const block = rows.slice(start, start + GRID_SIZE);
            const grid = block.map(ensureRow32);
            frames.push(grid);
        }

        const lastGrid = frames[frames.length - 1];
        const lastFrame = flattenGrid(lastGrid);

        return { frames, lastGrid, lastFrame };
    }

    function emptyGrid() {
        return Array.from({ length: GRID_SIZE }, () =>
            new Array(GRID_SIZE).fill(0)
        );
    }

    // -------------- Metrics (PPI + contact area) --------------

    function computeMetricsFromFrame(frame) {
        const LOWER_THRESH =
            (window.HeatmapSim && HeatmapSim.LOWER_THRESH) || 25;

        const total = frame.length || 1;
        let above = 0;
        for (const v of frame) {
            if (v >= LOWER_THRESH) above++;
        }
        const contactArea = (above / total) * 100;

        const sorted = frame.slice().sort((a, b) => b - a);
        const TOP_N = 10;
        const top = sorted.slice(0, TOP_N);
        const ppi = top.length ? top[Math.floor(top.length / 2)] : 0;

        const status =
            ppi >= 220 || contactArea >= 30
                ? "High"
                : ppi >= 150
                    ? "Medium"
                    : "OK";

        return { ppi, contactArea, status };
    }

    // -------------- Per-session + per-patient loaders ----------

    function getPatientMeta(patientId) {
        const meta = INDEX.patients[patientId];
        if (!meta) throw new Error(`Unknown patientId: ${patientId}`);
        return meta;
    }

    function findPatientIdByEmail(email) {
        if (!email) return null;
        const lower = email.toLowerCase();
        for (const [id, p] of Object.entries(INDEX.patients)) {
            if (p.email.toLowerCase() === lower) return id;
        }
        return null;
    }

    async function loadSession(patientId, dateKey) {
        const meta = getPatientMeta(patientId);
        const filename = meta.files[dateKey];
        if (!filename) {
            throw new Error(`No file for ${patientId} on ${dateKey}`);
        }

        const csvText = await fetchCsv(filename);
        const parsed = parseFramesFromCsv(csvText);
        const metrics = computeMetricsFromFrame(parsed.lastFrame);

        return {
            patientId,
            patientName: meta.name,
            dateKey,
            filename,
            // last frame snapshot (for charts / summary)
            grid: parsed.lastGrid,
            frame: parsed.lastFrame,
            // ALL frames for this session (for video)
            frames: parsed.frames,
            ppi: metrics.ppi,
            contactArea: metrics.contactArea,
            status: metrics.status
        };
    }

    async function loadPatientMetrics(patientId) {
        const meta = getPatientMeta(patientId);
        const dateKeys = Object.keys(meta.files).sort(); // 2025-10-11 .. 13

        const sessions = [];
        for (const d of dateKeys) {
            sessions.push(await loadSession(patientId, d));
        }

        const labels = sessions.map(s => s.dateKey);
        const ppiSeries = sessions.map(s => Math.round(s.ppi));
        const contactSeries = sessions.map(s =>
            Number(s.contactArea.toFixed(1))
        );

        const peak =
            ppiSeries.length ? Math.max(...ppiSeries) : 0;
        const avgPpi =
            ppiSeries.length
                ? ppiSeries.reduce((a, b) => a + b, 0) / ppiSeries.length
                : 0;
        const avgContact =
            contactSeries.length
                ? contactSeries.reduce((a, b) => a + b, 0) /
                contactSeries.length
                : 0;
        const highEpisodes = sessions.filter(
            s => s.status === "High"
        ).length;

        return {
            patientId,
            patientName: meta.name,
            labels,
            ppiSeries,
            contactSeries,
            sessions,
            summary: {
                peak,
                avgPpi,
                avgContact,
                highEpisodes
            }
        };
    }

    // Map "Last 1h/6h/24h" buttons to how many sessions we keep
    function sliceByRange(metrics, rangeKey) {
        const n = metrics.labels.length;
        if (!n) return { labels: [], ppi: [], contact: [] };

        let keep;
        switch (rangeKey) {
            case "1h": keep = 1; break;
            case "6h": keep = Math.min(2, n); break;
            case "24h":
            default: keep = n;
        }

        const start = Math.max(0, n - keep);
        return {
            labels: metrics.labels.slice(start),
            ppi: metrics.ppiSeries.slice(start),
            contact: metrics.contactSeries.slice(start)
        };
    }

    // Expose a small API
    window.SensorData = {
        INDEX,
        GRID_SIZE,
        loadSession,
        loadPatientMetrics,
        sliceByRange,
        findPatientIdByEmail
    };
})();
