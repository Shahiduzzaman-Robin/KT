# M/S Kamrul Traders Transaction Management App

Fast full-stack transaction system for income/outgoing tracking, ledger autocomplete, analytics, and CSV export.

## Stack
- Frontend: React + Vite + Tailwind CSS + Recharts
- Backend: Node.js + Express + MongoDB + Mongoose
- API client: Axios
- Authentication: JWT login with role-based access

## Features Implemented
- Transaction CRUD (income/outgoing) with BDT display (৳)
- Ledger CRUD with types: customer, supplier, employee, other
- Instant ledger autocomplete (`/api/ledgers?search=Kam&limit=5`)
- Daily, monthly, yearly summaries
- Category breakdown analytics (chart-ready)
- Filters: date range, type, min/max amount
- High-value transaction highlight
- CSV export for transactions
- Audit trail model for create/update/delete actions
- Login system with seeded users:
  - `admin` / `admin123`
  - `entry` / `entry123`
  - `viewer` / `viewer123`
- Color coding:
  - Income: green
  - Outgoing: red

## Folder Structure

```text
backend/
  server.js
  models/
  routes/
  utils/
frontend/
  src/
    components/
    pages/
    utils/
```

## Run Locally

### 1) Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Backend default URL: `http://localhost:5000`
Auth is exposed at `POST /api/auth/login` and `GET /api/auth/me`.

### 2) Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend default URL: `http://localhost:5173`

Open `http://localhost:5173/login` to sign in.

## API Endpoints

### Ledger
- `GET /api/ledgers?search=Kam&limit=5`
- `POST /api/ledgers`
- `PUT /api/ledgers/:id`
- `DELETE /api/ledgers/:id`

### Transactions
- `GET /api/transactions`
- `POST /api/transactions`
- `PUT /api/transactions/:id`
- `DELETE /api/transactions/:id`

### Summary
- `GET /api/summary/daily?date=YYYY-MM-DD`
- `GET /api/summary/monthly?month=YYYY-MM`
- `GET /api/summary/yearly?year=YYYY`
- `GET /api/summary/category-breakdown?from=YYYY-MM-DD&to=YYYY-MM-DD`

### Export
- `GET /api/exports/transactions.csv?from=YYYY-MM-DD&to=YYYY-MM-DD`

## Notes
- Authentication and RBAC are enabled with JWT sessions.
- Add Redis caching for hot autocomplete queries if ledger volume grows further.
- Mongo index on ledger name is enabled for fast suggestions.
- Before any UI or styling changes, review `frontend/DESIGN.md` and follow it as the canonical design guide.
