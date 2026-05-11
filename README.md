# Portfolio Dashboard

Vite + React portfolio decision dashboard.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy

Push to `main`. GitHub Actions deploys to GitHub Pages.

## Current features

- Market / group / tag filtering
- Keyword search
- Manual USD/JPY setting
- Manual input for shares, average price, current price, annual dividend
- Market value, unrealized P/L, annual dividend, dividend yield calculation
- Sector allocation summary
- Risk warnings
- CSV export
- Browser localStorage persistence

## Known limits

- No automatic stock price acquisition
- No automatic FX acquisition
- No automatic dividend history, payout ratio, or operating cash flow acquisition
- Local input data is stored only in the browser where it was entered
