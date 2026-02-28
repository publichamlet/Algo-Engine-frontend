# BePlus Algo --- Frontend (Backtesting Web UI)

Version: 3.0\
Last Updated: 2026

------------------------------------------------------------------------

## Overview

This repository contains the BePlus Algo Trading frontend web
application.

It is a lightweight, framework-free web interface for configuring,
triggering, and visualizing algorithmic backtests executed by the BePlus
Algo backend.

The UI is intentionally built using HTML, CSS, and Vanilla JavaScript
only to ensure:

-   Simple backend integration\
-   Transparent debugging\
-   Static hosting compatibility\
-   Full control over performance rendering

------------------------------------------------------------------------

## Tech Stack

-   HTML (index.html)
-   CSS (styles.css)
-   Vanilla JavaScript (app.js, ui_options.js)
-   TradingView Lightweight Charts (CDN)
-   Fetch API

No frontend framework is used.

------------------------------------------------------------------------

## Current Project Structure

    /
    ├── index.html
    ├── styles.css
    ├── app.js
    ├── ui_options.js
    ├── dummy-data.js
    ├── config/
    │   └── ui-options.json
    └── README.md

------------------------------------------------------------------------

## UI Configuration System

All dropdowns and strategy parameters are controlled by:

config/ui-options.json

This JSON defines:

-   Broker options
-   Instrument options
-   Strategy list
-   Strategy parameters
-   Strategy behavior rules (e.g., requires instrument)

------------------------------------------------------------------------

## Backend Dependency

This frontend does not execute backtests locally.

It requires the BePlus Algo backend (FastAPI).

API Base (in app.js):

``` js
const API_BASE = "http://localhost:8000";
```

Endpoints Used:

-   POST /api/backtests/run\
-   GET /api/backtests/{run_id}

------------------------------------------------------------------------

## Request Payload Structure

The UI sends:

-   broker
-   instrument_id
-   timeframe
-   start_ist
-   end_ist
-   capital
-   qty
-   strategy
-   strategy_params
-   feature_pack

------------------------------------------------------------------------

# KPI Dashboard System

The KPI system provides:

-   Professional definitions
-   Structured evaluation ranges
-   Risk grading guidance
-   Clear calculation logic
-   Split-value display for key metrics

Net PnL and Max Drawdown display both absolute and percentage values.

------------------------------------------------------------------------

# KPI Documentation (Complete)

## Net PnL

Definition: Net profit or loss after deducting all trading charges.\
Calculation: Gross PnL − Total Charges.

Evaluation (as % of Starting Capital): - Negative → Not usable - 0--5% →
Very weak - 5--10% → Average - 10--20% → Good - 20--40% → Very good -
40%+ → Excellent

Side Value: Percentage shows return relative to Starting Capital.

------------------------------------------------------------------------

## Profit Factor

Definition: Measures profit earned for every unit of loss.\
Calculation: Gross Profit ÷ Gross Loss.

Evaluation: - \<1.0 → Losing - 1.0--1.2 → Weak - 1.2--1.4 → Average -
1.4--1.8 → Good - 1.8--2.5 → Very good - \>2.5 → Excellent

Higher is better.

------------------------------------------------------------------------

## Max Drawdown

Definition: Largest decline in account value from a previous peak to the
lowest point before a new peak forms.\
Calculation: (Peak Equity − Lowest Equity) ÷ Peak Equity.

Evaluation: - \>40% → Very High Risk - 30--40% → Risky - 20--30% →
Average - 10--20% → Good - \<10% → Excellent

Side Value: - Amount = Maximum loss from peak - Percentage = Loss
relative to peak equity

Lower is better.

------------------------------------------------------------------------

## Total Trades

Definition: Number of completed trades in the backtest.

------------------------------------------------------------------------

## Win Rate

Definition: Percentage of trades that ended in profit.\
Calculation: Winning Trades ÷ Total Trades.

Evaluation: - \<40% → Weak - 40--50% → Average - 50--60% → Good -
60--70% → Very good - \>70% → Excellent

------------------------------------------------------------------------

## Expectancy (₹ per trade)

Definition: Average net profit per trade.\
Calculation: Net PnL ÷ Total Trades.

Evaluation: - Negative → Not usable - Near zero → Very weak - Small
positive → Average - Strong positive → Good - High and consistent →
Excellent

------------------------------------------------------------------------

## Payoff Ratio

Definition: Average win size relative to average loss size.\
Calculation: Average Win ÷ Average Loss.

Evaluation: - \<0.8 → Weak - 0.8--1.0 → Average - 1.0--1.5 → Good -
1.5--2.0 → Very good - \>2.0 → Excellent

------------------------------------------------------------------------

## Charges Ratio

Definition: Portion of gross profit consumed by trading costs.\
Calculation: Total Charges ÷ Gross Profit.

Evaluation: - \>60% → Very inefficient - 40--60% → Risky - 30--40% →
Average - 20--30% → Good - \<20% → Excellent

Lower is better.

------------------------------------------------------------------------

## Recovery Factor

Definition: Efficiency of profit relative to drawdown.\
Calculation: Net Profit ÷ Max Drawdown.

Evaluation: - \<1.0 → Weak - 1.0--1.5 → Average - 1.5--2.0 → Good -
2.0--3.0 → Very good - \>3.0 → Excellent

------------------------------------------------------------------------

## Profitable Months %

Definition: Percentage of months with positive Net PnL.\
Calculation: Profitable Months ÷ Total Months.

Evaluation: - \<40% → Inconsistent - 40--55% → Average - 55--65% →
Good - 65--75% → Very good - \>75% → Excellent

------------------------------------------------------------------------

## Worst Month Net

Definition: Largest monthly net loss.

Evaluation: - \>25% → Very risky - 15--25% → Risky - 10--15% → Average -
5--10% → Good - \<5% → Excellent

------------------------------------------------------------------------

## Longest Losing Streak

Definition: Maximum consecutive losing trades.

Evaluation: - \>10 → Very stressful - 6--10 → Risky - 4--6 → Average -
2--4 → Good - 0--2 → Excellent

------------------------------------------------------------------------

## Avg Trades/Day

Definition: Average number of trades per trading day.

Higher values increase cost exposure.\
Lower values reduce capital deployment speed.

------------------------------------------------------------------------

## Avg Holding Time

Definition: Average duration a trade remains open.

Shorter duration reduces overnight risk.\
Longer duration increases exposure to volatility.

------------------------------------------------------------------------

## Overnight Trades %

Definition: Percentage of trades held beyond same trading day.

Evaluation: - \>40% → High gap risk - 20--40% → Moderate - \<20% → Lower
risk

------------------------------------------------------------------------

## Gross PnL

Definition: Total profit before charges.

------------------------------------------------------------------------

## Total Charges

Definition: Estimated brokerage, exchange fees, and taxes.

------------------------------------------------------------------------

## Winning Trades

Definition: Number of profitable trades.

------------------------------------------------------------------------

## Losing Trades

Definition: Number of losing trades.

------------------------------------------------------------------------

## Starting Capital

Definition: Initial capital used for simulation.

------------------------------------------------------------------------

## Ending Capital

Definition: Final capital after backtest.\
Calculation: Starting Capital + Net PnL.

------------------------------------------------------------------------

## Deployment

This is a static frontend and can be hosted on:

-   GitHub Pages
-   Netlify
-   Vercel
-   AWS S3
-   Nginx / Apache

------------------------------------------------------------------------

## License

Private / Internal Project\
BePlus Algo Trading
