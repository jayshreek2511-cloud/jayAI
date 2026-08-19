const QUICK_ACTIONS = [
  { icon: '📋', label: 'Check Attendance', message: 'What is my attendance?' },
  { icon: '📅', label: 'Recent Attendance', message: 'Show my recent attendance records' },
  { icon: '📊', label: 'Academic Performance', message: 'Show attendance analytics' },
  { icon: '👩‍🏫', label: 'Talk to Teacher', message: 'I want to talk to my teacher' },
];

function DonutChart({ percentage }) {
  const r = 50;
  const c = 2 * Math.PI * r;
  const filled = (percentage / 100) * c;
  const totalDays = 80;
  const presentDays = Math.round((percentage / 100) * totalDays);

  return (
    <div className="attendance-card">
      <div className="section-title">Attendance</div>
      <div className="donut-wrap">
        <svg viewBox="0 0 120 120">
          <circle className="donut-track" cx="60" cy="60" r={r} />
          <circle className="donut-fill" cx="60" cy="60" r={r}
            strokeDasharray={`${filled} ${c - filled}`} />
        </svg>
        <div className="donut-center">
          <span className="donut-pct">{percentage}%</span>
          <span className="donut-label">Overall</span>
        </div>
      </div>
      <div className="att-stats">
        <div style={{ textAlign: 'center' }}>
          <div className="att-stat-val">{presentDays}</div>
          <div className="att-stat-lbl">Present Days</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className="att-stat-val">{totalDays}</div>
          <div className="att-stat-lbl">Total Days</div>
        </div>
      </div>
      <button className="view-report-btn">View Full Report</button>
    </div>
  );
}

export default function RightPanel({ userInfo, onSendMessage, open }) {
  const pct = userInfo.attendancePercentage ?? 94;
  const childName = userInfo.childName || userInfo.name || 'Student';

  return (
    <aside className={`right-sidebar${open ? ' open' : ''}`}>
      <div className="section-title">Quick Actions</div>
      <div className="quick-actions-grid">
        {QUICK_ACTIONS.map((qa, i) => (
          <button key={i} className="qa-card" onClick={() => onSendMessage(qa.message)}>
            <span className="qa-icon">{qa.icon}</span>
            <span className="qa-label">{qa.label}</span>
          </button>
        ))}
      </div>

      <DonutChart percentage={pct} />

      <div className="help-card">
        <div className="section-title">Need More Help?</div>
        <p>If you're not satisfied with my answers, I can connect you directly to {childName}'s teacher.</p>
        <button onClick={() => onSendMessage('I want to talk to my teacher')}>
          📞 Talk to Teacher
        </button>
      </div>

      <div className="powered-by">Powered by XYZ AI 🧡</div>
    </aside>
  );
}
