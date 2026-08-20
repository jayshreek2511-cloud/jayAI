# 🤖 XYZ AI — Human-Like School Assistant

> Built for the **Bharat Academix AI & Machine Learning Competition 2026**

XYZ AI is a role-aware conversational school assistant that chats, listens, speaks, and animates a talking avatar. It enforces server-side permissions so each user can access only the information and actions appropriate to their role.

---

## ✨ Features

| Category | What it does |
| --- | --- |
| 💬 **Conversational Chat** | Natural-language chat backed by Gemini for intent extraction and persona-styled replies. |
| 🌐 **Multilingual** | Supports 11 languages: English, Hindi, Tamil, Telugu, Marathi, Bengali, Gujarati, Punjabi, Kannada, Malayalam, and Urdu. |
| 🎙️ **Voice Input** | Browser speech-to-text using the Web Speech API, with the locale selected from the language dropdown. |
| 🔊 **Voice Output** | Replies are spoken via `speechSynthesis`, matched to the selected language when a suitable browser voice is available. |
| 🧑‍🎨 **Talking Avatar** | Animated avatar with mouth movement while XYZ AI speaks. |
| 🔐 **Role-Based Permissions** | Each action is checked server-side against the caller's JWT-verified role. |
| 🧠 **Conversation Memory** | Retains recent turns per user so follow-up questions can use context. |
| 📣 **Escalation Flow** | Teacher-contact requests are confirmed before notification and support student→teacher, parent→teacher, principal→teacher, and teacher→student flows. |
| 🔔 **Notifications** | Role-specific alerts plus AI-triggered notification actions. |
| 🏠 **Shared Home Feed** | School events and celebrations in a social-feed-style home page. |
| 🛡️ **Security Hardened** | Guards against prompt injection, system-prompt extraction, and API-key extraction attempts. |
| 📱 **Responsive Dashboard** | Dashboard UI for laptop and mobile layouts. |

---

## 🏗️ Architecture

```text
User message
    │
    ▼
🔑 Role Resolver              — role comes only from the signed JWT
    │
    ▼
🧩 Intent + Entity Extraction — Gemini classifies into fixed intents
    │
    ▼
🧠 Context Manager            — recent conversation turns are supplied
    │
    ▼
🚦 Permission Check           — role-to-intent policy is enforced
    │
    ▼
📡 Mock API Layer             — attendance, escalation, notifications
    │
    ▼
🗣️ Persona Response Generator — role-appropriate reply in the selected language
    │
    ▼
Chat 💬 / Voice 🔊 / Avatar 🧑‍🎨
```

**Personas by role:**

- 🎓 Student — Friendly, supportive Academic Assistant
- 👨‍👩‍👧 Parent — Caring, patient Parent Support Assistant
- 👩‍🏫 Teacher — Professional Teaching Assistant
- 🏫 Principal — Professional Management Assistant

---

## 📁 Repository Structure

```text
School-ERP-Ecosystem/
├── 01-student-repository/student-portal/
├── 02-parent-repository/parent-portal/
├── 03-management-repository/management-portal/
├── 04-staff-repository/staff-portal/
└── 05-xyz-ai-repository/xyz-ai/
    ├── backend/     ← Express API, authentication, permissions, Gemini integration
    ├── frontend/    ← Vite + React dashboard UI
    ├── voice/       ← reserved voice assets/wrappers
    ├── avatar/      ← reserved talking-avatar assets
    └── README.md
```

The functional submission is in `05-xyz-ai-repository/xyz-ai/`; the other portals are intentionally lightweight entry points.

---

## 🚀 Getting Started

### 1. Backend

```powershell
cd 05-xyz-ai-repository/xyz-ai/backend
npm install
```

Create `backend/.env` from `backend/.env.example`:

```env
JWT_SECRET=your-long-random-secret
GEMINI_API_KEY=your-real-gemini-key

# Optional development key that protects the main key's free-tier quota
GEMINI_API_KEY_TEST=
USE_TEST_KEY=false
```

Then start the API:

```powershell
npm run dev
```

The backend runs at `http://localhost:3001`.

### 2. Frontend

Open a second terminal:

```powershell
cd 05-xyz-ai-repository/xyz-ai/frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

> 🎙️ Voice features work best in Chrome, Edge, or Brave. Firefox and Safari have limited Web Speech API support.

---

## 👥 Demo Test Users

The demo login does not require a password; enter a seeded ID and select its matching role.

| Name | User ID | Role | Notes |
| --- | --- | --- | --- |
| Aarav Sharma | `student-001` | Student | Class 6A |
| Neha Sharma | `parent-001` | Parent | Linked to Aarav |
| Priya Menon | `teacher-001` | Teacher | Class 6A |
| Dr. Ritu Verma | `principal-001` | Principal | School-wide access |

---

## 🎙️ Voice Input Notes

Voice input uses Chrome's Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition`) with `continuous = false`, `interimResults = true`, and a locale derived from the language dropdown. Chrome's recognition service requires network access even though it is started locally.

The recognizer is cleaned up whenever the Chat view unmounts and uses a single active-instance guard, preventing a stale recognition session from surviving navigation and conflicting with a new one. If recognition fails, the browser console logs the complete native `SpeechRecognitionErrorEvent` for diagnosis.

For a voice test, allow microphone access for `localhost:5173`, navigate to **Chat**, click the microphone, speak a short phrase, and confirm that the recognized text appears in the message field.

---

## 🛡️ Security Notes

- **Role claims** — the role is read only from the verified JWT; claims in chat text are ignored.
- **Prompt injection** — instructions such as “ignore your instructions” cannot change permissions because authorization never comes from the message.
- **System-prompt extraction** — requests for hidden instructions are refused at both prompt and application layers.
- **API-key extraction** — Gemini keys are read server-side from environment variables and never exposed to the frontend.
- **Unauthorized actions** — mutating actions re-check role and ownership server-side before execution.

---

## ⚠️ Known Limitations

- Gemini free-tier limits can affect live AI replies. Use `GEMINI_API_KEY_TEST` with `USE_TEST_KEY=true` during development when appropriate.
- Web Speech API support, network availability, and recognition accuracy vary by browser and locale.
- Teacher and principal deep-dive reports are beyond the current demo scope.
- The four portal applications are intentionally minimal; functional features live in XYZ AI.

---

## 💛 Credits

Built for the Bharat Academix AI & Machine Learning Competition 2026.
**Powered by XYZ AI**
