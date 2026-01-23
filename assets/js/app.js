// ===== CONFIG =====
const API_BASE = "http://localhost:8000"; // Change this to your backend URL

// ===== STATE MANAGEMENT =====
const state = {
    currentRunId: null,
    currentData: null,
    chart: null,
    chartModalChart: null,
    tooltipElement: null,
};

// ===== UTILITY FUNCTIONS =====

/**
 * Convert an ISO string like "2026-01-15T15:10:00+05:30"
 * into a UTC timestamp (seconds) that preserves the *wall-clock time*
 * shown in the string, without shifting to the viewer's timezone.
 *
 * Example:
 *  "2026-01-15T15:10:00+05:30" -> chart will display 15:10 (not 09:40)
 */
function isoToWallClockUtcSeconds(isoString) {
    // We intentionally IGNORE the offset part (+05:30) for chart display,
    // because the user wants the same time shown in the response.
    //
    // Step 1: Extract "YYYY-MM-DDTHH:mm:ss"
    const base = String(isoString).slice(0, 19); // "2026-01-15T15:10:00"

    // Step 2: Parse components
    const year = parseInt(base.slice(0, 4), 10);
    const month = parseInt(base.slice(5, 7), 10);   // 1-12
    const day = parseInt(base.slice(8, 10), 10);
    const hour = parseInt(base.slice(11, 13), 10);
    const min = parseInt(base.slice(14, 16), 10);
    const sec = parseInt(base.slice(17, 19), 10);

    // Step 3: Create a UTC timestamp for that same wall-clock time
    return Math.floor(Date.UTC(year, month - 1, day, hour, min, sec) / 1000);
}

/**
 * Show error banner with message
 */
function showError(message) {
    const banner = document.getElementById('errorBanner');
    const msgEl = document.getElementById('errorMessage');
    msgEl.textContent = message;
    banner.classList.remove('hidden');
    setTimeout(() => banner.classList.add('hidden'), 6000);
}

/**
 * Show success banner with message
 */
function showSuccess(message) {
    const banner = document.getElementById('successBanner');
    const msgEl = document.getElementById('successMessage');
    msgEl.textContent = message;
    banner.classList.remove('hidden');
    setTimeout(() => banner.classList.add('hidden'), 4000);
}

/**
 * Create tooltip on chart
 */
function createTooltipElement() {
    const tooltip = document.createElement('div');
    tooltip.id = 'tooltip';
    tooltip.className = 'chart-tooltip';
    document.body.appendChild(tooltip);
    return tooltip;
}

/**
 * Show tooltip on chart
 */
// function showTooltip(text, x, y) {
function showTooltip(text) {
    const tooltip = document.getElementById('tooltip') || createTooltipElement();

    tooltip.innerHTML = text.replace(/\n/g, '<br>');
    tooltip.style.display = 'block';

    const margin = 25;

    // measure after visible
    const w = tooltip.offsetWidth || 220;
    const h = tooltip.offsetHeight || 100;

    let x = lastMouse.x + margin + 25;
    let y = lastMouse.y + margin;

    // keep inside viewport
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (x + w + margin > vw) x = lastMouse.x - w - margin;
    if (y + h + margin > vh) y = lastMouse.y - h - margin;

    x = Math.max(margin, Math.min(x, vw - w - margin));
    y = Math.max(margin, Math.min(y, vh - h - margin));

    tooltip.style.left = x + "px";
    tooltip.style.top = y + "px";
}

/**
 * Hide tooltip
 */
function hideTooltip() {
    const tooltip = document.getElementById('tooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
        lastMouse = { x: 0, y: 0 };
    }
}

/**
 * Show/hide loading overlay
 */
function setLoading(isLoading) {
    const overlay = document.getElementById('loadingOverlay');
    if (isLoading) {
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
    }
}

/**
 * Validate form inputs before API call
 */
function validateForm(formData) {
    const errors = [];

    if (!formData.broker) errors.push("Broker is required");
    if (!formData.instrument_id) errors.push("Instrument is required");
    if (!formData.timeframe) errors.push("Timeframe is required");
    if (!formData.start_ist) errors.push("Start time is required");
    if (!formData.end_ist) errors.push("End time is required");

    const startTime = new Date(formData.start_ist).getTime();
    const endTime = new Date(formData.end_ist).getTime();
    if (startTime >= endTime) {
        errors.push("Start time must be before end time");
    }

    if (!formData.capital || formData.capital <= 0) {
        errors.push("Capital must be greater than 0");
    }

    if (!formData.qty || formData.qty <= 0) {
        errors.push("Quantity must be greater than 0");
    }

    if (!formData.strategy) errors.push("Strategy is required");

    return { isValid: errors.length === 0, errors };
}

/**
 * Build API payload from form
 * Uses dynamic strategy params from config.js (readStrategyParamsFromUI)
 */
function buildPayload() {
    const form = document.getElementById('backtestForm');
    const formData = new FormData(form);
    const selectedInstrument = formData.get("instrument_id");
    const instrument_id =
    (!selectedInstrument && window.__strategyDefaultInstrumentId)
        ? window.__strategyDefaultInstrumentId
        : selectedInstrument;

    return {
        broker: formData.get('broker'),
        instrument_id,
        timeframe: formData.get('timeframe'),
        start_ist: formData.get('start_ist'),
        end_ist: formData.get('end_ist'),
        strategy: formData.get('strategy'),

        // ✅ NEW: dynamic params (comes from config.js)
        params: (typeof readStrategyParamsFromUI === "function")
            ? readStrategyParamsFromUI()
            : {},

        capital: parseInt(formData.get('capital')) || 0,
        qty: parseInt(formData.get('qty')) || 0,
        feature_pack: formData.get('feature_pack') || "default"

        // ❌ Remove save_json/save_parquet flags (as per new backend design)
    };
}

/**
 * Call API to run backtest
 */
async function runBacktest() {
    const payload = buildPayload();
    console.log('Running backtest with payload:', payload);
    const validation = validateForm(payload);

    if (!validation.isValid) {
        showError(validation.errors.join(", "));
        return;
    }

    setLoading(true);

    try {
        const response = await fetch(`${API_BASE}/api/backtests/run`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `API Error: ${response.status}`);
        }

        const data = await response.json();
        state.currentRunId = data.run_id;
        state.currentData = data;

        renderResults(data);
        document.getElementById('deleteBtn').disabled = false;
        showSuccess('Backtest completed successfully!');
    } catch (error) {
        showError(`Failed to run backtest: ${error.message}`);
        console.error('API Error:', error);
    } finally {
        setLoading(false);
    }
}

/**
 * Render KPI summary cards
 */
function renderSummary(summary) {
    const formatCurrency = (val) => `₹${(val || 0).toFixed(2)}`;
    const formatPercent = (val) => `${(val || 0).toFixed(1)}%`;

    document.getElementById('kpiTotalTrades').textContent = summary.total_trades || 0;
    document.getElementById('kpiWinRate').textContent = formatPercent(summary.win_rate_pct);
    document.getElementById('kpiWinningTrades').textContent = summary.winning_trades || 0;
    document.getElementById('kpiLosingTrades').textContent = summary.losing_trades || 0;
    document.getElementById('kpiGrossPnl').textContent = formatCurrency(summary.gross_pnl);
    document.getElementById('kpiCharges').textContent = formatCurrency(summary.total_charges);
    
    const netPnlEl = document.getElementById('kpiNetPnl');
    netPnlEl.textContent = formatCurrency(summary.net_pnl);
    netPnlEl.className = 'kpi-value ' + (summary.net_pnl >= 0 ? 'positive' : 'negative');

    document.getElementById('kpiStartingCapital').textContent = formatCurrency(summary.starting_capital);
    document.getElementById('kpiEndingCapital').textContent = formatCurrency(summary.ending_capital);
}

/**
 * Render candlestick chart with trade markers
 */
function renderChart(container, candles, trades) {
    // Clean up old chart
    if (state.chart) {
        state.chart.remove();
    }

    // console.log('Rendering chart with candles:', candles, 'and trades:', trades);

    const chart = LightweightCharts.createChart(container, {
        layout: {
            textColor: '#CBD5E1',
            background: { color: '#0F172A' },
        },
        timeScale: {
            timeVisible: true,
            secondsVisible: false,
        },
        grid: {
            vertLines: { color: 'rgba(71, 85, 105, 0.2)' },
            horzLines: { color: 'rgba(71, 85, 105, 0.2)' },
        },
    });

    const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#10B981',
        downColor: '#EF4444',
        borderUpColor: '#10B981',
        borderDownColor: '#EF4444',
        wickUpColor: '#10B981',
        wickDownColor: '#EF4444',
    });

    // Convert candles
    const chartCandles = candles.map(c => ({
        time: isoToWallClockUtcSeconds(c.ts),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
    }));

    candlestickSeries.setData(chartCandles);

    // Create marker registry for lookup
    const markerRegistry = {};

    const markers = [];
    trades.forEach(trade => {
        const entryTime = isoToWallClockUtcSeconds(trade.entry_ts);
        const exitTime = isoToWallClockUtcSeconds(trade.exit_ts);
        const isProfitable = trade.net_pnl >= 0;

        // console.log('trade signal:', trade.entry_signals_json);
        // console.log('trade signal:', trade.exit_signals_json);
        // console.log('trade signal:', trade.signals_json);

        // Register markers for tooltip lookup
        markerRegistry[entryTime] = { type: 'entry', trade };
        markerRegistry[exitTime] = { type: 'exit', trade };

        // Entry marker
        markers.push({
            time: entryTime,
            position: 'belowBar',
            color: isProfitable ? '#10B981' : '#EF4444',
            shape: 'arrowUp',
            text: `E`
        });

        // Exit marker
        markers.push({
            time: exitTime,
            position: 'aboveBar',
            color: isProfitable ? '#10B981' : '#EF4444',
            shape: 'arrowDown',
            text: `X`
        });
    });

    candlestickSeries.setMarkers(markers);

    // Add hover event to show/hide tooltips
    chart.subscribeCrosshairMove(param => {
        if (param.point === undefined || !param.time || param.point.x < 0 || param.point.y < 0) {
            hideTooltip();
            return;
        } else {
            const data = param.seriesData.get(candlestickSeries);

            // Double check data exists
            if (!data) {
                hideTooltip();
                return;
            }

            // Format OHLC
            let tooltipText = `O: ₹${data.open.toFixed(2)}\nH: ₹${data.high.toFixed(2)}\nL: ₹${data.low.toFixed(2)}\nC: ₹${data.close.toFixed(2)}`;

            // Add marker info if exists
            if (param.time && markerRegistry[param.time]) {
                const markerInfo = markerRegistry[param.time];
                const trade = markerInfo.trade;

                if (markerInfo.type === 'entry') {
                    tooltipText += `\n\nEntry Signal\nPrice: ₹${trade.entry_price.toFixed(2)}\nP&L: ₹${trade.net_pnl.toFixed(2)}`;
                } else if (markerInfo.type === 'exit') {
                    tooltipText += `\n\nExit Signal\nPrice: ₹${trade.exit_price.toFixed(2)}\nP&L: ₹${trade.net_pnl.toFixed(2)}`;
                }
            }
            // showTooltip(tooltipText, param.point.x, param.point.y);
            showTooltip(tooltipText);
        }
    });

    chart.timeScale().fitContent();

    state.chart = chart;
    return chart;
}

/**
 * Render chart in modal with separate instance
 */
function renderChartInModal(container, candles, trades) {
    const chart = LightweightCharts.createChart(container, {
        layout: {
            textColor: '#CBD5E1',
            background: { color: '#0F172A' },
        },
        timeScale: {
            timeVisible: true,
            secondsVisible: false,
        },
        grid: {
            vertLines: { color: 'rgba(71, 85, 105, 0.2)' },
            horzLines: { color: 'rgba(71, 85, 105, 0.2)' },
        },
    });

    const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#10B981',
        downColor: '#EF4444',
        borderUpColor: '#10B981',
        borderDownColor: '#EF4444',
        wickUpColor: '#10B981',
        wickDownColor: '#EF4444',
    });

    const chartCandles = candles.map(c => ({
        time: isoToWallClockUtcSeconds(c.ts),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
    }));

    candlestickSeries.setData(chartCandles);

    // Create marker registry for lookup
    const markerRegistry = {};

    const markers = [];
    trades.forEach(trade => {
        const entryTime = isoToWallClockUtcSeconds(trade.entry_ts);
        const exitTime = isoToWallClockUtcSeconds(trade.exit_ts);
        const isProfitable = trade.net_pnl >= 0;

        // Register markers for tooltip lookup
        markerRegistry[entryTime] = { type: 'entry', trade };
        markerRegistry[exitTime] = { type: 'exit', trade };

        // Entry marker
        markers.push({
            time: entryTime,
            position: 'belowBar',
            color: isProfitable ? '#10B981' : '#EF4444',
            shape: 'arrowUp',
            text: `E`
        });

        // Exit marker
        markers.push({
            time: exitTime,
            position: 'aboveBar',
            color: isProfitable ? '#10B981' : '#EF4444',
            shape: 'arrowDown',
            text: `X`
        });
    });

    candlestickSeries.setMarkers(markers);

    // Add hover event to show/hide tooltips
    chart.subscribeCrosshairMove(param => {
        if (param.point === undefined || !param.time || param.point.x < 0 || param.point.y < 0) {
            hideTooltip();
            return;
        } else {
            const data = param.seriesData.get(candlestickSeries);

            // Double check data exists
            if (!data) {
                console.log('2 nd Hiding tooltip actively');
                hideTooltip();
                return;
            }

            // Format OHLC
            let tooltipText = `O: ₹${data.open.toFixed(2)}\nH: ₹${data.high.toFixed(2)}\nL: ₹${data.low.toFixed(2)}\nC: ₹${data.close.toFixed(2)}`;

            // Add marker info if exists
            if (param.time && markerRegistry[param.time]) {
                const markerInfo = markerRegistry[param.time];
                const trade = markerInfo.trade;

                if (markerInfo.type === 'entry') {
                    tooltipText += `\n\nEntry Signal\nPrice: ₹${trade.entry_price.toFixed(2)}\nP&L: ₹${trade.net_pnl.toFixed(2)}`;
                } else if (markerInfo.type === 'exit') {
                    tooltipText += `\n\nExit Signal\nPrice: ₹${trade.exit_price.toFixed(2)}\nP&L: ₹${trade.net_pnl.toFixed(2)}`;
                }
            }
            // showTooltip(tooltipText, param.point.x, param.point.y);
            showTooltip(tooltipText);
        }
    });

    chart.timeScale().fitContent();

    return chart;
}

/**
 * Render trades table
 */
function renderTradesTable(trades) {
    const tbody = document.getElementById('tradesTableBody');
    tbody.innerHTML = '';

    trades.forEach((trade, idx) => {
        const row = document.createElement('tr');
        const isProfitable = trade.net_pnl >= 0;

        row.innerHTML = `
            <td>${new Date(trade.entry_ts).toLocaleString('en-IN')}</td>
            <td>₹${(trade.entry_price || 0).toFixed(2)}</td>
            <td>${new Date(trade.exit_ts).toLocaleString('en-IN')}</td>
            <td>₹${(trade.exit_price || 0).toFixed(2)}</td>
            <td>${trade.qty || 1}</td>
            <td>₹${(trade.gross_pnl || 0).toFixed(2)}</td>
            <td>₹${(trade.charges || 0).toFixed(2)}</td>
            <td class="trade-pnl ${isProfitable ? 'positive' : 'negative'}">₹${(trade.net_pnl || 0).toFixed(2)}</td>
            <td>
                <button class="btn btn-sm btn-outline btn-view-signals" onclick="openSignalsModal(${idx})">
                    Signals
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

/**
 * Open signals modal for a trade
 */
function openSignalsModal(tradeIdx) {
    const trade = state.currentData.trades[tradeIdx];
    const content = document.getElementById('signalsContent');

    let html = '';

    if (trade.signals_json) {
        try {
            const parsedSignals = JSON.parse(trade.signals_json);
            html += `
                <div class="signal-section">
                    <div class="signal-section-title">Main Signals</div>
                    <div class="signal-json">${JSON.stringify(parsedSignals, null, 2)}</div>
                </div>
            `;
        } catch (e) {
            console.error('Error parsing signals_json:', e);
        }
    }

    if (trade.entry_signals_json) {
        try {
            const parsedEntrySignals = JSON.parse(trade.entry_signals_json);
            html += `
                <div class="signal-section">
                    <div class="signal-section-title">Entry Signals</div>
                    <div class="signal-json">${JSON.stringify(parsedEntrySignals, null, 2)}</div>
                </div>
            `;
        } catch (e) {
            console.error('Error parsing entry_signals_json:', e);
        }
    }

    if (trade.exit_signals_json) {
        try {
            const parsedExitSignals = JSON.parse(trade.exit_signals_json);
            html += `
                <div class="signal-section">
                    <div class="signal-section-title">Exit Signals</div>
                    <div class="signal-json">${JSON.stringify(parsedExitSignals, null, 2)}</div>
                </div>
            `;
        } catch (e) {
            console.error('Error parsing exit_signals_json:', e);
        }
    }

    content.innerHTML = html || '<p style="color: var(--color-text-secondary);">No signal data available</p>';
    openModal('signalsModal');
}

/**
 * Render all results
 */
function renderResults(data) {
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('resultsContainer').classList.remove('hidden');

    renderSummary(data.summary);
    renderChart(document.getElementById('chartContainer'), data.candles, data.trades);
    renderTradesTable(data.trades);
}

/**
 * Open modal by ID
 */
function openModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
}

/**
 * Close modal by ID
 */
function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

/**
 * Delete run
 */
async function deleteRun() {
    if (!state.currentRunId) {
        showError("No run to delete");
        return;
    }

    const confirmMsg = document.getElementById('confirmMessage');
    confirmMsg.textContent = `Are you sure you want to delete run ${state.currentRunId}? This action cannot be undone.`;
    openModal('confirmDialog');

    // Setup confirm buttons
    document.getElementById('confirmOk').onclick = async () => {
        closeModal('confirmDialog');
        setLoading(true);

        try {
            const response = await fetch(`${API_BASE}/api/backtests/${state.currentRunId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error(`Delete failed: ${response.status}`);
            }

            state.currentRunId = null;
            state.currentData = null;
            document.getElementById('deleteBtn').disabled = true;
            document.getElementById('resultsContainer').classList.add('hidden');
            document.getElementById('emptyState').classList.remove('hidden');

            showSuccess('Run deleted successfully');
        } catch (error) {
            showError(`Failed to delete run: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    document.getElementById('confirmCancel').onclick = () => {
        closeModal('confirmDialog');
    };
}

function enlargeChart() {
    openModal('chartModal');
    setTimeout(() => {
        const container = document.getElementById('chartModalContainer');
        if (state.currentData) {
            // Re-render chart in modal  // ← ADDED COMMENT
            if (state.chartModalChart) {  // ← ADDED: Clean up old chart
                state.chartModalChart.remove();
            }
            state.chartModalChart = renderChartInModal(container, state.currentData.candles, state.currentData.trades);  // ← CHANGED: Use separate function
        }
    }, 100);
}

// ===== EVENT LISTENERS =====

// mouse move for tooltip positioning
const chartContainer = document.getElementById("chartContainer");
const chartModalContainer = document.getElementById("chartModalContainer");

let lastMouse = { x: 0, y: 0 };

chartContainer.addEventListener("mousemove", (e) => {
    lastMouse.x = e.clientX;   // viewport coords
    lastMouse.y = e.clientY;
});

chartModalContainer.addEventListener("mousemove", (e) => {
    lastMouse.x = e.clientX;   // viewport coords
    lastMouse.y = e.clientY;
});

chartContainer.addEventListener("mouseleave", () => {
    hideTooltip();
});

// Form submission
document.getElementById('backtestForm').addEventListener('submit', (e) => {
    e.preventDefault();
    runBacktest();
});

// Delete button
document.getElementById('deleteBtn').addEventListener('click', deleteRun);

// Enlarge chart button
document.getElementById('enlargeChartBtn').addEventListener('click', enlargeChart);

// Modal close buttons
document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const modalId = e.target.getAttribute('data-modal');
        closeModal(modalId);
        // Re-render main chart when closing modal  // ← ADDED
        if (modalId === 'chartModal' && state.currentData) {
            setTimeout(() => {
                renderChart(document.getElementById('chartContainer'), state.currentData.candles, state.currentData.trades);
            }, 100);
        }
    });
});

// Back to Top Button
const backToTopBtn = document.getElementById('backToTopBtn');
const contentArea = document.querySelector('.content-area');

contentArea.addEventListener('scroll', () => {
    if (contentArea.scrollTop > 300) {
        backToTopBtn.classList.remove('hidden');
    } else {
        backToTopBtn.classList.add('hidden');
    }
});

backToTopBtn.addEventListener('click', () => {
    contentArea.scrollTo({ top: 0, behavior: 'smooth' });
});

// Close modal on ESC key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal').forEach(modal => {
            if (!modal.classList.contains('hidden')) {
                const modalId = modal.id;  // ← ADDED
                modal.classList.add('hidden');
                // Re-render main chart when closing modal with ESC  // ← ADDED
                if (modalId === 'chartModal' && state.currentData) {
                    setTimeout(() => {
                        renderChart(document.getElementById('chartContainer'), state.currentData.candles, state.currentData.trades);
                    }, 100);
                }
            }
        });
    }
});

// ===== INITIALIZATION =====

// Optional: Load dummy data on startup for testing (comment out for production)
// Uncomment the line below to test the UI with dummy data
// window.addEventListener('load', () => { state.currentData = DUMMY_RESPONSE; renderResults(DUMMY_RESPONSE); document.getElementById('deleteBtn').disabled = false; });
// 