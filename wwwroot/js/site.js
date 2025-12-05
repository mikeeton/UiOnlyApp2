// File: wwwroot/js/site.js
// Shared logic for Patient + Clinician dashboards
// Requires: Chart.js, charts.js (window.Charts), heatmap.js (window.HeatmapSim)

(function () {
    // -----------------------------
    // 0) Static sensor index (from your CSV list)
    // -----------------------------
    const SENSOR_INDEX = {
        patients: {
            "1c0fd777": {
                name: "Michael Eton",
                files: {
                    "2025-10-11": "1c0fd777_20251011.csv",
                    "2025-10-12": "1c0fd777_20251012.csv",
                    "2025-10-13": "1c0fd777_20251013.csv"
                }
            },
            "71e66ab3": {
                name: "Jason Ghanian",
                files: {
                    "2025-10-11": "71e66ab3_20251011.csv",
                    "2025-10-12": "71e66ab3_20251012.csv",
                    "2025-10-13": "71e66ab3_20251013.csv"
                }
            },
            "543d4676": {
                name: "Alex Jenkins",
                files: {
                    "2025-10-11": "543d4676_20251011.csv",
                    "2025-10-12": "543d4676_20251012.csv",
                    "2025-10-13": "543d4676_20251013.csv"
                }
            },
            "d13043b3": {
                name: "Richard Afana",
                files: {
                    "2025-10-11": "d13043b3_20251011.csv",
                    "2025-10-12": "d13043b3_20251012.csv",
                    "2025-10-13": "d13043b3_20251013.csv"
                }
            },
            "de0e9b2c": {
                name: "De Luca",
                files: {
                    "2025-10-11": "de0e9b2c_20251011.csv",
                    "2025-10-12": "de0e9b2c_20251012.csv",
                    "2025-10-13": "de0e9b2c_20251013.csv"
                }
            }
        }
    };

    const SENSOR_BASE_URL = "/sensor-data/";

    // thresholds + grid size
    const BASELINE_VALUE = 1;
    const CONTACT_THRESHOLD = 5;
    const ALERT_PPI_THRESHOLD = 220;
    const ALERT_AREA_THRESHOLD = 70;

    const ROWS_PER_FRAME = 32;
    const COLS_PER_FRAME = 32;
    const MAX_FRAMES = 300;        // 300 * 33ms ≈ 10s video
    const FRAME_DURATION_MS = 33;  // ~30fps

    // cache sessions so Clinician view doesn't refetch constantly
    const sessionCache = {}; // { patientId: { dateKey: { frames, ppi, contactPct, alert } } }

    // -----------------------------
    // 1) CSV + metrics helpers
    // -----------------------------

    function parseCsvToFrames(csvText, maxFrames) {
        if (!csvText) return [];

        const lines = csvText
            .trim()
            .split(/\r?\n/)
            .filter(l => l.trim() !== "");

        const totalFrames = Math.min(
            Math.floor(lines.length / ROWS_PER_FRAME),
            maxFrames || Infinity
        );

        const frames = [];

        for (let f = 0; f < totalFrames; f++) {
            const flat = [];
            for (let r = 0; r < ROWS_PER_FRAME; r++) {
                const line = lines[f * ROWS_PER_FRAME + r];
                const parts = line.split(/[,;\s]+/).filter(p => p.length > 0);

                for (let c = 0; c < COLS_PER_FRAME; c++) {
                    const v = Number(parts[c] ?? BASELINE_VALUE);
                    flat.push(Number.isFinite(v) ? v : BASELINE_VALUE);
                }
            }
            frames.push(flat);
        }

        return frames;
    }

    function computePPI(frame) {
        let maxVal = 0;
        for (const v of frame) {
            if (v > BASELINE_VALUE && v > maxVal) maxVal = v;
        }
        return maxVal;
    }

    function computeContactAreaPct(frame, threshold) {
        const total = frame.length || 1;
        let count = 0;
        for (const v of frame) {
            if (v > threshold) count++;
        }
        return (count / total) * 100;
    }

    function computeSessionMetrics(frames) {
        let maxPpi = 0;
        let sumArea = 0;

        for (const frame of frames) {
            const ppi = computePPI(frame);
            if (ppi > maxPpi) maxPpi = ppi;
            sumArea += computeContactAreaPct(frame, CONTACT_THRESHOLD);
        }

        const meanArea = frames.length ? sumArea / frames.length : 0;

        return { ppi: maxPpi, contactPct: meanArea };
    }

    function computeAlert(ppi, contactPct) {
        if (ppi >= ALERT_PPI_THRESHOLD || contactPct >= ALERT_AREA_THRESHOLD) {
            return { label: "High risk", cssClass: "text-danger" };
        }
        if (ppi > BASELINE_VALUE + 10 || contactPct > 10) {
            return { label: "Monitor", cssClass: "text-warning" };
        }
        return { label: "Stable", cssClass: "text-success" };
    }

    function mapPalette(uiValue) {
        switch (uiValue) {
            case "warm": return "inferno";
            case "cool": return "viridis";
            case "contrast": return "gray";
            case "default":
            default: return "inferno";
        }
    }

    function alertClassToBootstrap(cssClass) {
        if (!cssClass) return "";
        if (cssClass.includes("danger")) return "text-danger";
        if (cssClass.includes("warning")) return "text-warning";
        if (cssClass.includes("success")) return "text-success";
        return "";
    }

    // -----------------------------
    // 2) Notes + risk flags helpers
    // -----------------------------
    const NOTES_STORAGE_KEY = "sensoreClinicianNotes";

    function loadAllNotes() {
        try {
            const raw = localStorage.getItem(NOTES_STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    }

    function saveAllNotes(notesObj) {
        try {
            localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notesObj));
        } catch {
            // ignore
        }
    }

    function renderRiskFlags(sessions, patientName) {
        const emptyEl = document.getElementById("clinRiskEmpty");
        const listEl = document.getElementById("clinRiskList");
        if (!emptyEl || !listEl) return;

        listEl.innerHTML = "";

        const entries = Object.entries(sessions)
            .filter(([date, s]) => s.alert && s.alert.label === "High risk")
            .sort(([d1], [d2]) => d1.localeCompare(d2));

        if (!entries.length) {
            emptyEl.classList.remove("d-none");
            listEl.classList.add("d-none");
            emptyEl.textContent = "No recent High risk sessions for this patient.";
            return;
        }

        emptyEl.classList.add("d-none");
        listEl.classList.remove("d-none");

        const latest = entries.slice(-5); // last 5 high-risk

        for (const [date, s] of latest) {
            const li = document.createElement("li");
            li.className = "list-group-item bg-transparent border-secondary text-light small d-flex justify-content-between align-items-center";

            li.innerHTML = `
                <div>
                    <div class="fw-semibold">${date}</div>
                    <div class="text-muted">
                        PPI: ${s.ppi.toFixed(0)} • Contact: ${s.contactPct.toFixed(1)}%
                    </div>
                </div>
                <span class="badge bg-danger rounded-pill">High risk</span>
            `;
            listEl.appendChild(li);
        }
    }

    function renderClinicianNotes(patientId) {
        const threadEl = document.getElementById("clinNotesThread");
        if (!threadEl) return;

        const notesAll = loadAllNotes();
        const notes = notesAll[patientId] || [];

        threadEl.innerHTML = "";

        if (!patientId) {
            threadEl.innerHTML = `<div class="text-muted">Select a patient to view or add notes.</div>`;
            return;
        }

        if (!notes.length) {
            threadEl.innerHTML = `<div class="text-muted">No notes for this patient yet. Add one below.</div>`;
            return;
        }

        for (const note of notes) {
            const dt = new Date(note.ts);
            const timeLabel = dt.toLocaleString();

            const div = document.createElement("div");
            div.className = "mb-2";

            div.innerHTML = `
                <div class="fw-semibold">Dr. Patel <span class="text-muted small">• ${timeLabel}</span></div>
                <div>${note.text}</div>
            `;
            threadEl.appendChild(div);
        }
    }

    // -----------------------------
    // 3) Data loading (per patient)
    // -----------------------------

    async function loadSessionsForPatient(patientId) {
        if (sessionCache[patientId]) return sessionCache[patientId];

        const meta = SENSOR_INDEX.patients[patientId];
        if (!meta) return {};

        const sessions = {};
        const dates = Object.keys(meta.files).sort();

        for (const dateKey of dates) {
            const fileName = meta.files[dateKey];
            const url = SENSOR_BASE_URL + fileName;

            try {
                const csv = await fetch(url).then(r => {
                    if (!r.ok) throw new Error("HTTP " + r.status);
                    return r.text();
                });

                const frames = parseCsvToFrames(csv, MAX_FRAMES);
                if (!frames.length) continue;

                const metrics = computeSessionMetrics(frames);
                const alert = computeAlert(metrics.ppi, metrics.contactPct);

                sessions[dateKey] = {
                    frames,
                    ppi: metrics.ppi,
                    contactPct: metrics.contactPct,
                    alert
                };
            } catch (err) {
                console.error("Error loading session", url, err);
            }
        }

        sessionCache[patientId] = sessions;
        return sessions;
    }

    // -----------------------------
    // 4) HeatmapPlayer helper
    // -----------------------------

    function HeatmapPlayer(opts) {
        this.canvas = document.getElementById(opts.canvasId);
        this.dateSelect = document.getElementById(opts.dateSelectId);
        this.paletteSelect = document.getElementById(opts.paletteSelectId);
        this.kpiPpi = document.getElementById(opts.kpiPpiId);
        this.kpiContact = document.getElementById(opts.kpiContactId);
        this.kpiStatus = document.getElementById(opts.kpiStatusId);
        this.statusText = document.getElementById(opts.statusTextId);
        this.caption = document.getElementById(opts.captionId);
        this.playButton = document.getElementById(opts.playBtnId);
        this.slider = document.getElementById(opts.sliderId);
        this.timeLabel = document.getElementById(opts.timeLabelId);

        this.currentFrames = [];
        this.currentDateKey = null;
        this.playing = false;
        this.timerId = null;

        this.sessions = opts.sessions || {};
        this.patientName = opts.patientName || "";
    }

    HeatmapPlayer.prototype.destroyTimer = function () {
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
        this.playing = false;
        if (this.playButton) {
            this.playButton.innerHTML = '<i class="bi bi-play-fill"></i>';
        }
    };

    HeatmapPlayer.prototype.renderFrame = function (index) {
        if (!this.canvas || !this.currentFrames.length) return;
        const frame = this.currentFrames[index];
        const palName = mapPalette(this.paletteSelect.value);

        if (window.HeatmapSim && typeof HeatmapSim.drawHeatmap === "function") {
            HeatmapSim.drawHeatmap(this.canvas, frame, palName);
        } else {
            // simple fallback
            const SIZE = 32;
            const ctx = this.canvas.getContext("2d");
            const w = 256, h = 256;
            this.canvas.width = w;
            this.canvas.height = h;

            const img = ctx.createImageData(SIZE, SIZE);
            let min = Infinity, max = -Infinity;
            for (const v of frame) {
                if (v < min) min = v;
                if (v > max) max = v;
            }
            const range = max - min || 1;

            for (let i = 0; i < frame.length; i++) {
                const t = (frame[i] - min) / range;
                const r = Math.floor(255 * t);
                const b = Math.floor(255 * (1 - t));
                const g = Math.floor(80 + 50 * t);
                const idx = i * 4;
                img.data[idx] = r;
                img.data[idx + 1] = g;
                img.data[idx + 2] = b;
                img.data[idx + 3] = 255;
            }

            const tmp = document.createElement("canvas");
            tmp.width = SIZE;
            tmp.height = SIZE;
            tmp.getContext("2d").putImageData(img, 0, 0);

            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(tmp, 0, 0, w, h);
        }
    };

    HeatmapPlayer.prototype.setSession = function (dateKey) {
        const session = this.sessions[dateKey];
        if (!session) return;

        this.currentDateKey = dateKey;
        this.currentFrames = session.frames;
        if (this.slider) this.slider.value = 0;

        if (this.kpiPpi) this.kpiPpi.textContent = session.ppi.toFixed(0);
        if (this.kpiContact) this.kpiContact.textContent = session.contactPct.toFixed(1) + " %";
        if (this.kpiStatus) {
            this.kpiStatus.textContent = session.alert.label;
            this.kpiStatus.className = "fw-bold " + session.alert.cssClass;
        }

        if (this.statusText) {
            this.statusText.textContent = `${this.patientName} • ${dateKey}`;
        }
        if (this.caption) {
            this.caption.textContent = `${this.patientName} • ${dateKey}`;
        }

        this.renderFrame(0);

        const totalT = this.currentFrames.length * FRAME_DURATION_MS / 1000;
        if (this.timeLabel) {
            this.timeLabel.textContent = `0.0s / ${totalT.toFixed(1)}s`;
        }

        if (this.playing) {
            this.startPlayback();
        }
    };

    HeatmapPlayer.prototype.startPlayback = function () {
        if (!this.currentFrames.length || !this.slider) return;

        this.destroyTimer();
        const totalFrames = this.currentFrames.length;
        this.slider.max = totalFrames - 1;

        this.timerId = setInterval(() => {
            let idx = Number(this.slider.value);
            idx = (idx + 1) % totalFrames;
            this.slider.value = idx;

            this.renderFrame(idx);

            if (this.timeLabel) {
                const t = (idx + 1) * FRAME_DURATION_MS / 1000;
                const totalT = totalFrames * FRAME_DURATION_MS / 1000;
                this.timeLabel.textContent = `${t.toFixed(1)}s / ${totalT.toFixed(1)}s`;
            }
        }, FRAME_DURATION_MS);

        this.playing = true;
        if (this.playButton) {
            this.playButton.innerHTML = '<i class="bi bi-pause-fill"></i>';
        }
    };

    HeatmapPlayer.prototype.bindEvents = function () {
        if (!this.canvas) return;

        if (this.playButton) {
            this.playButton.addEventListener("click", () => {
                if (this.playing) {
                    this.destroyTimer();
                } else {
                    this.startPlayback();
                }
            });
        }

        if (this.slider) {
            this.slider.addEventListener("input", () => {
                if (!this.currentFrames.length) return;
                const idx = Number(this.slider.value);
                this.renderFrame(idx);

                if (this.timeLabel) {
                    const t = (idx + 1) * FRAME_DURATION_MS / 1000;
                    const totalT = this.currentFrames.length * FRAME_DURATION_MS / 1000;
                    this.timeLabel.textContent = `${t.toFixed(1)}s / ${totalT.toFixed(1)}s`;
                }
            });
        }

        if (this.paletteSelect) {
            this.paletteSelect.addEventListener("change", () => {
                if (!this.currentFrames.length || !this.slider) return;
                const idx = Number(this.slider.value);
                this.renderFrame(idx);
            });
        }

        if (this.dateSelect) {
            this.dateSelect.addEventListener("change", () => {
                this.destroyTimer();
                const value = this.dateSelect.value;
                if (value) {
                    this.setSession(value);
                }
            });
        }
    };

    // -----------------------------
    // 5) Patient dashboard init
    // -----------------------------

    async function initPatientDashboard() {
        if (typeof PATIENT_ID === "undefined") return;
        const patientId = PATIENT_ID;
        const patientMeta = SENSOR_INDEX.patients[patientId];
        if (!patientMeta) return;

        const statusEl = document.getElementById("hmStatusText");
        if (statusEl) statusEl.textContent = "Loading your sessions…";

        const hmDateSel = document.getElementById("hmDate");
        const trendCanvas = document.getElementById("trendChart");

        const kpiOverallLabel = document.getElementById("kpiOverallLabel");
        const kpiLatestPpi = document.getElementById("kpiLatestPpi");
        const kpiLatestContact = document.getElementById("kpiLatestContact");

        const sessions = await loadSessionsForPatient(patientId);
        const dateKeys = Object.keys(sessions).sort();
        if (!dateKeys.length) {
            if (statusEl) statusEl.textContent = "No valid sessions were found for your account.";
            return;
        }

        // Populate date drop-down
        if (hmDateSel) {
            hmDateSel.innerHTML = "";
            for (const d of dateKeys) {
                const opt = document.createElement("option");
                opt.value = d;
                opt.textContent = d;
                hmDateSel.appendChild(opt);
            }
            hmDateSel.value = dateKeys[dateKeys.length - 1];
        }

        // KPIs from most recent session
        const latest = sessions[dateKeys[dateKeys.length - 1]];
        if (kpiLatestPpi) kpiLatestPpi.textContent = latest.ppi.toFixed(0);
        if (kpiLatestContact) kpiLatestContact.textContent = latest.contactPct.toFixed(1) + " %";
        if (kpiOverallLabel) {
            kpiOverallLabel.textContent = latest.alert.label;
            kpiOverallLabel.classList.add(alertClassToBootstrap(latest.alert.cssClass));
        }

        // Trend chart
        if (trendCanvas && window.Charts && Charts.mkCompareChart) {
            const labels = dateKeys;
            const ppiSeries = labels.map(d => sessions[d].ppi);
            const contactSeries = labels.map(d => sessions[d].contactPct);

            const trendChart = Charts.mkCompareChart(
                trendCanvas.getContext("2d"),
                labels,
                ppiSeries,
                contactSeries,
                "Peak Pressure Index",
                "Contact Area %"
            );

            const rangeButtons = document.querySelectorAll('[data-range]');
            rangeButtons.forEach(btn => {
                btn.addEventListener("click", () => {
                    rangeButtons.forEach(b => b.classList.remove("active"));
                    btn.classList.add("active");

                    const range = btn.getAttribute("data-range");
                    let count = labels.length;
                    if (range === "1") count = 1;
                    else if (range === "6") count = Math.min(2, labels.length);
                    else count = labels.length;

                    const subLabels = labels.slice(-count);
                    const subPpi = ppiSeries.slice(-count);
                    const subContact = contactSeries.slice(-count);

                    trendChart.data.labels = subLabels;
                    trendChart.data.datasets[0].data = subPpi;
                    trendChart.data.datasets[1].data = subContact;
                    trendChart.update();
                });
            });
        }

        // Heatmap player for patient
        const player = new HeatmapPlayer({
            canvasId: "heatmapCanvas",
            dateSelectId: "hmDate",
            paletteSelectId: "hmPalette",
            kpiPpiId: "hmKpiPpi",
            kpiContactId: "hmKpiContact",
            kpiStatusId: "hmKpiStatus",
            statusTextId: "hmStatusText",
            captionId: "hmSessionCaption",
            playBtnId: "hmBtnPlay",
            sliderId: "hmFrameSlider",
            timeLabelId: "hmFrameTime",
            sessions,
            patientName: patientMeta.name
        });

        player.bindEvents();

        if (statusEl) statusEl.textContent = "Ready. Playing latest session.";
        player.setSession(hmDateSel ? hmDateSel.value : dateKeys[dateKeys.length - 1]);
    }

    // -----------------------------
    // 6) Clinician dashboard init
    // -----------------------------

    async function initClinicianDashboard() {
        const selPatient = document.getElementById("clinPatient");
        const selDate = document.getElementById("clinDate");
        const selPalette = document.getElementById("clinPalette");
        const trendCanvas = document.getElementById("clinTrendChart");
        const statusEl = document.getElementById("clinHmStatusText");

        if (!selPatient || !selDate || !trendCanvas) return;

        // populate patient list
        selPatient.innerHTML = '<option value="">Choose patient…</option>';
        for (const [id, meta] of Object.entries(SENSOR_INDEX.patients)) {
            const opt = document.createElement("option");
            opt.value = id;
            opt.textContent = `${meta.name} (${id})`;
            selPatient.appendChild(opt);
        }

        let currentPatientId = null;
        let currentSessions = {};
        let currentTrendChart = null;

        // notes controls
        const noteInput = document.getElementById("clinNoteInput");
        const noteSendBtn = document.getElementById("clinNoteSend");

        // Heatmap player wired to clinician IDs
        const player = new HeatmapPlayer({
            canvasId: "clinHeatmapCanvas",
            dateSelectId: "clinDate",
            paletteSelectId: "clinPalette",
            kpiPpiId: "clinKpiPpi",
            kpiContactId: "clinKpiContact",
            kpiStatusId: "clinKpiStatus",
            statusTextId: "clinHmStatusText",
            captionId: "clinHmSessionCaption",
            playBtnId: "clinHmBtnPlay",
            sliderId: "clinHmFrameSlider",
            timeLabelId: "clinHmFrameTime",
            sessions: {},
            patientName: ""
        });

        player.bindEvents();

        selPatient.addEventListener("change", async () => {
            const id = selPatient.value;
            player.destroyTimer();
            player.sessions = {};
            currentSessions = {};
            currentPatientId = id;

            renderRiskFlags({}, "");
            renderClinicianNotes(null);

            if (!id) {
                if (statusEl) statusEl.textContent = "Select a patient and date to load a session heatmap.";
                selDate.innerHTML = '<option value="">Date…</option>';
                if (trendCanvas) {
                    const ctx = trendCanvas.getContext("2d");
                    ctx.clearRect(0, 0, trendCanvas.width, trendCanvas.height);
                }
                return;
            }

            const meta = SENSOR_INDEX.patients[id];
            if (statusEl) statusEl.textContent = `Loading sessions for ${meta.name}…`;

            const sessions = await loadSessionsForPatient(id);
            currentSessions = sessions;
            player.sessions = sessions;
            player.patientName = meta.name;

            const dates = Object.keys(sessions).sort();
            selDate.innerHTML = "";
            for (const d of dates) {
                const opt = document.createElement("option");
                opt.value = d;
                opt.textContent = d;
                selDate.appendChild(opt);
            }
            if (!dates.length) {
                selDate.innerHTML = '<option value="">No sessions</option>';
                if (statusEl) statusEl.textContent = "No sessions for this patient.";
                renderRiskFlags({}, meta.name);
                renderClinicianNotes(id);
                return;
            }
            selDate.value = dates[dates.length - 1];

            // Trend chart for clinician
            if (trendCanvas && window.Charts && Charts.mkCompareChart) {
                const labels = dates;
                const ppiSeries = labels.map(d => sessions[d].ppi);
                const contactSeries = labels.map(d => sessions[d].contactPct);

                const ctx = trendCanvas.getContext("2d");
                if (currentTrendChart) {
                    currentTrendChart.destroy();
                }
                currentTrendChart = Charts.mkCompareChart(
                    ctx,
                    labels,
                    ppiSeries,
                    contactSeries,
                    "Peak Pressure Index",
                    "Contact Area %"
                );

                const rangeButtons = document.querySelectorAll('[data-clin-range]');
                rangeButtons.forEach(btn => {
                    btn.addEventListener("click", () => {
                        rangeButtons.forEach(b => b.classList.remove("active"));
                        btn.classList.add("active");

                        const range = btn.getAttribute("data-clin-range");
                        let count = labels.length;
                        if (range === "1") count = 1;
                        else if (range === "6") count = Math.min(2, labels.length);
                        else count = labels.length;

                        const subLabels = labels.slice(-count);
                        const subPpi = ppiSeries.slice(-count);
                        const subContact = contactSeries.slice(-count);

                        currentTrendChart.data.labels = subLabels;
                        currentTrendChart.data.datasets[0].data = subPpi;
                        currentTrendChart.data.datasets[1].data = subContact;
                        currentTrendChart.update();
                    });
                });
            }

            // Risk flags + notes for this patient
            renderRiskFlags(currentSessions, meta.name);
            renderClinicianNotes(id);

            if (statusEl) statusEl.textContent = "Select a date to view the session heatmap.";
            player.setSession(selDate.value);
        });

        selDate.addEventListener("change", () => {
            const d = selDate.value;
            if (!currentPatientId || !d) return;
            player.destroyTimer();
            player.setSession(d);
        });

        if (selPalette) {
            selPalette.addEventListener("change", () => {
                if (!player.currentFrames.length || !player.slider) return;
                const idx = Number(player.slider.value);
                player.renderFrame(idx);
            });
        }

        // notes send handler
        if (noteSendBtn && noteInput) {
            noteSendBtn.addEventListener("click", () => {
                const text = noteInput.value.trim();
                if (!text || !currentPatientId) return;

                const all = loadAllNotes();
                if (!all[currentPatientId]) all[currentPatientId] = [];

                all[currentPatientId].push({
                    text,
                    ts: Date.now()
                });

                saveAllNotes(all);
                noteInput.value = "";
                renderClinicianNotes(currentPatientId);
            });

            // Optional: send on Enter
            noteInput.addEventListener("keydown", e => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    noteSendBtn.click();
                }
            });
        }
    }

    // -----------------------------
    // 7) Entry point
    // -----------------------------
    document.addEventListener("DOMContentLoaded", function () {
        // Patient dashboard (Index)
        if (typeof PATIENT_ID !== "undefined" && document.getElementById("trendChart")) {
            initPatientDashboard();
        }

        // Clinician dashboard
        if (document.getElementById("clinTrendChart")) {
            initClinicianDashboard();
        }
    });
})();
