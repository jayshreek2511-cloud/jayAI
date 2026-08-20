import { useState } from 'react';

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
  userInfo, language, onLanguageChange, onMenuClick, isMuted, onToggleMute,
  notifications = [], onNotificationClick,
}) {
  const initials = (userInfo.displayName || 'U').split(' ').map(w => w[0]).join('').slice(0, 2);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
    }).format(date);
  }

  return (
    <div className="top-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="hamburger" onClick={onMenuClick}>☰</button>
        <select className="lang-selector" value={language} onChange={e => onLanguageChange(e.target.value)}>
          {LANGUAGES.map(l => <option key={l.code} value={l.code}>🌐 {l.label}</option>)}
        </select>
      </div>

      <div className="topbar-right">
        <button className="icon-btn" onClick={onToggleMute} title={isMuted ? 'Unmute voice replies' : 'Mute voice replies'}>
          {isMuted ? '🔇' : '🔊'}
        </button>
        <div className="notifications-menu">
          <button
            className="icon-btn"
            onClick={() => setNotificationsOpen((open) => !open)}
            title="Notifications"
            aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
            aria-expanded={notificationsOpen}
          >
            🔔{unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
          </button>
          {notificationsOpen && (
            <section className="notifications-panel" aria-label="Notifications">
              <div className="notifications-heading">Notifications</div>
              {notifications.length === 0 ? (
                <p className="notifications-empty">You’re all caught up.</p>
              ) : (
                <div className="notifications-list">
                  {notifications.map((notification) => (
                    <button
                      className={`notification-item${notification.read ? '' : ' unread'}`}
                      key={notification.id}
                      onClick={() => onNotificationClick?.(notification.id)}
                    >
                      {!notification.read && <span className="notification-dot" aria-label="Unread" />}
                      <span className="notification-copy">
                        <span className="notification-title">{notification.title}</span>
                        <span className="notification-message">{notification.message}</span>
                        <span className="notification-time">{formatTimestamp(notification.timestamp)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
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
