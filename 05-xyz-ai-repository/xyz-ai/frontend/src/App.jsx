import { useState, useEffect } from 'react';
import Sidebar from './Sidebar.jsx';
import TopBar from './TopBar.jsx';
import ChatPanel from './ChatPanel.jsx';
import RightPanel from './RightPanel.jsx';
import LoginScreen from './LoginScreen.jsx';
import { AttendanceView, ReportsView, AssignmentsView, HomeView, PlaceholderView, MyChildrenView } from './Views.jsx';

const API = '/api';
const SESSION_KEY = 'xyz-ai-session';

function loadStoredSession() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY));
    if (typeof saved?.token === 'string' && typeof saved?.user?.userId === 'string' && typeof saved?.user?.role === 'string') {
      return saved;
    }
  } catch {
    // Missing or malformed browser storage should behave like a signed-out session.
  }
  return null;
}

function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
  } catch {
    return {};
  }
}

/* ── Role-specific display names (from mock-data.json) ── */
const ROLE_NAMES = {
  'student-001': { name: 'Aarav Sharma', class: '6A', attendancePercentage: 94 },
  'student-011': { name: 'Riya Sharma', class: '7A', attendancePercentage: 82 },
  'parent-001': { name: 'Neha Sharma' },
  'teacher-001': { name: 'Priya Menon', class: '6A' },
  'principal-001': { name: 'Dr. Ritu Verma' },
};

const LANG_LOCALES = {
  en: 'en-US', hi: 'hi-IN', kn: 'kn-IN', ta: 'ta-IN', te: 'te-IN',
  mr: 'mr-IN', bn: 'bn-IN', gu: 'gu-IN', pa: 'pa-IN', ml: 'ml-IN', ur: 'ur-PK',
};

export default function App() {
  /* ── State ── */
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [session, setSession] = useState(loadStoredSession);
  const [status, setStatus] = useState(session ? 'ready' : 'idle');
  const [error, setError] = useState(null);

  const token = session?.token ?? null;
  const currentUser = session?.user ?? null;
  const linkedStudentIds = currentUser?.linkedStudentIds ?? [];
  const activeChildId = currentUser?.role === 'parent'
    ? (linkedStudentIds.includes(session?.activeChildId) ? session.activeChildId : linkedStudentIds[0])
    : null;

  /* ── Navigation & UI State ── */
  const [activeView, setActiveView] = useState('home');
  const [language, setLanguage] = useState('en');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  /* ── User info derived from current demo user ── */
  const profile = currentUser ? (ROLE_NAMES[currentUser.userId] || {}) : {};
  const activeChildProfile = activeChildId ? (ROLE_NAMES[activeChildId] || {}) : {};
  const linkedChildren = linkedStudentIds.map((studentId) => ({
    userId: studentId,
    name: ROLE_NAMES[studentId]?.name || studentId,
    class: ROLE_NAMES[studentId]?.class || '',
    attendancePercentage: ROLE_NAMES[studentId]?.attendancePercentage,
  }));
  const userInfo = {
    userId: currentUser?.userId || '',
    role: currentUser?.role || '',
    displayName: profile.name || currentUser?.userId || '',
    name: profile.name || currentUser?.userId || '',
    studentId: activeChildId || currentUser?.userId || '',
    class: profile.class || '',
    childName: activeChildProfile.name || profile.childName || profile.name || '',
    childClass: activeChildProfile.class || profile.childClass || profile.class || '',
    attendancePercentage: activeChildProfile.attendancePercentage ?? profile.attendancePercentage ?? 94,
    linkedChildren,
  };

  /* ── Speech Synthesis TTS Voice generator & boundary sync ── */
  const [boundaryTick, setBoundaryTick] = useState(0);

  useEffect(() => {
    if ('speechSynthesis' in window) {
      const handleVoicesChanged = () => {
        const voices = window.speechSynthesis.getVoices();
        console.log(`[TTS] SpeechSynthesis voices ready: ${voices.length} voice(s) available.`);
      };
      window.speechSynthesis.onvoiceschanged = handleVoicesChanged;
      handleVoicesChanged();
    }
  }, []);

  useEffect(() => {
    if (!token) {
      setNotifications([]);
      return;
    }

    let active = true;
    async function loadNotifications() {
      try {
        const response = await fetch(`${API}/mock/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load notifications.');
        if (active) setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      } catch (notificationError) {
        console.error('Could not load notifications:', notificationError);
        if (active) setNotifications([]);
      }
    }

    loadNotifications();
    return () => { active = false; };
  }, [token]);

  function getMatchingVoice(langCode) {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    const targetLocale = (LANG_LOCALES[langCode] || 'en-US').toLowerCase();
    const targetLangPrefix = (langCode || 'en').toLowerCase();

    console.log(`[TTS] Voice lookup for '${langCode}' (${targetLocale}). Available voices:`, voices.map(v => `${v.name} (${v.lang})`));

    let voice = voices.find(v => v.lang.toLowerCase().replace('_', '-') === targetLocale);
    if (!voice) {
      voice = voices.find(v => v.lang.toLowerCase().startsWith(targetLangPrefix));
    }
    if (!voice) {
      voice = voices.find(v => v.lang.toLowerCase().startsWith('en'));
    }
    if (!voice && voices.length > 0) {
      voice = voices[0];
    }
    return voice;
  }

  function speakReply(text, lang) {
    if (isMuted || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const targetLocale = LANG_LOCALES[lang] || 'en-US';
      utterance.lang = targetLocale;

      const voice = getMatchingVoice(lang);
      if (voice) {
        utterance.voice = voice;
        console.log(`[TTS] Selected voice: '${voice.name}' (${voice.lang}) for language: '${lang}'`);
      } else {
        console.log(`[TTS] Using default browser voice for locale: '${targetLocale}'`);
      }

      utterance.onstart = () => {
        console.log('[TTS Event] Utterance started');
        setIsSpeaking(true);
      };
      utterance.onboundary = (e) => {
        console.log(`[TTS Event] Word boundary at charIndex ${e.charIndex}`);
        setBoundaryTick(t => t + 1);
      };
      utterance.onend = () => {
        console.log('[TTS Event] Utterance ended');
        setIsSpeaking(false);
      };
      utterance.onerror = (e) => {
        console.error('[TTS Event] Utterance error:', e);
        setIsSpeaking(false);
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error('[TTS] Exception in speakReply:', e);
      setIsSpeaking(false);
    }
  }

  function handleToggleMute() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setIsMuted(m => !m);
  }

  async function handleLogin({ userId, role }) {
    if (!userId || !role) {
      setError('User ID and role are required.');
      return;
    }

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setSession(null);
    setStatus('connecting');
    setError(null);
    setMessages([]);
    setActiveView('home');

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Login failed (${res.status})`);

      const claims = decodeJwtPayload(data.token);
      const linkedStudentIds = Array.isArray(claims.linkedStudentIds) ? claims.linkedStudentIds : [];
      const nextSession = {
        token: data.token,
        user: { userId, role, linkedStudentIds },
        activeChildId: linkedStudentIds[0] || null,
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
      setStatus('ready');
    } catch (e) {
      setError(`Could not sign in: ${e.message}`);
      setStatus('error');
    }
  }

  function handleSwitchChild(nextChildId) {
    if (!linkedStudentIds.includes(nextChildId)) return;
    const nextSession = { ...session, activeChildId: nextChildId };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
    setMessages([]);
    setActiveView('home');
    setSidebarOpen(false);
  }

  function handleLogout() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    setMessages([]);
    setInput('');
    setError(null);
    setStatus('idle');
    setIsSpeaking(false);
    setSidebarOpen(false);
    setRightOpen(false);
    setActiveView('chat');
    setNotifications([]);
    setLogoutDialogOpen(false);
  }

  async function handleNotificationClick(notificationId) {
    const currentNotification = notifications.find((notification) => notification.id === notificationId);
    if (!currentNotification || currentNotification.read || !token) return;

    try {
      const response = await fetch(`${API}/mock/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not mark notification as read.');
      setNotifications((items) => items.map((notification) => (
        notification.id === notificationId ? data.notification : notification
      )));
    } catch (notificationError) {
      console.error('Could not mark notification as read:', notificationError);
    }
  }

  /* ── Send message ── */
  async function sendMessage(overrideText) {
    const text = (overrideText || input).trim();
    if (!text || !token) return;

    setInput('');
    setError(null);
    setMessages(prev => [...prev, { role: 'user', text, time: new Date() }]);

    try {
      const res = await fetch(`${API}/orchestrate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: text,
          language,
          ...(activeChildId ? { activeChildId } : {}),
        }),
      });
      const data = await res.json();
      const reply = (data && typeof data.reply === 'string' && data.reply.trim())
        ? data.reply
        : "Sorry, I didn't catch that — could you rephrase?";
      setMessages(prev => [...prev, { role: 'ai', text: reply, time: new Date() }]);

      speakReply(reply, language);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', text: `Error: ${e.message}`, time: new Date() }]);
    }
  }

  function handleSelectView(viewId) {
    if (viewId === 'teacher') {
      setActiveView('chat');
      sendMessage('I want to talk to my teacher');
      return;
    }
    setActiveView(viewId);
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const isLoading = status === 'connecting';

  if (!currentUser || !token) {
    return <LoginScreen onLogin={handleLogin} error={error} isLoading={isLoading} />;
  }

  return (
    <div className="app-layout">
      <Sidebar
        userInfo={userInfo}
        activeView={activeView}
        onSelectView={handleSelectView}
        onLogout={() => setLogoutDialogOpen(true)}
        linkedChildren={linkedChildren}
        activeChildId={activeChildId}
        onSwitchChild={handleSwitchChild}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="main-area">
        <TopBar
          userInfo={userInfo}
          language={language}
          onLanguageChange={setLanguage}
          onMenuClick={() => setSidebarOpen(o => !o)}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          notifications={notifications}
          onNotificationClick={handleNotificationClick}
        />

        <div className="content-area">
          {activeView === 'home' && <HomeView />}

          {activeView === 'chat' && (
            <ChatPanel
              messages={messages}
              input={input}
              onInputChange={setInput}
              onSend={sendMessage}
              onKeyDown={handleKey}
              isLoading={isLoading}
              error={error}
              userInfo={userInfo}
              status={status}
              isSpeaking={isSpeaking}
              boundaryTick={boundaryTick}
              isMuted={isMuted}
              onToggleMute={handleToggleMute}
              language={language}
            />
          )}

          {activeView === 'attendance' && (
            <AttendanceView userInfo={userInfo} token={token} />
          )}

          {activeView === 'reports' && (
            <ReportsView userInfo={userInfo} />
          )}

          {activeView === 'assignments' && (
            <AssignmentsView userInfo={userInfo} />
          )}

          {activeView === 'children' && (
            <MyChildrenView userInfo={userInfo} />
          )}

          {activeView === 'settings' && (
            <PlaceholderView
              icon="⚙️"
              title="Settings & Preferences"
              subtitle="Account settings, notification preferences, and privacy controls coming soon."
            />
          )}

          {activeView === 'help' && (
            <PlaceholderView
              icon="❓"
              title="Help & Support"
              subtitle="School directory, FAQs, and AI assistant user guide coming soon."
            />
          )}

          <RightPanel
            userInfo={userInfo}
            token={token}
            onSendMessage={(msg) => {
              setActiveView('chat');
              sendMessage(msg);
            }}
            open={rightOpen}
          />
        </div>
      </div>

      <button
        className="mobile-right-toggle"
        onClick={() => setRightOpen(o => !o)}
        title="Quick Actions"
      >⚡</button>

      {logoutDialogOpen && (
        <div className="logout-dialog-backdrop" role="presentation">
          <div className="logout-dialog" role="dialog" aria-modal="true" aria-labelledby="logout-dialog-title">
            <h2 id="logout-dialog-title">Log out?</h2>
            <p>Are you sure you want to log out?</p>
            <div className="logout-dialog-actions">
              <button className="logout-cancel-btn" onClick={() => setLogoutDialogOpen(false)}>Cancel</button>
              <button className="logout-confirm-btn" onClick={handleLogout}>Log out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
