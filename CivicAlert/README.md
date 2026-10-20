# CivicAlert

CivicAlert is a browser-based prototype with Resident, CEPALCO, and Water District portals. It follows this stack:

| Layer | Technology |
|---|---|
| Frontend framework | React 18 |
| Programming language | TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS |
| Prototype storage | Browser `localStorage` |
| Notification demonstration | Simulated SMS records and a virtual inbox |

No backend, database, SMS provider, or live message transmission is required to run the prototype. The existing code under `backend/` is retained as a separate, inactive backend workspace; the frontend does not call it.

## Project structure

- `frontend/apps/` — Resident, CEPALCO, and Water District Vite applications.
- `frontend/packages/ui/` — shared React interface, Tailwind styles, local demo settings, and `localStorage` prototype data.
- `backend/` — inactive previous API implementation and its local database; it is not included in the active npm workspaces.
- `package.json`, `package-lock.json`, and `tsconfig.json` — root workspace and tool configuration.

## Requirements

- Node.js 20 or newer
- npm 10 or newer

Install dependencies from the project root:

```powershell
npm install
```

Run all three frontends:

```powershell
npm run dev:all
```

Open the URLs printed by Vite. The usual addresses are:

- Resident: `http://localhost:5173`
- CEPALCO: `http://localhost:5174`
- Water District: `http://localhost:5175`

You can run one portal instead:

```powershell
npm run dev:resident
npm run dev:cepalco
npm run dev:water
```

## Demo accounts and data

CEPALCO and Water District demo administrator accounts use the password `DemoPass123!`:

| Portal | Username |
|---|---|
| CEPALCO | `admin@cepalco.local` |
| Water District | `admin@waterdistrict.local` |

Residents can register from the Resident portal. Demo accounts, resident profiles, advisories, maintenance, reports, preferences, and virtual-inbox messages are stored in this browser's `localStorage`. Each browser profile has its own data. Clearing the site's local storage resets the prototype and its sample records.

Publishing an advisory or maintenance item creates simulated notification records for opted-in demo residents. Review them under **Virtual SMS inbox**. These are demonstration records only; no SMS is sent to any phone.

This client-side prototype is for demonstration, not production authentication or storage. Data remains on the device/browser where it was entered and is not protected by a server.

## Checks

```powershell
npm run typecheck
npm run build
```
