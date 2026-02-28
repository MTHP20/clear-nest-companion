import { useCallback, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClearNestLogo } from '@/components/ClearNestLogo';
import { Mic, MicOff, PhoneOff } from 'lucide-react';
import { useConversation } from '@11labs/react';
import { useSession } from '@/contexts/SessionContext';

// ─── Typewriter hook ──────────────────────────────────────────────────────────
function useTypewriter(fullText: string, isActive: boolean, charsPerSecond = 30) {
  const [displayed, setDisplayed] = useState('');
  const indexRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setDisplayed('');
    indexRef.current = 0;
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!fullText) return;

    intervalRef.current = setInterval(() => {
      indexRef.current += 1;
      setDisplayed(fullText.slice(0, indexRef.current));
      if (indexRef.current >= fullText.length) clearInterval(intervalRef.current!);
    }, 1000 / charsPerSecond);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fullText, charsPerSecond]);

  // Snap to full if speaking ends before typing finishes
  useEffect(() => {
    if (!isActive && displayed.length < fullText.length) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setDisplayed(fullText);
    }
  }, [isActive, fullText, displayed.length]);

  return { displayed, isTyping: displayed.length < fullText.length };
}

// ─── Component ───────────────────────────────────────────────────────────────
const Conversation = () => {
  const navigate = useNavigate();
  const {
    lastClaraMessage,
    lastUserMessage,
    setLastClaraMessage,
    setLastUserMessage,
    handleAgentToolCall,
    autoSyncLatest,
    liveExtract,
  } = useSession();

  // ── Live transcript buffer for real-time AI extraction ────────────────────
  // Accumulates every user + Clara turn. After each new user message we
  // debounce 2.5 s (giving Clara time to reply) then send the last 6 turns
  // to Claude so it can populate the dashboard sections in real-time.
  const transcriptBuffer = useRef<Array<{ role: 'user' | 'ai'; text: string }>>([]);
  const extractTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleExtract = useCallback(() => {
    if (extractTimer.current) clearTimeout(extractTimer.current);
    extractTimer.current = setTimeout(() => {
      // Take the last 6 turns (3 full exchanges) for context
      const recent = transcriptBuffer.current.slice(-6);
      const snippet = recent
        .map(t => `${t.role === 'ai' ? 'Clara' : 'Narayan'}: ${t.text}`)
        .join('\n');
      liveExtract(snippet);
    }, 2500);
  }, [liveExtract]);

  const agentId = import.meta.env.VITE_ELEVENLABS_AGENT_ID as string;

  // Clear extraction timer on unmount
  useEffect(() => () => { if (extractTimer.current) clearTimeout(extractTimer.current); }, []);

  // ── Track whether a session has ever been started this page visit ─────────
  // This is passed back to ElevenLabs as context so Clara knows to continue,
  // not re-introduce. We also store the last topic covered so Clara can resume.
  const hasSpokenBefore = useRef(false);
  const conversationSummary = useRef<string>('');

  // ── Clean display text ────────────────────────────────────────────────────
  const cleanClaraMessage = (raw: string): string =>
    raw
      .replace(/\[NOTE:[^\]]*\]/gi, '')
      .replace(/^\[Patient\]\s*/i, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

  const parseAndCaptureNote = (raw: string) => {
    const noteMatch = raw.match(/\[NOTE:\s*([^\]]+)\]/i);
    if (!noteMatch) return;
    const noteStr = noteMatch[1];
    const get = (key: string) => {
      const m = noteStr.match(new RegExp(`${key}=([^,\\]]+)`, 'i'));
      return m ? m[1].trim() : undefined;
    };
    const category = get('category') ?? 'general';
    // Keep a running summary for context injection on resume
    const content = get('content') ?? noteStr;
    if (content) {
      conversationSummary.current = conversationSummary.current
        ? `${conversationSummary.current}; ${category}: ${content}`
        : `${category}: ${content}`;
    }
    handleAgentToolCall('capture_note', {
      category,
      content,
      confidence: get('confidence') ?? 'clear',
      flag: get('flag') === 'true',
    });
  };

  // ── ElevenLabs ────────────────────────────────────────────────────────────
  const conversation = useConversation({
    onMessage: (message: { source: string; message: string }) => {
      if (message.source === 'ai') {
        setLastClaraMessage(cleanClaraMessage(message.message));
        parseAndCaptureNote(message.message);
        hasSpokenBefore.current = true;
        transcriptBuffer.current.push({ role: 'ai', text: message.message });
      } else if (message.source === 'user') {
        setLastUserMessage(message.message);
        transcriptBuffer.current.push({ role: 'user', text: message.message });
        // Trigger AI extraction after every user utterance (debounced so
        // Clara's reply is included in the snippet before we extract)
        scheduleExtract();
      }
    },
    onToolCall: (toolCall: { tool_name: string; parameters: Record<string, unknown> }) => {
      handleAgentToolCall(toolCall.tool_name, toolCall.parameters);
    },
    onError: (error: string) => {
      console.error('❌ ElevenLabs error:', error);
      setLastClaraMessage(`Connection error: ${error}`);
    },
    onConnect: () => console.log('✅ Connected'),
    onDisconnect: () => {
      console.log('🔌 Disconnected — syncing conversation to dashboard in 4s…');
      // Wait 4 s for ElevenLabs to finish storing the conversation, then pull
      // the transcript and push everything into the dashboard sections.
      setTimeout(() => {
        autoSyncLatest()
          .then(result => {
            if (result && !result.alreadySynced) {
              console.log(`✅ Auto-sync complete: ${result.items} notes, ${result.actions} actions added to dashboard`);
            }
          })
          .catch(console.error);
      }, 4000);
    },
  });

  const isConnected = conversation.status === 'connected';
  const isAgentSpeaking = conversation.isSpeaking;

  const { displayed: typedMessage, isTyping } = useTypewriter(
    lastClaraMessage,
    isAgentSpeaking,
    30
  );

  // ── Start session — injects resume context if returning ───────────────────
  const startSession = useCallback(async () => {
    if (!agentId) { setLastClaraMessage('Agent ID not configured.'); return; }
    try {
      await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1,
        }
      });
      const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY as string;
      const res = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
        { headers: { 'xi-api-key': apiKey } }
      );
      if (!res.ok) { const t = await res.text(); throw new Error(`API error ${res.status}: ${t}`); }
      const data = await res.json();
      const signedUrl: string = data.signed_url ?? data.conversation_token ?? data.token;
      if (!signedUrl) throw new Error(`No URL in response: ${JSON.stringify(data)}`);

      // Build dynamic override — if we've spoken before, tell Clara to resume
      const dynamicPromptOverride = hasSpokenBefore.current
        ? [
          {
            role: 'system' as const,
            content: conversationSummary.current
              ? `You have already introduced yourself to Narayan. Do NOT say hello or reintroduce yourself. Simply continue the conversation naturally from where you left off. So far you have noted: ${conversationSummary.current}. Pick up the next topic.`
              : `You have already introduced yourself to Narayan. Do NOT say hello or reintroduce yourself. Simply continue the conversation naturally from where you left off.`,
          },
        ]
        : undefined;

      await conversation.startSession({
        signedUrl,
        ...(dynamicPromptOverride && {
          overrides: {
            agent: {
              prompt: {
                prompt: dynamicPromptOverride[0].content,
              },
            },
            // Tune VAD — ignore quiet background, wait longer for pauses
            turn_detection: {
              mode: 'server_vad',
              threshold: 0.55,          // 0–1, higher = less sensitive to quiet noise (default ~0.4)
              silence_duration_ms: 800, // wait 800ms of silence before treating as end of turn
              prefix_padding_ms: 300,   // capture 300ms before speech detected
            },
          },
        }),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not start session';
      console.error('❌ Start session error:', msg);
      setLastClaraMessage(`Could not start: ${msg}`);
    }
  }, [conversation, agentId, setLastClaraMessage]);

  const endSession = useCallback(async () => { await conversation.endSession(); }, [conversation]);
  const handleMicPress = () => { if (!isConnected) startSession(); else endSession(); };
  const handleEndChat = () => { endSession(); navigate('/'); };

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

  // ── Whether to show the greeting card (hide once conversation starts) ─────
  const showGreeting = !lastClaraMessage && !lastUserMessage;

  return (
    <div style={styles.page}>

      {/* ── Header ── */}
      <header style={styles.header}>
        <ClearNestLogo variant="small" />
        <button onClick={handleEndChat} style={styles.endChatBtn} aria-label="End chat">
          <PhoneOff size={20} style={{ marginRight: 8 }} />
          End Chat
        </button>
      </header>

      {/* ── Main — vertically centred, no scroll ── */}
      <main style={styles.main}>

        {/* Greeting — only shown before conversation starts */}
        {showGreeting && (
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
        )}

        {/* Clara's message — typewritten, stays until new message */}
        {lastClaraMessage && (
          <div style={styles.claraMessageCard}>
            <p style={styles.cardLabel}>Clara said:</p>
            <p style={styles.claraMessageText}>
              {typedMessage}
              {isTyping && <span style={styles.cursor} aria-hidden="true">|</span>}
            </p>
          </div>
        )}

        {/* You said */}
        {lastUserMessage && (
          <div style={styles.userMessageCard}>
            <p style={styles.cardLabel}>You said:</p>
            <p style={styles.userMessageText}>"{lastUserMessage}"</p>
          </div>
        )}

        {/* Status text */}
        <p style={{ ...styles.statusText, color: getStatusColor() }}>
          {getStatusText()}
        </p>

        {/* Mic button */}
        <div style={styles.micWrapper}>
          {isConnected && !isAgentSpeaking && (
            <>
              <span style={{ ...styles.pulseRing, animationDelay: '0s' }} />
              <span style={{ ...styles.pulseRing, animationDelay: '0.45s' }} />
            </>
          )}
          <button
            onClick={handleMicPress}
            disabled={isAgentSpeaking}
            aria-label={isConnected ? 'Stop conversation' : 'Start conversation with Clara'}
            style={{
              ...styles.micBtn,
              background: isConnected ? (isAgentSpeaking ? '#b0bec5' : '#2e6b9e') : '#4a7c6b',
              cursor: isAgentSpeaking ? 'not-allowed' : 'pointer',
              opacity: isAgentSpeaking ? 0.75 : 1,
            }}
          >
            {isConnected
              ? <MicOff size={48} color="#ffffff" />
              : <Mic size={48} color="#ffffff" />
            }
          </button>
        </div>

        {/* Button label */}
        <p style={styles.micLabel}>
          {!isConnected && 'Tap to start talking'}
          {isConnected && !isAgentSpeaking && 'Tap to stop'}
          {isConnected && isAgentSpeaking && 'Please wait…'}
        </p>

        {/* Live dot */}
        {isConnected && (
          <div style={styles.statusDot}>
            <span style={{ ...styles.dot, background: isAgentSpeaking ? '#4a7c6b' : '#2e6b9e' }} />
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

      <style>{`
        @keyframes elderPulse {
          0%   { transform: scale(1);   opacity: 0.5; }
          70%  { transform: scale(1.9); opacity: 0; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0; }
        }
      `}</style>
    </div>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page: {
    height: '100vh',
    overflow: 'hidden',
    background: '#f5f0eb',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Georgia', 'Times New Roman', serif",
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 28px',
    borderBottom: '1px solid #ddd6cc',
    background: '#ffffff',
    flexShrink: 0,
  },
  endChatBtn: {
    display: 'flex',
    alignItems: 'center',
    background: '#c0392b',
    color: '#ffffff',
    border: 'none',
    borderRadius: 12,
    padding: '12px 22px',
    fontSize: 17,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 3px 8px rgba(192,57,43,0.3)',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px 24px',
    maxWidth: 600,
    margin: '0 auto',
    width: '100%',
    gap: 18,
    overflow: 'hidden',
  },
  greetingCard: {
    background: '#ffffff',
    borderRadius: 20,
    padding: '28px 28px',
    textAlign: 'center',
    boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
    width: '100%',
    animation: 'fadeIn 0.4s ease',
    flexShrink: 0,
  },
  claraAvatar: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: '#4a7c6b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 14px',
    boxShadow: '0 4px 12px rgba(74,124,107,0.35)',
  },
  claraInitial: {
    fontSize: 32,
    color: '#ffffff',
    fontWeight: 700,
    fontFamily: 'Georgia, serif',
  },
  greetingTitle: {
    fontSize: 26,
    fontWeight: 700,
    color: '#1a2e26',
    margin: '0 0 10px',
    lineHeight: 1.2,
  },
  greetingBody: {
    fontSize: 18,
    color: '#4a5568',
    lineHeight: 1.65,
    margin: 0,
  },
  claraMessageCard: {
    background: '#e8f4ef',
    border: '2px solid #4a7c6b',
    borderRadius: 20,
    padding: '22px 26px',
    width: '100%',
    animation: 'fadeIn 0.35s ease',
    boxShadow: '0 2px 12px rgba(74,124,107,0.12)',
    flexShrink: 0,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: '#4a7c6b',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    margin: '0 0 8px',
    fontFamily: "'Helvetica Neue', sans-serif",
  },
  claraMessageText: {
    fontSize: 22,
    color: '#1a2e26',
    lineHeight: 1.6,
    margin: 0,
    fontWeight: 400,
    minHeight: '1.6em',
  },
  cursor: {
    display: 'inline-block',
    marginLeft: 1,
    color: '#4a7c6b',
    fontWeight: 200,
    animation: 'blink 0.75s step-start infinite',
  },
  userMessageCard: {
    background: '#eef2f7',
    border: '2px solid #2e6b9e',
    borderRadius: 20,
    padding: '18px 26px',
    width: '100%',
    animation: 'fadeIn 0.3s ease',
    flexShrink: 0,
  },
  userMessageText: {
    fontSize: 18,
    color: '#2c3e50',
    lineHeight: 1.6,
    margin: 0,
    fontStyle: 'italic',
  },
  statusText: {
    fontSize: 18,
    fontWeight: 600,
    textAlign: 'center' as const,
    margin: 0,
    fontFamily: "'Helvetica Neue', sans-serif",
    transition: 'color 0.3s ease',
    flexShrink: 0,
  },
  micWrapper: {
    position: 'relative',
    width: 148,
    height: 148,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pulseRing: {
    position: 'absolute',
    width: 148,
    height: 148,
    borderRadius: '50%',
    background: 'rgba(46,107,158,0.22)',
    animation: 'elderPulse 1.8s ease-out infinite',
    display: 'block',
  },
  micBtn: {
    position: 'relative',
    zIndex: 2,
    width: 148,
    height: 148,
    borderRadius: '50%',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.3s ease',
    boxShadow: '0 6px 24px rgba(0,0,0,0.2)',
    outline: 'none',
  },
  micLabel: {
    fontSize: 18,
    color: '#4a5568',
    margin: 0,
    fontFamily: "'Helvetica Neue', sans-serif",
    fontWeight: 600,
    textAlign: 'center' as const,
    flexShrink: 0,
  },
  statusDot: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    display: 'inline-block',
    animation: 'elderPulse 2s ease-out infinite',
  },
  dotLabel: {
    fontSize: 16,
    color: '#4a5568',
    fontFamily: "'Helvetica Neue', sans-serif",
  },
  footer: {
    textAlign: 'center' as const,
    padding: '14px 24px 18px',
    borderTop: '1px solid #ddd6cc',
    background: '#ffffff',
    flexShrink: 0,
  },
  footerText: {
    fontSize: 15,
    color: '#718096',
    margin: 0,
    lineHeight: 1.5,
  },
};

export default Conversation;