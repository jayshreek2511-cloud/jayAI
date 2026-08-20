import express from 'express';
import { requireAuthentication, signJwt } from './auth/jwt.js';
import { createJsonMockRepository } from './data/jsonMockRepository.js';
import { checkPermission } from './permissions.js';
import { extractIntent, generateReply } from './gemini.js';
import { getHistory, appendTurn } from './context.js';

function getSensitiveRequestRefusal(message) {
  const text = message.toLowerCase();
  if (/\b(system prompt|your instructions|show (me )?your prompt|repeat (your|the) prompt|hidden prompt|developer message)\b/.test(text)) {
    return 'I can’t provide internal instructions or system prompts, but I can help with school-related questions.';
  }
  if (/\b(api[ -]?key|\.env|process\.env|environment variables?|credentials?|secrets?)\b/.test(text)) {
    return 'I can’t access or share credentials, configuration, or other internal system details.';
  }
  return null;
}

export function createApp({ repository = createJsonMockRepository(), jwtSecret } = {}) {
  if (!jwtSecret) {
    throw new Error('JWT_SECRET must be configured before starting the backend.');
  }

  const app = express();
  const pendingParentNotifications = new Map();
  const pendingEscalations = new Map();

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
      const {
        message: rawMessage, intent: legacyIntent, entities: legacyEntities, language = 'en', activeChildId,
      } = request.body ?? {};

      const { userId, role, linkedStudentIds = [], linkedClassId } = request.auth;
      let selectedChildId = linkedStudentIds[0];

      if (role === 'parent' && activeChildId) {
        if (!linkedStudentIds.includes(activeChildId)) {
          return response.status(403).json({ error: 'The selected child is not linked to this parent account.' });
        }
        selectedChildId = activeChildId;
      }

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

      const sensitiveRequestRefusal = getSensitiveRequestRefusal(rawMessage);
      if (sensitiveRequestRefusal) {
        return response.status(200).json({
          allowed: true,
          intent: 'general_chat',
          entities: {},
          reply: sensitiveRequestRefusal,
        });
      }

      // Parent histories are child-scoped so a conversation about one child does not bleed into another.
      const conversationId = role === 'parent' ? `${userId}:${selectedChildId ?? 'no-child'}` : userId;
      const history = getHistory(conversationId);

      appendTurn(conversationId, 'user', rawMessage);

      const extraction = await extractIntent(rawMessage, history);
      let { intent, entities = {}, missing_fields = [] } = extraction;

      const pendingParentNotification = pendingParentNotifications.get(conversationId);
      const confirmingParentNotification = /\b(yes|confirm|sure|go ahead|please do|submit it|do it|ok)\b/i.test(rawMessage);
      const pendingEscalation = pendingEscalations.get(conversationId);
      const confirmingEscalation = /\b(yes|confirm|sure|go ahead|please do|submit it|do it|ok)\b/i.test(rawMessage);
      if (pendingParentNotification && confirmingParentNotification) {
        intent = 'notify_parent';
        entities = {
          studentId: pendingParentNotification.studentId,
          message: pendingParentNotification.message,
        };
        missing_fields = [];
      }
      if (pendingEscalation && confirmingEscalation) {
        intent = 'escalate_to_human';
        entities = pendingEscalation.entities;
        missing_fields = [];
      }

      // Parents often use the natural phrase "my attendance" when referring to their active child.
      if (role === 'parent' && intent === 'view_own_attendance') {
        intent = 'view_child_attendance';
      }

      if (!checkPermission(role, intent)) {
        let reply;
        if (intent === 'notify_parent') {
          reply = 'Sorry, only teachers and principals can notify a student’s parent.';
        } else {
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
        }
        appendTurn(conversationId, 'assistant', reply);
        return response.status(403).json({
          allowed: false,
          intent,
          entities,
          reply,
        });
      }

      let apiResult = null;

      if (intent === 'view_own_attendance') {
        const studentId = role === 'student' ? userId : selectedChildId;
        if (!studentId) {
          apiResult = { error: 'No linked student found.' };
        } else {
          apiResult = repository.getStudentAttendance(studentId);
          if (!apiResult) apiResult = { error: 'Student not found.' };
        }
      } else if (intent === 'view_child_attendance') {
        if (!selectedChildId) {
          apiResult = { error: 'No linked student found for this parent.' };
        } else {
          apiResult = repository.getStudentAttendance(selectedChildId);
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
        if (pendingEscalation && confirmingEscalation) {
          const created = repository.createEscalationWithNotification(pendingEscalation.prepared);
          pendingEscalations.delete(conversationId);
          apiResult = { ...created, confirmed: true };
        } else {
          const targetRole = entities.targetRole ?? (role === 'teacher' ? 'student' : 'teacher');
          const prepared = repository.prepareEscalation({
            userId,
            role,
            selectedChildId,
            targetRole,
            studentId: entities.studentId,
            studentName: entities.studentName,
            teacherId: entities.teacherId,
            teacherName: entities.teacherName,
            reason: entities.reason ?? rawMessage,
          });
          if (typeof prepared === 'string') {
            apiResult = { error: prepared };
          } else {
            pendingEscalations.set(conversationId, {
              prepared,
              entities: { ...entities, targetRole },
            });
            apiResult = {
              pending: true,
              prompt: `Would you like me to send a conversation request to ${prepared.recipient.name}?`,
            };
          }
        }
      } else if (intent === 'notify_parent') {
        if (pendingParentNotification && confirmingParentNotification) {
          const created = repository.createParentNotification({
            studentId: pendingParentNotification.studentId,
            message: pendingParentNotification.message,
            createdBy: userId,
          });
          pendingParentNotifications.delete(conversationId);
          apiResult = typeof created === 'string' ? { error: created } : created;
        } else {
          const prepared = repository.prepareParentNotification({
            studentId: entities.studentId,
            studentName: entities.studentName,
            message: entities.message ?? entities.reason,
          });
          if (typeof prepared === 'string') {
            apiResult = { error: prepared };
          } else {
            pendingParentNotifications.set(conversationId, {
              studentId: prepared.student.id,
              message: prepared.message,
            });
            apiResult = {
              pending: true,
              prompt: `Would you like me to notify ${prepared.parent.name} that ${prepared.message}?`,
            };
          }
        }
      }
      // general_chat → apiResult stays null, skip mock API call

      if (intent === 'notify_parent') {
        const reply = apiResult.error
          ? `I couldn't notify the parent: ${apiResult.error.replaceAll('-', ' ')}.`
          : apiResult.pending
            ? apiResult.prompt
            : `Done — I've notified ${apiResult.student.name}'s parent.`;
        appendTurn(conversationId, 'assistant', reply);
        return response.status(200).json({ allowed: true, intent, entities, reply, notification: apiResult.notification });
      }

      if (intent === 'escalate_to_human') {
        const reply = apiResult.error
          ? `I couldn't create that conversation request: ${apiResult.error.replaceAll('-', ' ')}.`
          : apiResult.pending
            ? apiResult.prompt
            : `Done — I've notified ${apiResult.recipient.name} that you would like to talk.`;
        appendTurn(conversationId, 'assistant', reply);
        return response.status(200).json({ allowed: true, intent, entities, reply, escalation: apiResult.escalation, notification: apiResult.notification });
      }

      const reply = await generateReply(role, intent, entities, apiResult, rawMessage, history, language);
      appendTurn(conversationId, 'assistant', reply);

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

    const { userId, role, linkedStudentIds = [] } = request.auth;
    if (role === 'student' && studentId !== userId) {
      return response.status(403).json({ error: 'Students can only view their own attendance.' });
    }
    if (role === 'parent' && !linkedStudentIds.includes(studentId)) {
      return response.status(403).json({ error: 'Parents can only view attendance for linked children.' });
    }

    const attendance = repository.getStudentAttendance(studentId);
    if (!attendance) {
      return response.status(404).json({ error: 'Student not found.' });
    }

    return response.status(200).json(attendance);
  });

  app.get('/mock/notifications', authenticate, (request, response) => {
    const notifications = repository.getNotifications(request.auth);
    return response.status(200).json({ notifications });
  });

  app.post('/mock/notifications/:id/read', authenticate, (request, response) => {
    const notification = repository.markNotificationRead({
      notificationId: request.params.id,
      userId: request.auth.userId,
      role: request.auth.role,
    });

    if (notification === 'not-found') {
      return response.status(404).json({ error: 'Notification not found.' });
    }
    if (notification === 'forbidden') {
      return response.status(403).json({ error: 'You cannot update this notification.' });
    }

    return response.status(200).json({ notification });
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
    const { targetRole, reason, studentId, studentName, teacherId, teacherName } = request.body ?? {};
    if (!targetRole || !reason) {
      return response.status(400).json({ error: 'targetRole and reason are required.' });
    }

    const prepared = repository.prepareEscalation({
      userId: request.auth.userId,
      role: request.auth.role,
      selectedChildId: request.auth.linkedStudentIds?.[0],
      targetRole,
      studentId,
      studentName,
      teacherId,
      teacherName,
      reason,
    });
    if (typeof prepared === 'string') {
      return response.status(400).json({ error: prepared.replaceAll('-', ' ') });
    }
    const created = repository.createEscalationWithNotification(prepared);
    return response.status(201).json({ ...created.escalation, notification: created.notification });
  });

  return app;
}
