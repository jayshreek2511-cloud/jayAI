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

function findStudentByReference(students, { studentId, studentName }) {
  if (studentId) return students.find((student) => student.id === studentId) ?? null;
  if (!studentName) return null;

  const normalizedName = studentName
    .toLowerCase()
    .replace(/['’]s\s+parent$/i, '')
    .replace(/\s+parent$/i, '')
    .trim();
  return students.find((student) => {
    const name = student.name.toLowerCase();
    return name === normalizedName || name.startsWith(`${normalizedName} `);
  }) ?? null;
}

function findTeacherByReference(teachers, { teacherId, teacherName, classId }) {
  if (teacherId) return teachers.find((teacher) => teacher.id === teacherId) ?? null;
  if (teacherName) {
    const normalizedName = teacherName.toLowerCase().trim();
    const namedTeacher = teachers.find((teacher) => {
      const name = teacher.name.toLowerCase();
      return name === normalizedName || name.startsWith(`${normalizedName} `);
    });
    if (namedTeacher) return namedTeacher;
  }
  return classId ? teachers.find((teacher) => teacher.class === classId) ?? null : null;
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
        const linkedStudentIds = parent?.studentIds ?? (parent?.studentId ? [parent.studentId] : []);
        return parent ? { userId, role, linkedStudentIds } : null;
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

    getNotifications({ userId, role }) {
      const notifications = data.notifications ?? [];
      return clone(
        notifications
          .filter((notification) => notification.role === role)
          .filter((notification) => notification.userId === null || notification.userId === userId)
          .sort((first, second) => new Date(second.timestamp) - new Date(first.timestamp)),
      );
    },

    markNotificationRead({ notificationId, userId, role }) {
      const notification = (data.notifications ?? []).find((item) => item.id === notificationId);
      if (!notification) return 'not-found';
      if (notification.role !== role || (notification.userId !== null && notification.userId !== userId)) {
        return 'forbidden';
      }

      notification.read = true;
      save();
      return clone(notification);
    },

    prepareParentNotification({ studentId, studentName, message }) {
      if (!message?.trim()) return 'missing-message';

      const student = findStudentByReference(data.students, { studentId, studentName });
      if (!student) return 'student-not-found';

      const parent = data.parents.find((item) => {
        const linkedStudentIds = item.studentIds ?? (item.studentId ? [item.studentId] : []);
        return linkedStudentIds.includes(student.id);
      });
      if (!parent) return 'parent-not-found';

      const normalizedMessage = message.trim().replace(/^(he|she)\b/i, student.name.split(' ')[0]);
      return clone({ student, parent, message: normalizedMessage });
    },

    createParentNotification({ studentId, studentName, message, createdBy }) {
      const prepared = this.prepareParentNotification({ studentId, studentName, message });
      if (typeof prepared === 'string') return prepared;

      const notification = {
        id: `notif-parent-${randomUUID()}`,
        role: 'parent',
        userId: prepared.parent.id,
        title: 'Message from school',
        message: prepared.message,
        timestamp: new Date().toISOString(),
        read: false,
        createdBy,
      };
      data.notifications ??= [];
      data.notifications.push(notification);
      save();
      return clone({ notification, student: prepared.student, parent: prepared.parent });
    },

    prepareEscalation({ userId, role, selectedChildId, targetRole, studentId, studentName, teacherId, teacherName, reason }) {
      const requester = role === 'student'
        ? data.students.find((item) => item.id === userId)
        : role === 'parent'
          ? data.parents.find((item) => item.id === userId)
          : role === 'teacher'
            ? data.teachers.find((item) => item.id === userId)
            : data.principals.find((item) => item.id === userId);
      if (!requester) return 'requester-not-found';

      if ((role === 'student' || role === 'parent') && targetRole === 'teacher') {
        const student = role === 'student'
          ? data.students.find((item) => item.id === userId)
          : data.students.find((item) => item.id === selectedChildId);
        if (!student) return 'student-not-found';
        const teacher = findTeacherByReference(data.teachers, { classId: student.class });
        if (!teacher) return 'class-teacher-not-found';
        return clone({ requester, requesterRole: role, recipient: teacher, recipientRole: 'teacher', subject: student, reason });
      }

      if (role === 'principal' && targetRole === 'teacher') {
        const teacher = findTeacherByReference(data.teachers, { teacherId, teacherName });
        if (!teacher) return 'teacher-name-required';
        return clone({ requester, requesterRole: role, recipient: teacher, recipientRole: 'teacher', reason });
      }

      if (role === 'teacher' && targetRole === 'student') {
        const student = findStudentByReference(data.students, { studentId, studentName });
        if (!student) return 'student-name-required';
        if (!(requester.studentIds ?? []).includes(student.id)) return 'student-not-in-teacher-class';
        return clone({ requester, requesterRole: role, recipient: student, recipientRole: 'student', subject: student, reason });
      }

      return 'unsupported-escalation-pairing';
    },

    createEscalationWithNotification(prepared) {
      const escalation = {
        ticketId: `ESC-${randomUUID().slice(0, 8).toUpperCase()}`,
        userId: prepared.requester.id,
        targetRole: prepared.recipientRole,
        targetUserId: prepared.recipient.id,
        reason: prepared.reason,
        status: 'submitted',
      };
      const subjectName = prepared.subject?.name;
      const message = prepared.requesterRole === 'parent' && subjectName
        ? `${prepared.requester.name} requested to talk about ${subjectName}.`
        : `${prepared.requester.name} requested to talk to you.`;
      const notification = {
        id: `notif-escalation-${randomUUID()}`,
        role: prepared.recipientRole,
        userId: prepared.recipient.id,
        title: 'Conversation request',
        message,
        timestamp: new Date().toISOString(),
        read: false,
        createdBy: prepared.requester.id,
        escalationId: escalation.ticketId,
      };
      data.escalations.push(escalation);
      data.notifications ??= [];
      data.notifications.push(notification);
      save();
      return clone({ escalation, notification, recipient: prepared.recipient });
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
