const DUMMY_RESPONSE = {
    run_id: "backtest-20260117-001",
    summary: {
        total_trades: 10,
        winning_trades: 7,
        losing_trades: 3,
        win_rate_pct: 70.0,

        // Sum of trades[i].gross_pnl
        gross_pnl: 720.50,

        // Sum of trades[i].charges
        total_charges: 264.00,

        // gross_pnl - total_charges (must match sum of trades[i].net_pnl)
        net_pnl: 456.50,

        starting_capital: 200000.00,
        ending_capital: 200456.50
    },

    // Minimal-but-realistic candles across 01-Dec-2025 to 15-Jan-2026
    // (You can add more candles later; this is enough to test chart rendering + time axis.)
    candles: [
        // 2025-12-02
        { ts: "2025-12-02T09:15:00+05:30", open: 19840.00, high: 19872.00, low: 19825.50, close: 19860.50, volume: 18600 },
        { ts: "2025-12-02T09:20:00+05:30", open: 19860.50, high: 19905.00, low: 19855.00, close: 19898.00, volume: 22150 },
        { ts: "2025-12-02T09:25:00+05:30", open: 19898.00, high: 19930.50, low: 19890.00, close: 19922.50, volume: 24310 },
        { ts: "2025-12-02T09:30:00+05:30", open: 19922.50, high: 19935.00, low: 19900.00, close: 19910.00, volume: 20840 },

        // 2025-12-09
        { ts: "2025-12-09T10:05:00+05:30", open: 20010.00, high: 20022.00, low: 19970.00, close: 19982.00, volume: 19420 },
        { ts: "2025-12-09T10:10:00+05:30", open: 19982.00, high: 19990.50, low: 19940.00, close: 19955.00, volume: 21210 },
        { ts: "2025-12-09T10:15:00+05:30", open: 19955.00, high: 19960.00, low: 19910.00, close: 19920.00, volume: 23580 },
        { ts: "2025-12-09T10:20:00+05:30", open: 19920.00, high: 19935.00, low: 19888.00, close: 19905.00, volume: 22840 },

        // 2025-12-16
        { ts: "2025-12-16T11:00:00+05:30", open: 20120.00, high: 20155.50, low: 20105.00, close: 20142.00, volume: 17620 },
        { ts: "2025-12-16T11:05:00+05:30", open: 20142.00, high: 20190.00, low: 20135.00, close: 20178.50, volume: 20990 },
        { ts: "2025-12-16T11:10:00+05:30", open: 20178.50, high: 20205.00, low: 20170.00, close: 20198.00, volume: 23840 },
        { ts: "2025-12-16T11:15:00+05:30", open: 20198.00, high: 20235.00, low: 20192.00, close: 20228.00, volume: 24410 },

        // 2025-12-23
        { ts: "2025-12-23T09:45:00+05:30", open: 20280.00, high: 20305.00, low: 20270.00, close: 20295.50, volume: 16500 },
        { ts: "2025-12-23T09:50:00+05:30", open: 20295.50, high: 20320.00, low: 20290.00, close: 20310.00, volume: 18820 },
        { ts: "2025-12-23T09:55:00+05:30", open: 20310.00, high: 20325.50, low: 20300.00, close: 20318.00, volume: 20440 },
        { ts: "2025-12-23T10:00:00+05:30", open: 20318.00, high: 20330.00, low: 20298.00, close: 20305.00, volume: 19710 },

        // 2025-12-30
        { ts: "2025-12-30T14:10:00+05:30", open: 20410.00, high: 20418.00, low: 20375.00, close: 20388.00, volume: 14220 },
        { ts: "2025-12-30T14:15:00+05:30", open: 20388.00, high: 20395.00, low: 20340.00, close: 20355.00, volume: 17580 },
        { ts: "2025-12-30T14:20:00+05:30", open: 20355.00, high: 20360.00, low: 20310.00, close: 20325.00, volume: 20110 },
        { ts: "2025-12-30T14:25:00+05:30", open: 20325.00, high: 20345.00, low: 20320.00, close: 20340.50, volume: 19660 },

        // 2026-01-05
        { ts: "2026-01-05T09:20:00+05:30", open: 20520.00, high: 20555.00, low: 20510.00, close: 20542.00, volume: 21400 },
        { ts: "2026-01-05T09:25:00+05:30", open: 20542.00, high: 20570.00, low: 20535.00, close: 20565.00, volume: 23900 },
        { ts: "2026-01-05T09:30:00+05:30", open: 20565.00, high: 20605.00, low: 20560.00, close: 20598.00, volume: 26250 },
        { ts: "2026-01-05T09:35:00+05:30", open: 20598.00, high: 20610.00, low: 20580.00, close: 20600.00, volume: 22860 },

        // 2026-01-08
        { ts: "2026-01-08T10:40:00+05:30", open: 20680.00, high: 20710.00, low: 20670.00, close: 20695.50, volume: 17800 },
        { ts: "2026-01-08T10:45:00+05:30", open: 20695.50, high: 20705.00, low: 20680.00, close: 20688.00, volume: 19040 },
        { ts: "2026-01-08T10:50:00+05:30", open: 20688.00, high: 20700.00, low: 20655.00, close: 20670.50, volume: 21330 },
        { ts: "2026-01-08T10:55:00+05:30", open: 20670.50, high: 20690.00, low: 20660.00, close: 20685.00, volume: 20610 },

        // 2026-01-12
        { ts: "2026-01-12T12:05:00+05:30", open: 20740.00, high: 20755.00, low: 20720.00, close: 20748.50, volume: 16650 },
        { ts: "2026-01-12T12:10:00+05:30", open: 20748.50, high: 20795.00, low: 20745.00, close: 20788.00, volume: 21510 },
        { ts: "2026-01-12T12:15:00+05:30", open: 20788.00, high: 20810.00, low: 20780.00, close: 20805.50, volume: 24120 },
        { ts: "2026-01-12T12:20:00+05:30", open: 20805.50, high: 20825.00, low: 20795.00, close: 20818.00, volume: 22900 },

        // 2026-01-14
        { ts: "2026-01-14T09:55:00+05:30", open: 20890.00, high: 20910.00, low: 20875.00, close: 20902.50, volume: 18440 },
        { ts: "2026-01-14T10:00:00+05:30", open: 20902.50, high: 20935.00, low: 20898.00, close: 20925.00, volume: 21610 },
        { ts: "2026-01-14T10:05:00+05:30", open: 20925.00, high: 20960.00, low: 20920.00, close: 20955.00, volume: 24880 },
        { ts: "2026-01-14T10:10:00+05:30", open: 20955.00, high: 20970.00, low: 20940.00, close: 20962.50, volume: 22100 },

        // 2026-01-15
        { ts: "2026-01-15T14:55:00+05:30", open: 21040.00, high: 21065.00, low: 21035.00, close: 21055.50, volume: 15900 },
        { ts: "2026-01-15T15:00:00+05:30", open: 21055.50, high: 21090.00, low: 21050.00, close: 21080.00, volume: 18220 },
        { ts: "2026-01-15T15:05:00+05:30", open: 21080.00, high: 21110.00, low: 21075.00, close: 21105.50, volume: 20440 },
        { ts: "2026-01-15T15:10:00+05:30", open: 21105.50, high: 21125.00, low: 21100.00, close: 21120.00, volume: 17680 }
    ],

    // 10 trades spread across the requested period.
    // All totals match summary exactly:
    // gross_pnl sum = 720.50
    // charges sum = 264.00
    // net_pnl sum = 456.50
    trades: [
        {
            entry_ts: "2025-12-02T09:20:00+05:30",
            entry_price: 19898.00,
            exit_ts: "2025-12-02T09:30:00+05:30",
            exit_price: 20018.50,
            qty: 1,
            gross_pnl: 120.50,
            charges: 28.00,
            net_pnl: 92.50,
            signals_json: '{"signal":"ema_crossover","direction":"buy"}',
            entry_signals_json: '{"ema_fast":19872.10,"ema_slow":19855.40}',
            exit_signals_json: '{"ema_fast":19960.25,"ema_slow":19910.80}'
        },
        {
            entry_ts: "2025-12-09T10:05:00+05:30",
            entry_price: 19982.00,
            exit_ts: "2025-12-09T10:20:00+05:30",
            exit_price: 19897.00,
            qty: 1,
            gross_pnl: -85.00,
            charges: 24.00,
            net_pnl: -109.00,
            signals_json: '{"signal":"breakdown_failure","direction":"buy"}',
            entry_signals_json: '{"breakout_level":20005.00,"rvol":1.35}',
            exit_signals_json: '{"stop_reason":"failed_breakout","rvol":0.92}'
        },
        {
            entry_ts: "2025-12-16T11:05:00+05:30",
            entry_price: 20178.50,
            exit_ts: "2025-12-16T11:15:00+05:30",
            exit_price: 20388.50,
            qty: 1,
            gross_pnl: 210.00,
            charges: 32.00,
            net_pnl: 178.00,
            signals_json: '{"signal":"momentum_pullback","direction":"buy"}',
            entry_signals_json: '{"vwap_dev_pct":-0.18,"rsi":44.2}',
            exit_signals_json: '{"trail_hit":true,"rsi":58.9}'
        },
        {
            entry_ts: "2025-12-23T09:50:00+05:30",
            entry_price: 20310.00,
            exit_ts: "2025-12-23T10:00:00+05:30",
            exit_price: 20375.00,
            qty: 1,
            gross_pnl: 65.00,
            charges: 22.00,
            net_pnl: 43.00,
            signals_json: '{"signal":"rsi_mean_reversion","direction":"buy"}',
            entry_signals_json: '{"rsi":29.6,"bb_pos":-1.8}',
            exit_signals_json: '{"rsi":38.4,"bb_pos":-0.6}'
        },
        {
            entry_ts: "2025-12-30T14:10:00+05:30",
            entry_price: 20388.00,
            exit_ts: "2025-12-30T14:20:00+05:30",
            exit_price: 20348.00,
            qty: 1,
            gross_pnl: -40.00,
            charges: 20.00,
            net_pnl: -60.00,
            signals_json: '{"signal":"range_reject","direction":"sell"}',
            entry_signals_json: '{"range_high":20420.0,"wick_reject":true}',
            exit_signals_json: '{"cover_reason":"range_follow_through_failed"}'
        },
        {
            entry_ts: "2026-01-05T09:25:00+05:30",
            entry_price: 20565.00,
            exit_ts: "2026-01-05T09:35:00+05:30",
            exit_price: 20720.00,
            qty: 1,
            gross_pnl: 155.00,
            charges: 30.00,
            net_pnl: 125.00,
            signals_json: '{"signal":"opening_drive","direction":"buy"}',
            entry_signals_json: '{"gap_pct":0.32,"orb_break":true}',
            exit_signals_json: '{"tp_reason":"impulse_extension"}'
        },
        {
            entry_ts: "2026-01-08T10:40:00+05:30",
            entry_price: 20695.50,
            exit_ts: "2026-01-08T10:55:00+05:30",
            exit_price: 20785.50,
            qty: 1,
            gross_pnl: 90.00,
            charges: 26.00,
            net_pnl: 64.00,
            signals_json: '{"signal":"vwap_reclaim","direction":"buy"}',
            entry_signals_json: '{"vwap":20690.2,"close_above_vwap":true}',
            exit_signals_json: '{"tp_reason":"mean_to_trend"}'
        },
        {
            entry_ts: "2026-01-12T12:05:00+05:30",
            entry_price: 20748.50,
            exit_ts: "2026-01-12T12:20:00+05:30",
            exit_price: 20638.50,
            qty: 1,
            gross_pnl: -110.00,
            charges: 25.00,
            net_pnl: -135.00,
            signals_json: '{"signal":"false_breakout","direction":"buy"}',
            entry_signals_json: '{"breakout_level":20760.0,"rsi":51.0}',
            exit_signals_json: '{"stop_reason":"quick_reject","rsi":44.7}'
        },
        {
            entry_ts: "2026-01-14T10:00:00+05:30",
            entry_price: 20925.00,
            exit_ts: "2026-01-14T10:10:00+05:30",
            exit_price: 21165.00,
            qty: 1,
            gross_pnl: 240.00,
            charges: 34.00,
            net_pnl: 206.00,
            signals_json: '{"signal":"trend_continuation","direction":"buy"}',
            entry_signals_json: '{"adx":24.5,"ema_stack":"bullish"}',
            exit_signals_json: '{"tp_reason":"impulse_to_resistance"}'
        },
        {
            entry_ts: "2026-01-15T15:00:00+05:30",
            entry_price: 21080.00,
            exit_ts: "2026-01-15T15:10:00+05:30",
            exit_price: 21155.00,
            qty: 1,
            gross_pnl: 75.00,
            charges: 23.00,
            net_pnl: 52.00,
            signals_json: '{"signal":"late_day_breakout","direction":"buy"}',
            entry_signals_json: '{"day_high_break":true,"volume_spike":1.42}',
            exit_signals_json: '{"tp_reason":"closing_momentum"}'
        }
    ],

    exports: {
        manifest_path: "data/exports/backtests/runs/backtest-20260117-001__manifest.json",
        trades_json: "backtest-20260117-001-trades.json",
        candles_json: "backtest-20260117-001-candles.json"
    }
};
