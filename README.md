# BePlus Algo — Frontend (Backtesting Web UI)

This repository contains the **BePlus Algo Trading** frontend web application.
It is a **lightweight, framework-free** UI for configuring, triggering, and visualizing **algorithmic backtests** executed by the BePlus Algo backend.

The frontend is intentionally kept simple (HTML/CSS/Vanilla JS) to make backend integration, debugging, and hosting straightforward.

---

## What this UI does

I use this UI to:

* Select **Broker**, **Instrument**, **Timeframe**, and **IST start/end times**
* Select a **Strategy**
* Auto-generate **strategy parameters** dynamically from a JSON config
* Trigger a **Run Backtest** API call
* Visualize results:

  * Summary KPIs (trades, win rate, gross/net PnL, charges, capital)
  * Candle chart with trades overlay (via **TradingView Lightweight Charts**)
  * Trades table + signals modal
* Delete the last run (when supported by backend)

---

## Tech stack

* **HTML** (`index.html`)
* **CSS** (`styles.css`)
* **Vanilla JavaScript**
* **TradingView Lightweight Charts** (loaded via CDN)
* **Fetch API** for backend communication

No React/Angular/Vue is used.

---

## Current project structure (actual)

```
/
├── index.html
├── styles.css
├── app.js
├── ui_options.js
├── dummy-data.js
├── config/
│   └── ui-options.json
└── README.md
```

---

## Configuration (UI Options)

The UI options (dropdown lists + strategy parameter schema) are driven from:

* `config/ui-options.json`

This JSON controls:

* Broker dropdown options
* Instrument dropdown options
* Strategy dropdown options
* Strategy parameter fields (auto-created based on selected strategy)
* Strategy rules like **whether instrument selection is required**

### Example strategy entry

```json
{
  "id": "ema_crossover",
  "label": "EMA Crossover",
  "requires_instrument": true,
  "params": [
    {"key": "ema_fast", "label": "EMA Fast", "type": "number", "required": true, "default": 9},
    {"key": "ema_slow", "label": "EMA Slow", "type": "number", "required": true, "default": 21}
  ]
}
```

If `requires_instrument` is set to `false`, the UI can disable/hide the instrument selector (useful for strategies that internally force a prefixed/default instrument).

---

## Backend dependency

This frontend **does not run backtests locally**.
It requires the BePlus Algo backend (FastAPI) to be running.

### API base URL

In `app.js`, set:

```js
const API_BASE = "http://localhost:8000";
```

### Endpoints used (current)

* Run backtest:

  * `POST ${API_BASE}/api/backtests/run`
* Fetch run by id (used for refresh/polling patterns):

  * `GET  ${API_BASE}/api/backtests/{run_id}`

(Exact backend availability depends on the server implementation.)

---

## Request payload (sent from UI)

The UI builds a payload from the form, including:

* `broker`
* `instrument_id`
* `timeframe`
* `start_ist`, `end_ist`
* `capital`, `qty`
* `strategy`
* `strategy_params` (dynamic values read from generated inputs)
* optional feature settings (e.g., `feature_pack`)

---

## Expected response contract

The UI expects the backend response to be compatible with:

```json
{
  "run_id": "backtest-YYYYMMDD-###",
  "summary": {
    "total_trades": 10,
    "winning_trades": 7,
    "losing_trades": 3,
    "win_rate_pct": 70.0,
    "gross_pnl": 720.50,
    "total_charges": 264.00,
    "net_pnl": 456.50,
    "starting_capital": 200000.00,
    "ending_capital": 200456.50
  },
  "candles": [
    {"ts": "2026-01-15T15:10:00+05:30", "open": 1, "high": 1, "low": 1, "close": 1, "volume": 1}
  ],
  "trades": [
    {
      "entry_ts": "...",
      "entry_price": 0,
      "exit_ts": "...",
      "exit_price": 0,
      "qty": 1,
      "gross_pnl": 0,
      "charges": 0,
      "net_pnl": 0,
      "signals_json": "{...}",
      "entry_signals_json": "{...}",
      "exit_signals_json": "{...}"
    }
  ]
}
```

Notes:

* Candle timestamps are ISO-8601 strings and may include timezone offsets (e.g., `+05:30`).
* Trade signal metadata is stored as JSON strings:

  * `signals_json`
  * `entry_signals_json`
  * `exit_signals_json`

---

## Local development

Because browsers restrict `fetch()` calls from `file://`, I should run a local server.

### Option 1 — VS Code Live Server

1. Install **Live Server** extension
2. Right-click `index.html`
3. Choose **Open with Live Server**

### Option 2 — Python static server

```bash
python -m http.server 5500
```

Then open:

```
http://localhost:5500
```

---

## How the UI works (high level)

1. On page load, `ui_options.js` loads `config/ui-options.json`
2. It populates broker/instrument/strategy dropdowns
3. When I select a strategy, it dynamically renders the required parameter inputs
4. When I click **Run Backtest**:

   * the form is validated
   * payload is built
   * `app.js` calls `POST /api/backtests/run`
5. Response is rendered into:

   * KPI cards
   * candle chart
   * trades table
   * modals (signals / fullscreen chart)

---

## Dummy data (optional)

`dummy-data.js` exists for offline UI testing.
It is currently commented out in `index.html`.

To test UI without backend, I can enable it by uncommenting:

```html
<!-- <script src="dummy-data.js"></script> -->
```

(And updating `app.js` to use dummy response logic if needed.)

---

## Deployment

This is a **static frontend**, so I can host it on:

* GitHub Pages
* Netlify / Vercel
* AWS S3 static hosting
* Any Nginx/Apache server

---

## Notes

* Time inputs are collected as **IST datetime-local** values from the form.
* Display timezone depends on chart library parsing and JS date handling.
* The UI is designed for clarity and debugging over minification.

---

## License

Private / Internal project — BePlus Algo Trading
