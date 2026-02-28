import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClearNestLogo } from '@/components/ClearNestLogo';
import { Mic, MicOff, PhoneOff } from 'lucide-react';
import { useConversation } from '@11labs/react';
import { useSession } from '@/contexts/SessionContext';

const Conversation = () => {
  const navigate = useNavigate();
  const {
    lastClaraMessage,
    lastUserMessage,
    setLastClaraMessage,
    setLastUserMessage,
    handleAgentToolCall,
  } = useSession();

  const agentId = import.meta.env.VITE_ELEVENLABS_AGENT_ID as string;

  // ─── Strip internal [NOTE: ...] and [Patient] tags from Clara's display text ──
  const cleanClaraMessage = (raw: string): string => {
    return raw
      // Remove [NOTE: ...] blocks (including multiline)
      .replace(/\[NOTE:[^\]]*\]/gi, '')
      // Remove [Patient] prefix
      .replace(/^\[Patient\]\s*/i, '')
      // Clean up any double spaces or trailing whitespace
      .replace(/\s{2,}/g, ' ')
      .trim();
  };

  const parseAndCaptureNote = (raw: string) => {
    const noteMatch = raw.match(/\[NOTE:\s*([^\]]+)\]/i);
    if (!noteMatch) return;

    const noteStr = noteMatch[1];

    // Parse key=value pairs from the note string
    const get = (key: string) => {
      const m = noteStr.match(new RegExp(`${key}=([^,\\]]+)`, 'i'));
      return m ? m[1].trim() : undefined;
    };

    const category = get('category') ?? 'general';
    const content = get('content') ?? noteStr;
    const confidence = (get('confidence') ?? 'clear') as 'clear' | 'needs-follow-up';
    const flagVal = get('flag');
    const flag = flagVal === 'true';

    handleAgentToolCall('capture_note', { category, content, confidence, flag });
  };

  // ─── ElevenLabs Conversational AI ─────────────────────────────────────────
  const conversation = useConversation({
    onMessage: (message: { source: string; message: string }) => {
      console.log('💬 Message:', message);
      if (message.source === 'ai') {
        setLastClaraMessage(cleanClaraMessage(message.message));
        // Parse the note out separately and send to session context
        parseAndCaptureNote(message.message);
      } else if (message.source === 'user') {
        setLastUserMessage(message.message);
      }
    },
    onToolCall: (toolCall: { tool_name: string; parameters: Record<string, unknown> }) => {
      console.log('🔧 Tool call:', toolCall);
      handleAgentToolCall(toolCall.tool_name, toolCall.parameters);
    },
    onError: (error: string) => {
      console.error('❌ ElevenLabs error:', error);
      setLastClaraMessage(`Connection error: ${error}`);
    },
    onConnect: () => console.log('✅ Connected to ElevenLabs agent'),
    onDisconnect: () => console.log('🔌 Disconnected from ElevenLabs agent'),
  });

  // ─── Controls ─────────────────────────────────────────────────────────────
  const startSession = useCallback(async () => {
    if (!agentId) {
      setLastClaraMessage('Agent ID not configured.');
      return;
    }

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY as string;

      const res = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
        { headers: { 'xi-api-key': apiKey } }
      );

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`ElevenLabs API error ${res.status}: ${errText}`);
      }

      const data = await res.json();
      console.log('🔑 ElevenLabs token response:', data); // <-- tells us exactly what field it returns

      // The signed URL itself is passed directly — NOT wrapped in conversationToken
      const signedUrl: string = data.signed_url ?? data.conversation_token ?? data.token;

      if (!signedUrl) throw new Error(`No URL in response: ${JSON.stringify(data)}`);

      // Pass the signed URL directly — SDK connects via WebSocket to it
      await conversation.startSession({ signedUrl });

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not start session';
      console.error('❌ Start session error:', msg);
      setLastClaraMessage(`Could not start: ${msg}`);
    }
  }, [conversation, agentId, setLastClaraMessage]);

  const endSession = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  const isConnected = conversation.status === 'connected';
  const isAgentSpeaking = conversation.isSpeaking;

  const handleMicPress = () => {
    if (!isConnected) startSession();
    else endSession();
  };

  const handleEndChat = () => {
    endSession();
    navigate('/');
  };

  // ─── Status text — large and clear ───────────────────────────────────────
  const getStatusText = () => {
    if (!isConnected) return 'Tap the button below to speak with Clara';
    if (isAgentSpeaking) return 'Clara is speaking…';
    return 'Clara is listening — speak now';
  };

  const getStatusColor = () => {
    if (!isConnected) return '#7a8b9a';
    if (isAgentSpeaking) return '#4a7c6b';
    return '#2e6b9e';
  };

  return (
    <div style={styles.page}>

      {/* ── Header ── */}
      <header style={styles.header}>
        <ClearNestLogo href="/" variant="small" />
        <button
          onClick={handleEndChat}
          style={styles.endChatBtn}
          aria-label="End chat and go to dashboard"
        >
          <PhoneOff size={22} style={{ marginRight: 8 }} />
          End Chat
        </button>
      </header>

      {/* ── Main ── */}
      <main style={styles.main}>

        {/* Greeting */}
        <div style={styles.greetingCard}>
          <div style={styles.claraAvatar} aria-hidden="true">
            <span style={styles.claraInitial}>C</span>
          </div>
          <h1 style={styles.greetingTitle}>Hello. I'm Clara.</h1>
          <p style={styles.greetingBody}>
            I'm here for a gentle chat to help your family get organised.
            There are no wrong answers — we go at your pace.
          </p>
        </div>

        {/* Clara's last message — persists until user speaks again */}
        {lastClaraMessage && (
          <div style={styles.claraMessageCard}>
            <p style={styles.cardLabel}>Clara said:</p>
            <p style={styles.claraMessageText}>{lastClaraMessage}</p>
          </div>
        )}

        {/* You said — only shown after user speaks */}
        {lastUserMessage && (
          <div style={styles.userMessageCard}>
            <p style={styles.cardLabel}>You said:</p>
            <p style={styles.userMessageText}>"{lastUserMessage}"</p>
          </div>
        )}

        {/* Status */}
        <p style={{ ...styles.statusText, color: getStatusColor() }}>
          {getStatusText()}
        </p>

        {/* ── Big Mic Button ── */}
        <div style={styles.micWrapper}>
          {/* Pulsing ring when listening */}
          {isConnected && !isAgentSpeaking && (
            <>
              <span style={{ ...styles.pulseRing, animationDelay: '0s' }} />
              <span style={{ ...styles.pulseRing, animationDelay: '0.4s' }} />
            </>
          )}

          <button
            onClick={handleMicPress}
            disabled={isAgentSpeaking}
            aria-label={isConnected ? 'Stop conversation' : 'Start conversation with Clara'}
            style={{
              ...styles.micBtn,
              background: isConnected
                ? (isAgentSpeaking ? '#b0bec5' : '#2e6b9e')
                : '#4a7c6b',
              cursor: isAgentSpeaking ? 'not-allowed' : 'pointer',
              opacity: isAgentSpeaking ? 0.75 : 1,
            }}
          >
            {isConnected
              ? <MicOff size={52} color="#ffffff" />
              : <Mic size={52} color="#ffffff" />
            }
          </button>
        </div>

        {/* Button label */}
        <p style={styles.micLabel}>
          {!isConnected && 'Tap to start talking'}
          {isConnected && !isAgentSpeaking && 'Tap to stop'}
          {isConnected && isAgentSpeaking && 'Please wait…'}
        </p>

        {/* Live status dot */}
        {isConnected && (
          <div style={styles.statusDot}>
            <span style={{
              ...styles.dot,
              background: isAgentSpeaking ? '#4a7c6b' : '#2e6b9e',
            }} />
            <span style={styles.dotLabel}>
              {isAgentSpeaking ? 'Clara is speaking' : 'Listening'}
            </span>
          </div>
        )}

      </main>

      {/* ── Footer ── */}
      <footer style={styles.footer}>
        <p style={styles.footerText}>
          You can stop at any time — just say "I'd like to stop" or press <strong>End Chat</strong>.
        </p>
      </footer>

      {/* ── Pulse animation ── */}
      <style>{`
        @keyframes elderPulse {
          0%   { transform: scale(1);   opacity: 0.5; }
          70%  { transform: scale(1.9); opacity: 0; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        @keyframes claraFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

// ─── Inline styles (no Tailwind dependency, all values intentionally large) ──
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#f5f0eb',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Georgia', 'Times New Roman', serif",
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 28px',
    borderBottom: '1px solid #ddd6cc',
    background: '#ffffff',
  },
  endChatBtn: {
    display: 'flex',
    alignItems: 'center',
    background: '#c0392b',
    color: '#ffffff',
    border: 'none',
    borderRadius: 12,
    padding: '14px 24px',
    fontSize: 18,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.02em',
    fontFamily: 'inherit',
    boxShadow: '0 3px 8px rgba(192,57,43,0.3)',
  },

  // ── Main ────────────────────────────────────────────────────────────────
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '28px 20px 40px',
    maxWidth: 640,
    margin: '0 auto',
    width: '100%',
    gap: 24,
  },

  // ── Greeting card ────────────────────────────────────────────────────────
  greetingCard: {
    background: '#ffffff',
    borderRadius: 20,
    padding: '32px 28px',
    textAlign: 'center',
    boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
    width: '100%',
  },
  claraAvatar: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    background: '#4a7c6b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
    boxShadow: '0 4px 12px rgba(74,124,107,0.35)',
  },
  claraInitial: {
    fontSize: 36,
    color: '#ffffff',
    fontWeight: 700,
    fontFamily: 'Georgia, serif',
  },
  greetingTitle: {
    fontSize: 30,
    fontWeight: 700,
    color: '#1a2e26',
    margin: '0 0 12px',
    lineHeight: 1.2,
  },
  greetingBody: {
    fontSize: 30,
    color: '#4a5568',
    lineHeight: 1.7,
    margin: 0,
  },

  // ── Clara's message (persistent) ────────────────────────────────────────
  claraMessageCard: {
    background: '#e8f4ef',
    border: '2px solid #4a7c6b',
    borderRadius: 20,
    padding: '28px 28px',
    width: '100%',
    animation: 'claraFadeIn 0.4s ease',
    boxShadow: '0 2px 12px rgba(74,124,107,0.15)',
  },
  cardLabel: {
    fontSize: 15,
    fontWeight: 700,
    color: '#4a7c6b',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    margin: '0 0 10px',
    fontFamily: "'Helvetica Neue', sans-serif",
  },
  claraMessageText: {
    fontSize: 24,
    color: '#1a2e26',
    lineHeight: 1.6,
    margin: 0,
    fontWeight: 400,
  },

  // ── User's message ───────────────────────────────────────────────────────
  userMessageCard: {
    background: '#eef2f7',
    border: '2px solid #2e6b9e',
    borderRadius: 20,
    padding: '24px 28px',
    width: '100%',
    animation: 'claraFadeIn 0.3s ease',
  },
  userMessageText: {
    fontSize: 20,
    color: '#2c3e50',
    lineHeight: 1.6,
    margin: 0,
    fontStyle: 'italic',
  },

  // ── Status text ──────────────────────────────────────────────────────────
  statusText: {
    fontSize: 20,
    fontWeight: 600,
    textAlign: 'center',
    margin: 0,
    fontFamily: "'Helvetica Neue', sans-serif",
    transition: 'color 0.3s ease',
  },

  // ── Mic button ───────────────────────────────────────────────────────────
  micWrapper: {
    position: 'relative',
    width: 160,
    height: 160,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: '50%',
    background: 'rgba(46,107,158,0.25)',
    animation: 'elderPulse 1.8s ease-out infinite',
    display: 'block',
  },
  micBtn: {
    position: 'relative',
    zIndex: 2,
    width: 160,
    height: 160,
    borderRadius: '50%',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.3s ease, transform 0.15s ease',
    boxShadow: '0 6px 24px rgba(0,0,0,0.22)',
    outline: 'none',
  },
  micLabel: {
    fontSize: 20,
    color: '#4a5568',
    margin: 0,
    fontFamily: "'Helvetica Neue', sans-serif",
    fontWeight: 600,
    textAlign: 'center',
  },

  // ── Status dot ───────────────────────────────────────────────────────────
  statusDot: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: '50%',
    display: 'inline-block',
    animation: 'elderPulse 2s ease-out infinite',
  },
  dotLabel: {
    fontSize: 18,
    color: '#4a5568',
    fontFamily: "'Helvetica Neue', sans-serif",
  },

  // ── Footer ───────────────────────────────────────────────────────────────
  footer: {
    textAlign: 'center',
    padding: '20px 24px 28px',
    borderTop: '1px solid #ddd6cc',
    background: '#ffffff',
  },
  footerText: {
    fontSize: 17,
    color: '#718096',
    margin: 0,
    lineHeight: 1.6,
  },
};

export default Conversation;