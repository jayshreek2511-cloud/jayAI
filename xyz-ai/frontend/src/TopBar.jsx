const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'mr', label: 'मराठी' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'gu', label: 'ગુજરાતી' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'മലയാളം' },
  { code: 'ur', label: 'اردو' },
];

export default function TopBar({
  userInfo, currentUser, onSwitchDemoUser, language, onLanguageChange, onMenuClick, isMuted, onToggleMute,
}) {
  const initials = (userInfo.displayName || 'U').split(' ').map(w => w[0]).join('').slice(0, 2);
  const currentVal = currentUser ? `${currentUser.userId}:${currentUser.role}` : 'student-001:student';

  return (
    <div className="top-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="hamburger" onClick={onMenuClick}>☰</button>
        <select
          className="lang-selector"
          value={language}
          onChange={e => onLanguageChange(e.target.value)}
        >
          {LANGUAGES.map(l => (
            <option key={l.code} value={l.code}>🌐 {l.label}</option>
          ))}
        </select>

        {/* ── Fast Role Switcher Dropdown for Manual Demo Testing ── */}
        <select
          className="demo-user-selector"
          value={currentVal}
          onChange={e => {
            const [uId, uRole] = e.target.value.split(':');
            onSwitchDemoUser(uId, uRole);
          }}
          title="Switch Demo Role & Re-authenticate"
        >
          <option value="student-001:student">👨‍🎓 Student (Aarav)</option>
          <option value="parent-001:parent">👨‍👩‍👧 Parent (Mrs. Sharma)</option>
          <option value="teacher-001:teacher">👩‍🏫 Teacher (Priya Menon)</option>
          <option value="principal-001:principal">🎓 Principal (Dr. Verma)</option>
        </select>
      </div>

      <div className="topbar-right">
        <button
          className="icon-btn"
          onClick={onToggleMute}
          title={isMuted ? 'Unmute voice replies' : 'Mute voice replies'}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
        <button className="icon-btn" title="Notifications">
          🔔<span className="notif-badge">3</span>
        </button>
        <div className="user-profile">
          <div className="user-avatar">{initials}</div>
          <div className="user-meta">
            <div className="user-name">{userInfo.displayName || 'User'}</div>
            <div className="user-role">{userInfo.role || 'student'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
