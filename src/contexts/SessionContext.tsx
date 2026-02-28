import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface CapturedItem {
  id: string;
  category: string;
  content: string;
  confidence: 'clear' | 'needs-follow-up';
  flag: boolean;
  timestamp: Date;
}

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  severity: 'red' | 'amber';
  status: 'todo' | 'in-progress' | 'done';
  learnMoreUrl?: string;
}

export interface SessionEntry {
  id: string;
  date: Date;
  duration: string;
  itemsCaptured: number;
  actionsFlagged: number;
}

export interface ClaraResponse {
  spoken: string;
  note?: CapturedItem;
  action?: ActionItem;
}

interface ClaraStructuredResponse {
  spoken: string;
  note?: {
    category: string;
    content: string;
    confidence: 'clear' | 'needs-follow-up';
    flag: boolean;
  };
  action?: {
    title: string;
    description: string;
    severity: 'red' | 'amber';
    learnMoreUrl?: string;
  };
}

interface SessionContextType {
  parentName: string;
  capturedItems: CapturedItem[];
  actionItems: ActionItem[];
  sessions: SessionEntry[];
  claraResponses: ClaraResponse[];
  lastClaraMessage: string;
  isListening: boolean;
  isThinking: boolean;
  addCapturedItem: (item: CapturedItem) => void;
  addActionItem: (item: ActionItem) => void;
  updateActionStatus: (id: string, status: ActionItem['status']) => void;
  setListening: (v: boolean) => void;
  setThinking: (v: boolean) => void;
  setLastClaraMessage: (msg: string) => void;
  simulateConversationTurn: () => void;
  processTranscript: (transcript: string) => Promise<void>;
}

const SessionContext = createContext<SessionContextType | null>(null);

// ─── Clara system prompt ──────────────────────────────────────────────────────
const CLARA_SYSTEM_PROMPT = `You are Clara, a warm and gentle voice assistant for ClearNest — an app that helps adult children organise their elderly parent's finances and personal affairs during the early stages of memory loss.

You are speaking with an elderly person (likely 75–85 years old). Your tone must be:
- Warm, patient, and unhurried — never clinical or corporate
- Simple language, no jargon
- One question at a time, never overwhelming
- Affirming and reassuring — "That's really helpful", "No rush at all"

Your job is to gently gather information about:
- Bank accounts and financial accounts
- Pension providers
- Insurance policies (life, home, other)
- Property ownership
- Will and legal documents
- Power of Attorney
- Key contacts (GP, solicitor, etc.)
- Care wishes

You must respond with ONLY a valid JSON object — no markdown, no preamble, no backticks. The JSON must match this exact shape:

{
  "spoken": "Your warm, conversational reply — 1 to 3 sentences maximum",
  "note": {
    "category": "bank_accounts | financial_accounts | documents | property | care_wishes | key_contacts",
    "content": "Plain English summary of what was shared — concise and factual",
    "confidence": "clear | needs-follow-up",
    "flag": false
  },
  "action": {
    "title": "Short title of the action needed",
    "description": "Why this matters and what the family should do",
    "severity": "red | amber",
    "learnMoreUrl": "optional relevant URL"
  }
}

Rules:
- "spoken" is ALWAYS required
- Include "note" only when the person shared a concrete piece of information worth capturing
- Include "action" only when there is a genuine concern requiring follow-up (missing LPA, unknown pension provider, etc.)
- Set "flag" to true when confidence is "needs-follow-up"
- If nothing useful was said, respond warmly and ask a gentle follow-up — omit "note" and "action"
- Keep "spoken" to 1–3 sentences. Never a monologue.`;

// ─── Mock turns for dashboard demo button ────────────────────────────────────
const MOCK_TURNS: { spoken: string; note?: Omit<CapturedItem, 'id' | 'timestamp'>; action?: Omit<ActionItem, 'id'> }[] = [
  {
    spoken: "That's really helpful, Arthur. So you have a current account with Barclays — and you keep the statements in a blue folder in the top drawer. Is that right?",
    note: { category: "bank_accounts", content: "Barclays current account mentioned. Statements in blue folder, top drawer of desk in study.", confidence: "clear", flag: false },
  },
  {
    spoken: "Thank you. Do you happen to remember if you set up a Power of Attorney with anyone — perhaps with Sarah or another family member?",
    action: { title: "Power of Attorney — Not confirmed", description: "Arthur hasn't confirmed whether a Lasting Power of Attorney is in place. Without this, the family may face Court of Protection proceedings — costing £20,000+ and taking 9+ months.", severity: "red", status: "todo", learnMoreUrl: "https://www.gov.uk/power-of-attorney" },
  },
  {
    spoken: "I understand. Do you remember the name of your pension provider? You mentioned you had a council pension.",
    note: { category: "financial_accounts", content: "Council pension mentioned but provider unknown.", confidence: "needs-follow-up", flag: true },
    action: { title: "Pension Provider — Unknown", description: "Arthur mentioned a council pension but couldn't recall the provider. Use the government's free Pension Tracing Service.", severity: "amber", status: "todo", learnMoreUrl: "https://www.gov.uk/find-pension-contact-details" },
  },
  {
    spoken: "That's perfectly fine. Let me ask about something else — do you have a will, Arthur? And do you know where it's kept?",
    note: { category: "documents", content: "Will exists, drawn up by Henderson & Partners. Kept in a brown envelope in the filing cabinet.", confidence: "clear", flag: false },
  },
  {
    spoken: "Lovely. And is there anything you'd like your family to know about how you'd like to be cared for, if you ever needed extra help at home?",
    note: { category: "care_wishes", content: "Arthur would prefer to stay at home as long as possible. Would like Sarah to manage things.", confidence: "clear", flag: false },
  },
  {
    spoken: "That's very clear, Arthur. One last thing — do you have any insurance policies? Life insurance, home insurance, anything like that?",
    note: { category: "documents", content: "Home insurance with Aviva, renews in March. Life insurance policy exists but provider unknown.", confidence: "needs-follow-up", flag: true },
    action: { title: "Life Insurance Provider — Unknown", description: "Arthur has a life insurance policy but can't recall the provider. Documents may be in the filing cabinet.", severity: "amber", status: "todo" },
  },
];

// ─── Pre-loaded demo data ─────────────────────────────────────────────────────
const INITIAL_ITEMS: CapturedItem[] = [
  { id: '1', category: 'bank_accounts', content: 'Barclays current account mentioned. Statements in blue folder, top drawer of desk in study.', confidence: 'clear', flag: false, timestamp: new Date(Date.now() - 600000) },
  { id: '2', category: 'documents', content: 'Will exists, drawn up by Henderson & Partners solicitors on the High Street. Kept in a brown envelope in the filing cabinet.', confidence: 'clear', flag: false, timestamp: new Date(Date.now() - 480000) },
  { id: '3', category: 'financial_accounts', content: 'Council pension mentioned but provider unknown. Arthur believes it may be through the local authority.', confidence: 'needs-follow-up', flag: true, timestamp: new Date(Date.now() - 360000) },
  { id: '4', category: 'care_wishes', content: "Arthur would prefer to stay at home as long as possible. Doesn't want to go into a care home. Would like Sarah to manage things.", confidence: 'clear', flag: false, timestamp: new Date(Date.now() - 240000) },
  { id: '5', category: 'documents', content: "Home insurance with Aviva, renews in March. Life insurance policy exists but Arthur can't remember the provider.", confidence: 'needs-follow-up', flag: true, timestamp: new Date(Date.now() - 120000) },
  { id: '6', category: 'property', content: "Family home owned outright, no mortgage. Deeds held by Henderson & Partners.", confidence: 'clear', flag: false, timestamp: new Date(Date.now() - 60000) },
  { id: '7', category: 'key_contacts', content: "GP is Dr. Patel at Meadowbank Surgery. NHS number in a letter in the kitchen drawer.", confidence: 'clear', flag: false, timestamp: new Date() },
];

const INITIAL_ACTIONS: ActionItem[] = [
  { id: 'a1', title: 'Power of Attorney — Not confirmed', description: "Arthur hasn't confirmed whether a Lasting Power of Attorney is in place. Without this, the family may face Court of Protection proceedings — costing £20,000+ and taking 9+ months.", severity: 'red', status: 'todo', learnMoreUrl: 'https://www.gov.uk/power-of-attorney' },
  { id: 'a2', title: 'Pension Provider — Unknown', description: "Arthur mentioned a council pension but couldn't recall the provider. Use the government's free Pension Tracing Service.", severity: 'amber', status: 'todo', learnMoreUrl: 'https://www.gov.uk/find-pension-contact-details' },
  { id: 'a3', title: 'Life Insurance Provider — Unknown', description: "Arthur has a life insurance policy but can't recall the provider. Documents may be in the filing cabinet. Sarah should check.", severity: 'amber', status: 'todo' },
];

const INITIAL_SESSIONS: SessionEntry[] = [
  { id: 's1', date: new Date(), duration: '8 minutes', itemsCaptured: 7, actionsFlagged: 3 },
];

// ─── Provider ─────────────────────────────────────────────────────────────────
export function SessionProvider({ children }: { children: ReactNode }) {
  const [parentName] = useState('Arthur');
  const [capturedItems, setCapturedItems] = useState<CapturedItem[]>(INITIAL_ITEMS);
  const [actionItems, setActionItems] = useState<ActionItem[]>(INITIAL_ACTIONS);
  const [sessions] = useState<SessionEntry[]>(INITIAL_SESSIONS);
  const [claraResponses] = useState<ClaraResponse[]>([]);
  const [lastClaraMessage, setLastClaraMessage] = useState('');
  const [isListening, setListening] = useState(false);
  const [isThinking, setThinking] = useState(false);
  const [turnIndex, setTurnIndex] = useState(0);

  // Full conversation history sent to Gemini each turn so Clara has context
  const [conversationHistory, setConversationHistory] = useState<
    { role: 'user' | 'model'; parts: { text: string }[] }[]
  >([]);

  const addCapturedItem = useCallback((item: CapturedItem) => {
    setCapturedItems(prev => [item, ...prev]);
  }, []);

  const addActionItem = useCallback((item: ActionItem) => {
    setActionItems(prev => [item, ...prev]);
  }, []);

  const updateActionStatus = useCallback((id: string, status: ActionItem['status']) => {
    setActionItems(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  }, []);

  // ─── REAL path: transcript → Gemini → dashboard ──────────────────────────
  const processTranscript = useCallback(async (transcript: string) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

    if (!apiKey) {
      console.error('❌ VITE_GEMINI_API_KEY not set in .env');
      setLastClaraMessage("I'm sorry, I couldn't connect just now. Please check the API key is configured.");
      return;
    }

    // Build updated history with new user message
    const updatedHistory = [
      ...conversationHistory,
      { role: 'user' as const, parts: [{ text: transcript }] },
    ];

    try {
      console.log('📤 Sending transcript to Gemini:', transcript);

      // Gemini 1.5 Flash — free tier, fast, great for conversational use
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: CLARA_SYSTEM_PROMPT }],
            },
            contents: updatedHistory,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1024,
            },
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(
          (err as { error?: { message?: string } }).error?.message ?? `HTTP ${response.status}`
        );
      }

      const data = await response.json();
      const rawText: string =
        data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      console.log('✅ Gemini raw response:', rawText);

      // Parse the structured JSON Clara returned
      let parsed: ClaraStructuredResponse;
      try {
        const clean = rawText.replace(/```json|```/g, '').trim();
        parsed = JSON.parse(clean);
      } catch {
        console.warn('⚠️ Could not parse Gemini response as JSON, using raw as spoken');
        parsed = { spoken: rawText };
      }

      // Save assistant reply to history for next turn
      setConversationHistory([
        ...updatedHistory,
        { role: 'model', parts: [{ text: rawText }] },
      ]);

      // Update Clara's spoken message on screen
      setLastClaraMessage(parsed.spoken);

      // Add note to dashboard if present
      if (parsed.note) {
        addCapturedItem({
          ...parsed.note,
          id: `item-${Date.now()}`,
          timestamp: new Date(),
        });
        console.log('📋 Captured item added:', parsed.note);
      }

      // Add action item to dashboard if present
      if (parsed.action) {
        addActionItem({
          ...parsed.action,
          id: `action-${Date.now()}`,
          status: 'todo',
        });
        console.log('⚠️ Action item added:', parsed.action);
      }

      // ── ElevenLabs TTS — speak Clara's response aloud ──────────────────
      // Runs after dashboard is updated so voice doesn't block UI
      const elevenKey = import.meta.env.VITE_ELEVENLABS_API_KEY as string | undefined;
      if (elevenKey && parsed.spoken) {
        speakWithElevenLabs(parsed.spoken, elevenKey);
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('❌ Gemini API error:', message);
      setLastClaraMessage("I'm sorry, I had a little trouble there. Could you say that again?");
    }
  }, [conversationHistory, addCapturedItem, addActionItem]);

  // ─── ElevenLabs TTS ───────────────────────────────────────────────────────
  // Clara's voice ID — "Rachel" is warm and clear, good for elderly users.
  // Change the voiceId to any voice from your ElevenLabs account.
  const ELEVENLABS_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Rachel

  const speakWithElevenLabs = useCallback(async (text: string, apiKey: string) => {
    try {
      console.log('🔊 Sending to ElevenLabs TTS…');

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': apiKey,
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_turbo_v2', // fastest, lowest latency
            voice_settings: {
              stability: 0.75,        // more stable = more consistent, less expressive
              similarity_boost: 0.85, // how closely to match the voice
              speed: 0.90,            // slightly slower — easier for elderly listeners
            },
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(
          (err as { detail?: { message?: string } }).detail?.message ?? `HTTP ${response.status}`
        );
      }

      // Response is raw audio bytes — play directly in browser
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
      audio.onended = () => URL.revokeObjectURL(audioUrl);

      console.log('✅ ElevenLabs audio playing');
    } catch (err) {
      // TTS failure is non-fatal — text is still shown on screen
      console.warn('⚠️ ElevenLabs TTS failed (non-fatal):', err instanceof Error ? err.message : err);
    }
  }, []);

  // ─── DEMO path: mock turns for dashboard demo button ─────────────────────
  const simulateConversationTurn = useCallback(() => {
    const turn = MOCK_TURNS[turnIndex % MOCK_TURNS.length];
    setListening(true);

    setTimeout(() => {
      setListening(false);
      setThinking(true);

      setTimeout(() => {
        setThinking(false);
        setLastClaraMessage(turn.spoken);

        if (turn.note) {
          addCapturedItem({ ...turn.note, id: `item-${Date.now()}`, timestamp: new Date() });
        }
        if (turn.action) {
          addActionItem({ ...turn.action, id: `action-${Date.now()}` });
        }

        setTurnIndex(prev => prev + 1);
      }, 2000);
    }, 3000);
  }, [turnIndex, addCapturedItem, addActionItem]);

  return (
    <SessionContext.Provider value={{
      parentName, capturedItems, actionItems, sessions, claraResponses,
      lastClaraMessage, isListening, isThinking,
      addCapturedItem, addActionItem, updateActionStatus,
      setListening, setThinking, setLastClaraMessage,
      simulateConversationTurn,
      processTranscript,
    }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}