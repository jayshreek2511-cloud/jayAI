import { useEffect, useState } from 'react';

const STUDENT_PARENT_ACTIONS = [
  { icon: '📋', label: 'Check Attendance', message: 'What is my attendance?' },
  { icon: '📅', label: 'Recent Attendance', message: 'Show my recent attendance records' },
  { icon: '📊', label: 'Academic Performance', message: 'Show attendance analytics' },
  { icon: '👩‍🏫', label: 'Talk to Teacher', message: 'I want to talk to my teacher' },
];

const TEACHER_ACTIONS = [
  { icon: '✅', label: 'Mark Attendance', message: 'I want to mark attendance for my class' },
  { icon: '📋', label: 'Class Attendance', message: 'Show class attendance overview' },
  { icon: '📊', label: 'Attendance Analytics', message: 'Show attendance analytics' },
  { icon: '👥', label: 'Class Roster', unavailable: true },
];

const PRINCIPAL_ACTIONS = [
  { icon: '📊', label: 'School Attendance', message: 'Show attendance analytics' },
  { icon: '🏫', label: 'View All Classes', unavailable: true },
  { icon: '👩‍🏫', label: 'Staff Overview', unavailable: true },
];

function DonutChart({ percentage, title, label, primaryStat, secondaryStat, loading }) {
  const r = 50;
  const c = 2 * Math.PI * r;
  const safePercentage = Number.isFinite(percentage) ? percentage : 0;
  const filled = (safePercentage / 100) * c;

  return (
    <div className="attendance-card">
      <div className="section-title">{title}</div>
      <div className="donut-wrap">
        <svg viewBox="0 0 120 120">
          <circle className="donut-track" cx="60" cy="60" r={r} />
          <circle className="donut-fill" cx="60" cy="60" r={r} strokeDasharray={`${filled} ${c - filled}`} />
        </svg>
        <div className="donut-center">
          <span className="donut-pct">{loading ? '…' : `${safePercentage}%`}</span>
          <span className="donut-label">{label}</span>
        </div>
      </div>
      <div className="att-stats">
        <div style={{ textAlign: 'center' }}>
          <div className="att-stat-val">{loading ? '…' : primaryStat.value}</div>
          <div className="att-stat-lbl">{primaryStat.label}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className="att-stat-val">{loading ? '…' : secondaryStat.value}</div>
          <div className="att-stat-lbl">{secondaryStat.label}</div>
        </div>
      </div>
    </div>
  );
}

function getActionsForRole(role) {
  if (role === 'teacher') return TEACHER_ACTIONS;
  if (role === 'principal') return PRINCIPAL_ACTIONS;
  return STUDENT_PARENT_ACTIONS;
}

export default function RightPanel({ userInfo, token, onSendMessage, open }) {
  const { role } = userInfo;
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    if ((role !== 'teacher' && role !== 'principal') || !token) {
      setAnalytics(null);
      setAnalyticsLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    setAnalyticsLoading(true);
    setAnalytics(null);

    fetch('/api/mock/attendance/analytics', {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Analytics request failed (${response.status})`);
        return response.json();
      })
      .then((data) => {
        if (!controller.signal.aborted) setAnalytics(data);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') console.error('Failed to load attendance analytics:', error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setAnalyticsLoading(false);
      });

    return () => controller.abort();
  }, [role, token]);

  const actions = getActionsForRole(role);
  const isIndividualRole = role === 'student' || role === 'parent';
  const totalDays = 80;
  const individualPct = userInfo.attendancePercentage ?? 94;
  const analyticsStats = analytics?.attendanceRecords;
  const attendanceProps = isIndividualRole
    ? {
      percentage: individualPct,
      title: 'Attendance',
      label: 'Overall',
      primaryStat: { value: Math.round((individualPct / 100) * totalDays), label: 'Present Days' },
      secondaryStat: { value: totalDays, label: 'Total Days' },
      loading: false,
    }
    : {
      // The existing analytics API is school-wide; it does not expose a class-only average.
      percentage: analytics?.averageAttendancePercentage,
      title: 'School Attendance',
      label: 'School Avg.',
      primaryStat: { value: analytics?.studentCount ?? '—', label: 'Students' },
      secondaryStat: { value: analyticsStats?.totalRecords ?? '—', label: 'Attendance Logs' },
      loading: analyticsLoading,
    };

  return (
    <aside className={`right-sidebar${open ? ' open' : ''}`}>
      <div className="section-title">Quick Actions</div>
      <div className="quick-actions-grid">
        {actions.map((qa) => (
          <button
            key={qa.label}
            className={`qa-card${qa.unavailable ? ' unavailable' : ''}`}
            disabled={qa.unavailable}
            title={qa.unavailable ? 'Not available yet — no supporting backend endpoint exists.' : qa.label}
            onClick={() => onSendMessage(qa.message)}
          >
            <span className="qa-icon">{qa.icon}</span>
            <span className="qa-label">{qa.label}</span>
            {qa.unavailable && <span className="qa-coming-soon">Soon</span>}
          </button>
        ))}
      </div>

      <DonutChart {...attendanceProps} />

      {isIndividualRole && (
        <div className="help-card">
          <div className="section-title">Need More Help?</div>
          <p>If you're not satisfied with my answers, I can connect you directly to {userInfo.childName || userInfo.name || 'your'} teacher.</p>
          <button onClick={() => onSendMessage('I want to talk to my teacher')}>
            📞 Talk to Teacher
          </button>
        </div>
      )}

      <div className="powered-by">Powered by XYZ AI 🧡</div>
    </aside>
  );
}
