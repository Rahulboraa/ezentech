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
| Production | PROD | Assemble units, customers, edit/delete, mark rework complete   |
| Dispatch   | DISP | Log driver, vehicle and destination for a unit leaving         |
| Gate       | GATE | Raise an entry request for a returned unit                     |
| Quality    | QUAL | Approve / reject a gate request, then issue it to Production   |
| Admin      | ADMN | Manage the station roster, reset any PIN, see every screen     |

**Rotate every PIN before go-live.** Each station can change its own from the
user menu at the bottom of the sidebar; Admin can add stations, reset any PIN and
deactivate a login from **Stations**. PINs are 4–12 characters and stored as
bcrypt hashes.

## Flow

A unit is **New Production** until it comes back through the Gate; from then on it is **Rework** and may
only be dispatched after Quality approves it, Quality issues it to Production, and Production marks the
rework complete. Serial numbers are unique across every unit and part — the server rejects a repeat.

Unit IDs follow the 17-character VOLTAS format:

| Chars | Meaning                                    | Source          |
| ----- | ------------------------------------------ | --------------- |
| 1–7   | VOLTAS product code                        | operator        |
| 8     | Product variant (critical part change)     | operator        |
| 9–10  | Year (2026 → `26`)                         | automatic       |
| 11    | Month, Jan `A` … Dec `L`                   | automatic       |
| 12    | Amber WAC code / manufacturing line        | station setting |
| 13    | Time slot, 09:00 `A`, one letter per hour  | automatic       |
| 14–17 | Random alphanumeric serial                 | server          |

## Scripts

- `npm run dev` — API + client with hot reload
- `npm run build` — client bundle then server TypeScript
- `npm start` — production server, also serves `client/dist`
- `npm test` — vitest (unit ID format, gate/rework state machine)
- `npm run seed` — station logins only (empty line)
- `npm run seed:demo` — 4 customers and 14 units covering every gate/dispatch state

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
- The first boot seeds the four station logins. Rotate the PINs immediately.

Render is also configured (`render.yaml`) if you would rather run it as one long-lived service.
