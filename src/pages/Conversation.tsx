import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClearNestLogo } from '@/components/ClearNestLogo';
import { Mic, PhoneOff, Volume2 } from 'lucide-react';
import { useConversation } from '@11labs/react';
import { useSession } from '@/contexts/SessionContext';

const CONNECTION_TIMEOUT_MS = 8000;

// ─── Typewriter hook ──────────────────────────────────────────────────────────
function useTypewriter(fullText: string, isActive: boolean, charsPerSecond = 30) {
  const [displayed, setDisplayed] = useState('');
  const indexRef    = useRef(0);
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

  useEffect(() => {
    if (!isActive && displayed.length < fullText.length) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setDisplayed(fullText);
    }
  }, [isActive, fullText, displayed.length]);

  return { displayed, isTyping: displayed.length < fullText.length };
}

// ─── Coverage areas ───────────────────────────────────────────────────────────
const COVERAGE_AREAS = [
  { category: 'bank_accounts',      label: 'Bank Accounts' },
  { category: 'financial_accounts', label: 'Pensions & Investments' },
  { category: 'property',           label: 'Property' },
  { category: 'documents',          label: 'Will & Documents' },
  { category: 'key_contacts',       label: 'Key Contacts' },
  { category: 'care_wishes',        label: 'Care Wishes' },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────
const Conversation = () => {
  const navigate = useNavigate();
  const {
    capturedItems,
    lastClaraMessage,
    lastUserMessage,
    setLastClaraMessage,
    setLastUserMessage,
    handleAgentToolCall,
  } = useSession();

  const coveredCategories = useMemo(
    () => new Set(capturedItems.map(i => i.category)),
    [capturedItems]
  );
  const uncoveredAreas = useMemo(
    () => COVERAGE_AREAS.filter(a => !coveredCategories.has(a.category)),
    [coveredCategories]
  );

  const agentId = import.meta.env.VITE_ELEVENLABS_AGENT_ID as string;

  // ── Session state ─────────────────────────────────────────────────────────
  const [isHolding, setIsHolding]             = useState(false);
  const [isMicMuted, setIsMicMuted]           = useState(false);
  const [hasStartedSession, setHasStartedSession] = useState(false);
  const [errorMessage, setErrorMessage]       = useState<string | null>(null);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const hasSpokenBefore         = useRef(false);
  const conversationSummary     = useRef<string>('');
  const interruptBufferRef      = useRef<string[]>([]);
  const isHoldingRef            = useRef(false);
  const audioUnlockedRef        = useRef(false);
  const connectionTimeoutRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stable ref to avoid startSession/endSession deps on conversation object
  const convMethodsRef          = useRef<{ start: typeof conversation.startSession; end: typeof conversation.endSession } | null>(null);

  const [interruptNotice, setInterruptNotice] = useState<string | null>(null);

  useEffect(() => { isHoldingRef.current = isHolding; }, [isHolding]);

  // ── Helpers ───────────────────────────────────────────────────────────────
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
    const content  = get('content')  ?? noteStr;
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

  // ── ElevenLabs — clientTools instead of onToolCall ────────────────────────
  // Fix 1: micMuted via explicit state — SDK's built-in PTT support.
  // `isMicMuted` starts false (no session), is set true in onConnect (mute until hold),
  // false on hold (unmute), true on release (mute again). This avoids the circular ref
  // that would occur if we derived this from conversation.status before conversation exists.
  const conversation = useConversation({
    micMuted: isMicMuted,
    clientTools: {
      capture_note: (params: Record<string, unknown>) => {
        handleAgentToolCall('capture_note', params);
        return 'Note captured';
      },
      flag_action: (params: Record<string, unknown>) => {
        handleAgentToolCall('flag_action', params);
        return 'Action flagged';
      },
    },
    onMessage: (message: { source: string; message: string }) => {
      if (message.source === 'ai') {
        const cleaned = cleanClaraMessage(message.message);
        if (cleaned) {
          setLastClaraMessage(cleaned);
          parseAndCaptureNote(message.message);
          hasSpokenBefore.current = true;
        }
        if (interruptBufferRef.current.length > 0) {
          const buffered = interruptBufferRef.current.join(' … ');
          setLastUserMessage(buffered);
          interruptBufferRef.current = [];
          setInterruptNotice(null);
        }
      } else if (message.source === 'user') {
        const userText = message.message?.trim();
        if (!userText) return;
        if (isHoldingRef.current) {
          setLastUserMessage(userText);
          setInterruptNotice(null);
        } else {
          interruptBufferRef.current.push(userText);
          setInterruptNotice(`We caught: "${userText}" — Clara will take this into account.`);
          handleAgentToolCall('capture_note', {
            category:   'general',
            content:    `Narayan said while Clara was speaking: "${userText}"`,
            confidence: 'needs-follow-up',
            flag:       true,
          });
        }
      }
    },
    onError: (error: string) => {
      console.error('❌ ElevenLabs error:', error);
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      setErrorMessage('Clara couldn\'t connect. Please try again.');
    },
    onConnect: () => {
      console.log('✅ Connected');
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      setHasStartedSession(true);
      setErrorMessage(null);
      setIsMicMuted(true); // mute mic until user holds button
    },
    onDisconnect: () => {
      console.log('🔌 Disconnected');
      setIsHolding(false);
      setIsMicMuted(false);
    },
  });

  // Keep methods ref in sync
  useEffect(() => {
    convMethodsRef.current = { start: conversation.startSession, end: conversation.endSession };
  });

  // Derive state from conversation.status (source of truth)
  const status = conversation.status; // 'connected' | 'connecting' | 'disconnected' | 'disconnecting'
  const isSessionActive = status === 'connected';
  const isStarting = status === 'connecting';
  const isAgentSpeaking = conversation.isSpeaking;

  const { displayed: typedMessage, isTyping } = useTypewriter(
    lastClaraMessage,
    isAgentSpeaking,
    30
  );

  // ── Start session — called exactly once per session ───────────────────────
  const startSession = useCallback(async () => {
    if (status !== 'disconnected') {
      console.log('⚠️ startSession called but status is', status, '— ignoring');
      return;
    }

    setErrorMessage(null);

    // Pre-request mic permission BEFORE any network awaits.
    // The ElevenLabs SDK calls getUserMedia() internally after the WebSocket connects,
    // but by then we're outside the user gesture window on many browsers — causing a
    // permission error that drops the session immediately after connect.
    // Doing it here (first await, closest to the click) keeps us within the gesture window.
    try {
      const permStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      permStream.getTracks().forEach(t => t.stop());
    } catch {
      setErrorMessage('Microphone access is required. Please allow mic access and try again.');
      return;
    }

    // Fix 3: 8-second connection timeout — prevents infinite "connecting" state
    connectionTimeoutRef.current = setTimeout(() => {
      console.warn('⏱ Connection timeout — ending session');
      convMethodsRef.current?.end().catch(() => {});
      setErrorMessage('Clara took too long to connect. Please try again.');
    }, CONNECTION_TIMEOUT_MS);

    try {
      const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY as string;
      const res = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
        { headers: { 'xi-api-key': apiKey } }
      );
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`API error ${res.status}: ${t}`);
      }
      const data = await res.json();
      const signedUrl: string = data.signed_url ?? data.conversation_token ?? data.token;
      if (!signedUrl) throw new Error(`No URL in response: ${JSON.stringify(data)}`);

      const toolInstructions = `You are Clara, a warm and gentle AI assistant for ClearNest, helping families plan ahead for eldercare. You are talking with Narayan.

CRITICAL — you MUST call the capture_note tool IMMEDIATELY whenever Narayan mentions ANYTHING about:
• Which bank(s) he uses, account types, where bank cards/documents are kept → category: "bank_accounts"
• Pension (provider name, whether it exists), investments, ISAs, savings, premium bonds → category: "financial_accounts"
• Property he owns or rents, address, where deeds are kept, mortgage details → category: "property"
• Will (does one exist, where kept, who the solicitor is), Power of Attorney / LPA (is one set up, who is named), insurance policies → category: "documents"
• Named people: GP name, solicitor, accountant, financial adviser, close family/friends with their role → category: "key_contacts"
• Care home preference, medical wishes, end-of-life preferences, funeral wishes → category: "care_wishes"
• Any other important personal information → category: "general"

Call capture_note as soon as the information is mentioned — do NOT wait until the end of the conversation.
Use flag_action for anything urgent (e.g. no will exists, no LPA set up).

Be warm, patient, and go at Narayan's pace. Never rush him.${
  hasSpokenBefore.current
    ? conversationSummary.current
      ? `\n\nYou have already introduced yourself. Do NOT say hello or reintroduce yourself. Continue naturally from where you left off. Notes captured so far: ${conversationSummary.current}. Move on to the next uncovered topic.`
      : `\n\nYou have already introduced yourself. Do NOT say hello or reintroduce yourself. Simply continue the conversation naturally.`
    : ''
}`;

      await convMethodsRef.current!.start({
        signedUrl,
        overrides: { agent: { prompt: { prompt: toolInstructions } } },
      });
    } catch (err) {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      const msg = err instanceof Error ? err.message : 'Could not start session';
      console.error('❌', msg);
      setErrorMessage('Clara couldn\'t connect. Please try again.');
    }
  }, [agentId, status]);

  const endSession = useCallback(async () => {
    setIsHolding(false);
    isHoldingRef.current = false;
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    try { await convMethodsRef.current?.end(); } catch (_) { /* ignore */ }
  }, []);

  // Fix 4: Cleanup on unmount — stop timeouts and end session
  useEffect(() => {
    return () => {
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      convMethodsRef.current?.end().catch(() => {});
    };
  }, []);

  const handleEndChat = useCallback(() => {
    endSession();
    navigate('/');
  }, [endSession, navigate]);

  // ── PTT handlers ──────────────────────────────────────────────────────────
  const handlePressStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();

    // Fix 2: Unlock AudioContext synchronously in the user gesture, before any awaits.
    // Browsers (especially Safari) suspend AudioContext created after async calls.
    // Unlocking here ensures Clara's voice can play when ElevenLabs initialises audio.
    if (!audioUnlockedRef.current) {
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        ctx.resume().then(() => ctx.close());
        audioUnlockedRef.current = true;
      } catch (_) { /* non-critical */ }
    }

    if (!isSessionActive) {
      startSession();
      return;
    }
    isHoldingRef.current = true;
    setIsHolding(true);
    setIsMicMuted(false); // unmute while holding
  }, [isSessionActive, startSession]);

  const handlePressEnd = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isSessionActive) return;
    isHoldingRef.current = false;
    setIsHolding(false);
    setIsMicMuted(true); // mute again after releasing
  }, [isSessionActive]);

  const handleContextMenu = (e: React.MouseEvent) => e.preventDefault();

  // ── UI phase ──────────────────────────────────────────────────────────────
  type Phase = 'idle' | 'connecting' | 'clara_speaking' | 'holding' | 'waiting';
  const getPhase = (): Phase => {
    if (!isSessionActive && !isStarting) return 'idle';
    if (isStarting)      return 'connecting';
    if (isHolding)       return 'holding';
    if (isAgentSpeaking) return 'clara_speaking';
    return 'waiting';
  };
  const phase = getPhase();

  const showGreeting = !hasStartedSession && !isStarting;

  const dotColor =
    phase === 'holding'        ? '#c0392b' :
    phase === 'clara_speaking' ? '#4a7c6b' :
    phase === 'waiting'        ? '#f0a500' :
    phase === 'connecting'     ? '#8a96a0' :
                                  '#4a7c6b';

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

      <main style={styles.main}>

        {isSessionActive && (
          <div style={styles.disclaimerBanner}>
            <span style={styles.disclaimerIcon}>💡</span>
            <span style={styles.disclaimerText}>
              <strong>Hold the button</strong> to speak. Release when you're done. You can hold at any time — even while Clara is talking.
            </span>
          </div>
        )}

        {showGreeting && (
          <div style={styles.greetingCard}>
            <div style={styles.claraAvatar}><span style={styles.claraInitial}>C</span></div>
            <h1 style={styles.greetingTitle}>Hello. I'm Clara.</h1>
            <p style={styles.greetingBody}>
              I'm here for a gentle chat to help your family get organised.
              There are no wrong answers — we go at your pace.
            </p>
          </div>
        )}

        {/* Fix 5: User-facing error with retry — never silently swallow errors */}
        {errorMessage && (
          <div style={styles.errorCard}>
            <p style={styles.errorText}>⚠️ {errorMessage}</p>
            <button
              onClick={() => { setErrorMessage(null); startSession(); }}
              style={styles.retryBtn}
            >
              Try again
            </button>
          </div>
        )}

        {lastClaraMessage && (
          <div style={styles.claraMessageCard}>
            <p style={styles.cardLabel}>Clara said:</p>
            <p style={styles.claraMessageText}>
              {typedMessage}
              {isTyping && <span style={styles.cursor}>|</span>}
            </p>
          </div>
        )}

        {interruptNotice && (
          <div style={styles.interruptCard}>
            <p style={styles.interruptText}>🎙 {interruptNotice}</p>
          </div>
        )}

        {lastUserMessage && !interruptNotice && (
          <div style={styles.userMessageCard}>
            <p style={styles.cardLabel}>You said:</p>
            <p style={styles.userMessageText}>"{lastUserMessage}"</p>
          </div>
        )}

        {(isSessionActive || isStarting) && (
          <div style={styles.statusRow}>
            <span style={{
              ...styles.bigDot,
              background: dotColor,
              boxShadow:
                phase === 'holding' ? '0 0 0 5px rgba(192,57,43,0.22)' :
                phase === 'waiting' ? '0 0 0 5px rgba(240,165,0,0.20)' : 'none',
              animation:
                phase === 'holding'        ? 'dotPop 0.9s ease-in-out infinite' :
                phase === 'clara_speaking' ? 'dotFade 1.4s ease-in-out infinite' :
                phase === 'waiting'        ? 'dotFade 1.8s ease-in-out infinite' : 'none',
            }} />
            <div style={styles.statusTextBlock}>
              <p style={{ ...styles.statusMain, color: dotColor }}>
                {phase === 'connecting'     && 'Connecting to Clara…'}
                {phase === 'clara_speaking' && 'Clara is speaking'}
                {phase === 'waiting'        && 'Hold the button to speak'}
                {phase === 'holding'        && 'Recording — release when done'}
              </p>
              <p style={styles.statusSub}>
                {phase === 'connecting'     && 'Please wait a moment'}
                {phase === 'clara_speaking' && 'Hold the button to interrupt'}
                {phase === 'waiting'        && 'Take your time — no rush'}
                {phase === 'holding'        && 'Clara will hear everything you say'}
              </p>
            </div>
          </div>
        )}

        {/* ── Single mic button — tap to start, hold to talk ── */}
        <div style={styles.micWrapper}>
          {phase === 'holding' && (
            <>
              <span style={{ ...styles.pulseRing, background: 'rgba(192,57,43,0.18)', animationDelay: '0s' }} />
              <span style={{ ...styles.pulseRing, background: 'rgba(192,57,43,0.12)', animationDelay: '0.5s' }} />
            </>
          )}
          <button
            onMouseDown={handlePressStart}
            onMouseUp={handlePressEnd}
            onMouseLeave={handlePressEnd}
            onTouchStart={handlePressStart}
            onTouchEnd={handlePressEnd}
            onTouchCancel={handlePressEnd}
            onContextMenu={handleContextMenu}
            disabled={isStarting}
            aria-label={
              !hasStartedSession   ? 'Start chat with Clara' :
              phase === 'holding'  ? 'Release to stop talking' : 'Hold to speak'
            }
            style={{
              ...styles.micBtn,
              background:
                phase === 'holding'        ? '#c0392b' :
                phase === 'clara_speaking' ? '#4a7c6b' :
                phase === 'waiting'        ? '#f0a500' :
                phase === 'connecting'     ? '#b0bec5' :
                                              '#4a7c6b',
              cursor:    isStarting ? 'not-allowed' : 'pointer',
              transform: phase === 'holding' ? 'scale(1.08)' : 'scale(1)',
              boxShadow:
                phase === 'holding' ? '0 10px 36px rgba(192,57,43,0.40)' :
                phase === 'waiting' ? '0 8px 28px rgba(240,165,0,0.30)' :
                                       '0 6px 20px rgba(0,0,0,0.16)',
              userSelect: 'none',
              WebkitUserSelect: 'none',
            } as React.CSSProperties}
          >
            {phase === 'clara_speaking'
              ? <Volume2 size={48} color="#fff" />
              : <Mic    size={48} color="#fff" />
            }
          </button>
        </div>

        <p style={{ ...styles.micLabel, color: dotColor }}>
          {!hasStartedSession                               && 'Start Chat'}
          {hasStartedSession && phase === 'connecting'     && 'Connecting…'}
          {hasStartedSession && phase === 'clara_speaking' && 'Hold to interrupt'}
          {hasStartedSession && phase === 'waiting'        && 'Hold to speak'}
          {hasStartedSession && phase === 'holding'        && 'Release when done'}
        </p>

      </main>

      {!isSessionActive && (capturedItems.length > 0 || !!lastClaraMessage) && uncoveredAreas.length > 0 && (
        <div style={styles.stillToCoverBanner}>
          <div style={styles.stillToCoverDot} />
          <p style={styles.stillToCoverText}>
            <strong>Still to cover:</strong>{' '}
            {uncoveredAreas.map(a => a.label).join(', ')}.{' '}
            <span style={{ color: '#4a7c6b' }}>Start a new session to cover these topics.</span>
          </p>
        </div>
      )}

      <footer style={styles.footer}>
        <p style={styles.footerText}>
          Hold the button to speak at any time — even while Clara is talking.
        </p>
      </footer>

      <style>{`
        @keyframes elderPulse {
          0%   { transform: scale(1);   opacity: 0.5; }
          70%  { transform: scale(2.0); opacity: 0; }
          100% { transform: scale(2.0); opacity: 0; }
        }
        @keyframes dotPop {
          0%, 100% { transform: scale(1);    opacity: 1; }
          50%      { transform: scale(1.25); opacity: 0.85; }
        }
        @keyframes dotFade {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.35; }
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

const styles: Record<string, React.CSSProperties> = {
  page: {
    height: '100vh',
    overflow: 'hidden',
    background: '#f5f0eb',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Georgia', 'Times New Roman', serif",
    userSelect: 'none',
    WebkitUserSelect: 'none',
  } as React.CSSProperties,
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 28px',
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
    padding: '11px 20px',
    fontSize: 16,
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
    padding: '16px 24px',
    maxWidth: 580,
    margin: '0 auto',
    width: '100%',
    gap: 14,
    overflow: 'hidden',
  },
  disclaimerBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    background: '#fff8e8',
    border: '1.5px solid #e8c96a',
    borderRadius: 12,
    padding: '10px 16px',
    width: '100%',
    flexShrink: 0,
    animation: 'fadeIn 0.3s ease',
  },
  disclaimerIcon: { fontSize: 16, flexShrink: 0, marginTop: 1 },
  disclaimerText: {
    fontSize: 14,
    color: '#7a5c10',
    fontFamily: "'Helvetica Neue', sans-serif",
    lineHeight: 1.5,
    margin: 0,
  },
  greetingCard: {
    background: '#ffffff',
    borderRadius: 20,
    padding: '22px 24px',
    textAlign: 'center',
    boxShadow: '0 2px 16px rgba(0,0,0,0.07)',
    width: '100%',
    animation: 'fadeIn 0.4s ease',
    flexShrink: 0,
  },
  claraAvatar: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: '#4a7c6b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 10px',
    boxShadow: '0 4px 12px rgba(74,124,107,0.35)',
  },
  claraInitial: { fontSize: 28, color: '#ffffff', fontWeight: 700, fontFamily: 'Georgia, serif' },
  greetingTitle: { fontSize: 22, fontWeight: 700, color: '#1a2e26', margin: '0 0 6px' },
  greetingBody:  { fontSize: 16, color: '#4a5568', lineHeight: 1.6, margin: 0 },
  claraMessageCard: {
    background: '#e8f4ef',
    border: '2px solid #4a7c6b',
    borderRadius: 18,
    padding: '18px 22px',
    width: '100%',
    animation: 'fadeIn 0.35s ease',
    boxShadow: '0 2px 12px rgba(74,124,107,0.10)',
    flexShrink: 0,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#4a7c6b',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    margin: '0 0 6px',
    fontFamily: "'Helvetica Neue', sans-serif",
  },
  claraMessageText: {
    fontSize: 20, color: '#1a2e26', lineHeight: 1.6, margin: 0, fontWeight: 400, minHeight: '1.5em',
  },
  cursor: {
    display: 'inline-block', marginLeft: 1, color: '#4a7c6b', fontWeight: 200,
    animation: 'blink 0.75s step-start infinite',
  },
  interruptCard: {
    background: '#fff3f3',
    border: '1.5px solid #e8a0a0',
    borderRadius: 14,
    padding: '10px 16px',
    width: '100%',
    animation: 'fadeIn 0.3s ease',
    flexShrink: 0,
  },
  interruptText: {
    fontSize: 13, color: '#8b2020', fontFamily: "'Helvetica Neue', sans-serif", margin: 0, lineHeight: 1.5,
  },
  userMessageCard: {
    background: '#eef2f7',
    border: '2px solid #2e6b9e',
    borderRadius: 18,
    padding: '14px 22px',
    width: '100%',
    animation: 'fadeIn 0.3s ease',
    flexShrink: 0,
  },
  userMessageText: { fontSize: 17, color: '#2c3e50', lineHeight: 1.6, margin: 0, fontStyle: 'italic' },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    width: '100%',
    padding: '12px 18px',
    background: '#ffffff',
    borderRadius: 16,
    boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
    flexShrink: 0,
  },
  bigDot: {
    width: 22, height: 22, borderRadius: '50%', display: 'block', flexShrink: 0,
    transition: 'background 0.4s ease, box-shadow 0.4s ease',
  },
  statusTextBlock: { display: 'flex', flexDirection: 'column' as const, gap: 2 },
  statusMain: {
    fontSize: 16, fontWeight: 700, fontFamily: "'Helvetica Neue', sans-serif", margin: 0,
    transition: 'color 0.3s ease',
  },
  statusSub: { fontSize: 13, color: '#8a96a0', fontFamily: "'Helvetica Neue', sans-serif", margin: 0 },
  micWrapper: {
    position: 'relative', width: 148, height: 148,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  pulseRing: {
    position: 'absolute', width: 148, height: 148, borderRadius: '50%',
    animation: 'elderPulse 1.6s ease-out infinite', display: 'block', pointerEvents: 'none',
  },
  micBtn: {
    position: 'relative', zIndex: 2, width: 148, height: 148, borderRadius: '50%',
    border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 0.25s ease, transform 0.2s ease, box-shadow 0.25s ease',
    outline: 'none', touchAction: 'none',
  },
  micLabel: {
    fontSize: 16, margin: 0, fontFamily: "'Helvetica Neue', sans-serif", fontWeight: 700,
    textAlign: 'center' as const, flexShrink: 0, transition: 'color 0.3s ease',
  },
  errorCard: {
    background: '#fff3f3',
    border: '1.5px solid #c0392b',
    borderRadius: 14,
    padding: '12px 18px',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    animation: 'fadeIn 0.3s ease',
    flexShrink: 0,
  },
  errorText: {
    fontSize: 14, color: '#8b2020', fontFamily: "'Helvetica Neue', sans-serif",
    margin: 0, lineHeight: 1.5, flex: 1,
  },
  retryBtn: {
    background: '#c0392b', color: '#fff', border: 'none', borderRadius: 8,
    padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
    fontFamily: "'Helvetica Neue', sans-serif", flexShrink: 0,
  },
  stillToCoverBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    background: '#fdf6e3',
    borderTop: '1px solid #e8d98a',
    borderBottom: '1px solid #e8d98a',
    padding: '12px 28px',
    flexShrink: 0,
  },
  stillToCoverDot: {
    width: 8, height: 8, borderRadius: '50%', background: '#c49a00', flexShrink: 0, marginTop: 5,
  },
  stillToCoverText: {
    fontSize: 15, color: '#5c4200', margin: 0, lineHeight: 1.55,
    fontFamily: "'Helvetica Neue', sans-serif",
  },
  footer: {
    textAlign: 'center' as const, padding: '12px 24px 16px',
    borderTop: '1px solid #ddd6cc', background: '#ffffff', flexShrink: 0,
  },
  footerText: { fontSize: 14, color: '#718096', margin: 0, lineHeight: 1.5 },
};

export default Conversation;
