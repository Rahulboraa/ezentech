# EZENTECH Unit Assembly Station

Shop-floor serial traceability for AC units — assembly, dispatch, gate returns and quality release.
React + Vite client, Express + MongoDB API, one npm workspace repo.

## Run locally

```bash
cp .env.example .env      # MONGODB_URI, JWT_SECRET
npm install
npm run dev               # API on :5100, client on :5173 (proxied)
```

`npm run seed` creates the four station logins if they are missing (also runs on every boot):

| Station    | PIN  | Can do                                                       |
| ---------- | ---- | ------------------------------------------------------------ |
| Production | PROD | Assemble units, models, customers, edit/delete, mark rework complete |
| Dispatch   | DISP | Load a truck: one driver, vehicle, destination and invoice for many units |
| Gate       | GATE | Raise an entry request for a returned unit                     |
| Quality    | QUAL | Approve / reject a gate request, then issue it to Production   |
| Customer   | —    | Sees only its own machines, their status, and raises complaints |
| Admin      | ADMN | Manage the station roster, reset any PIN, see every screen     |

**Rotate every PIN before go-live.** Each station can change its own from the
user menu at the bottom of the sidebar; Admin can add stations, reset any PIN and
deactivate a login from **Stations**. PINs are 4–12 characters and stored as
bcrypt hashes.

## What the operator actually does

The line runs fast and one model for a whole batch, so nothing about the serial
format is asked of the operator. A **model** — set up once on the Models screen —
carries the product code, variant and assembly type. The operator picks it at
changeover, then only scans part barcodes and presses **Log unit**; the Unit ID
is composed server-side. The model, the operator name and the manufacturing line
all survive a log and a page reload, so a shift is one selection followed by
scanning.

Dispatch works the same way round: a truck carries many units under one invoice,
so the driver, vehicle, destination and invoice number are entered once and every
unit scanned onto that truck is stamped with them in a single save. A unit that
is not allowed to leave is reported back by ID and stays behind — the rest of the
load still goes out.

## Flow

A customer reports a problem against a serial from its own login. The gate receives the machine, raises the entry
request, and the usual cycle follows. Anything past the 365-day warranty window is refused — the customer cannot
report it and the gate cannot take it in.

A unit is **New Production** until it comes back through the Gate; from then on it is **Rework** and may
only be dispatched after Quality approves it, Quality issues it to Production, and Production marks the
rework complete. Serial numbers are unique across every unit and part — the server rejects a repeat.

Unit IDs follow the 17-character VOLTAS format:

| Chars | Meaning                                    | Source          |
| ----- | ------------------------------------------ | --------------- |
| 1–7   | VOLTAS product code                        | model           |
| 8     | Product variant (critical part change)     | model           |
| 9–10  | Year (2026 → `26`)                         | automatic       |
| 11    | Month, Jan `A` … Dec `L`                   | automatic       |
| 12    | Amber WAC code / manufacturing line        | station setting |
| 13    | Time slot, 09:00 `A`, one letter per hour  | automatic       |
| 14–17 | Random alphanumeric serial                 | server          |

Nothing in that table is typed per unit. Chars 1–8 come from the selected model,
char 12 from the station's line setting, and the rest from the clock and the
server.

## Scripts

- `npm run dev` — API + client with hot reload
- `npm run build` — client bundle then server TypeScript
- `npm start` — production server, also serves `client/dist`
- `npm test` — vitest (unit ID format, gate/rework state machine)
- `npm run seed` — station logins only (empty line; add your own models before logging)
- `npm run seed:demo` — 4 models, 4 customers and 14 units covering every gate/dispatch state

## Deploy (Vercel)

`vercel.json` builds the client and serves the API from `api/index.ts`.

- **Root Directory: the repo root**, not `client/` — the function imports `../server/src`.
- Framework preset: **Other**. Build command and output directory come from `vercel.json`.
- Environment variables (all environments):

  | Variable      | Value                                                                 |
  | ------------- | --------------------------------------------------------------------- |
  | `MONGODB_URI` | `mongodb+srv://…@cluster.mongodb.net/ezentech-assembly?retryWrites=true&w=majority` |
  | `JWT_SECRET`  | 32+ random characters — the server refuses to boot on a placeholder    |

  `PORT` is unused on serverless and Vercel sets `NODE_ENV` itself.

- Atlas → Network Access must allow `0.0.0.0/0` so Vercel can connect.
- `GET /api/health` returning `{"ok":true}` means the API and database are both up.
- The first boot seeds the station logins. Rotate the PINs immediately, then add
  the plant's models from **Models** — the assembly tray stays closed until one exists.

Render is also configured (`render.yaml`) if you would rather run it as one long-lived service.
