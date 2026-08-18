import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dataFile = fileURLToPath(new URL('./mock-data.json', import.meta.url));
const allowedStatuses = new Set(['present', 'absent', 'late']);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function calculateRecordStats(records) {
  return records.reduce(
    (stats, record) => {
      stats.totalRecords += 1;
      stats[record.status] += 1;
      return stats;
    },
    { totalRecords: 0, present: 0, absent: 0, late: 0 },
  );
}

// The route layer depends only on this repository interface, allowing a future
// SQLite implementation to replace this JSON-backed implementation.
export function createJsonMockRepository({ initialData, persist = true } = {}) {
  const data = initialData ? clone(initialData) : JSON.parse(readFileSync(dataFile, 'utf8'));

  function save() {
    if (persist) {
      writeFileSync(dataFile, `${JSON.stringify(data, null, 2)}\n`);
    }
  }

  return {
    getLoginIdentity(userId, role) {
      if (role === 'student') {
        const student = data.students.find((item) => item.id === userId);
        return student ? { userId, role } : null;
      }

      if (role === 'parent') {
        const parent = data.parents.find((item) => item.id === userId);
        return parent ? { userId, role, linkedStudentId: parent.studentId } : null;
      }

      if (role === 'teacher') {
        const teacher = data.teachers.find((item) => item.id === userId);
        return teacher ? { userId, role, linkedClassId: teacher.class } : null;
      }

      if (role === 'principal') {
        const principal = data.principals.find((item) => item.id === userId);
        return principal ? { userId, role } : null;
      }

      return null;
    },

    getStudentAttendance(studentId) {
      const student = data.students.find((item) => item.id === studentId);
      if (!student) return null;

      const records = data.attendanceRecords.filter((record) => record.studentId === studentId);
      return { student: clone(student), records: clone(records) };
    },

    markAttendance({ studentId, date, status }) {
      const student = data.students.find((item) => item.id === studentId);
      if (!student) return 'not-found';
      if (!allowedStatuses.has(status)) return 'invalid-status';

      const existing = data.attendanceRecords.find(
        (record) => record.studentId === studentId && record.date === date,
      );
      const record = existing ?? { studentId, date, status };
      record.status = status;
      if (!existing) data.attendanceRecords.push(record);

      save();
      return clone(record);
    },

    getAttendanceAnalytics() {
      const recordStats = calculateRecordStats(data.attendanceRecords);
      const averageAttendancePercentage = data.students.reduce(
        (sum, student) => sum + student.attendancePercentage,
        0,
      ) / data.students.length;

      return {
        studentCount: data.students.length,
        averageAttendancePercentage: Number(averageAttendancePercentage.toFixed(1)),
        attendanceRecords: recordStats,
      };
    },

    createEscalation({ userId, targetRole, reason }) {
      const escalation = {
        ticketId: `ESC-${randomUUID().slice(0, 8).toUpperCase()}`,
        userId,
        targetRole,
        reason,
        status: 'submitted',
      };
      data.escalations.push(escalation);
      save();
      return clone(escalation);
    },
  };
}
