import { useState, useEffect } from 'react';
import Sidebar from './Sidebar.jsx';
import TopBar from './TopBar.jsx';
import ChatPanel from './ChatPanel.jsx';
import RightPanel from './RightPanel.jsx';
import { AttendanceView, ReportsView, AssignmentsView, PlaceholderView, MyChildrenView } from './Views.jsx';

const API = '/api';
const DEMO_USER = { userId: 'student-001', role: 'student' };

/* ── Role-specific display names (from mock-data.json) ── */
const ROLE_NAMES = {
  'student-001': { name: 'Aarav Sharma', class: '6A', attendancePercentage: 94 },
  'parent-001': { name: 'Neha Sharma', childName: 'Aarav Sharma', childClass: '6A', attendancePercentage: 94 },
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
  const [token, setToken] = useState(null);
  const [status, setStatus] = useState('connecting');
  const [error, setError] = useState(null);

  /* ── Demo User State ── */
  const [currentUser, setCurrentUser] = useState({ userId: 'student-001', role: 'student' });

  /* ── Navigation & UI State ── */
  const [activeView, setActiveView] = useState('chat');
  const [language, setLanguage] = useState('en');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  /* ── User info derived from current demo user ── */
  const profile = ROLE_NAMES[currentUser.userId] || {};
  const userInfo = {
    userId: currentUser.userId,
    role: currentUser.role,
    displayName: profile.name || currentUser.userId,
    name: profile.name || currentUser.userId,
    class: profile.class || '',
    childName: profile.childName || profile.name || '',
    childClass: profile.childClass || profile.class || '',
    attendancePercentage: profile.attendancePercentage ?? 94,
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

  /* ── Switch Demo User ── */
  function handleSwitchDemoUser(targetUserId, targetRole) {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setMessages([]);
    setCurrentUser({ userId: targetUserId, role: targetRole });
  }

  /* ── Auto-login on currentUser change ── */
  useEffect(() => {
    (async () => {
      try {
        setStatus('connecting');
        const res = await fetch(`${API}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentUser),
        });
        if (!res.ok) throw new Error(`Login failed (${res.status})`);
        const { token: t } = await res.json();
        setToken(t);
        setStatus('ready');
      } catch (e) {
        setError(`Could not connect: ${e.message}`);
        setStatus('error');
      }
    })();
  }, [currentUser]);

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
        body: JSON.stringify({ message: text, language }),
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

  return (
    <div className="app-layout">
      <Sidebar
        userInfo={userInfo}
        activeView={activeView}
        onSelectView={handleSelectView}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="main-area">
        <TopBar
          userInfo={userInfo}
          currentUser={currentUser}
          onSwitchDemoUser={handleSwitchDemoUser}
          language={language}
          onLanguageChange={setLanguage}
          onMenuClick={() => setSidebarOpen(o => !o)}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
        />

        <div className="content-area">
          {(activeView === 'home' || activeView === 'chat') && (
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
    </div>
  );
}
