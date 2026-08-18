# XYZ AI

Phase 1 scaffolding plus the Phase 2 mock school-data API for XYZ AI, a role-aware school assistant project.

## Included in this phase

- Placeholder login pages for Student, Parent, Teacher, and Principal portals
- Express backend health check
- React empty chat shell
- JSON-backed, swappable mock data repository with 10 students, 4 parents, 3 teachers, and 1 principal
- Attendance lookup, marking, school-wide analytics, and escalation mock endpoints

JWT authentication is included. Permission rules, AI integration, chat behavior, and later-phase features are not yet implemented.

## Run locally

In separate terminals:

```powershell
cd xyz-ai/backend
npm install
npm run dev
```

The health check is available at `http://localhost:3001/health`.

### Phase 2 mock API

- `GET /mock/attendance?studentId=student-001`
- `POST /mock/attendance/mark` with `{ "studentId", "date", "status" }` (`present`, `absent`, or `late`)
- `GET /mock/attendance/analytics` (intentionally has no auth enforcement in this phase)
- `POST /mock/escalate` with `{ "userId", "targetRole", "reason" }`

Run the API check with:

```powershell
cd xyz-ai/backend
npm test
```

### Authentication

Set `JWT_SECRET` to a long random value before starting the backend. Use
`POST /auth/login` with a seeded `{ "userId", "role" }` pair to obtain a bearer
token. All `/mock/*` endpoints require `Authorization: Bearer <token>`.

The verified JWT is the sole source for the current user's identity and role on
protected routes; `/mock/escalate` derives its `userId` from that token.

### Permission check stub

`POST /orchestrate` accepts `{ "intent", "entities" }`, derives the caller's
role exclusively from the verified JWT, and returns `{ "allowed": true }` or a
403 response explaining why the intent is disallowed. This is a permission stub
for the future conversation pipeline; it does not implement that pipeline.

```powershell
cd xyz-ai/frontend
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`).
