/* ============================================================================
   levels.js
   S/R Levels Viewer
   - Fetch candles from /api/marketdata/candles/features (OHLCV only)
   - Fetch levels from /api/levels/zones
   - Draw zones as rectangles on a canvas overlay above LightweightCharts
   ============================================================================ */

// ===== CONFIG =====
// const API_BASE = "http://localhost:8000"; // Change this to your backend URL
const API_BASE = "https://api.beplusalgo.trade";  // Production backend URL

const UI_OPTIONS_PATH = "./config/ui-options.json";

// Backend endpoints (relative to API base)
const ENDPOINT_CANDLES = "/api/marketdata/candles/features";
const ENDPOINT_LEVELS = "/api/levels/zones"; // adjust only if your API path differs

// Chart globals
let chart = null;
let candleSeries = null;

// Stored latest data
let latestCandles = [];      // raw market rows
let latestLevels = null;     // levels response (supports/resistances)
let latestVisibleRange = null;

// Overlay canvas
let overlayCanvas = null;
let overlayCtx = null;

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------
function $(id) {
    return document.getElementById(id);
}

function showLoading(text) {
    $("loadingText").textContent = text || "Working...";
    $("loadingOverlay").classList.remove("hidden");
}

function hideLoading() {
    $("loadingOverlay").classList.add("hidden");
}

function showError(msg) {
    $("errorMessage").textContent = msg || "Something went wrong.";
    $("errorBanner").classList.remove("hidden");
}

function hideError() {
    $("errorBanner").classList.add("hidden");
}

function showSuccess(msg) {
    $("successMessage").textContent = msg || "Done.";
    $("successBanner").classList.remove("hidden");
    // Auto-hide success after a short moment (keeps UI clean)
    setTimeout(() => $("successBanner").classList.add("hidden"), 2200);
}

function setResultsVisible(visible) {
    if (visible) {
        $("results").classList.remove("hidden");
        $("emptyState").classList.add("hidden");
    } else {
        $("results").classList.add("hidden");
        $("emptyState").classList.remove("hidden");
    }
}

function forceChartResizeAndRedraw() {
    if (!chart || !candleSeries) return;

    const container = $("chartContainer");
    const w = container.clientWidth;
    const h = container.clientHeight;

    if (w > 0 && h > 0) {
        chart.applyOptions({ width: w, height: h });
        chart.timeScale().fitContent();
        resizeOverlay();
        drawZonesOverlay();
    }
}

// ---------------------------------------------------------------------------
// API base resolution
// ---------------------------------------------------------------------------
function getApiBase() {
    // If user typed it, use it
    const typed = ($("apiBase").value || "").trim();
    if (typed) return typed.replace(/\/+$/, "");

    // Else, use same-origin (works if you host frontend behind same domain)
    return window.location.origin.replace(/\/+$/, "");
}

async function postJson(url, payload) {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    const text = await res.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        // ignore JSON parse error; keep raw text for debugging
    }

    if (!res.ok) {
        const detail = (data && (data.detail || data.message)) ? (data.detail || data.message) : text;
        throw new Error(`HTTP ${res.status}: ${detail}`);
    }

    return data;
}

// ---------------------------------------------------------------------------
// Timeframe + lookback helpers
// ---------------------------------------------------------------------------
function parseTimeframeToMs(tf) {
    // Supports: 1m, 3m, 5m, 15m, 1h, 4h, 1d, 1w (if you add it later)
    const m = String(tf || "").trim().match(/^(\d+)\s*([mhdw])$/i);
    if (!m) return null;

    const n = Number(m[1]);
    const unit = m[2].toLowerCase();

    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const week = 7 * day;

    if (unit === "m") return n * minute;
    if (unit === "h") return n * hour;
    if (unit === "d") return n * day;
    if (unit === "w") return n * week;

    return null;
}

function dtLocalToApiString(dtLocalValue) {
    // input from <input type="datetime-local"> gives "YYYY-MM-DDTHH:mm"
    // backend expects string like "YYYY-MM-DD HH:mm" or ISO-ish; we send "YYYY-MM-DD HH:mm"
    if (!dtLocalValue) return "";
    return dtLocalValue.replace("T", " ");
}

function computeStartFromLookback(endLocal, tf, candles) {
    const tfMs = parseTimeframeToMs(tf);
    if (!tfMs) return null;
    const n = Number(candles);
    if (!Number.isFinite(n) || n <= 0) return null;

    const endMs = new Date(endLocal).getTime();
    if (!Number.isFinite(endMs)) return null;

    const startMs = endMs - (n * tfMs);
    const d = new Date(startMs);

    // Convert to "YYYY-MM-DDTHH:mm" for displaying back into datetime-local style
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function getSelectedRangeMode() {
    const radios = document.querySelectorAll("input[name='rangeMode']");
    for (const r of radios) {
        if (r.checked) return r.value;
    }
    return "range";
}

function getRangeInputs() {
    const mode = getSelectedRangeMode();
    const tf = $("timeframe").value;

    if (mode === "range") {
        const startLocal = $("startIst").value;
        const endLocal = $("endIst").value;
        return {
            start_ist: dtLocalToApiString(startLocal),
            end_ist: dtLocalToApiString(endLocal),
        };
    }

    // lookback mode
    const endLocal = $("endIst2").value;
    const nCandles = $("lookbackCandles").value;

    if (!endLocal || !nCandles) {
        return { start_ist: "", end_ist: "" };
    }

    const computedStartLocal = computeStartFromLookback(endLocal, tf, nCandles);
    if (computedStartLocal) {
        $("computedStart").value = computedStartLocal.replace("T", " ");
        return {
            start_ist: dtLocalToApiString(computedStartLocal),
            end_ist: dtLocalToApiString(endLocal),
        };
    }

    return { start_ist: "", end_ist: "" };
}

// ---------------------------------------------------------------------------
// UI Options loading (broker / instrument from ui-options.json)
// ---------------------------------------------------------------------------
function fillSelect(selectEl, items) {
    selectEl.innerHTML = "";

    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "-- Select --";
    opt0.disabled = true;
    opt0.selected = true;
    selectEl.appendChild(opt0);

    let defaultValue = "";
    (items || []).forEach(item => {
        const opt = document.createElement("option");
        opt.value = item.id;
        opt.textContent = item.label || item.id;
        selectEl.appendChild(opt);
        if (item.default === true) defaultValue = item.id;
    });

    if (defaultValue) selectEl.value = defaultValue;
}

async function loadUiOptions() {
    const res = await fetch(UI_OPTIONS_PATH, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load ui-options.json (HTTP ${res.status})`);

    const cfg = await res.json();
    fillSelect($("broker"), cfg.brokers || []);
    fillSelect($("instrument"), cfg.instruments || []);
}

// ---------------------------------------------------------------------------
// Chart setup + overlay drawing
// ---------------------------------------------------------------------------
function ensureChart() {
    if (chart && candleSeries) return;

    const container = $("chartContainer");
    container.innerHTML = "";

    chart = LightweightCharts.createChart(container, {
        width: container.clientWidth,
        height: container.clientHeight,
        layout: {
            background: { type: "solid", color: "#0b0f14" },
            textColor: "#d1d5db",
        },
        grid: {
            vertLines: { color: "rgba(255,255,255,0.06)" },
            horzLines: { color: "rgba(255,255,255,0.06)" },
        },
        rightPriceScale: { borderColor: "rgba(255,255,255,0.1)" },
        timeScale: { borderColor: "rgba(255,255,255,0.1)" },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
        },
    });

    candleSeries = chart.addCandlestickSeries({
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderVisible: false,
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
    });

    // Overlay canvas (zones)
    overlayCanvas = $("zoneOverlay");
    overlayCtx = overlayCanvas.getContext("2d");

    // Resize overlay to match container
    resizeOverlay();

    // Redraw zones when visible range changes (zoom/pan)
    chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
        latestVisibleRange = range || null;
        drawZonesOverlay();
    });

    // Redraw on resize
    window.addEventListener("resize", () => {
        chart.applyOptions({
            width: container.clientWidth,
            height: container.clientHeight,
        });
        resizeOverlay();
        drawZonesOverlay();
    });
}

function resizeOverlay() {
    const wrap = $("chartContainer");
    const rect = wrap.getBoundingClientRect();
    overlayCanvas.width = Math.floor(rect.width * window.devicePixelRatio);
    overlayCanvas.height = Math.floor(rect.height * window.devicePixelRatio);
    overlayCanvas.style.width = `${Math.floor(rect.width)}px`;
    overlayCanvas.style.height = `${Math.floor(rect.height)}px`;
    overlayCtx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
}

function normalizeStrength(zones) {
    // zones are objects that include "strength"
    const arr = (zones || []).map(z => Number(z.strength)).filter(v => Number.isFinite(v));
    if (arr.length === 0) return { min: 0, max: 1 };
    return { min: Math.min(...arr), max: Math.max(...arr) };
}

function colorForZone(type, strength, min, max) {
    // Stronger => darker (higher alpha + slightly darker border)
    const t = (max > min) ? ((strength - min) / (max - min)) : 1.0;
    const clamped = Math.max(0, Math.min(1, t));

    // Support = green-ish, Resistance = red-ish
    if (type === "support") {
        const fillA = 0.12 + 0.28 * clamped;   // 0.12..0.40
        const borderA = 0.30 + 0.50 * clamped; // 0.30..0.80
        return {
            fill: `rgba(46, 204, 113, ${fillA.toFixed(3)})`,
            border: `rgba(46, 204, 113, ${borderA.toFixed(3)})`,
            text: "rgba(235, 255, 245, 0.90)",
        };
    }

    const fillA = 0.12 + 0.28 * clamped;   // 0.12..0.40
    const borderA = 0.30 + 0.50 * clamped; // 0.30..0.80
    return {
        fill: `rgba(231, 76, 60, ${fillA.toFixed(3)})`,
        border: `rgba(231, 76, 60, ${borderA.toFixed(3)})`,
        text: "rgba(255, 238, 238, 0.90)",
    };
}

function getVisibleXRangePx() {
    // We draw rectangles across the visible chart area.
    // If we have visible range, map it; otherwise fallback to full width.
    const w = $("chartContainer").clientWidth;

    try {
        const ts = chart.timeScale();
        const range = ts.getVisibleRange ? ts.getVisibleRange() : null;
        if (!range || !range.from || !range.to) {
            return { x1: 0, x2: w };
        }

        const x1 = ts.timeToCoordinate(range.from);
        const x2 = ts.timeToCoordinate(range.to);

        if (x1 === null || x2 === null) return { x1: 0, x2: w };
        return { x1: Math.min(x1, x2), x2: Math.max(x1, x2) };
    } catch {
        return { x1: 0, x2: w };
    }
}

function drawOneZoneRect(zone, type, strengthRange) {
    // Convert prices to y coords
    const yHigh = candleSeries.priceToCoordinate(zone.zone_high);
    const yLow = candleSeries.priceToCoordinate(zone.zone_low);

    // console.log(`Drawing ${type} zone: ${zone.zone_low}–${zone.zone_high} (strength=${zone.strength}) => y: ${yLow}–${yHigh}`);

    if (yHigh === null || yLow === null) return;

    const top = Math.min(yHigh, yLow);
    let height = Math.abs(yHigh - yLow);
    if (height < 2) height = 2;

    // X span across visible range
    const xr = getVisibleXRangePx();
    const x = xr.x1;
    const width = xr.x2 - xr.x1;

    const colors = colorForZone(type, Number(zone.strength), strengthRange.min, strengthRange.max);

    // Fill + border
    overlayCtx.fillStyle = colors.fill;
    overlayCtx.strokeStyle = colors.border;
    overlayCtx.lineWidth = 2;

    overlayCtx.beginPath();
    overlayCtx.rect(x, top, width, height);
    overlayCtx.fill();
    overlayCtx.stroke();

    // Label inside the zone (top-left)
    const label = `${type.toUpperCase()} ${zone.zone_low}–${zone.zone_high}`;
    overlayCtx.font = "12px Inter, system-ui, sans-serif";
    overlayCtx.fillStyle = colors.text;

    // Put the text slightly inside the rectangle
    const tx = x + 10;
    const ty = top + 18;

    // Basic text background to improve readability
    overlayCtx.save();
    overlayCtx.globalAlpha = 0.25;
    overlayCtx.fillStyle = "rgba(0,0,0,1)";
    overlayCtx.fillRect(tx - 6, ty - 14, overlayCtx.measureText(label).width + 12, 18);
    overlayCtx.restore();

    overlayCtx.fillStyle = colors.text;
    overlayCtx.fillText(label, tx, ty);
}

function drawZonesOverlay() {
    if (!overlayCtx || !chart || !candleSeries) return;

    // Clear overlay
    overlayCtx.clearRect(
        0,
        0,
        overlayCanvas.width / window.devicePixelRatio,
        overlayCanvas.height / window.devicePixelRatio
    );

    if (!latestLevels) return;

    const supports = latestLevels.supports || [];
    const resistances = latestLevels.resistances || [];

    const supRange = normalizeStrength(supports);
    const resRange = normalizeStrength(resistances);

    // Draw supports first, resistances second (so resistances appear “above” if they overlap)
    supports.forEach(z => drawOneZoneRect(z, "support", supRange));
    resistances.forEach(z => drawOneZoneRect(z, "resistance", resRange));
}

// ---------------------------------------------------------------------------
// Render tables
// ---------------------------------------------------------------------------
function renderZonesTable(tableId, zones) {
    const tbody = $(tableId).querySelector("tbody");
    tbody.innerHTML = "";

    (zones || []).forEach((z, idx) => {
        const tr = document.createElement("tr");

        const range = `${z.zone_low} – ${z.zone_high}`;
        const lastTouch = z.last_touch || "-";
        const rej = (z.rejection_score !== undefined && z.rejection_score !== null) ? z.rejection_score : "-";
        const strength = (z.strength !== undefined && z.strength !== null) ? z.strength : "-";

        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td>${range}</td>
            <td>${z.touches ?? "-"}</td>
            <td>${lastTouch}</td>
            <td>${rej}</td>
            <td>${strength}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ---------------------------------------------------------------------------
// Fetch Market Data (OHLCV only)
// ---------------------------------------------------------------------------
async function fetchMarketData() {
    hideError();

    const broker = $("broker").value;
    const instrument_id = $("instrument").value;
    const timeframe = $("timeframe").value;

    const { start_ist, end_ist } = getRangeInputs();
    if (!start_ist || !end_ist) {
        throw new Error("Please provide a valid date range OR lookback candles + end time.");
    }

    const apiBase = getApiBase();
    const url = `${API_BASE}${ENDPOINT_CANDLES}`;

    // IMPORTANT: indicators: [] means "OHLCV only" (as per your CandleFeaturesPayload behavior)
    const payload = {
        broker,
        instrument_id,
        timeframe,
        start_ist,
        end_ist,
        indicators: [],
        use_cache: true,
        include_meta: true,
    };

    showLoading("Fetching market data...");
    const data = await postJson(url, payload);

    latestCandles = (data && data.rows) ? data.rows : [];
    if (!Array.isArray(latestCandles) || latestCandles.length === 0) {
        throw new Error("No candle data returned. Try a different range/timeframe.");
    }

    // Convert into LightweightCharts format
    // LightweightCharts expects: { time: unixSeconds, open, high, low, close }
    const candlesLC = latestCandles.map(r => {
        const ts = new Date(r.ts_ist).getTime() / 1000;
        return {
            time: Math.floor(ts),
            open: Number(r.open),
            high: Number(r.high),
            low: Number(r.low),
            close: Number(r.close),
        };
    });

    ensureChart();
    candleSeries.setData(candlesLC);

    hideLoading();
    showSuccess(`Market data loaded (${latestCandles.length} candles).`);
    setResultsVisible(true);

    // ✅ Wait one paint so browser computes layout, then resize chart correctly
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            forceChartResizeAndRedraw();
        });
    });

    // After candle data is present, redraw zones overlay if levels already exist
    drawZonesOverlay();

    return data;
}

// ---------------------------------------------------------------------------
// Run Levels
// ---------------------------------------------------------------------------
async function runLevels() {
    hideError();

    const broker = $("broker").value;
    const instrument_id = $("instrument").value;
    const timeframe = $("timeframe").value;

    const { start_ist, end_ist } = getRangeInputs();
    if (!start_ist || !end_ist) {
        throw new Error("Please provide a valid date range OR lookback candles + end time.");
    }

    const apiBase = getApiBase();
    const url = `${API_BASE}${ENDPOINT_LEVELS}`;

    // Engine params
    const payload = {
        broker,
        instrument_id,
        timeframe,
        start_ist,
        end_ist,

        // engine knobs (match your python function args)
        pivot_n: Number($("pivotN").value || 2),
        lookback_bars: Number($("lookbackBars").value || 260),
        atr_period: Number($("atrPeriod").value || 14),
        tol_mode: $("tolMode").value || "atr",
        tol_atr_mult: Number($("tolAtrMult").value || 0.7),
        tol_pct: Number($("tolPct").value || 0.004),
        top_n_each: Number($("topNEach").value || 5),
        min_touches: Number($("minTouches").value || 2),
    };

    showLoading("Running levels engine...");
    const data = await postJson(url, payload);

    // Expected response (based on your python return):
    // { last_close, tolerance_used, pivot_n, supports: [...], resistances: [...] }
    // If your backend returns pandas DF serialized, it will still be list-of-dicts.
    // Backend returns: { run_id, meta, result }
    const result = (data && data.result) ? data.result : data;

    latestLevels = {
        last_close: result.last_close,
        tolerance_used: result.tolerance_used,
        pivot_n: result.pivot_n,
        supports: Array.isArray(result.supports) ? result.supports : [],
        resistances: Array.isArray(result.resistances) ? result.resistances : [],
    };

    // (optional but useful) store meta for display
    let latestLevelsMeta = data && data.meta ? data.meta : null;
    let latestLevelsRunId = data && data.run_id ? data.run_id : "";

    // Render tables
    renderZonesTable("supportTable", latestLevels.supports);
    renderZonesTable("resistanceTable", latestLevels.resistances);

    // Meta
    $("runMeta").textContent = `run_id=${latestLevelsRunId || "-"} | last_close=${latestLevels.last_close} | tolerance=${latestLevels.tolerance_used} | pivot_n=${latestLevels.pivot_n}`;

    hideLoading();
    showSuccess(`Levels computed. Supports=${latestLevels.supports.length}, Resistances=${latestLevels.resistances.length}`);
    setResultsVisible(true);

    // ✅ Wait one paint so browser computes layout, then resize chart correctly
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            forceChartResizeAndRedraw();
        });
    });

    // Draw rectangles
    drawZonesOverlay();

    return data;
}

// ---------------------------------------------------------------------------
// Range mode UI wiring
// ---------------------------------------------------------------------------
function setRangeModeUI(mode) {
    if (mode === "lookback") {
        $("rangeBlock").classList.add("hidden");
        $("lookbackBlock").classList.remove("hidden");

        // In lookback mode, range inputs should not be required
        $("startIst").removeAttribute("required");
        $("endIst").removeAttribute("required");
    } else {
        $("rangeBlock").classList.remove("hidden");
        $("lookbackBlock").classList.add("hidden");

        $("startIst").setAttribute("required", "required");
        $("endIst").setAttribute("required", "required");
    }
}

function wireRangeMode() {
    const radios = document.querySelectorAll("input[name='rangeMode']");
    radios.forEach(r => {
        r.addEventListener("change", () => setRangeModeUI(getSelectedRangeMode()));
    });

    // compute start preview live when in lookback mode
    $("lookbackCandles").addEventListener("input", () => {
        const mode = getSelectedRangeMode();
        if (mode !== "lookback") return;

        const endLocal = $("endIst2").value;
        const tf = $("timeframe").value;
        const n = $("lookbackCandles").value;

        if (!endLocal || !n) {
            $("computedStart").value = "";
            return;
        }

        const startLocal = computeStartFromLookback(endLocal, tf, n);
        $("computedStart").value = startLocal ? startLocal.replace("T", " ") : "";
    });

    $("endIst2").addEventListener("input", () => {
        const evt = new Event("input");
        $("lookbackCandles").dispatchEvent(evt);
    });

    $("timeframe").addEventListener("change", () => {
        const evt = new Event("input");
        $("lookbackCandles").dispatchEvent(evt);
    });

    // default
    setRangeModeUI(getSelectedRangeMode());
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
    try {
        $("errorClose").addEventListener("click", hideError);

        // load dropdowns
        await loadUiOptions();

        // range mode
        wireRangeMode();

        // buttons
        $("btnFetch").addEventListener("click", async () => {
            try {
                await fetchMarketData();
            } catch (e) {
                hideLoading();
                showError(e.message || String(e));
            }
        });

        $("btnLevels").addEventListener("click", async () => {
            try {
                // If candles not fetched yet, still allow levels run (backend will fetch internally),
                // but drawing zones needs chart/candles. So we do: fetch candles first if missing.
                if (!latestCandles || latestCandles.length === 0) {
                    await fetchMarketData();
                }
                await runLevels();
            } catch (e) {
                hideLoading();
                showError(e.message || String(e));
            }
        });

        $("levelsForm").addEventListener("submit", async (e) => {
            e.preventDefault();
            try {
                await fetchMarketData();
                await runLevels();
            } catch (err) {
                hideLoading();
                showError(err.message || String(err));
            }
        });

    } catch (e) {
        showError(e.message || String(e));
    }
});
