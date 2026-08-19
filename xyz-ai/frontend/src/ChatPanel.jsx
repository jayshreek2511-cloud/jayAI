import { useRef, useEffect, useState } from 'react';

const SUGGESTIONS_BY_ROLE = {
  student: [
    'What is my attendance?',
    'Show my recent attendance records',
    'I want to talk to my teacher',
  ],
  parent: [
    'How much attendance does my child have?',
    "Show my child's recent attendance",
    "I want to talk to my child's teacher",
  ],
  teacher: [
    'Show class attendance',
    'View attendance analytics',
    'Mark student attendance today',
  ],
  principal: [
    'Show attendance analytics',
    'View school-wide attendance stats',
    'Show class attendance report',
  ],
};

const LANG_LOCALES = {
  en: 'en-US', hi: 'hi-IN', kn: 'kn-IN', ta: 'ta-IN', te: 'te-IN',
  mr: 'mr-IN', bn: 'bn-IN', gu: 'gu-IN', pa: 'pa-IN', ml: 'ml-IN', ur: 'ur-PK',
};

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * TalkingAvatarSVG — Renders the animated robot face.
 */
function TalkingAvatarSVG({ isSpeaking, boundaryTick, size = 'large' }) {
  const [mouthOpen, setMouthOpen] = useState(false);

  useEffect(() => {
    if (!isSpeaking) {
      setMouthOpen(false);
      return;
    }
    setMouthOpen(true);
    const interval = setInterval(() => {
      setMouthOpen(prev => !prev);
    }, 170);
    return () => clearInterval(interval);
  }, [isSpeaking, boundaryTick]);

  const containerClass = [
    'avatar-svg-container',
    isSpeaking ? 'talking' : '',
    size === 'small' ? 'avatar-small' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClass}>
      <svg viewBox="0 0 100 100" width="85%" height="85%">
        {/* Face Background */}
        <circle cx="50" cy="50" r="42" fill="#FED7AA" stroke="#F97316" strokeWidth="3" />
        {/* Cheeks */}
        <circle cx="28" cy="56" r="6" fill="#FDBA74" opacity="0.6" />
        <circle cx="72" cy="56" r="6" fill="#FDBA74" opacity="0.6" />
        {/* Eyes */}
        <circle cx="36" cy="44" r="5" fill="#1F2937" />
        <circle cx="64" cy="44" r="5" fill="#1F2937" />
        <circle cx="38" cy="42" r="2" fill="#FFFFFF" />
        <circle cx="66" cy="42" r="2" fill="#FFFFFF" />
        {/* Eyebrows */}
        <path d="M 30 35 Q 36 32 42 35" fill="none" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M 58 35 Q 64 32 70 35" fill="none" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" />

        {/* Mouth (Animated) */}
        {mouthOpen ? (
          <ellipse cx="50" cy="68" rx="12" ry="10" fill="#DC2626" stroke="#991B1B" strokeWidth="2" />
        ) : (
          <path d="M 38 64 Q 50 72 62 64" fill="none" stroke="#1F2937" strokeWidth="3" strokeLinecap="round" />
        )}

        {/* Teeth visible when open */}
        {mouthOpen && (
          <rect x="44" y="59" width="12" height="4" rx="1" fill="#FFFFFF" opacity="0.85" />
        )}

        {/* Robot Cap / Antenna */}
        <circle cx="50" cy="8" r="4" fill="#F97316" />
        <line x1="50" y1="12" x2="50" y2="18" stroke="#F97316" strokeWidth="3" />
      </svg>
    </div>
  );
}

export default function ChatPanel({
  messages, input, onInputChange, onSend, onKeyDown,
  isLoading, error, userInfo, isSpeaking, boundaryTick, isMuted, onToggleMute, language,
}) {
  const endRef = useRef(null);
  const recognitionRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const [sttError, setSttError] = useState(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const role = userInfo.role || 'student';
  const firstName = (userInfo.displayName || 'there').split(' ')[0];
  const suggestions = SUGGESTIONS_BY_ROLE[role] || SUGGESTIONS_BY_ROLE.student;
  const hasMessages = messages.length > 0;

  /* ── SpeechRecognition (STT) Handler ── */
  function toggleListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSttError("Voice input isn't supported in this browser — try Chrome");
      return;
    }

    // Conflict Resolution: Stop active TTS speech to prevent mic feedback loop
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    // Stop if currently recording (toggle behavior)
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.warn('[STT] Error stopping recognition:', e);
        }
      }
      setIsListening(false);
      return;
    }

    try {
      setSttError(null);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      const targetLocale = LANG_LOCALES[language] || 'en-US';
      recognition.lang = targetLocale;

      console.log(`[STT] Initializing SpeechRecognition with target locale '${targetLocale}' (Language code: '${language}')`);

      recognition.onstart = () => {
        console.log('[STT Event] Speech recognition actively recording');
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        console.log('[STT Event] Live transcript output:', transcript);
        onInputChange(transcript);
      };

      recognition.onerror = (event) => {
        console.error('[STT Event] Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setSttError('Microphone permission denied. Please allow mic access in your browser settings.');
        } else if (event.error === 'no-speech') {
          setSttError('No speech detected. Click the mic button and try speaking again.');
        } else if (event.error === 'network') {
          setSttError('Network error during voice recognition.');
        } else {
          setSttError(`Voice recognition notice: ${event.error}`);
        }
      };

      recognition.onend = () => {
        console.log('[STT Event] Speech recognition session ended');
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('[STT] Exception starting SpeechRecognition:', err);
      setSttError(`Could not start voice input: ${err.message}`);
      setIsListening(false);
    }
  }

  function handleSuggestionClick(text) {
    onInputChange(text);
    setTimeout(() => {
      onSend(text);
    }, 50);
  }

  return (
    <div className="chat-panel">
      {/* ── GREETING STATE: Large avatar + suggestions ── */}
      {!hasMessages && (
        <>
          <div className="chat-greeting">
            <div className="greeting-hello">
              Good {getTimeGreeting()}, <span className="accent">{firstName}</span>! 👋
            </div>
            <div className="greeting-sub">I'm XYZ AI, your smart school assistant.</div>
            <div className="greeting-sub2">How can I help you today?</div>
          </div>

          <div className="chat-hero">
            <div className="hero-avatar-wrap">
              <TalkingAvatarSVG isSpeaking={isSpeaking} boundaryTick={boundaryTick} size="large" />
              <div className="online-pill">
                <span className="online-dot" />
                {isSpeaking ? '🗣️ XYZ AI is speaking...' : 'XYZ AI is online'}
              </div>
            </div>
            <div className="suggestion-area">
              <div className="suggestion-label">You can ask me like:</div>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  className="suggestion-chip"
                  onClick={() => handleSuggestionClick(s)}
                >
                  "{s}"
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── CONVERSATION STATE: Compact floating avatar strip + messages ── */}
      {hasMessages && (
        <div className="chat-avatar-strip">
          <TalkingAvatarSVG isSpeaking={isSpeaking} boundaryTick={boundaryTick} size="small" />
          <div className="avatar-strip-info">
            <span className="avatar-strip-name">XYZ AI</span>
            <span className={`avatar-strip-status${isSpeaking ? ' speaking' : ''}`}>
              {isSpeaking ? '🗣️ Speaking...' : '● Online'}
            </span>
          </div>
          <button
            className="avatar-strip-mute"
            onClick={onToggleMute}
            title={isMuted ? 'Unmute voice' : 'Mute voice'}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
        </div>
      )}

      <div className="chat-messages">
        {isLoading && messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#9CA3AF', fontStyle: 'italic', padding: 24 }}>
            Connecting to XYZ AI...
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg-row ${m.role === 'user' ? 'user' : 'ai'}`}>
            {m.role === 'ai' && <div className="msg-avatar bot-av">🤖</div>}
            {m.role === 'user' && (
              <div className="msg-avatar user-av">
                {(userInfo.displayName || 'U')[0]}
              </div>
            )}
            <div className="msg-content">
              <div className="msg-bubble">{m.text}</div>
              <div className="msg-time">{formatTime(m.time || new Date())}</div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {error && <div className="error-toast">{error}</div>}

      {sttError && (
        <div className="voice-toast">
          <span>⚠️ {sttError}</span>
          <button className="toast-close-btn" onClick={() => setSttError(null)}>×</button>
        </div>
      )}

      <div className="chat-input-bar">
        <div className="input-wrap">
          <input
            aria-label="Chat message"
            disabled={isLoading}
            placeholder={
              isListening
                ? '🎙️ Listening... speak clearly into your mic'
                : isLoading
                ? 'Connecting...'
                : 'Type or speak your message...'
            }
            value={input}
            onChange={e => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button
            className={`mic-btn${isListening ? ' listening' : ''}`}
            title={isListening ? 'Recording voice... Click to stop' : 'Start voice input (SpeechRecognition)'}
            onClick={toggleListening}
            type="button"
          >
            {isListening ? '🔴' : '🎤'}
          </button>
          <button
            className="send-btn"
            disabled={isLoading || !input.trim()}
            onClick={() => onSend()}
            title="Send"
          >➤</button>
        </div>
        <div className="voice-hint">
          {isListening
            ? '🎙️ Recording voice input... Speak into your microphone'
            : isMuted
            ? '🔇 Voice replies muted'
            : '🔊 Voice replies active (speechSynthesis) • Click 🎤 for voice input'}
        </div>
      </div>
    </div>
  );
}

function getTimeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
