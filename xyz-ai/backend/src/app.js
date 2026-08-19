import express from 'express';
import { requireAuthentication, signJwt } from './auth/jwt.js';
import { createJsonMockRepository } from './data/jsonMockRepository.js';
import { checkPermission } from './permissions.js';
import { extractIntent, generateReply } from './gemini.js';
import { getHistory, appendTurn } from './context.js';

export function createApp({ repository = createJsonMockRepository(), jwtSecret } = {}) {
  if (!jwtSecret) {
    throw new Error('JWT_SECRET must be configured before starting the backend.');
  }

  const app = express();

  app.use(express.json());

  app.use((request, response, next) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (request.method === 'OPTIONS') {
      return response.status(200).end();
    }
    next();
  });

  app.get('/health', (_request, response) => {
    response.status(200).json({ status: 'ok', service: 'xyz-ai-backend' });
  });

  app.post('/auth/login', (request, response) => {
    const { userId, role } = request.body ?? {};
    if (!userId || !role) {
      return response.status(400).json({ error: 'userId and role are required.' });
    }

    const identity = repository.getLoginIdentity(userId, role);
    if (!identity) {
      return response.status(401).json({ error: 'Invalid userId or role.' });
    }

    return response.status(200).json({ token: signJwt(identity, jwtSecret) });
  });

  const authenticate = requireAuthentication({ jwtSecret });

  app.post('/orchestrate', authenticate, async (request, response) => {
    try {
      const { message: rawMessage, intent: legacyIntent, entities: legacyEntities, language = 'en' } = request.body ?? {};

      const { userId, role, linkedStudentId, linkedClassId } = request.auth;

      // Backward-compatible path: if caller sends { intent, entities } (no message),
      // skip Gemini extraction and use the old permission-check-and-echo behavior.
      if (!rawMessage && legacyIntent) {
        if (!checkPermission(role, legacyIntent)) {
          return response.status(403).json({
            allowed: false,
            reason: `The ${role} role is not allowed to perform ${legacyIntent}.`,
          });
        }
        return response.status(200).json({ allowed: true, intent: legacyIntent, entities: legacyEntities ?? {} });
      }

      if (!rawMessage || typeof rawMessage !== 'string') {
        return response.status(400).json({ error: 'message is required.' });
      }

      const history = getHistory(userId);

      appendTurn(userId, 'user', rawMessage);

      const extraction = await extractIntent(rawMessage, history);
      const { intent, entities, missing_fields } = extraction;

      if (!checkPermission(role, intent)) {
        let reply;
        try {
          reply = await generateReply(
            role, intent, entities,
            { allowed: false, reason: `The ${role} role is not allowed to perform ${intent}.` },
            rawMessage,
            history,
            language,
          );
        } catch {
          reply = `Sorry, the ${role} role is not allowed to perform "${intent}".`;
        }
        appendTurn(userId, 'assistant', reply);
        return response.status(403).json({
          allowed: false,
          intent,
          entities,
          reply,
        });
      }

      let apiResult = null;

      if (intent === 'view_own_attendance') {
        const studentId = role === 'student' ? userId : linkedStudentId;
        if (!studentId) {
          apiResult = { error: 'No linked student found.' };
        } else {
          apiResult = repository.getStudentAttendance(studentId);
          if (!apiResult) apiResult = { error: 'Student not found.' };
        }
      } else if (intent === 'view_child_attendance') {
        if (!linkedStudentId) {
          apiResult = { error: 'No linked student found for this parent.' };
        } else {
          apiResult = repository.getStudentAttendance(linkedStudentId);
          if (!apiResult) apiResult = { error: 'Student not found.' };
        }
      } else if (intent === 'view_class_attendance') {
        if (!linkedClassId) {
          apiResult = { error: 'No linked class found for this teacher.' };
        } else {
          const classStudents = [
            'student-001', 'student-002', 'student-003', 'student-004',
            'student-005', 'student-006', 'student-007', 'student-008',
            'student-009', 'student-010',
          ];
          const records = [];
          for (const sid of classStudents) {
            const att = repository.getStudentAttendance(sid);
            if (att && att.student.class === linkedClassId) {
              records.push({ student: att.student, records: att.records });
            }
          }
          apiResult = { class: linkedClassId, students: records };
        }
      } else if (intent === 'mark_attendance') {
        if (missing_fields.length > 0) {
          apiResult = { error: 'Missing required fields', missing_fields };
        } else {
          const record = repository.markAttendance({
            studentId: entities.studentId,
            date: entities.date,
            status: entities.status,
          });
          if (record === 'not-found') {
            apiResult = { error: 'Student not found.' };
          } else if (record === 'invalid-status') {
            apiResult = { error: 'Status must be present, absent, or late.' };
          } else {
            apiResult = { message: 'Attendance marked.', attendance: record };
          }
        }
      } else if (intent === 'attendance_analytics') {
        apiResult = repository.getAttendanceAnalytics();
      } else if (intent === 'escalate_to_human') {
        const historyText = history.map((h) => h.text).join(' ').toLowerCase();
        const confirming = /\b(yes|confirm|sure|go ahead|please do|submit it|do it)\b/.test(rawMessage.toLowerCase());
        const wasAsked = /\b(would you like|shall i|should i|confirm|submit)\b/.test(historyText);

        if (confirming || (wasAsked && !/\b(no|cancel|never mind|don't)\b/.test(rawMessage.toLowerCase()))) {
          const targetRole = entities.targetRole ?? 'teacher';
          const reason = entities.reason ?? `User requested escalation to ${targetRole}`;
          apiResult = repository.createEscalation({ userId, targetRole, reason });
        } else {
          apiResult = {
            pending: true,
            prompt: `Would you like me to submit an escalation to the ${entities.targetRole ?? 'teacher'}?`,
          };
        }
      }
      // general_chat → apiResult stays null, skip mock API call

      const reply = await generateReply(role, intent, entities, apiResult, rawMessage, history, language);
      appendTurn(userId, 'assistant', reply);

      return response.status(200).json({ allowed: true, intent, entities, reply });
    } catch (error) {
      console.error('Orchestrate error:', error);
      return response.status(500).json({ error: 'Internal error processing your request.' });
    }
  });

  app.get('/mock/attendance', authenticate, (request, response) => {
    const { studentId } = request.query;
    if (!studentId) {
      return response.status(400).json({ error: 'studentId is required.' });
    }

    const attendance = repository.getStudentAttendance(studentId);
    if (!attendance) {
      return response.status(404).json({ error: 'Student not found.' });
    }

    return response.status(200).json(attendance);
  });

  app.post('/mock/attendance/mark', authenticate, (request, response) => {
    const { studentId, date, status } = request.body ?? {};
    if (!studentId || !date || !status) {
      return response.status(400).json({ error: 'studentId, date, and status are required.' });
    }

    const record = repository.markAttendance({ studentId, date, status });
    if (record === 'not-found') {
      return response.status(404).json({ error: 'Student not found.' });
    }
    if (record === 'invalid-status') {
      return response.status(400).json({ error: 'status must be present, absent, or late.' });
    }

    return response.status(201).json({ message: 'Attendance marked.', attendance: record });
  });

  // Authorization rules are intentionally deferred to the permissions phase.
  app.get('/mock/attendance/analytics', authenticate, (_request, response) => {
    response.status(200).json(repository.getAttendanceAnalytics());
  });

  app.post('/mock/escalate', authenticate, (request, response) => {
    const { targetRole, reason } = request.body ?? {};
    if (!targetRole || !reason) {
      return response.status(400).json({ error: 'targetRole and reason are required.' });
    }

    return response.status(201).json(
      repository.createEscalation({ userId: request.auth.userId, targetRole, reason }),
    );
  });

  return app;
}
