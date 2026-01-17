# BePlus Algo — Frontend (Backtesting Web UI)

This repository contains the **BePlus Algo Trading frontend web application**.
It is used to configure, trigger, and visualize **algorithmic backtests** executed by the BePlus Algo backend.

The frontend is intentionally kept **lightweight and framework-free**, focusing on clarity, speed, and easy backend integration.

---

## Purpose

The frontend allows users to:

* Configure backtest parameters (instrument, date range, strategy, inputs)
* Trigger a backtest via API
* Visualize results including:

  * Summary metrics (PnL, win rate, charges, capital)
  * Candle chart (OHLC)
  * Trade-by-trade breakdown
* Validate backend logic using **dummy responses** during development

---

## Tech Stack

* HTML
* CSS
* Vanilla JavaScript
* Fetch API for backend communication
* Chart library (as used in the project)

No frameworks are used to keep the UI portable and easy to host.

---

## Project Structure (Typical)

```
/
├── index.html
├── assets/
│   ├── css/
│   ├── js/
│   └── images/
├── pages/              # optional
├── components/         # optional
└── README.md
```

> Exact structure may vary slightly depending on the current iteration.

---

## Backend Dependency

This frontend **does not run backtests itself**.
It depends on a running backend service (FastAPI) that exposes a backtest API.

### Example Request Payload

```json
{
  "broker": "angelone",
  "instrument_id": "NFO:NIFTY-FUT-20260130",
  "start_date": "2025-12-01",
  "end_date": "2026-01-15",
  "strategy": "bucket1_momentum",
  "strategy_params": {
    "ema_fast": 9,
    "ema_slow": 21
  }
}
```

### Expected Response Shape

```json
{
  "run_id": "string",
  "summary": {},
  "candles": [],
  "trades": [],
  "exports": {}
}
```

The UI is built around this response contract.

---

## Local Development

### Run the frontend locally

Because browsers restrict `fetch()` calls from `file://`, use a local server.

#### Option 1 — VS Code Live Server

1. Install **Live Server**
2. Right-click `index.html`
3. Select **Open with Live Server**

#### Option 2 — Python static server

```bash
python -m http.server 5500
```

Open in browser:

```
http://localhost:5500
```

---

## API Base URL Configuration

Set the backend base URL in the frontend JavaScript config file.

Example:

```js
const API_BASE_URL = "http://127.0.0.1:8000";
```

For production:

```js
const API_BASE_URL = "https://your-backend-domain.com";
```

---

## Backtest Execution Flow

1. User selects backtest parameters in the UI
2. Clicks **Run Backtest**
3. Frontend sends request to backend
4. Backend runs backtest and returns result JSON
5. Frontend renders:

   * Summary cards
   * Candle chart
   * Trades table
   * Run metadata

---

## Dummy Data Support

During UI development, dummy responses are used to:

* Test charts
* Validate summary calculations
* Verify trade table rendering
* Simulate long backtest ranges

This allows frontend progress even when backend execution is unavailable.

---

## Deployment

This is a **static frontend** and can be hosted on:

* GitHub Pages
* Netlify / Vercel
* AWS S3 (static hosting)
* Any Nginx / Apache server

### GitHub Pages (Quick Setup)

1. Push the repository to GitHub
2. Go to **Settings → Pages**
3. Select:

   * Source: `Deploy from a branch`
   * Branch: `main`
   * Folder: `/ (root)`
4. Save — GitHub will provide the public URL

---

## Notes & Conventions

* All timestamps are ISO-8601 formatted
* Candle timestamps include timezone offset (`+05:30`)
* Trade signal metadata is stored as JSON strings:

  * `signals_json`
  * `entry_signals_json`
  * `exit_signals_json`
* Designed for **readability and debugging**, not minification

---

## Roadmap

* Backtest execution UI ✔
* Long-running job status polling
* Saved run history (run_id based)
* Export downloads from UI
* Paper-trade and live-trade views

---

## License

Private / Internal project — BePlus Algo Trading
Add a license file if open-sourcing in the future.
