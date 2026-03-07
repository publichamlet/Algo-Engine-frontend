// ===== CONFIG =====
const API_BASE = "http://localhost:8000"; // Change this to your backend URL
// const API_BASE = "https://api.beplusalgo.trade";  // Production backend URL

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
 * Check whether current viewport should use drawer behavior.
 */
function isDrawerViewport() {
    return window.innerWidth <= 1200;
}

/**
 * Open form drawer for tablet/mobile view.
 */
function openFormDrawer() {
    const sidebar = document.getElementById('formSidebar');
    const overlay = document.getElementById('formDrawerOverlay');

    if (!isDrawerViewport()) return;

    if (sidebar) {
        sidebar.classList.add('drawer-open');
    }

    if (overlay) {
        overlay.classList.remove('hidden');
    }

    document.body.classList.add('drawer-active');
}

/**
 * Close form drawer for tablet/mobile view.
 */
function closeFormDrawer() {
    const sidebar = document.getElementById('formSidebar');
    const overlay = document.getElementById('formDrawerOverlay');

    if (sidebar) {
        sidebar.classList.remove('drawer-open');
    }

    if (overlay) {
        overlay.classList.add('hidden');
    }

    document.body.classList.remove('drawer-active');
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

    const strategy = formData.get('strategy');

    // Dynamic params (from ui_options.js)
    const rawParams = (typeof readStrategyParamsFromUI === "function")
        ? readStrategyParamsFromUI()
        : {};

    // Strategy-specific UI rules requested:
    // - Stable: no params should be sent (or empty object; backend can treat missing == defaults)
    // - Turbo: send only { overnight_mode: ... }
    let paramsToSend = rawParams;
    if (strategy === "beplus_momentum_stable") {
        paramsToSend = null; // omit in payload
    } else if (strategy === "beplus_momentum_turbo") {
        paramsToSend = {
            overnight_mode: rawParams.overnight_mode || "all",
        };
    } else if (strategy === "beplus_momentum_breakout") {
        paramsToSend = null; // omit in payload
    }

    // Auto-set HA flags + feature pack (based on CLI tests) for both Stable and Turbo.
    const isMomentum = (strategy === "beplus_momentum_stable" || strategy === "beplus_momentum_turbo");

    const payload = {
        broker: formData.get('broker'),
        instrument_id,
        timeframe: formData.get('timeframe'),
        start_ist: formData.get('start_ist'),
        end_ist: formData.get('end_ist'),
        strategy,

        capital: parseInt(formData.get('capital')) || 0,
        qty: parseInt(formData.get('qty')) || 0,

        // Default from UI unless overridden
        feature_pack: formData.get('feature_pack') || "default"
    };

    if (isMomentum) {
        payload.feature_pack = "none";
        payload.candle_mode = "heikin_ashi";
        payload.execution_price_source = "heikin_ashi";
    }

    if (paramsToSend && Object.keys(paramsToSend).length > 0) {
        payload.params = paramsToSend;
    }

    return payload;
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

    // Close the parameter drawer FIRST on tablet/mobile,
    // then show the loading overlay above the page.
    if (isDrawerViewport()) {
        closeFormDrawer();
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

/**
 * Render KPI summary cards directly from backend response.
 *
 * IMPORTANT:
 * - Backend now returns both `summary` and `kpis`.
 * - Frontend should NOT calculate KPI values from trades anymore.
 * - Frontend should only format and display response values.
 */
function renderSummary(summary, kpis) {
    const safeNum = (val) => {
        const n = Number(val);
        return Number.isFinite(n) ? n : 0;
    };

    const formatCurrency = (val) => {
        const n = Number(val);
        if (!Number.isFinite(n)) return '₹0';
        return `₹${Math.round(n).toLocaleString('en-IN')}`;
    };

    const formatPercent = (val) => {
        const n = Number(val);
        if (!Number.isFinite(n)) return '0%';
        return `${n.toFixed(1)}%`;
    };

    const formatNumber = (val) => {
        const n = Number(val);
        if (!Number.isFinite(n)) return '-';
        return Math.round(n).toLocaleString('en-IN');
    };

    const formatCount = (val) => {
        const n = Number(val);
        if (!Number.isFinite(n)) return '0';
        return String(Math.round(n));
    };

    const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = text;
        }
    };

    const formatRatio = (value) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return '-';
        return n.toFixed(2);
    }

    const summaryData = summary || {};
    const kpiData = kpis || {};

    // -----------------------
    // Existing KPI cards
    // -----------------------
    setText('kpiTotalTrades', formatCount(kpiData.total_trades ?? summaryData.total_trades ?? 0));
    setText('kpiWinRate', formatPercent(kpiData.win_rate ?? summaryData.win_rate_pct ?? 0, 2));
    setText('kpiWinningTrades', formatCount(kpiData.win_count ?? summaryData.winning_trades ?? 0));
    setText('kpiLosingTrades', formatCount(kpiData.loss_count ?? summaryData.losing_trades ?? 0));
    setText('kpiGrossPnl', formatCurrency(kpiData.gross_pnl_total ?? summaryData.gross_pnl ?? 0));
    setText('kpiCharges', formatCurrency(kpiData.charges_total ?? summaryData.total_charges ?? 0));

    // Additional gross values from backend
    setText('kpiGrossProfit', formatCurrency(kpiData.gross_profit ?? 0));
    setText('kpiGrossLossAbs', formatCurrency(kpiData.gross_loss_abs ?? 0));

    // -----------------------
    // Net PnL (₹ + % of starting capital)
    // -----------------------
    const netPnl = safeNum(kpiData.net_pnl_total ?? summaryData.net_pnl ?? 0);
    const netPnlPct = kpiData.net_pnl_pct;
    const netPnlCard = document.getElementById('kpiNetPnlCard');
    const netPnlAmtEl = document.getElementById('kpiNetPnlAmt');
    const netPnlPctEl = document.getElementById('kpiNetPnlPct');

    if (netPnlAmtEl && netPnlPctEl) {
        netPnlAmtEl.textContent = formatCurrency(netPnl);
        netPnlPctEl.textContent = (netPnlPct !== undefined && netPnlPct !== null)
            ? formatPercent(netPnlPct, 2)
            : '-';

        // Keep the green/red color on the amount (same behavior as before)
        netPnlAmtEl.className = (netPnl >= 0) ? 'positive' : 'negative';

        // Add background-state class for styling support
        if (netPnlCard) {
            netPnlCard.classList.remove('kpi-positive', 'kpi-negative');
            netPnlCard.classList.add(netPnl >= 0 ? 'kpi-positive' : 'kpi-negative');
        }
    } else {
        // Old UI fallback: kpiNetPnl only
        const netPnlEl = document.getElementById('kpiNetPnl');
        if (netPnlEl) {
            netPnlEl.textContent = formatCurrency(netPnl);
            netPnlEl.className = 'kpi-value ' + (netPnl >= 0 ? 'positive' : 'negative');
        }
    }

    setText('kpiStartingCapital', formatCurrency(kpiData.starting_capital ?? summaryData.starting_capital ?? 0));
    setText('kpiEndingCapital', formatCurrency(kpiData.ending_capital ?? summaryData.ending_capital ?? 0));

    // -----------------------
    // Backend KPI cards
    // -----------------------

    // Edge
    setText('kpiProfitFactor', formatRatio(kpiData.profit_factor ?? 0, 2));
    setText('kpiExpectancy', formatCurrency(kpiData.expectancy ?? 0));
    setText('kpiPayoffRatio', formatRatio(kpiData.payoff_ratio ?? 0, 2));

    // Risk
    setText('kpiMaxDrawdownAmt', formatCurrency(kpiData.max_drawdown_abs ?? 0));
    setText('kpiMaxDrawdownPct', formatPercent(kpiData.max_drawdown_pct ?? 0, 2));
    setText('kpiRecoveryFactor', formatRatio(kpiData.recovery_factor ?? 0, 2));
    setText('kpiLongestLosingStreak', formatCount(kpiData.longest_losing_streak ?? 0));
    setText('kpiChargesRatio', formatPercent(kpiData.charges_ratio_pct ?? 0, 2));

    // Stability / downside
    setText('kpiProfitableMonthsPct', formatPercent(kpiData.profitable_months_pct ?? 0, 2));
    setText('kpiWorstMonthNet', formatCurrency(kpiData.worst_month_net ?? 0));
    setText('kpiWorstDayNet', formatCurrency(kpiData.worst_day_net ?? 0));
    setText('kpiWorstTradeNet', formatCurrency(kpiData.worst_trade_net ?? 0));
    setText('kpiLongestLosingDailyStreak', formatCount(kpiData.longest_losing_daily_streak ?? 0));
    setText('kpiLongestLosingMonthlyStreak', formatCount(kpiData.longest_losing_monthly_streak ?? 0));

    // Execution / behavior
    setText('kpiAvgTradesPerDay', formatRatio(kpiData.avg_trades_per_day ?? 0, 2));
    setText('kpiAvgHoldingTime', kpiData.avg_holding_readable ?? '-');
    setText('kpiMaxHoldingTime', kpiData.max_holding_readable ?? '-');
    setText('kpiOvernightTradesCount', formatCount(kpiData.overnight_trades_count ?? 0));
    setText('kpiOvernightTradesPct', formatPercent(kpiData.overnight_trades_pct ?? 0, 2));
    setText('kpiOvernightWinRate', formatPercent(kpiData.overnight_win_rate_pct ?? 0, 2));

    // // Risk-adjusted
    // setText('kpiSharpeRatio', formatNumber(kpiData.sharpe_ratio ?? 0, 2));
    // setText('kpiSortinoRatio', formatNumber(kpiData.sortino_ratio ?? 0, 2));
}

/**
 * Resolve display instrument name for chart heading.
 *
 * Priority:
 * 1. Response summary / root data labels if present
 * 2. Currently selected UI option text
 * 3. Raw instrument id
 */
function resolveInstrumentDisplayName(data) {
    const summary = data?.summary || {};

    const directLabel =
        summary.instrument_label ||
        summary.instrument_name ||
        data?.instrument_label ||
        data?.instrument_name ||
        null;

    if (directLabel) {
        return String(directLabel);
    }

    const instrumentId =
        summary.instrument_id ||
        data?.instrument_id ||
        null;

    const instrumentEl = document.getElementById('instrument');
    if (instrumentEl && instrumentEl.tagName.toLowerCase() === 'select') {
        const selectedIndex = instrumentEl.selectedIndex;

        // First fallback: directly use the selected option text from UI
        if (selectedIndex >= 0) {
            const selectedOption = instrumentEl.options[selectedIndex];
            if (selectedOption) {
                if (instrumentId && selectedOption.value === instrumentId) {
                    return selectedOption.textContent || instrumentId;
                }

                if (!instrumentId) {
                    return selectedOption.textContent || '-';
                }
            }
        }

        // Second fallback: search all options if backend returned instrument_id
        if (instrumentId) {
            const matchedOption = Array.from(instrumentEl.options).find(
                (opt) => opt.value === instrumentId
            );
            if (matchedOption) {
                return matchedOption.textContent || instrumentId;
            }
        }
    }

    return instrumentId || '-';
}

/**
 * Update chart section heading with instrument name.
 */
function renderChartHeading(data) {
    const chartInstrumentNameEl = document.getElementById('chartInstrumentName');
    if (!chartInstrumentNameEl) return;

    chartInstrumentNameEl.textContent = resolveInstrumentDisplayName(data);
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
 * Render monthly summary table from backend response.
 *
 * Expected backend shape can vary slightly, so this renderer supports
 * a few common aliases for each value to keep frontend robust.
 */
function renderMonthlyTable(monthlySummary) {
    const tbody = document.getElementById('monthlyTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    const rows = Array.isArray(monthlySummary) ? monthlySummary : [];

    rows.forEach((monthRow) => {
        const row = document.createElement('tr');

        const monthLabel =
            monthRow.trade_month ??
            monthRow.month ??
            monthRow.month_label ??
            '-';

        const totalTrades =
            monthRow.total_trades ??
            0;

        const winCount =
            monthRow.total_win ??
            monthRow.win_count ??
            monthRow.winning_trades ??
            monthRow.win_trade ??
            0;
            
            const lossCount =
            monthRow.total_loss ??
            monthRow.loss_count ??
            monthRow.losing_trades ??
            monthRow.loss_trade ??
            0;

        const chargesPct =
            monthRow.charges_rate ??
            monthRow.charges_pct ??
            0;

        const grossPnl =
            monthRow.gross_pnl_total ??
            monthRow.gross_pnl ??
            0;

        const charges =
            monthRow.charges_total ??
            monthRow.charges ??
            0;

        const netPnl =
            monthRow.net_pnl_total ??
            monthRow.net_pnl ??
            0;

        const cumNetPnl =
            monthRow.cum_net_pnl ??
            monthRow.cumulative_net_pnl ??
            monthRow.cumNetPnl ??
            0;

        const isProfitable = Number(netPnl) >= 0;

        row.innerHTML = `
            <td>${monthLabel}</td>
            <td>${Number(totalTrades || 0)}</td>
            <td>${Number(winCount || 0)}</td>
            <td>${Number(lossCount || 0)}</td>
            <td>₹${Number(grossPnl || 0).toFixed(2)}</td>
            <td>₹${Number(charges || 0).toFixed(2)}</td>
            <td>${Number(chargesPct || 0).toFixed(2)}%</td>
            <td class="trade-pnl ${isProfitable ? 'positive' : 'negative'}">₹${Number(netPnl || 0).toFixed(2)}</td>
            <td class="trade-pnl ${Number(cumNetPnl) >= 0 ? 'positive' : 'negative'}">₹${Number(cumNetPnl || 0).toFixed(2)}</td>
        `;

        tbody.appendChild(row);
    });
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
 *
 * IMPORTANT ORDER:
 * 1. Summary
 * 2. Price Chart & Trades
 * 3. Monthly Summary
 * 4. Trade Details
 */
function renderResults(data) {
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('resultsContainer').classList.remove('hidden');

    renderSummary(data.summary, data.kpis);
    renderChartHeading(data);
    renderChart(document.getElementById('chartContainer'), data.candles, data.trades);
    renderMonthlyTable(data.monthly_summary);
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

// Form drawer controls
document.getElementById('openFormDrawerBtn')?.addEventListener('click', openFormDrawer);
document.getElementById('closeFormDrawerBtn')?.addEventListener('click', closeFormDrawer);
document.getElementById('formDrawerOverlay')?.addEventListener('click', closeFormDrawer);

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

/**
 * Return the active scroll container based on viewport behavior.
 * - Desktop: content area is the scroll container
 * - Tablet/Mobile: window/page may become the scroll container
 */
function getActiveScrollTop() {
    if (isDrawerViewport()) {
        return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    }
    return contentArea ? contentArea.scrollTop : 0;
}

/**
 * Toggle back-to-top button visibility.
 */
function updateBackToTopVisibility() {
    if (!backToTopBtn) return;

    if (getActiveScrollTop() > 300) {
        backToTopBtn.classList.remove('hidden');
    } else {
        backToTopBtn.classList.add('hidden');
    }
}

// Desktop/internal scroll container
if (contentArea) {
    contentArea.addEventListener('scroll', updateBackToTopVisibility);
}

// Tablet/mobile/page scroll
window.addEventListener('scroll', updateBackToTopVisibility);

backToTopBtn.addEventListener('click', () => {
    if (isDrawerViewport()) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (contentArea) {
        contentArea.scrollTo({ top: 0, behavior: 'smooth' });
    }
});

// Close modal / drawer on ESC key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeFormDrawer();

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