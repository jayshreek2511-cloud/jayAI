import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';
import { createJsonMockRepository } from '../src/data/jsonMockRepository.js';

const dataFile = fileURLToPath(new URL('../src/data/mock-data.json', import.meta.url));
const seedData = JSON.parse(readFileSync(dataFile, 'utf8'));
const app = createApp({
  repository: createJsonMockRepository({ initialData: seedData }),
  jwtSecret: 'test-only-jwt-secret',
});
const server = createServer(app);

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  return { status: response.status, body: await response.json() };
}

function decodeJwtPayload(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
}

try {
  const missingToken = await request('/mock/attendance?studentId=student-001');
  assert.equal(missingToken.status, 401);

  const invalidToken = await request('/mock/attendance?studentId=student-001', {
    headers: { authorization: 'Bearer not-a-valid-jwt' },
  });
  assert.equal(invalidToken.status, 401);

  const login = await request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: 'student-001', role: 'student' }),
  });
  assert.equal(login.status, 200);
  assert.ok(login.body.token);
  const authorization = { authorization: `Bearer ${login.body.token}` };

  const parentLogin = await request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: 'parent-001', role: 'parent' }),
  });
  assert.equal(decodeJwtPayload(parentLogin.body.token).linkedStudentId, 'student-001');

  const teacherLogin = await request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: 'teacher-001', role: 'teacher' }),
  });
  assert.equal(decodeJwtPayload(teacherLogin.body.token).linkedClassId, '6A');

  const forgedLogin = await request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: 'student-001', role: 'principal' }),
  });
  assert.equal(forgedLogin.status, 401);

  const studentMarkAttempt = await request('/orchestrate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authorization },
    body: JSON.stringify({
      intent: 'mark_attendance',
      role: 'teacher',
      entities: { studentId: 'student-001' },
    }),
  });
  assert.equal(studentMarkAttempt.status, 403);
  assert.equal(studentMarkAttempt.body.allowed, false);

  const teacherMarkAttempt = await request('/orchestrate', {
    method: 'POST',
    headers: { authorization: `Bearer ${teacherLogin.body.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ intent: 'mark_attendance', entities: { studentId: 'student-001' } }),
  });
  assert.equal(teacherMarkAttempt.status, 200);
  assert.equal(teacherMarkAttempt.body.allowed, true);

  const attendance = await request('/mock/attendance?studentId=student-001', { headers: authorization });
  assert.equal(attendance.status, 200);
  assert.equal(attendance.body.student.name, 'Aarav Sharma');
  assert.equal(attendance.body.student.attendancePercentage, 94);

  const marked = await request('/mock/attendance/mark', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authorization },
    body: JSON.stringify({ studentId: 'student-001', date: '2026-08-17', status: 'present' }),
  });
  assert.equal(marked.status, 201);
  assert.deepEqual(marked.body.attendance, {
    studentId: 'student-001', date: '2026-08-17', status: 'present',
  });

  const analytics = await request('/mock/attendance/analytics', { headers: authorization });
  assert.equal(analytics.status, 200);
  assert.equal(analytics.body.studentCount, 10);
  assert.equal(analytics.body.attendanceRecords.totalRecords, 11);

  const escalation = await request('/mock/escalate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authorization },
    body: JSON.stringify({ targetRole: 'teacher', reason: 'Needs attendance clarification.' }),
  });
  assert.equal(escalation.status, 201);
  assert.match(escalation.body.ticketId, /^ESC-[A-F0-9]{8}$/);
  assert.equal(escalation.body.status, 'submitted');
  assert.equal(escalation.body.userId, 'student-001');

  console.log('Authentication, permissions, and protected mock API tests passed.');
} finally {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
