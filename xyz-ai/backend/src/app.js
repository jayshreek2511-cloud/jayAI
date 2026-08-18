import express from 'express';
import { requireAuthentication, signJwt } from './auth/jwt.js';
import { createJsonMockRepository } from './data/jsonMockRepository.js';
import { checkPermission } from './permissions.js';

export function createApp({ repository = createJsonMockRepository(), jwtSecret } = {}) {
  if (!jwtSecret) {
    throw new Error('JWT_SECRET must be configured before starting the backend.');
  }

  const app = express();

  app.use(express.json());

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

  // Stub for the future conversation pipeline. It intentionally uses only the
  // authenticated JWT role, never a role supplied by a client message.
  app.post('/orchestrate', authenticate, (request, response) => {
    const { intent, entities } = request.body ?? {};
    if (!intent) {
      return response.status(400).json({ error: 'intent is required.' });
    }

    if (!checkPermission(request.auth.role, intent)) {
      return response.status(403).json({
        allowed: false,
        reason: `The ${request.auth.role} role is not allowed to perform ${intent}.`,
      });
    }

    return response.status(200).json({ allowed: true, intent, entities: entities ?? {} });
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
