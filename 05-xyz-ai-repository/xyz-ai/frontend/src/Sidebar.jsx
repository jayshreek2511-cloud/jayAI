import { useState } from 'react';

const NAV_ITEMS = [
  { icon: '🏠', label: 'Home', id: 'home' },
  { icon: '💬', label: 'AI Chat', id: 'chat' },
  { icon: '📋', label: 'Attendance', id: 'attendance' },
  { icon: '📊', label: 'Reports', id: 'reports' },
  { icon: '📝', label: 'Assignments', id: 'assignments' },
  { icon: '👨‍👩‍👧', label: 'My Children', id: 'children', parentOnly: true },
  { icon: '👩‍🏫', label: 'Talk to Teacher', id: 'teacher' },
  { icon: '⚙️', label: 'Settings', id: 'settings' },
  { icon: '❓', label: 'Help & Support', id: 'help' },
];

export default function Sidebar({
  userInfo, activeView, onSelectView, onLogout, linkedChildren = [], activeChildId, onSwitchChild, open, onClose,
}) {
  const [showChildPicker, setShowChildPicker] = useState(false);
  const childName = userInfo.childName || userInfo.name || 'Student';
  const childClass = userInfo.childClass || userInfo.class || '';
  const initials = childName.split(' ').map(w => w[0]).join('').slice(0, 2);
  const isParent = userInfo.role === 'parent';

  const visibleItems = NAV_ITEMS.filter(item => !item.parentOnly || isParent);

  function handleNavClick(id) {
    onSelectView(id);
    onClose();
  }

  return (
    <>
      <div className={`sidebar-overlay${open ? ' visible' : ''}`} onClick={onClose} />
      <aside className={`left-sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-icon">🤖</div>
          <div>
            <div className="logo-text"><span>XYZ </span><span className="ai">AI</span></div>
            <div className="logo-subtitle">School Assistant</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {visibleItems.map(item => {
            const isActive = activeView === item.id || (activeView === 'home' && item.id === 'home');
            return (
              <button
                key={item.id}
                className={`nav-item${isActive ? ' active' : ''}`}
                onClick={() => handleNavClick(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </button>
            );
          })}
          <button className="nav-item logout" onClick={onLogout}>
            <span className="nav-icon">🚪</span>
            Logout
          </button>
        </nav>

        <div className="sidebar-child-card">
          <div className="child-card-header">
            {isParent ? 'Active Child' : 'Your Profile'}
          </div>
          <div className="child-info">
            <div className="child-avatar">{initials}</div>
            <div>
              <div className="child-name">{childName}</div>
              {childClass && <div className="child-class">Class {childClass}</div>}
            </div>
          </div>
          {isParent && linkedChildren.length > 1 && (
            <>
              <button className="switch-child-btn" onClick={() => setShowChildPicker((visible) => !visible)}>
                Switch Child ⇄
              </button>
              {showChildPicker && (
                <div className="child-picker" aria-label="Choose active child">
                  {linkedChildren.map((child) => (
                    <button
                      key={child.userId}
                      className={`child-picker-option${child.userId === activeChildId ? ' active' : ''}`}
                      onClick={() => {
                        onSwitchChild(child.userId);
                        setShowChildPicker(false);
                      }}
                    >
                      {child.name} {child.class ? `• Class ${child.class}` : ''}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}
