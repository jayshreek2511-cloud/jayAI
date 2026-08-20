# XYZ AI

XYZ AI is a role-aware school assistant built for the **Bharat Academix AI & ML Competition 2026**. It gives students, parents, teachers, and school leadership one conversational interface for school information, attendance workflows, notifications, and escalation, while tailoring what each role may access.

## Architecture

Each request follows a controlled pipeline: **Role Resolver → Intent/Entity Extraction (Gemini) → Context Manager → Permission Check → Mock API → Persona Response Generator → Chat/Voice/Avatar Output**. The backend resolves the signed-in identity from a JWT, retains relevant conversation context, validates the requested action before accessing data, then returns a role-appropriate response to the React interface. Browser speech and the animated avatar present the response as voice and visual output.

## Run locally

Prerequisites: Node.js 20+ and a Gemini API key.

1. Create `backend/.env` from `backend/.env.example` and set:

   ```env
   JWT_SECRET=use-a-long-random-local-secret
   GEMINI_API_KEY=your-gemini-api-key
   GEMINI_API_KEY_TEST=optional-separate-development-key
   USE_TEST_KEY=false
   ```

   Set `USE_TEST_KEY=true` to use `GEMINI_API_KEY_TEST` during development and preserve the demo key's quota. Do not commit real keys.

2. Start the backend in one terminal:

   ```powershell
   cd backend
   npm install
   npm run dev
   ```

   The API listens on `http://localhost:3001`.

3. Start the frontend in another terminal:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

   Open `http://localhost:5173`.

## Demo users

The demo login has no password; choose the matching role and enter one of these seeded IDs.

| User ID | Role | Demo identity |
| --- | --- | --- |
| `student-001` | `student` | Aarav Sharma |
| `parent-001` | `parent` | Neha Sharma |
| `teacher-001` | `teacher` | Priya Menon |
| `principal-001` | `principal` | Dr. Ritu Verma |

## Implemented features

- Multilingual chat across 11 supported languages.
- Browser voice input and text-to-speech voice replies.
- Animated talking avatar synchronized with voice output.
- Role-based permissions and JWT-backed identity enforcement.
- Escalation workflow for issues that need another school role.
- Notifications, including chat-triggered `notify_parent` actions with confirmation.
- Role-differentiated dashboards for student, parent, teacher, and principal experiences.

## Security notes

- Prompt-injection attempts are treated as untrusted input and are blocked from changing instructions or identity.
- Requests to reveal system prompts, hidden instructions, credentials, or configuration are refused.
- Gemini keys are read only from environment variables; the optional test key helps protect the demo key's quota.
- The active role is derived only from the signed JWT—never from chat text or client-supplied conversational claims.

## Known limitations

- Gemini free-tier daily quota limits can affect live AI responses; use the optional test key during development.
- Teacher and principal deep-view capabilities are intentionally deferred beyond the current demo scope.
- Browser speech recognition support varies; Chrome is recommended for voice input.
