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

Rotate the PINs before go-live.

## Flow

A unit is **New Production** until it comes back through the Gate; from then on it is **Rework** and may
only be dispatched after Quality approves it, Quality issues it to Production, and Production marks the
rework complete. Serial numbers are unique across every unit and part — the server rejects a repeat.

Unit IDs follow the 17-character VOLTAS format: 8-char product code, 2-digit year, month letter (A–L),
a fixed `N`, then a 5-character serial allocated by the server.

## Scripts

- `npm run dev` — API + client with hot reload
- `npm run build` — client bundle then server TypeScript
- `npm start` — production server, also serves `client/dist`
- `npm test` — vitest (unit ID format, gate/rework state machine)
