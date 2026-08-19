const MODELS = [
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
];
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

function isTestKeyMode() {
  return process.env.USE_TEST_KEY === 'true' || process.env.USE_TEST_KEY === '1';
}

function apiKey() {
  const useTest = isTestKeyMode();
  const key = useTest ? process.env.GEMINI_API_KEY_TEST : process.env.GEMINI_API_KEY;
  if (!key) {
    const keyName = useTest ? 'GEMINI_API_KEY_TEST' : 'GEMINI_API_KEY';
    throw new Error(`${keyName} is not set in the environment.`);
  }
  return key;
}

export function logKeyMode() {
  if (isTestKeyMode()) {
    console.log('[XYZ AI] Using TEST Gemini key');
  } else {
    console.log('[XYZ AI] Using MAIN Gemini key');
  }
}

async function callGemini(systemPrompt, userPrompt, responseMimeType = null) {
  const generationConfig = { temperature: 0.2 };
  if (responseMimeType) {
    generationConfig.responseMimeType = responseMimeType;
  }

  let lastError = null;
  for (const model of MODELS) {
    const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey()}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      console.log(`[GEMINI DIAG] Success with model ${model} — length=${text.length}`);
      return text;
    }

    const body = await res.text();
    console.error(`[GEMINI DIAG] Model ${model} returned HTTP ${res.status}: ${body.slice(0, 200)}`);
    lastError = new Error(`Gemini API error ${res.status}: ${body}`);
    lastError.status = res.status;
    if (res.status !== 429 && res.status !== 404) {
      throw lastError;
    }
  }

  throw lastError;
}

function stripFences(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return cleaned.trim();
}

const INTENTS = [
  'view_own_attendance',
  'view_child_attendance',
  'mark_attendance',
  'attendance_analytics',
  'escalate_to_human',
  'general_chat',
];

const LANGUAGES = {
  en: 'English',
  hi: 'Hindi',
  ta: 'Tamil',
  te: 'Telugu',
  mr: 'Marathi',
  bn: 'Bengali',
  gu: 'Gujarati',
  pa: 'Punjabi',
  kn: 'Kannada',
  ml: 'Malayalam',
  ur: 'Urdu',
};

export async function extractIntent(message, history) {
  const historyBlock = history && history.length
    ? `Recent conversation:\n${history.map((h) => `${h.role}: ${h.text}`).join('\n')}\n\n`
    : '';

  const systemPrompt = `You are an intent classifier for a school assistant chatbot.
Given the user's message and recent conversation context (if available), classify the intent and extract entities.

${historyBlock}Available intents: ${INTENTS.join(', ')}

Return ONLY strict JSON with no prose, no markdown fences:
{"intent":"<one of the intents>","entities":{...},"missing_fields":[]}

Rules:
- "view_own_attendance": user wants to see their own attendance, or is asking a follow-up question about their attendance (e.g. "what about last week?", "how about yesterday?", "and last month?").
- "view_child_attendance": user (a parent) wants to see their child's attendance, or follow up on their child's attendance.
- "mark_attendance": user wants to mark attendance for a student. Entities: {"studentId":"...","date":"...","status":"present|absent|late"}. Include missing fields in missing_fields array.
- "attendance_analytics": user wants school-wide attendance stats.
- "escalate_to_human": user wants to speak to a teacher/staff/principal, OR is confirming/accepting a previous assistant offer to escalate (e.g. replying "yes", "sure", "go ahead", "please do", "submit it" to a prior escalation prompt). Entities: {"targetRole":"teacher|principal"}.
- "general_chat": anything else — greeting, thanks, off-topic, or conversation not matching above intents.

CRITICAL INSTRUCTIONS:
1. Always analyze the conversation history to resolve pronouns, ellipsis, or follow-up questions. If the user previously asked about attendance and now asks "what about last week?", classify as "view_own_attendance".
2. If the conversation history shows the assistant previously asked about escalating to a staff member and the user's message is affirmative (yes, sure, go ahead, please do, submit it, ok, do it), classify as "escalate_to_human" and inherit the targetRole from the earlier context.`;

  let raw;
  try {
    console.log(`[GEMINI DIAG] extractIntent called for: "${message.slice(0, 60)}"`);
    raw = await callGemini(systemPrompt, message, 'application/json');
    console.log(`[GEMINI DIAG] extractIntent raw: ${raw.slice(0, 200)}`);
  } catch (err) {
    console.error(`[GEMINI DIAG] extractIntent FAILED: status=${err.status}, msg=${err.message.slice(0, 200)}`);
    if (err.status === 429 || err.status === 503) {
      console.warn('[GEMINI DIAG] Quota/503 hit on intent — falling back to general_chat');
      return { intent: 'general_chat', entities: { message }, missing_fields: [] };
    }
    throw err;
  }

  try {
    const parsed = JSON.parse(stripFences(raw));
    if (INTENTS.includes(parsed.intent)) {
      return { intent: parsed.intent, entities: parsed.entities ?? {}, missing_fields: parsed.missing_fields ?? [] };
    }
  } catch {
    // fall through
  }

  return { intent: 'general_chat', entities: { message }, missing_fields: [] };
}

const PERSONAS = {
  student: 'You are "XYZ AI", a friendly, supportive Academic Assistant for students. Use a warm, encouraging tone. Keep replies concise and helpful.',
  parent: 'You are "XYZ AI", a caring, patient Parent Support Assistant. Use a respectful, reassuring tone. Keep replies concise and helpful.',
  teacher: 'You are "XYZ AI", a professional, efficient Teaching Assistant. Use a collegial, clear tone. Keep replies concise and helpful.',
  principal: 'You are "XYZ AI", a professional Management Assistant. Use a formal, clear tone. Keep replies concise and helpful.',
};

export async function generateReply(role, intent, entities, apiResult, userMessage, history = [], language = 'en') {
  const persona = PERSONAS[role] ?? PERSONAS.student;
  const langName = LANGUAGES[language] ?? 'English';

  const systemPrompt = `${persona}

You are helping a ${role} in a school assistant chatbot called XYZ AI.
Generate a natural-language reply based on the intent and data below.
CRITICAL: Respond in ${langName}.
Be conversational but concise.
Do not output JSON — just the spoken reply as plain text in ${langName}.`;

  const historyBlock = history && history.length
    ? `Recent conversation:\n${history.slice(-4).map((h) => `${h.role}: ${h.text}`).join('\n')}\n`
    : '';

  const contextParts = [
    historyBlock,
    `User said: "${userMessage}"`,
    `Detected intent: ${intent}`,
    `Entities: ${JSON.stringify(entities)}`,
    `API result: ${JSON.stringify(apiResult)}`,
  ].filter(Boolean);

  let raw;
  try {
    console.log(`[GEMINI DIAG] generateReply called — intent=${intent}, lang=${language}`);
    raw = await callGemini(systemPrompt, contextParts.join('\n'));
  } catch (err) {
    console.error(`[GEMINI DIAG] generateReply FAILED: status=${err.status}, msg=${err.message.slice(0, 200)}`);
    if (err.status === 429 || err.status === 503) {
      console.warn('[GEMINI DIAG] Quota/503 hit on reply — using fallback');
      return generateFallbackReply(intent, entities, apiResult);
    }
    throw err;
  }
  return raw.trim();
}

function generateFallbackReply(intent, entities, apiResult) {
  if (intent === 'general_chat') return "I'm XYZ AI, your school assistant. How can I help you today?";
  if (intent === 'view_own_attendance' && apiResult?.student) {
    return `Hi ${apiResult.student.name}! Your current attendance is ${apiResult.student.attendancePercentage}%.`;
  }
  if (intent === 'view_own_attendance') return "Let me look up your attendance information.";
  if (intent === 'view_child_attendance' && apiResult?.student) {
    return `Here is the attendance for ${apiResult.student.name}: ${apiResult.student.attendancePercentage}%.`;
  }
  if (intent === 'attendance_analytics' && apiResult) {
    return `School-wide average attendance is ${apiResult.averageAttendancePercentage}% across ${apiResult.studentCount} students.`;
  }
  if (intent === 'escalate_to_human' && apiResult?.pending) {
    return apiResult.prompt;
  }
  if (intent === 'escalate_to_human' && apiResult?.ticketId) {
    return `Your escalation has been submitted. Ticket ID: ${apiResult.ticketId}. Someone will be in touch soon.`;
  }
  if (intent === 'mark_attendance' && apiResult?.attendance) {
    return `Attendance marked for ${apiResult.attendance.studentId} on ${apiResult.attendance.date} as ${apiResult.attendance.status}.`;
  }
  if (intent === 'mark_attendance' && apiResult?.error) {
    return `Could not mark attendance: ${apiResult.error}`;
  }
  if (apiResult?.error) return `There was an issue: ${apiResult.error}`;
  return "I've processed your request. Let me know if you need anything else!";
}
