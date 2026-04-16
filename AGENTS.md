# Campus Event Finder - Agent Guide

## Project Structure

Two separate Node.js projects:
- `campus-event-finder/` - Angular 21 frontend
- `campus-event-finder-backend/` - Express + TypeScript API

## Running the App

**Backend** (port 5000):
```bash
cd campus-event-finder-backend/campus-event-finder-backend-main
npm start        # production mode
npm run dev      # with hot reload (nodemon)
```

**Frontend** (port 4200):
```bash
cd campus-event-finder/campus-event-finder/frontend
ng serve         # dev server with hot reload
ng build         # production build
ng test          # Vitest unit tests
```

## Database

- MySQL at `127.0.0.1:3306` (configurable via `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` env vars)
- Database auto-creates on first run via `schema.auto.sql`
- Default DB: `campus_event_finder`

## API Endpoints

Backend runs at `http://localhost:5000`:
- `GET /api/events` - List all events (seeds default events on first call)
- `POST /api/events` - Create event
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event
- `POST /api/events/:id/likes` - Like event
- `POST /api/events/:id/comments` - Add comment
- `POST /api/events/:id/registrations` - Register for event
- `GET /api/users` - List users
- `POST /api/users/login` - Login
- `POST /api/users/register` - Register

## Key Conventions

- **Email validation**: Only `@liceo.edu.ph` emails allowed
- **Departments**: 8 department options + Main Administration. All aliases normalized via `department-directory.ts`
- **Roles**: `student`, `admin`, `main-admin`
- **Passwords**: Stored in plain text (demo app - not production-ready)

## Demo Accounts

16 pre-seeded accounts with pattern `<dept>.<role>@liceo.edu.ph`:
- e.g., `cs.admin@liceo.edu.ph` / `CSAdmin123`
- e.g., `main.admin@liceo.edu.ph` / `MainAdmin123`

## Mock Data Behavior

- Default events seed with 110+ mock comments and 120+ mock registrations on first GET
- New events created via POST do NOT get mock data
- Useful for testing UI with realistic engagement metrics

## Angular Conventions

- Component files: `*.component.ts` + `*.component.html` in same folder
- Services use `providedIn: 'root'`
- Guards: `authGuard`, `adminGuard`, `studentGuard` in `src/app/guards/`
- `app.routes.ts` defines all routes with guard protection
- No standalone components - all use module pattern via `app.config.ts`
