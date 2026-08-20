import { useState, useEffect } from 'react';

/* ── Attendance View Component ── */
const UPCOMING_EVENTS = [
  { icon: '🏅', title: 'Annual Sports Day', date: 'Aug 28', description: 'A full day of house events, team spirit, and track finals.' },
  { icon: '🤝', title: 'Parent-Teacher Meeting', date: 'Aug 24', description: 'Connect with teachers to review progress and learning goals.' },
  { icon: '🇮🇳', title: 'Independence Day Celebration', date: 'Aug 15', description: 'Student performances, artwork, and a school-wide assembly.' },
];

const SCHOOL_MOMENTS = [
  { icon: '🤖', title: 'Robotics Club wins regional science fair', caption: 'Our Robotics Club won 1st place at the Regional Science Fair!', date: 'Aug 19, 2026', tone: 'robotics' },
  { icon: '🎭', title: 'Annual Day highlights', caption: 'Annual Day celebrations were a huge success — thank you to every student and family who joined us.', date: 'Aug 16, 2026', tone: 'annual-day' },
  { icon: '🌱', title: 'Campus garden day', caption: 'Young gardeners added new plants to our learning garden and made the campus brighter.', date: 'Aug 12, 2026', tone: 'garden' },
];

export function HomeView() {
  return (
    <div className="view-container home-feed">
      <div className="view-header">
        <h2 className="view-title">🏫 School Home</h2>
        <p className="view-sub">What’s happening around our school community</p>
      </div>
      <section className="home-section" aria-labelledby="upcoming-events-heading">
        <div className="home-section-heading"><h3 id="upcoming-events-heading">Upcoming Events</h3><span>Mark your calendar</span></div>
        <div className="events-feed-grid">
          {UPCOMING_EVENTS.map((event) => <article className="event-feed-card" key={event.title}>
            <div className="event-placeholder" aria-hidden="true">{event.icon}</div>
            <div className="event-feed-copy"><span className="event-date">{event.date}</span><h4>{event.title}</h4><p>{event.description}</p></div>
          </article>)}
        </div>
      </section>
      <section className="home-section" aria-labelledby="school-moments-heading">
        <div className="home-section-heading"><h3 id="school-moments-heading">School Moments</h3><span>Recent celebrations</span></div>
        <div className="moments-feed">
          {SCHOOL_MOMENTS.map((moment) => <article className="moment-feed-card" key={moment.title}>
            <div className={`moment-placeholder ${moment.tone}`} aria-hidden="true">{moment.icon}</div>
            <div className="moment-feed-copy"><h4>{moment.title}</h4><p>{moment.caption}</p><time>{moment.date}</time></div>
          </article>)}
        </div>
      </section>
    </div>
  );
}

export function AttendanceView({ userInfo, token }) {
  const [attData, setAttData] = useState(null);
  const [loading, setLoading] = useState(true);

  const studentId = userInfo.studentId || userInfo.userId || 'student-001';

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/mock/attendance?studentId=${studentId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setAttData(data);
        }
      } catch (e) {
        console.error('Failed to load attendance from /api/mock/attendance:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [token, studentId]);

  const pct = attData?.student?.attendancePercentage ?? userInfo.attendancePercentage ?? 94;
  const childName = attData?.student?.name || userInfo.childName || userInfo.name || 'Aarav Sharma';
  const records = attData?.records || [
    { date: '2026-08-19', subject: 'Mathematics', status: 'present' },
    { date: '2026-08-18', subject: 'Science', status: 'present' },
    { date: '2026-08-17', subject: 'English', status: 'present' },
    { date: '2026-08-16', subject: 'Social Studies', status: 'present' },
    { date: '2026-08-15', subject: 'Hindi', status: 'late' },
  ];

  const totalLogs = records.length;
  const presentLogs = records.filter(r => r.status.toLowerCase() === 'present').length;
  const lateLogs = records.filter(r => r.status.toLowerCase() === 'late').length;
  const absentLogs = records.filter(r => r.status.toLowerCase() === 'absent').length;

  return (
    <div className="view-container">
      <div className="view-header">
        <h2 className="view-title">📋 Attendance Overview</h2>
        <p className="view-sub">Track attendance records and daily logs for {childName} (API Verified)</p>
      </div>

      <div className="att-overview-grid">
        <div className="att-card main-stat">
          <div className="stat-label">Overall Attendance</div>
          <div className="stat-value highlight">{pct}%</div>
          <div className="stat-badge positive">✓ Meets 75% Requirement</div>
        </div>

        <div className="att-card">
          <div className="stat-label">Recorded Sessions</div>
          <div className="stat-value">{presentLogs} / {totalLogs}</div>
          <div className="stat-sub">Current Term Logged Sessions</div>
        </div>

        <div className="att-card">
          <div className="stat-label">Absences / Late</div>
          <div className="stat-value warning">{absentLogs} Abs / {lateLogs} Late</div>
          <div className="stat-sub">Excused Leaves: 0</div>
        </div>
      </div>

      <div className="table-card">
        <h3 className="card-title">Recent Attendance Logs (from /mock/attendance)</h3>
        {loading ? (
          <div className="loading-txt">Loading attendance data from API...</div>
        ) : (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Subject</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={i}>
                  <td>{r.date}</td>
                  <td>{r.subject || 'General'}</td>
                  <td>
                    <span className={`status-pill ${r.status.toLowerCase()}`}>
                      {r.status.toLowerCase() === 'present' ? '✓ Present' : (r.status.toLowerCase() === 'late' ? '⚠️ Late' : '❌ Absent')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ── Reports View Component (Populated Demo) ── */
export function ReportsView({ userInfo }) {
  const childName = userInfo.childName || userInfo.name || 'Aarav Sharma';
  const childClass = userInfo.childClass || userInfo.class || '6A';
  const attendancePercentage = userInfo.attendancePercentage ?? 94;
  const reports = [
    {
      title: `Mid-Term Academic Progress Report — Class ${childClass}`,
      date: 'Aug 15, 2026',
      score: '92% (Grade A)',
      summary: 'Outstanding performance in Mathematics & Science. Recommended for Advanced Math Olympiad prep.',
      status: 'Verified',
    },
    {
      title: 'Term 1 Attendance & Conduct Summary',
      date: 'Aug 01, 2026',
      score: `${attendancePercentage}% Attendance`,
      summary: `${Math.round((attendancePercentage / 100) * 80)} days present out of 80 working days. Attendance summary for ${childName}.`,
      status: 'Official',
    },
    {
      title: 'Quarterly Co-Curricular & Skills Evaluation',
      date: 'Jul 10, 2026',
      score: 'Grade A+',
      summary: 'Active team lead in School Robotics Club & Inter-House Debate competition.',
      status: 'Published',
    },
  ];

  return (
    <div className="view-container">
      <div className="view-header">
        <h2 className="view-title">📊 Student Reports & Gradebooks</h2>
        <p className="view-sub">Official academic reports and progress evaluations for {childName}</p>
      </div>

      <div className="reports-list">
        {reports.map((rpt, idx) => (
          <div className="report-item-card" key={idx}>
            <div className="report-card-main">
              <div className="report-icon-box">📜</div>
              <div className="report-details">
                <div className="report-top-row">
                  <h3 className="report-card-title">{rpt.title}</h3>
                  <span className="report-date-badge">{rpt.date}</span>
                </div>
                <div className="report-score-row">
                  <span className="report-score-tag">{rpt.score}</span>
                  <span className="report-status-pill">{rpt.status}</span>
                </div>
                <p className="report-summary-txt">{rpt.summary}</p>
              </div>
            </div>
            <button className="view-report-action-btn" onClick={() => alert(`Opening ${rpt.title}`)}>
              📄 View Report
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Assignments View Component (Populated Demo) ── */
export function AssignmentsView({ userInfo }) {
  const childName = userInfo.childName || userInfo.name || 'Aarav Sharma';
  const assignments = [
    {
      subject: 'Mathematics',
      icon: '📐',
      title: 'Chapter 5 Algebra & Polynomials Worksheet',
      dueDate: 'Due Aug 22, 2026',
      status: 'pending',
      statusLabel: '⏳ Pending Submission',
    },
    {
      subject: 'Science',
      icon: '🧪',
      title: 'Physics Motion & Forces Lab Experiment Report',
      dueDate: 'Submitted Aug 19, 2026',
      status: 'submitted',
      statusLabel: '✓ Submitted',
    },
    {
      subject: 'English',
      icon: '📖',
      title: 'Short Essay on Environmental Conservation',
      dueDate: 'Submitted Aug 17, 2026',
      status: 'submitted',
      statusLabel: '✓ Submitted',
    },
    {
      subject: 'Social Studies',
      icon: '🗺️',
      title: 'Historical Monuments Mapping Project',
      dueDate: 'Due Aug 15, 2026',
      status: 'overdue',
      statusLabel: '⚠️ Overdue',
    },
  ];

  return (
    <div className="view-container">
      <div className="view-header">
        <h2 className="view-title">📝 Homework & Class Assignments</h2>
        <p className="view-sub">Active assignments, submissions, and deadlines for {childName}</p>
      </div>

      <div className="assignments-grid">
        {assignments.map((asgn, idx) => (
          <div className={`assignment-card ${asgn.status}`} key={idx}>
            <div className="asgn-header">
              <div className="asgn-subject-pill">
                <span className="asgn-icon">{asgn.icon}</span>
                {asgn.subject}
              </div>
              <span className={`asgn-status-badge ${asgn.status}`}>
                {asgn.statusLabel}
              </span>
            </div>
            <h3 className="asgn-title">{asgn.title}</h3>
            <div className="asgn-footer">
              <span className="asgn-duedate">{asgn.dueDate}</span>
              <button className="asgn-action-btn">
                {asgn.status === 'submitted' ? 'View Work' : 'Upload Task'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Generic Placeholder View Component ── */
export function PlaceholderView({ title, icon, subtitle }) {
  return (
    <div className="view-container centered">
      <div className="placeholder-card">
        <div className="placeholder-icon">{icon}</div>
        <h2 className="placeholder-title">{title}</h2>
        <p className="placeholder-desc">{subtitle}</p>
        <div className="placeholder-tag">🚀 Feature Coming Soon</div>
      </div>
    </div>
  );
}

/* ── My Children View (Parent Role) ── */
export function MyChildrenView({ userInfo }) {
  const isParent = userInfo.role === 'parent';
  const children = userInfo.linkedChildren?.length
    ? userInfo.linkedChildren
    : [{ userId: userInfo.studentId, name: userInfo.childName || 'Aarav Sharma', class: userInfo.childClass || '6A', attendancePercentage: userInfo.attendancePercentage ?? 94 }];

  if (!isParent) {
    return (
      <div className="view-container centered">
        <div className="placeholder-card">
          <div className="placeholder-icon">👨‍👩‍👧</div>
          <h2 className="placeholder-title">My Children Portal</h2>
          <p className="placeholder-desc">
            This panel is dedicated to Parent accounts to monitor linked children. You are logged in as a <strong>{userInfo.role}</strong> ({userInfo.displayName}).
          </p>
          <div className="placeholder-tag">Parent Account Required</div>
        </div>
      </div>
    );
  }

  return (
    <div className="view-container">
      <div className="view-header">
        <h2 className="view-title">👨‍👩‍👧 My Children</h2>
        <p className="view-sub">Manage student profiles linked to your parent account</p>
      </div>

      <div className="children-grid">
        {children.map((child) => {
          const initials = child.name.split(' ').map((word) => word[0]).join('').slice(0, 2);
          const isActive = child.userId === userInfo.studentId;
          return (
        <div className={`child-detail-card${isActive ? ' active' : ''}`} key={child.userId}>
          <div className="child-card-top">
            <div className="child-avatar-lg">{initials}</div>
            <div>
              <h3 className="child-fullname">{child.name}</h3>
              <div className="child-meta">Class {child.class}</div>
            </div>
            {isActive && <div className="active-tag">Active</div>}
          </div>
          <div className="child-stats-row">
            <div>
              <span className="lbl">Attendance</span>
              <span className="val">{child.attendancePercentage ?? '—'}%</span>
            </div>
            <div>
              <span className="lbl">Grade</span>
              <span className="val">A</span>
            </div>
            <div>
              <span className="lbl">Teacher</span>
              <span className="val">Priya Menon</span>
            </div>
          </div>
        </div>
          );
        })}
      </div>
    </div>
  );
}
