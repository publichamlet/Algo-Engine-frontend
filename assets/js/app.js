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
 * Compute helpful KPIs that are not directly returned by backend summary.
 *
 * IMPORTANT:
 * - We intentionally compute using the frontend `trades` array so UI stays backward compatible
 *   even if backend summary fields evolve.
 * - We use trade.net_pnl for profit/loss, and trade.entry_ts/exit_ts for time grouping.
 */
function computeDerivedKpis(trades, summary) {
    const safeNum = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    };

    const fmt2 = (v) => safeNum(v).toFixed(2);

    const formatCurrency = (val) => `₹${safeNum(val).toFixed(2)}`;

    const formatPercent = (val, digits = 1) => `${safeNum(val).toFixed(digits)}%`;

    const dateKeyFromIso = (iso) => String(iso || '').slice(0, 10);      // YYYY-MM-DD
    const monthKeyFromIso = (iso) => String(iso || '').slice(0, 7);     // YYYY-MM
    const parseIsoMs = (iso) => {
        // JS Date parses ISO with offset correctly. If parse fails, return NaN.
        const t = Date.parse(iso);
        return Number.isFinite(t) ? t : NaN;
    };

    const formatDuration = (ms) => {
        const totalMin = Math.max(0, Math.round(ms / 60000));
        if (totalMin < 60) return `${totalMin}m`;
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        return m === 0 ? `${h}h` : `${h}h ${m}m`;
    };

    const cleanTrades = Array.isArray(trades) ? trades.slice() : [];

    // Sort by exit time (stable equity curve + streaks)
    cleanTrades.sort((a, b) => {
        const at = parseIsoMs(a.exit_ts);
        const bt = parseIsoMs(b.exit_ts);
        if (!Number.isFinite(at) && !Number.isFinite(bt)) return 0;
        if (!Number.isFinite(at)) return 1;
        if (!Number.isFinite(bt)) return -1;
        return at - bt;
    });

    const totalTrades = cleanTrades.length;

    // Profit Factor / Payoff / Expectancy
    let grossProfit = 0;
    let grossLossAbs = 0;
    let winCount = 0;
    let lossCount = 0;
    let sumWins = 0;
    let sumLossAbs = 0;
    let sumNet = 0;

    // Holding time & overnight
    let sumHoldMs = 0;
    let holdCount = 0;
    let overnightCount = 0;

    // Trades per day
    const daySet = new Set();

    // Monthly Net
    const monthNet = new Map(); // YYYY-MM -> net sum

    // Losing streak
    let currentLoseStreak = 0;
    let maxLoseStreak = 0;

    // Equity curve for drawdown
    const startingCapital = safeNum(summary && summary.starting_capital);
    let equity = startingCapital;
    let peakEquity = startingCapital;
    let maxDrawdownAbs = 0;

    for (const t of cleanTrades) {
        const pnl = safeNum(t.net_pnl);
        sumNet += pnl;

        if (pnl >= 0) {
            winCount += 1;
            sumWins += pnl;
            grossProfit += pnl;

            currentLoseStreak = 0;
        } else {
            lossCount += 1;
            const lossAbs = Math.abs(pnl);
            sumLossAbs += lossAbs;
            grossLossAbs += lossAbs;

            currentLoseStreak += 1;
            if (currentLoseStreak > maxLoseStreak) maxLoseStreak = currentLoseStreak;
        }

        // Drawdown calc (equity updates on trade exit)
        equity += pnl;
        if (equity > peakEquity) peakEquity = equity;
        const dd = peakEquity - equity;
        if (dd > maxDrawdownAbs) maxDrawdownAbs = dd;

        // Holding time
        const entryMs = parseIsoMs(t.entry_ts);
        const exitMs = parseIsoMs(t.exit_ts);
        if (Number.isFinite(entryMs) && Number.isFinite(exitMs) && exitMs >= entryMs) {
            sumHoldMs += (exitMs - entryMs);
            holdCount += 1;
        }

        // Overnight trades (compare date part in the original string so it matches IST wall-clock)
        const entryDay = dateKeyFromIso(t.entry_ts);
        const exitDay = dateKeyFromIso(t.exit_ts);
        if (entryDay && exitDay && entryDay !== exitDay) overnightCount += 1;

        // Trades/day (use exit day)
        if (exitDay) daySet.add(exitDay);

        // Monthly net (use exit month)
        const exitMonth = monthKeyFromIso(t.exit_ts);
        if (exitMonth) {
            monthNet.set(exitMonth, safeNum(monthNet.get(exitMonth)) + pnl);
        }
    }

    const profitFactor = grossLossAbs > 0 ? (grossProfit / grossLossAbs) : (grossProfit > 0 ? Infinity : 0);
    const expectancy = totalTrades > 0 ? (sumNet / totalTrades) : 0;

    const avgWin = winCount > 0 ? (sumWins / winCount) : 0;
    const avgLossAbs = lossCount > 0 ? (sumLossAbs / lossCount) : 0;
    const payoffRatio = avgLossAbs > 0 ? (avgWin / avgLossAbs) : (avgWin > 0 ? Infinity : 0);

    // Max drawdown %
    const maxDrawdownPct = peakEquity > 0 ? (maxDrawdownAbs / peakEquity) * 100 : 0;

    // Recovery factor
    const netProfit = safeNum(summary && summary.net_pnl);
    const recoveryFactor = maxDrawdownAbs > 0 ? (netProfit / maxDrawdownAbs) : (netProfit > 0 ? Infinity : 0);

    // Charges Ratio (Cost Efficiency)
    const grossPnlSummary = safeNum(summary && summary.gross_pnl);
    const totalChargesSummary = safeNum(summary && summary.total_charges);
    
    let chargesRatio = 0;
    
    if (Math.abs(grossPnlSummary) > 0) {
        chargesRatio = (totalChargesSummary / Math.abs(grossPnlSummary)) * 100;
    }

    // Profitable months %
    const months = Array.from(monthNet.values());
    const totalMonths = months.length;
    const profitableMonths = months.filter(v => safeNum(v) > 0).length;
    const profitableMonthsPct = totalMonths > 0 ? (profitableMonths / totalMonths) * 100 : 0;

    // Worst month net
    let worstMonthNet = 0;
    if (totalMonths > 0) {
        worstMonthNet = Math.min(...months.map(v => safeNum(v)));
    }

    // Trades/day
    const totalDays = daySet.size;
    const avgTradesPerDay = totalDays > 0 ? (totalTrades / totalDays) : 0;

    // Holding time
    const avgHoldMs = holdCount > 0 ? (sumHoldMs / holdCount) : 0;

    // Overnight %
    const overnightPct = totalTrades > 0 ? (overnightCount / totalTrades) * 100 : 0;

    // -----------------------
    // Sharpe / Sortino (trade-level)
    // -----------------------
    // NOTE:
    // - Uses trade "net_pnl" series (already after charges).
    // - This is a trade-level Sharpe/Sortino (not daily). Good for comparing strategies quickly.
    // - If you later want a more institutional metric, we can compute DAILY Sharpe from equity curve.

    const pnls = cleanTrades.map(t => safeNum(t.net_pnl));

    const mean = (arr) => {
        if (!arr.length) return 0;
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    };

    const stdDev = (arr) => {
        if (arr.length < 2) return 0;
        const m = mean(arr);
        const varPop = arr.reduce((s, x) => s + Math.pow(x - m, 2), 0) / arr.length;
        return Math.sqrt(varPop);
    };

    const mPnl = mean(pnls);
    const sdPnl = stdDev(pnls);

    // Sharpe (trade-level): mean / stddev
    const sharpeRatio = sdPnl > 0 ? (mPnl / sdPnl) : 0;

    // Sortino: mean / downside deviation (only losses contribute)
    const downside = pnls.filter(x => x < 0);
    const downsideDev = downside.length > 0 ? Math.sqrt(downside.reduce((s, x) => s + (x * x), 0) / downside.length) : 0;
    const sortinoRatio = downsideDev > 0 ? (mPnl / downsideDev) : 0;

    return {
        // raw
        profit_factor: profitFactor,
        expectancy: expectancy,
        payoff_ratio: payoffRatio,
        max_drawdown_abs: maxDrawdownAbs,
        max_drawdown_pct: maxDrawdownPct,
        recovery_factor: recoveryFactor,
        longest_losing_streak: maxLoseStreak,
        profitable_months_pct: profitableMonthsPct,
        worst_month_net: worstMonthNet,
        avg_trades_per_day: avgTradesPerDay,
        avg_holding_ms: avgHoldMs,
        overnight_trades_pct: overnightPct,
        // sharpe_ratio: sharpeRatio,
        // sortino_ratio: sortinoRatio,
        charges_ratio: chargesRatio,

        // display
        profit_factor_display: Number.isFinite(profitFactor) ? fmt2(profitFactor) : '∞',
        expectancy_display: formatCurrency(expectancy),
        payoff_ratio_display: Number.isFinite(payoffRatio) ? fmt2(payoffRatio) : '∞',
        max_drawdown_abs_display: formatCurrency(maxDrawdownAbs),
        max_drawdown_pct_display: formatPercent(maxDrawdownPct, 1),
        max_drawdown_display: `${formatCurrency(maxDrawdownAbs)} / ${formatPercent(maxDrawdownPct, 1)}`,
        recovery_factor_display: Number.isFinite(recoveryFactor) ? fmt2(recoveryFactor) : '∞',
        longest_losing_streak_display: String(maxLoseStreak || 0),
        profitable_months_pct_display: formatPercent(profitableMonthsPct, 1),
        worst_month_net_display: formatCurrency(worstMonthNet),
        avg_trades_per_day_display: fmt2(avgTradesPerDay),
        avg_holding_time_display: formatDuration(avgHoldMs),
        overnight_trades_pct_display: formatPercent(overnightPct, 1),
        // sharpe_ratio_display: Number.isFinite(sharpeRatio) ? fmt2(sharpeRatio) : '0.00',
        // sortino_ratio_display: Number.isFinite(sortinoRatio) ? fmt2(sortinoRatio) : '0.00',
        charges_ratio_display: formatPercent(chargesRatio, 1),
    };
}


function renderSummary(summary, trades) {
    const formatCurrency = (val) => {
        const n = Number(val || 0);
        return `₹${n.toFixed(2)}`;
    };

    const formatPercent = (val, digits = 1) => {
        const n = Number(val || 0);
        return `${n.toFixed(digits)}%`;
    };

    const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    // -----------------------
    // Existing KPI cards
    // -----------------------
    setText('kpiTotalTrades', summary.total_trades || 0);
    setText('kpiWinRate', formatPercent(summary.win_rate_pct));
    setText('kpiWinningTrades', summary.winning_trades || 0);
    setText('kpiLosingTrades', summary.losing_trades || 0);
    setText('kpiGrossPnl', formatCurrency(summary.gross_pnl));
    setText('kpiCharges', formatCurrency(summary.total_charges));

    const netPnlEl = document.getElementById('kpiNetPnl');
    if (netPnlEl) {
        netPnlEl.textContent = formatCurrency(summary.net_pnl);
        netPnlEl.className = 'kpi-value ' + (Number(summary.net_pnl || 0) >= 0 ? 'positive' : 'negative');
    }

    setText('kpiStartingCapital', formatCurrency(summary.starting_capital));
    setText('kpiEndingCapital', formatCurrency(summary.ending_capital));

    // -----------------------
    // Derived KPI cards (from trade list)
    // -----------------------
    const derived = computeDerivedKpis(trades || [], summary);

    // Edge
    setText('kpiProfitFactor', derived.profit_factor_display);
    setText('kpiExpectancy', derived.expectancy_display);
    setText('kpiPayoffRatio', derived.payoff_ratio_display);

    // Risk
    setText('kpiMaxDrawdownAmt', derived.max_drawdown_abs_display);
    setText('kpiMaxDrawdownPct', derived.max_drawdown_pct_display);
    setText('kpiRecoveryFactor', derived.recovery_factor_display);
    setText('kpiLongestLosingStreak', derived.longest_losing_streak_display);
    setText('kpiChargesRatio', derived.charges_ratio_display);

    // Stability
    setText('kpiProfitableMonthsPct', derived.profitable_months_pct_display);
    setText('kpiWorstMonthNet', derived.worst_month_net_display);

    // Execution
    setText('kpiAvgTradesPerDay', derived.avg_trades_per_day_display);
    setText('kpiAvgHoldingTime', derived.avg_holding_time_display);
    setText('kpiOvernightTradesPct', derived.overnight_trades_pct_display);

    // // Risk-adjusted
    // setText('kpiSharpeRatio', derived.sharpe_ratio_display);
    // setText('kpiSortinoRatio', derived.sortino_ratio_display);
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

    renderSummary(data.summary, data.trades);
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