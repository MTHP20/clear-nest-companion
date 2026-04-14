import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClearNestLogo } from '@/components/ClearNestLogo';
import { useConversation } from '@elevenlabs/react';
import { useSession } from '@/contexts/SessionContext';

// ─── Typewriter hook ──────────────────────────────────────────────────────────
function useTypewriter(fullText: string, isActive: boolean, charsPerSecond = 18) {
  const [displayed, setDisplayed] = useState('');
  const indexRef    = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setDisplayed('');
    indexRef.current = 0;
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!fullText) return;
    // Skip animation if user prefers reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayed(fullText);
      indexRef.current = fullText.length;
      return;
    }
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

// ─── Topic selection ─────────────────────────────────────────────────────────
type TopicOption = 'all' | 'bank_accounts' | 'financial_accounts' | 'documents' | 'property' | 'care_wishes' | 'key_contacts' | 'chat';

const TOPIC_CARDS: Array<{
  id: TopicOption;
  label: string;
  icon: string;
  description: string;
  category?: string; // links to COVERAGE_AREAS category for completion check
}> = [
  { id: 'all',                label: 'All topics',         icon: '📋', description: 'Cover everything step by step' },
  { id: 'bank_accounts',      label: 'Bank accounts',      icon: '🏦', description: 'Banks, cards, savings', category: 'bank_accounts' },
  { id: 'financial_accounts', label: 'Financial',          icon: '📈', description: 'Pensions, ISAs, investments', category: 'financial_accounts' },
  { id: 'documents',          label: 'Will & documents',   icon: '📄', description: 'Will, LPA, insurance', category: 'documents' },
  { id: 'property',           label: 'Property',           icon: '🏠', description: 'Home, deeds, mortgage', category: 'property' },
  { id: 'care_wishes',        label: 'Care wishes',        icon: '❤️', description: 'Care & end-of-life preferences', category: 'care_wishes' },
  { id: 'key_contacts',       label: 'Key contacts',       icon: '👥', description: 'GP, solicitor, accountant', category: 'key_contacts' },
  { id: 'chat',               label: 'Just a chat',        icon: '☕', description: 'No agenda — friendly catch-up' },
];

// ─── Brand colours ────────────────────────────────────────────────────────────
const BRAND = {
  red:       '#E53935',
  blue:      '#9B7BC8',
  amber:     '#F4C842',
  blueMuted: '#C9B8E0',
};

// ─── Theme (mirrors Landing.tsx — reads same localStorage key) ────────────────
const CONV_THEME_KEY = 'cn-theme-v1';
const CONV_THEMES = {
  default: {
    pageBg:          '#e1f1fd',
    textColor:       '#1e2d4f',
    blobs:           ['rgba(70,99,172,0.14)', 'rgba(70,99,172,0.08)', 'rgba(70,99,172,0.07)'] as [string, string, string],
    cardBg:          'rgba(255,255,255,0.28)',
    cardBorder:      'rgba(255,255,255,0.58)',
    cardShadow:      '0 14px 44px rgba(70,99,172,0.12),0 2px 8px rgba(70,99,172,0.06),inset 0 1.5px 0 rgba(255,255,255,0.72)',
    cardHoverShadow: '0 24px 64px rgba(70,99,172,0.20),inset 0 1.5px 0 rgba(255,255,255,0.78)',
    cardTextPrimary: 'rgba(30,45,79,0.92)',
    cardTextSecondary:'rgba(46,62,107,0.52)',
    endChatBg:       'rgba(255,255,255,0.82)',
    endChatBorder:   'rgba(255,255,255,0.60)',
    endChatShadow:   '0 4px 16px rgba(70,99,172,0.15)',
  },
  orange: {
    pageBg:          '#fdf0e8',
    textColor:       '#5c2229',
    blobs:           ['rgba(199,98,91,0.15)', 'rgba(240,143,92,0.10)', 'rgba(199,98,91,0.08)'] as [string, string, string],
    cardBg:          'rgba(255,255,255,0.30)',
    cardBorder:      'rgba(255,255,255,0.62)',
    cardShadow:      '0 14px 44px rgba(156,55,66,0.12),0 2px 8px rgba(156,55,66,0.06),inset 0 1.5px 0 rgba(255,255,255,0.74)',
    cardHoverShadow: '0 24px 64px rgba(156,55,66,0.20),inset 0 1.5px 0 rgba(255,255,255,0.80)',
    cardTextPrimary: 'rgba(92,34,41,0.90)',
    cardTextSecondary:'rgba(92,34,41,0.50)',
    endChatBg:       'rgba(255,255,255,0.82)',
    endChatBorder:   'rgba(255,255,255,0.60)',
    endChatShadow:   '0 4px 16px rgba(156,55,66,0.15)',
  },
  dark: {
    pageBg:          '#0d0f1a',
    textColor:       '#a78bfa',
    blobs:           ['rgba(167,139,250,0.18)', 'rgba(94,207,207,0.09)', 'rgba(167,139,250,0.10)'] as [string, string, string],
    cardBg:          'rgba(255,255,255,0.055)',
    cardBorder:      'rgba(255,255,255,0.11)',
    cardShadow:      '0 14px 44px rgba(0,0,0,0.42),0 2px 8px rgba(0,0,0,0.22),inset 0 1.5px 0 rgba(255,255,255,0.07)',
    cardHoverShadow: '0 24px 64px rgba(0,0,0,0.58),inset 0 1.5px 0 rgba(255,255,255,0.10)',
    cardTextPrimary: 'rgba(240,234,255,0.95)',
    cardTextSecondary:'rgba(200,185,240,0.50)',
    endChatBg:       'rgba(255,255,255,0.08)',
    endChatBorder:   'rgba(255,255,255,0.12)',
    endChatShadow:   '0 4px 16px rgba(0,0,0,0.40)',
  },
} as const;
type ConvTheme = keyof typeof CONV_THEMES;
function loadConvTheme(): ConvTheme {
  try {
    const t = localStorage.getItem(CONV_THEME_KEY);
    if (t === 'default' || t === 'orange' || t === 'dark') return t;
  } catch { /* ignore */ }
  return 'default';
}

// ─── Clara Sphere — exact copy of Landing.tsx ClaraSphere ────────────────────
function ClaraSphere({ size = 160 }: { size?: number }) {
  const inset = Math.round(size * 0.09);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: 'conic-gradient(from 0deg,rgba(155,123,200,0) 0%,rgba(155,123,200,0.7) 25%,rgba(200,170,255,0.5) 50%,rgba(100,60,180,0.6) 75%,rgba(155,123,200,0) 100%)',
        animation: 'cnSphereRot 12s linear infinite', filter: 'blur(6px)',
      }} />
      <div style={{
        position: 'absolute', inset, borderRadius: '50%',
        background: 'conic-gradient(from 120deg,rgba(180,150,230,0) 0%,rgba(220,200,255,0.6) 30%,rgba(80,40,160,0.5) 60%,rgba(180,150,230,0) 100%)',
        animation: 'cnSphereRot2 8s linear infinite', filter: 'blur(7px)',
      }} />
      <div style={{
        position: 'absolute',
        width: Math.round(size * 0.6), height: Math.round(size * 0.38),
        borderRadius: '50%',
        background: 'radial-gradient(ellipse,rgba(196,168,232,0.88) 0%,rgba(155,123,200,0.4) 50%,transparent 70%)',
        top: Math.round(size * 0.12), left: Math.round(size * 0.09),
        animation: 'cnSphereSmoke1 6.5s ease-in-out infinite', filter: 'blur(8px)',
      }} />
      <div style={{
        position: 'absolute',
        top: Math.round(size * 0.13), left: Math.round(size * 0.18),
        width: '38%', height: '28%', borderRadius: '50%',
        background: 'radial-gradient(ellipse,rgba(255,255,255,0.65) 0%,transparent 70%)', zIndex: 9,
      }} />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
const Conversation = () => {
  const navigate = useNavigate();
  const {
    capturedItems,
    parentName,
    childName,
    familyId,
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
  const [selectedTopic, setSelectedTopic]       = useState<TopicOption | null>('all');
  const [isHolding, setIsHolding]               = useState(false);
  const [isMicMuted, setIsMicMuted]             = useState(false);
  const [hasStartedSession, setHasStartedSession] = useState(false);
  const [errorMessage, setErrorMessage]         = useState<string | null>(null);
  const [showDisclaimer, setShowDisclaimer]     = useState(false);
  const [showGoodbye, setShowGoodbye]           = useState(false);
  const [micPressed, setMicPressed]             = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const interruptBufferRef   = useRef<string[]>([]);
  const isHoldingRef         = useRef(false);
  const audioUnlockedRef     = useRef(false);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstHoldDoneRef     = useRef(false);

  const [interruptNotice, setInterruptNotice] = useState<string | null>(null);

  useEffect(() => { isHoldingRef.current = isHolding; }, [isHolding]);

  // Dismiss disclaimer after user completes their first hold-and-release
  useEffect(() => {
    if (isHolding) {
      firstHoldDoneRef.current = true;
    } else if (firstHoldDoneRef.current && showDisclaimer) {
      setShowDisclaimer(false);
    }
  }, [isHolding, showDisclaimer]);

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
    handleAgentToolCall('capture_note', {
      category,
      content,
      confidence: get('confidence') ?? 'clear',
      flag: get('flag') === 'true',
    });
  };

  // ── Stable callback refs ──────────────────────────────────────────────────
  const stableRefs = useRef({
    setLastClaraMessage,
    setLastUserMessage,
    setInterruptNotice,
    setHasStartedSession,
    setErrorMessage,
    setShowDisclaimer,
    setIsHolding,
    setIsMicMuted,
    handleAgentToolCall,
    cleanClaraMessage,
    parseAndCaptureNote,
    connectionTimeoutRef,
    interruptBufferRef,
    isHoldingRef,
  });
  stableRefs.current.setLastClaraMessage  = setLastClaraMessage;
  stableRefs.current.setLastUserMessage   = setLastUserMessage;
  stableRefs.current.setInterruptNotice   = setInterruptNotice;
  stableRefs.current.setHasStartedSession = setHasStartedSession;
  stableRefs.current.setErrorMessage      = setErrorMessage;
  stableRefs.current.setShowDisclaimer    = setShowDisclaimer;
  stableRefs.current.setIsHolding         = setIsHolding;
  stableRefs.current.setIsMicMuted        = setIsMicMuted;
  stableRefs.current.handleAgentToolCall  = handleAgentToolCall;
  stableRefs.current.cleanClaraMessage    = cleanClaraMessage;
  stableRefs.current.parseAndCaptureNote  = parseAndCaptureNote;

  // ── Stable callbacks for useConversation ──────────────────────────────────
  const stableOnMessage = useCallback((message: { source: string; message: string }) => {
    const r = stableRefs.current;
    if (message.source === 'ai') {
      const cleaned = r.cleanClaraMessage(message.message);
      if (cleaned) {
        r.setLastClaraMessage(cleaned);
        r.parseAndCaptureNote(message.message);
      }
      if (r.interruptBufferRef.current.length > 0) {
        const buffered = r.interruptBufferRef.current.join(' … ');
        r.setLastUserMessage(buffered);
        r.interruptBufferRef.current = [];
        r.setInterruptNotice(null);
      }
    } else if (message.source === 'user') {
      const userText = message.message?.trim();
      if (!userText) return;
      if (r.isHoldingRef.current) {
        r.setLastUserMessage(userText);
        r.setInterruptNotice(null);
      } else {
        r.interruptBufferRef.current.push(userText);
        r.setInterruptNotice(`We caught: "${userText}" — Clara will take this into account.`);
        r.handleAgentToolCall('capture_note', {
          category:   'general',
          content:    `User said while Clara was speaking: "${userText}"`,
          confidence: 'needs-follow-up',
          flag:       true,
        });
      }
    }
  }, []);

  const stableOnError = useCallback((error: string) => {
    console.error('❌ ElevenLabs error:', error);
    const r = stableRefs.current;
    if (r.connectionTimeoutRef.current) {
      clearTimeout(r.connectionTimeoutRef.current);
      r.connectionTimeoutRef.current = null;
    }
    r.setErrorMessage("Clara couldn't connect. Please try again.");
  }, []);

  const stableOnConnect = useCallback(() => {
    console.log('✅ Connected');
    const r = stableRefs.current;
    if (r.connectionTimeoutRef.current) {
      clearTimeout(r.connectionTimeoutRef.current);
      r.connectionTimeoutRef.current = null;
    }
    r.setHasStartedSession(true);
    r.setErrorMessage(null);
    r.setIsMicMuted(true);
    r.setShowDisclaimer(true); // show once, auto-hides after 6s
  }, []);

  const stableOnDisconnect = useCallback((details?: { reason?: string; message?: string }) => {
    console.log('🔌 Disconnected', details);
    const r = stableRefs.current;
    r.setIsHolding(false);
    r.setIsMicMuted(false);
    if (details?.reason === 'error') {
      r.setErrorMessage(`Clara disconnected: ${details.message || 'Connection error. Please try again.'}`);
    }
  }, []);

  const stableClientTools = useRef({
    capture_note: (params: Record<string, unknown>) => {
      stableRefs.current.handleAgentToolCall('capture_note', params);
      return 'Note captured';
    },
    flag_action: (params: Record<string, unknown>) => {
      stableRefs.current.handleAgentToolCall('flag_action', params);
      return 'Action flagged';
    },
  });

  const conversation = useConversation({
    micMuted: isMicMuted,
    clientTools: stableClientTools.current,
    onMessage: stableOnMessage,
    onError: stableOnError,
    onConnect: stableOnConnect,
    onDisconnect: stableOnDisconnect,
  });

  const convMethodsRef = useRef<{ start: typeof conversation.startSession; end: typeof conversation.endSession } | null>(null);
  useEffect(() => {
    convMethodsRef.current = { start: conversation.startSession, end: conversation.endSession };
  });

  const status          = conversation.status;
  const isSessionActive = status === 'connected';
  const isStarting      = status === 'connecting';
  const isAgentSpeaking = conversation.isSpeaking;

  const { displayed: typedMessage, isTyping } = useTypewriter(lastClaraMessage, isAgentSpeaking, 30);

  // ── Build context summary for Clara from captured items ──────────────────
  const buildContextSummary = useCallback((topic: TopicOption): string => {
    const CATEGORY_LABELS: Record<string, string> = {
      bank_accounts:      'Bank accounts',
      financial_accounts: 'Pensions & investments',
      property:           'Property',
      documents:          'Documents & will',
      key_contacts:       'Key contacts',
      care_wishes:        'Care wishes',
      general:            'General notes',
    };

    const ALL_CATS = ['bank_accounts', 'financial_accounts', 'property', 'documents', 'key_contacts', 'care_wishes'];
    const coveredCats = new Set(capturedItems.map(i => i.category));

    // Build base context from previous sessions (capped to avoid huge prompts)
    let baseContext = '';
    if (capturedItems.length > 0) {
      const linesByCat: Record<string, string[]> = {};
      for (const item of capturedItems.slice(0, 30)) {
        if (!linesByCat[item.category]) linesByCat[item.category] = [];
        if (linesByCat[item.category].length < 3) {
          linesByCat[item.category].push(item.content.trim());
        }
      }
      const knownLines = Object.entries(linesByCat)
        .map(([cat, lines]) => `- [${CATEGORY_LABELS[cat] ?? cat}]: ${lines.join('; ')}`)
        .join('\n');
      baseContext = `From previous sessions with ${parentName} (reviewed by ${childName}):\n${knownLines}\n\n`;
    }

    // Topic-specific focus injection
    if (topic === 'chat') {
      return `${baseContext}⚠️ SESSION MODE OVERRIDE — FRIENDLY CHAT ONLY: This is NOT an information-gathering session. Do NOT ask about finances, property, documents, or any coverage areas. Have a warm, friendly conversation — ask about ${parentName}'s day, how they're feeling, what they've been enjoying or remembering lately. Be fully present and caring. Only call capture_note if ${parentName} volunteers genuinely important practical information completely unprompted. Do NOT follow the "COVER THESE AREAS" instruction this session.`;
    }

    if (topic === 'all') {
      const notCovered = ALL_CATS.filter(c => !coveredCats.has(c));
      const uncoveredStr = notCovered.length > 0
        ? `Topics NOT yet covered: ${notCovered.map(c => CATEGORY_LABELS[c]).join(', ')}.`
        : `All main topics have been covered — do a gentle check to confirm nothing has changed.`;
      return `${baseContext}${uncoveredStr}\nFocus this session on what's missing. Acknowledge what ${parentName} has already shared — do not ask again.`;
    }

    // Single-topic deep dive
    const TOPIC_DEEP: Record<string, string> = {
      bank_accounts:      `bank accounts (which banks ${parentName} uses, account types, where bank cards and statements are kept)`,
      financial_accounts: `financial accounts (pensions — who with, ISAs, investments, savings accounts, premium bonds)`,
      documents:          `documents (does a will exist and where is it kept; is a Lasting Power of Attorney set up and who is named; insurance policies)`,
      property:           `property (does ${parentName} own or rent their home, the address, where the deeds are kept, whether there is a mortgage)`,
      care_wishes:        `care wishes (where ${parentName} would prefer to be cared for if needed, end-of-life preferences, funeral wishes)`,
      key_contacts:       `key contacts (named GP, solicitor, accountant, financial adviser — names and any contact details known)`,
    };
    const topicFocus = TOPIC_DEEP[topic] ?? topic;
    return `${baseContext}⚠️ TOPIC FOCUS OVERRIDE: For this session, talk ONLY about ${topicFocus}. Do NOT ask about any other areas today. Explore this topic in depth with thoughtful follow-up questions. Once you have gathered thorough information, end the session warmly. Ignore the ordered list in your instructions — this single topic is all that matters today.`;
  }, [capturedItems, parentName, childName]);

  const startSession = useCallback(async () => {
    if (status !== 'disconnected') return;
    setErrorMessage(null);
    const topic = selectedTopic ?? 'all';
    const context = buildContextSummary(topic);
    try {
      await convMethodsRef.current!.start({
        agentId,
        connectionType: 'websocket',
        dynamicVariables: {
          context,
          elderly_name: parentName,
          trusted_contact_name: childName,
          family_id: familyId,
        },
      });
    } catch (err) {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      const msg = err instanceof Error ? err.message : 'Could not start session';
      console.error('❌', msg);
      setErrorMessage("Clara couldn't connect. Please try again.");
    }
  }, [agentId, status, buildContextSummary, parentName, childName, familyId]);

  const endSession = useCallback(async () => {
    setIsHolding(false);
    isHoldingRef.current = false;
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    try { await convMethodsRef.current?.end(); } catch (_) { /* ignore */ }
  }, []);

  useEffect(() => {
    return () => {
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      convMethodsRef.current?.end().catch(() => {});
    };
  }, []);

  // Goodbye: warm message for 1.8s before navigating away
  const handleEndChat = useCallback(() => {
    endSession();
    if (hasStartedSession) {
      setShowGoodbye(true);
      setTimeout(() => navigate('/'), 1800);
    } else {
      navigate('/');
    }
  }, [endSession, navigate, hasStartedSession]);

  // ── PTT handlers ──────────────────────────────────────────────────────────
  const handlePressStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!audioUnlockedRef.current) {
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        ctx.resume().then(() => ctx.close());
        audioUnlockedRef.current = true;
      } catch (_) { /* non-critical */ }
    }
    setMicPressed(true);
    if (!isSessionActive) {
      startSession();
      return;
    }
    isHoldingRef.current = true;
    setIsHolding(true);
    setIsMicMuted(false);
  }, [isSessionActive, startSession]);

  const handlePressEnd = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setMicPressed(false);
    if (!isSessionActive) return;
    isHoldingRef.current = false;
    setIsHolding(false);
    setIsMicMuted(true);
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

  // Waiting phase uses calm blue — no amber urgency
  const dotColor =
    phase === 'holding'        ? BRAND.red :
    phase === 'clara_speaking' ? BRAND.blue :
    phase === 'waiting'        ? BRAND.blue :
    phase === 'connecting'     ? BRAND.blueMuted :
                                  BRAND.blue;

  // Tactile press: compress on mousedown, hold scale when holding
  const micScale =
    micPressed && !isHolding ? 0.94 :
    isHolding                ? 1.08 :
                               1.0;

  // ── Theme ─────────────────────────────────────────────────────────────────
  const th = CONV_THEMES[loadConvTheme()];

  // ── Display text for left column ─────────────────────────────────────────
  const getDisplayText = (): string => {
    if (phase === 'connecting') return 'Connecting\nto Clara…';
    if (phase === 'holding')    return 'Listening…';
    if (typedMessage) {
      // Show up to the first sentence boundary; fall back to full typed text
      const match = typedMessage.match(/^[^.!?]*[.!?]/);
      return match ? match[0] : typedMessage;
    }
    if (hasStartedSession) return 'Hold to\nspeak.';
    return 'Hold Clara\nto begin.';
  };
  const displayText = getDisplayText();

  // ── Goodbye screen ────────────────────────────────────────────────────────
  if (showGoodbye) {
    return (
      <div style={{ minHeight: '100dvh', background: th.pageBg, display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: "'Figtree', system-ui, sans-serif" }}>
        <div style={{ textAlign: 'center', animation: 'goodbyeFade 0.5s ease both' }}>
          <p style={{ fontSize: 'clamp(48px, 8vw, 96px)', fontWeight: 900, color: th.textColor, lineHeight: 1.1, letterSpacing: '-2px', margin: 0 }}>
            Thank you.{'\n'}See you soon.
          </p>
        </div>
        <style>{`
          @keyframes goodbyeFade {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: th.pageBg,
      position: 'relative',
      overflow: 'hidden',
      fontFamily: "'Figtree', system-ui, sans-serif",
      userSelect: 'none',
      WebkitUserSelect: 'none',
    } as React.CSSProperties}>

      <style>{`
        @keyframes cnSphereRot {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes cnSphereRot2 {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }
        @keyframes cnSphereSmoke1 {
          0%, 100% { opacity: 0.7; transform: scale(1) rotate(-5deg); }
          50%      { opacity: 1;   transform: scale(1.08) rotate(5deg); }
        }
        @keyframes cnSphereGlow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50%      { opacity: 1;   transform: scale(1.08); }
        }
        @keyframes cnLandingFadeDown {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes goodbyeFade {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
        }
      `}</style>

      {/* Background blobs */}
      <div style={{ position: 'fixed', borderRadius: '50%', filter: 'blur(130px)', pointerEvents: 'none', zIndex: 0, width: 700, height: 700, background: th.blobs[0], top: -200, right: '15%' }} />
      <div style={{ position: 'fixed', borderRadius: '50%', filter: 'blur(130px)', pointerEvents: 'none', zIndex: 0, width: 500, height: 500, background: th.blobs[1], bottom: -100, right: '48%' }} />
      <div style={{ position: 'fixed', borderRadius: '50%', filter: 'blur(130px)', pointerEvents: 'none', zIndex: 0, width: 380, height: 380, background: th.blobs[2], top: '30%', left: 20 }} />

      {/* Logo — top centre */}
      <div style={{
        position: 'absolute', top: 28, left: 0, right: 0, zIndex: 2,
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        animation: 'cnLandingFadeDown 0.5s cubic-bezier(0.22,1,0.36,1) both',
        pointerEvents: 'none',
      }}>
        <div style={{ transform: 'scale(0.8)', transformOrigin: 'center' }}>
          <ClearNestLogo />
        </div>
      </div>

      {/* Main scene — mirrors Landing.tsx layout */}
      <div style={{
        position: 'relative', zIndex: 1,
        minHeight: '100dvh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(80px, 8vw, 120px) clamp(32px, 7vw, 140px) clamp(48px, 4vw, 80px)',
        gap: 'clamp(24px, 3vw, 48px)',
        flexWrap: 'wrap',
      }}>

        {/* Left: Clara's dialogue in big greeting-style text */}
        <div
          aria-live="polite"
          aria-atomic="true"
          style={{
            fontSize: 'clamp(56px, 9vw, 128px)',
            fontWeight: 900,
            lineHeight: 1.0,
            color: th.textColor,
            flex: '1 1 0',
            minWidth: 0,
            letterSpacing: '-3px',
            whiteSpace: 'pre-line',
            wordBreak: 'break-word',
            transition: 'color 0.3s ease',
          }}
        >
          {displayText}
        </div>

        {/* Right: same column structure as Landing so sphere stays at identical Y position */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 20,
          flex: '1 1 0',
          minWidth: 'min(100%, 360px)',
          maxWidth: 520,
        }}>

          {/* Clara "card" — same dimensions as Landing card, chrome transparent */}
          <div
            onMouseDown={handlePressStart}
            onMouseUp={handlePressEnd}
            onMouseLeave={handlePressEnd}
            onTouchStart={handlePressStart}
            onTouchEnd={handlePressEnd}
            onTouchCancel={handlePressEnd}
            onContextMenu={handleContextMenu}
            role="button"
            tabIndex={0}
            aria-label={
              !hasStartedSession  ? 'Start chat with Clara' :
              phase === 'holding' ? 'Release to stop talking' : 'Hold to speak'
            }
            style={{
              position: 'relative',
              background: 'transparent',
              border: '1px solid transparent',
              borderRadius: 32,
              padding: '48px 28px 44px',
              overflow: 'visible',
              cursor: isStarting ? 'not-allowed' : 'pointer',
              minHeight: 580,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              textAlign: 'center',
              userSelect: 'none',
              WebkitUserSelect: 'none',
            } as React.CSSProperties}
          >
            {/* Sphere — scales up smoothly when Clara is active */}
            <div style={{
              transform: `scale(${
                micPressed && !isHolding      ? 0.94 :
                phase === 'clara_speaking'    ? 1.38 :
                phase === 'holding'           ? 1.25 :
                phase === 'connecting'        ? 1.10 :
                isSessionActive               ? 1.10 :
                                                1.0
              })`,
              transition: micPressed
                ? 'transform 80ms ease'
                : 'transform 0.7s cubic-bezier(0.22,1,0.36,1)',
              transformOrigin: 'center',
            }}>
              <ClaraSphere size={160} />
            </div>

            {/* Label — sits at same offset as the Landing card title */}
            <div style={{
              fontSize: 15, fontWeight: 500,
              color: th.textColor, opacity: 0.45,
              marginTop: 20, position: 'relative', zIndex: 1,
            }}>
              {!hasStartedSession                               && 'Hold to start'}
              {hasStartedSession && phase === 'connecting'     && 'Connecting…'}
              {hasStartedSession && phase === 'clara_speaking' && 'Hold to interrupt'}
              {hasStartedSession && phase === 'waiting'        && 'Hold to speak'}
              {hasStartedSession && phase === 'holding'        && 'Release when done'}
            </div>
          </div>

          {/* Phantom dashboard card — invisible, preserves column height so sphere Y matches Landing */}
          <div style={{
            borderRadius: 28, padding: '26px 32px',
            display: 'flex', alignItems: 'center', gap: 20,
            visibility: 'hidden', pointerEvents: 'none', flexShrink: 0,
          }}>
            <div style={{ width: 34, height: 34 }} />
            <span style={{ fontSize: 22, fontWeight: 900 }}>DASHBOARD</span>
          </div>
        </div>
      </div>

      {/* Error toast */}
      {errorMessage && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          background: '#fff', borderRadius: 14, padding: '12px 20px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)', zIndex: 10,
          animation: 'fadeUp 0.3s ease', display: 'flex', gap: 12, alignItems: 'center',
          whiteSpace: 'nowrap',
        }}>
          <p style={{ color: '#dc2626', margin: 0, fontSize: 15 }}>⚠️ {errorMessage}</p>
          <button
            onClick={() => { setErrorMessage(null); startSession(); }}
            style={{ background: BRAND.blue, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
          >
            Try again
          </button>
        </div>
      )}

      {/* Floating End Chat pill */}
      {hasStartedSession && (
        <button
          onClick={handleEndChat}
          style={{
            position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
            background: th.endChatBg, backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: `1px solid ${th.endChatBorder}`,
            color: th.textColor, borderRadius: 100, padding: '10px 28px',
            fontSize: 15, fontWeight: 600, cursor: 'pointer', zIndex: 10,
            boxShadow: th.endChatShadow,
            letterSpacing: '-0.2px',
          } as React.CSSProperties}
          aria-label="End chat"
        >
          End Chat
        </button>
      )}
    </div>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const DM_SANS  = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const PLAYFAIR = "Georgia, 'Times New Roman', serif";

const styles: Record<string, React.CSSProperties> = {
  page: {
    height: '100vh',
    overflow: 'hidden',
    background: '#FDFAF5',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: DM_SANS,
    userSelect: 'none',
    WebkitUserSelect: 'none',
  } as React.CSSProperties,

  // Minimal header — logo trust mark only, no nav feel
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: '12px 24px',
    background: '#FDFAF5',
    flexShrink: 0,
  },

  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px 24px',
    maxWidth: 560,
    margin: '0 auto',
    width: '100%',
    gap: 16,
    overflowY: 'auto' as const,
  },

  // Disclaimer — shown once, fades up, auto-hides
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
    animation: 'fadeUp 0.4s ease',
  },
  disclaimerIcon: { fontSize: 18, flexShrink: 0, marginTop: 1 },
  disclaimerText: {
    fontSize: 18,
    color: '#7a5c10',
    fontFamily: DM_SANS,
    lineHeight: 1.5,
    margin: 0,
  },

  greetingCard: {
    background: '#ffffff',
    borderRadius: 20,
    padding: '28px 24px',
    textAlign: 'center',
    boxShadow: '0 2px 16px rgba(0,0,0,0.07)',
    width: '100%',
    animation: 'fadeUp 0.4s ease',
    flexShrink: 0,
  },

  // Greeting avatar — 112px, warm and large
  claraAvatar: {
    width: 112,
    height: 112,
    borderRadius: '50%',
    background: BRAND.blue,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
    boxShadow: '0 4px 16px rgba(155,123,200,0.35)',
  },
  claraInitial: { fontSize: 44, color: '#ffffff', fontWeight: 700, fontFamily: PLAYFAIR },

  // Active session avatar — smaller, blooms when Clara speaks
  claraAvatarActive: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    background: BRAND.blue,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'box-shadow 0.3s ease',
  },
  claraInitialSmall: { fontSize: 28, color: '#ffffff', fontWeight: 700, fontFamily: PLAYFAIR },

  greetingTitle: { fontSize: 24, fontWeight: 700, color: '#3D1F8A', margin: '0 0 8px', fontFamily: PLAYFAIR },
  greetingBody:  { fontSize: 18, color: '#6B7280', lineHeight: 1.65, margin: 0, fontFamily: DM_SANS },

  claraMessageCard: {
    background: '#F3EEFF',
    borderRadius: 18,
    padding: '20px 24px',
    width: '100%',
    animation: 'fadeUp 0.4s ease',
    boxShadow: '0 2px 12px rgba(155,123,200,0.12)',
    flexShrink: 0,
  },

  // cardLabel — whisper treatment, 12px
  cardLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: BRAND.blue,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    margin: '0 0 8px',
    fontFamily: DM_SANS,
  },
  claraMessageText: {
    fontSize: 22, color: '#1A1A2E', lineHeight: 1.65, margin: 0, fontWeight: 400, minHeight: '1.5em',
    fontFamily: DM_SANS,
  },
  cursor: {
    display: 'inline-block', marginLeft: 1, color: BRAND.blue, fontWeight: 200,
    animation: 'blink 0.75s step-start infinite',
  },

  interruptCard: {
    background: '#fff3f3',
    border: '1.5px solid #FFCDD2',
    borderRadius: 14,
    padding: '10px 16px',
    width: '100%',
    animation: 'fadeUp 0.3s ease',
    flexShrink: 0,
  },
  interruptText: {
    fontSize: 18, color: '#B71C1C', fontFamily: DM_SANS, margin: 0, lineHeight: 1.5,
  },

  userMessageCard: {
    background: '#EBF2F8',
    borderRadius: 18,
    padding: '16px 24px',
    width: '100%',
    animation: 'fadeUp 0.3s ease',
    boxShadow: '0 2px 8px rgba(91,141,184,0.10)',
    flexShrink: 0,
  },
  userMessageText: { fontSize: 18, color: '#1A1A2E', lineHeight: 1.6, margin: 0, fontStyle: 'italic', fontFamily: DM_SANS },

  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    width: '100%',
    padding: '12px 18px',
    background: '#ffffff',
    borderRadius: 16,
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    flexShrink: 0,
  },
  bigDot: {
    width: 16, height: 16, borderRadius: '50%', display: 'block', flexShrink: 0,
    transition: 'background 0.4s ease',
  },
  statusTextBlock: { display: 'flex', flexDirection: 'column' as const, gap: 2 },
  statusMain: {
    fontSize: 18, fontWeight: 700, fontFamily: DM_SANS, margin: 0,
    transition: 'color 0.3s ease',
  },
  statusSub: { fontSize: 16, color: '#6B7280', fontFamily: DM_SANS, margin: 0 },

  // Mic button — 192px for large accessible target
  micWrapper: {
    position: 'relative', width: 192, height: 192,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  pulseRing: {
    position: 'absolute', width: 192, height: 192, borderRadius: '50%',
    animation: 'elderPulse 1.6s ease-out infinite', display: 'block', pointerEvents: 'none',
  },
  micBtn: {
    position: 'relative', zIndex: 2, width: 192, height: 192, borderRadius: '50%',
    border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
    outline: 'none', touchAction: 'none',
  },
  micLabel: {
    fontSize: 18, margin: 0, fontFamily: DM_SANS, fontWeight: 700,
    textAlign: 'center' as const, flexShrink: 0, transition: 'color 0.3s ease',
  },

  errorCard: {
    background: '#fff3f3',
    border: '1.5px solid #E53935',
    borderRadius: 14,
    padding: '12px 18px',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    animation: 'fadeUp 0.3s ease',
    flexShrink: 0,
  },
  errorText: {
    fontSize: 18, color: '#B71C1C', fontFamily: DM_SANS,
    margin: 0, lineHeight: 1.5, flex: 1,
  },
  retryBtn: {
    background: '#E53935', color: '#fff', border: 'none', borderRadius: 8,
    padding: '8px 16px', fontSize: 16, fontWeight: 700, cursor: 'pointer',
    fontFamily: DM_SANS, flexShrink: 0,
  },

  stillToCoverBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    background: '#FFF8EE',
    borderTop: '1px solid #F4DFB8',
    borderBottom: '1px solid #F4DFB8',
    padding: '12px 28px',
    flexShrink: 0,
  },
  stillToCoverDot: {
    width: 8, height: 8, borderRadius: '50%', background: '#F4A261', flexShrink: 0, marginTop: 7,
  },
  stillToCoverText: {
    fontSize: 18, color: '#7A4E1A', margin: 0, lineHeight: 1.55,
    fontFamily: DM_SANS,
  },

  // Floating End Chat — fixed bottom-right pill, only after session starts
  endChatFloating: {
    position: 'fixed' as const,
    bottom: 24,
    right: 24,
    background: '#E53935',
    color: '#ffffff',
    border: 'none',
    borderRadius: 999,
    padding: '12px 24px',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: DM_SANS,
    boxShadow: '0 4px 16px rgba(229,57,53,0.30)',
    zIndex: 10,
    animation: 'fadeUp 0.3s ease',
  },

  // Idle footer — ghost back button
  idleFooter: {
    textAlign: 'center' as const,
    padding: '12px 24px 20px',
    background: '#FDFAF5',
    flexShrink: 0,
  },
  backBtn: {
    background: 'transparent',
    color: '#6B7280',
    border: '1px solid #D1D5DB',
    borderRadius: 8,
    padding: '10px 20px',
    fontSize: 16,
    cursor: 'pointer',
    fontFamily: DM_SANS,
  },

  // Progress pills
  progressPillsWrapper: {
    width: '100%', flexShrink: 0,
  },
  progressPills: {
    display: 'flex', gap: 6, width: '100%',
  },
  progressPill: {
    flex: 1, height: 8, borderRadius: 999, transition: 'background 0.5s ease',
  },
  progressPillsLabel: {
    fontSize: 13, color: '#6B7280', fontFamily: DM_SANS,
    textAlign: 'center' as const, margin: '5px 0 0',
  },

  // Goodbye screen
  goodbyeCard: {
    background: '#ffffff',
    borderRadius: 20,
    padding: '48px 40px',
    textAlign: 'center',
    boxShadow: '0 2px 16px rgba(0,0,0,0.07)',
    maxWidth: 400,
    width: '100%',
    animation: 'goodbyeFade 0.5s ease',
  },
  goodbyeAvatar: {
    width: 96,
    height: 96,
    borderRadius: '50%',
    background: BRAND.blue,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
    boxShadow: '0 4px 16px rgba(155,123,200,0.30)',
  },
  goodbyeText: {
    fontSize: 24,
    fontFamily: PLAYFAIR,
    color: '#1A1A2E',
    margin: 0,
    lineHeight: 1.4,
    fontWeight: 600,
  },

  // ── Topic selection modal ────────────────────────────────────────────────────
  topicOverlay: {
    position: 'fixed' as const,
    inset: 0,
    zIndex: 50,
    background: 'rgba(26,26,46,0.55)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    overflowY: 'auto' as const,
  },
  topicCard: {
    background: '#FDFAF5',
    borderRadius: 24,
    padding: '32px 28px 28px',
    maxWidth: 480,
    width: '100%',
    boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
    textAlign: 'center' as const,
    animation: 'fadeUp 0.35s ease',
  },
  topicInlineCard: {
    width: '100%',
    animation: 'fadeUp 0.4s ease',
    flexShrink: 0,
  },
  topicTitle: {
    fontFamily: PLAYFAIR,
    fontSize: 22,
    fontWeight: 700,
    color: '#1A1A2E',
    margin: '0 0 6px',
  },
  topicSubtitle: {
    fontFamily: DM_SANS,
    fontSize: 15,
    color: '#6B7280',
    margin: '0 0 24px',
    lineHeight: 1.5,
  },
  topicGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 10,
    textAlign: 'left' as const,
  },
  topicBtn: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-start',
    gap: 2,
    background: '#ffffff',
    border: '1.5px solid #E5E7EB',
    borderRadius: 14,
    padding: '14px 14px 12px',
    cursor: 'pointer',
    transition: 'border-color 0.18s, box-shadow 0.18s, background 0.18s',
    textAlign: 'left' as const,
  },
  topicBtnDone: {
    background: '#F3F4F6',
    border: '1.5px solid #D1D5DB',
    opacity: 0.6,
    cursor: 'not-allowed' as const,
  },
  topicBtnAll: {
    gridColumn: 'span 2',
    background: '#EBF2FA',
    border: '1.5px solid #5B8DB8',
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 12,
  },
  topicBtnChat: {
    gridColumn: 'span 2',
    background: '#FFF8F0',
    border: '1.5px solid #F4A261',
  },
  topicIcon: {
    fontSize: 22,
    lineHeight: 1,
    marginBottom: 4,
  },
  topicLabel: {
    fontFamily: DM_SANS,
    fontSize: 15,
    fontWeight: 700,
    color: '#1A1A2E',
    display: 'block',
    lineHeight: 1.2,
  },
  topicDesc: {
    fontFamily: DM_SANS,
    fontSize: 12,
    color: '#6B7280',
    display: 'block',
    lineHeight: 1.3,
  },
};

export default Conversation;
