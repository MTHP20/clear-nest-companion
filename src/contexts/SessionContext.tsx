import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

export interface CapturedItem {
  id: string;
  category: string;
  content: string;
  confidence: 'clear' | 'needs-follow-up';
  flag: boolean;
  timestamp: Date;
  sourceQuote?: string;
  verificationStatus?: 'verified' | 'disputed' | 'unverified';
  verifiedByRole?: string;
  verifiedAt?: Date;
}

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  severity: 'red' | 'amber';
  status: 'todo' | 'in-progress' | 'done';
  learnMoreUrl?: string;
  dueDate?: string;
  assigneeRole?: string;
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

export interface SyncResult {
  items: number;
  actions: number;
  alreadySynced: boolean;
}

interface SessionContextType {
  parentName: string;
  childName: string;
  capturedItems: CapturedItem[];
  actionItems: ActionItem[];
  sessions: SessionEntry[];
  claraResponses: ClaraResponse[];
  lastClaraMessage: string;
  lastUserMessage: string;
  isListening: boolean;
  isThinking: boolean;
  userNotes: Record<string, string>;
  setUserNote: (itemId: string, note: string) => void;
  addCapturedItem: (item: CapturedItem) => void;
  addActionItem: (item: ActionItem) => void;
  updateActionStatus: (id: string, status: ActionItem['status']) => void;
  updateCapturedVerification: (id: string, status: 'verified' | 'disputed' | 'unverified') => void;
  setListening: (v: boolean) => void;
  setThinking: (v: boolean) => void;
  setLastClaraMessage: (msg: string) => void;
  setLastUserMessage: (msg: string) => void;
  handleAgentToolCall: (toolName: string, parameters: Record<string, unknown>) => void;
  syncFromConversation: (conversationId: string) => Promise<SyncResult>;
  autoSyncLatest: () => Promise<SyncResult | null>;
  liveExtract: (recentTranscript: string) => Promise<void>;
}

const SessionContext = createContext<SessionContextType | null>(null);

// ─── Category normaliser ──────────────────────────────────────────────────────
// Maps various Claude / ElevenLabs category names → the exact strings the
// dashboard components filter on.
const VALID_CATEGORIES = new Set([
  'documents',
  'bank_accounts',
  'financial_accounts',
  'property',
  'care_wishes',
  'key_contacts',
  'general',
]);

function normaliseCategory(raw: string): string {
  const lower = (raw ?? '').toLowerCase().replace(/[\s-]/g, '_');
  if (VALID_CATEGORIES.has(lower)) return lower;
  // fuzzy aliases
  if (lower.includes('document') || lower.includes('will') || lower.includes('legal')) return 'documents';
  if (lower.includes('bank')) return 'bank_accounts';
  if (lower.includes('financ') || lower.includes('pension') || lower.includes('invest')) return 'financial_accounts';
  if (lower.includes('propert') || lower.includes('house') || lower.includes('home')) return 'property';
  if (lower.includes('care') || lower.includes('wish') || lower.includes('prefer')) return 'care_wishes';
  if (lower.includes('contact') || lower.includes('person') || lower.includes('doctor') || lower.includes('solicitor')) return 'key_contacts';
  return 'general';
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [parentName] = useState('Narayan');
  const [childName] = useState('Sunil');
  const [capturedItems, setCapturedItems] = useState<CapturedItem[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [sessions] = useState<SessionEntry[]>([]);
  const [claraResponses] = useState<ClaraResponse[]>([]);
  const [lastClaraMessage, setLastClaraMessage] = useState('');
  const [lastUserMessage, setLastUserMessage] = useState('');
  // Ref so handleAgentToolCall always reads the latest user message
  const lastUserMessageRef = useRef('');
  const [isListening, setListening] = useState(false);
  const [isThinking, setThinking] = useState(false);
  const [userNotes, setUserNotes] = useState<Record<string, string>>({});

  // Track which conversation IDs have been synced this session (in-memory)
  const syncedIds = useRef<Set<string>>(new Set());

  const setUserNote = useCallback((itemId: string, note: string) => {
    setUserNotes(prev => ({ ...prev, [itemId]: note }));
  }, []);

  // Wrap setter so the ref stays in sync for use inside handleAgentToolCall
  const wrappedSetLastUserMessage = useCallback((msg: string) => {
    lastUserMessageRef.current = msg;
    setLastUserMessage(msg);
  }, []);

  const addCapturedItem = useCallback((item: CapturedItem) => {
    setCapturedItems(prev => [item, ...prev]);
  }, []);

  const addActionItem = useCallback((item: ActionItem) => {
    setActionItems(prev => [item, ...prev]);
  }, []);

  const updateActionStatus = useCallback((id: string, status: ActionItem['status']) => {
    setActionItems(prev => prev.map(a => (a.id === id ? { ...a, status } : a)));
  }, []);

  const updateCapturedVerification = useCallback(
    (id: string, status: 'verified' | 'disputed' | 'unverified') => {
      setCapturedItems(prev =>
        prev.map(i =>
          i.id === id
            ? { ...i, verificationStatus: status, verifiedByRole: 'dad', verifiedAt: new Date() }
            : i
        )
      );
    },
    []
  );

  // ─── ElevenLabs tool call handler (live session) ──────────────────────────
  const handleAgentToolCall = useCallback(
    (toolName: string, parameters: Record<string, unknown>) => {
      console.log('🔧 Agent tool call:', toolName, parameters);

      if (toolName === 'capture_note') {
        const item: CapturedItem = {
          id: `item-${Date.now()}`,
          category: normaliseCategory((parameters.category as string) ?? 'general'),
          content: (parameters.content as string) ?? '',
          confidence: (parameters.confidence as 'clear' | 'needs-follow-up') ?? 'clear',
          flag: (parameters.flag as boolean) ?? false,
          timestamp: new Date(),
          sourceQuote: (parameters.source_quote as string) || lastUserMessageRef.current || undefined,
        };
        addCapturedItem(item);
        console.log('📋 Note captured:', item);
      }

      if (toolName === 'flag_action') {
        const action: ActionItem = {
          id: `action-${Date.now()}`,
          title: (parameters.title as string) ?? 'Action required',
          description: (parameters.description as string) ?? '',
          severity: (parameters.severity as 'red' | 'amber') ?? 'amber',
          status: 'todo',
          learnMoreUrl: (parameters.learnMoreUrl as string) ?? undefined,
        };
        addActionItem(action);
        console.log('⚠️ Action flagged:', action);
      }
    },
    [addCapturedItem, addActionItem]
  );

  // ─── Real-time keyword extraction during a live session ──────────────────
  // Runs after each exchange. No external API needed — the ElevenLabs agent
  // (Clara) is the AI; this catches anything she doesn't tag via capture_note.
  const liveExtract = useCallback(async (recentTranscript: string): Promise<void> => {
    if (!recentTranscript.trim()) return;

    // Only look at lines spoken by the user (Narayan), not Clara
    const narayanLines = recentTranscript
      .split('\n')
      .filter(l => l.startsWith('Narayan:'))
      .map(l => l.replace(/^Narayan:\s*/i, '').trim())
      .filter(l => l.length > 8);

    if (narayanLines.length === 0) return;

    // ── Pattern table — ordered most-specific first ──────────────────────
    type PatternEntry = {
      re: RegExp;
      category: string;
      confidence: 'clear' | 'needs-follow-up';
    };

    const PATTERNS: PatternEntry[] = [
      // Bank accounts
      {
        re: /\b(barclays|lloyds|natwest|hsbc|santander|nationwide|monzo|starling|halifax|co-op bank|first direct|metro bank|bank(?:ing)?|current account|savings account|bank account)\b/i,
        category: 'bank_accounts',
        confidence: 'clear',
      },
      // Financial / pension
      {
        re: /\b(pension|nhs pension|teacher.?s pension|civil service pension|isa|stocks? and shares|premium bond|investment|annuity|retirement fund|workplace pension|final salary|defined benefit)\b/i,
        category: 'financial_accounts',
        confidence: 'clear',
      },
      // Property
      {
        re: /\b(own(?:s|ed)?\s+(?:my|the|a)\s+(?:house|flat|home|property|bungalow|apartment)|mortgage|freehold|leasehold|property deed|title deed|house deed|bought (?:my|the) house|live in (?:my|a) (?:house|flat|home))\b/i,
        category: 'property',
        confidence: 'clear',
      },
      // Documents — will / LPA / insurance
      {
        re: /\b(will|last (?:will|testament)|solicitor|power of attorney|lasting power|lpa|insurance polic(?:y|ies)|life insurance|home insurance|trust fund|probate|executor)\b/i,
        category: 'documents',
        confidence: 'clear',
      },
      // Key contacts — named people
      {
        re: /\b(dr\.?\s+[a-z]+|doctor\s+[a-z]+|my gp|general practitioner|my solicitor|my accountant|financial advis(?:er|or)|my lawyer|my (?:son|daughter|wife|husband|partner) is)\b/i,
        category: 'key_contacts',
        confidence: 'clear',
      },
      // Care wishes
      {
        re: /\b(care home|nursing home|residential home|(?:want|prefer|like|wish) to (?:stay|remain|live|be cared for) at home|end of life|do not resuscitate|dnr|funeral|cremation|burial|hospice|palliative)\b/i,
        category: 'care_wishes',
        confidence: 'clear',
      },
      // Loose property follow-up
      {
        re: /\b(deeds?|deeds? (?:are|kept|stored|at|with)|mortgage(?:d)?|renting|rented|landlord)\b/i,
        category: 'property',
        confidence: 'needs-follow-up',
      },
      // Loose contact follow-up
      {
        re: /\b(my (?:gp|doctor) is|my solicitor is|accountant called|adviser named)\b/i,
        category: 'key_contacts',
        confidence: 'clear',
      },
    ];

    for (const text of narayanLines) {
      for (const { re, category, confidence } of PATTERNS) {
        if (re.test(text)) {
          addCapturedItem({
            id: `live-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            category,
            content: text,
            confidence,
            flag: false,
            timestamp: new Date(),
          });
          console.log(`🏷️ Keyword match [${category}]: "${text.slice(0, 60)}…"`);
          break; // one category per utterance
        }
      }
    }
  }, [addCapturedItem]);

  // ─── Sync a past ElevenLabs conversation into the dashboard ──────────────
  // Fetches the transcript, extracts Clara's stored tool_calls AND runs
  // Claude AI over the full transcript text for richer extraction.
  const syncFromConversation = useCallback(async (conversationId: string): Promise<SyncResult> => {
    if (syncedIds.current.has(conversationId)) {
      return { items: 0, actions: 0, alreadySynced: true };
    }

    const EL_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY as string;
    const resp = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
      { headers: { 'xi-api-key': EL_KEY } }
    );
    if (!resp.ok) throw new Error(`ElevenLabs API error ${resp.status}`);
    const data = await resp.json();

    let items = 0;
    let actions = 0;
    const ts = Date.now();

    // ── Step 1: extract tool_calls stored by ElevenLabs in the transcript ──
    type RawTurn = { role: string; message?: string; tool_calls?: unknown[] };
    for (const turn of (data.transcript ?? []) as RawTurn[]) {
      for (const tc of (turn.tool_calls ?? [])) {
        try {
          const toolCall = tc as {
            tool_name?: string;
            name?: string;
            params_as_json?: string;
            parameters?: Record<string, unknown>;
          };
          const toolName = toolCall.tool_name ?? toolCall.name ?? '';
          let params: Record<string, unknown> = {};
          if (typeof toolCall.params_as_json === 'string') {
            params = JSON.parse(toolCall.params_as_json);
          } else if (toolCall.parameters) {
            params = toolCall.parameters;
          }

          if (toolName === 'capture_note') {
            addCapturedItem({
              id: `sync-${conversationId}-${ts}-${items}`,
              category: normaliseCategory((params.category as string) ?? 'general'),
              content: (params.content as string) ?? '',
              confidence: (params.confidence as 'clear' | 'needs-follow-up') ?? 'clear',
              flag: (params.flag as boolean) ?? false,
              timestamp: new Date(),
            });
            items++;
          } else if (toolName === 'flag_action') {
            addActionItem({
              id: `sync-action-${conversationId}-${ts}-${actions}`,
              title: (params.title as string) ?? 'Action required',
              description: (params.description as string) ?? '',
              severity: (params.severity as 'red' | 'amber') ?? 'amber',
              status: 'todo',
              learnMoreUrl: (params.learnMoreUrl as string) ?? undefined,
            });
            actions++;
          }
        } catch {
          // skip malformed tool call
        }
      }
    }

    // ── Step 2: Claude AI extraction from full transcript text ──────────────
    const anthropicKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;
    const transcriptText = ((data.transcript ?? []) as RawTurn[])
      .filter(t => t.message && t.message.trim())
      .map(t => `${t.role === 'agent' ? 'Clara' : 'Narayan'}: ${t.message}`)
      .join('\n');

    if (anthropicKey && transcriptText.length > 50) {
      try {
        const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            // haiku is the cheapest Claude model — ~$0.001 per full conversation sync
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 900,
            messages: [
              {
                role: 'user',
                content: `Extract all factual information from this care-planning conversation. Return ONLY JSON (no markdown):
{"notes":[{"category":"...","content":"1-sentence fact","confidence":"clear|needs-follow-up"}],"actions":[{"title":"...","description":"...","severity":"red|amber"}]}

Categories: documents (will/LPA/insurance/solicitor), bank_accounts, financial_accounts (pension/ISA/investments), property (house/deeds/mortgage), care_wishes (care home/medical wishes), key_contacts (named GP/solicitor/accountant), general
Actions only for urgent gaps (no will, no LPA set up, etc).

Conversation:
${transcriptText.slice(0, 4000)}`,
              },
            ],
          }),
        });

        if (claudeResp.ok) {
          const claudeData = await claudeResp.json();
          const text: string = claudeData.content?.[0]?.text ?? '';
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const extracted = JSON.parse(jsonMatch[0]) as {
              notes?: Array<{ category: string; content: string; confidence: string }>;
              actions?: Array<{ title: string; description: string; severity: string }>;
            };
            for (const note of extracted.notes ?? []) {
              if (note.content?.trim()) {
                addCapturedItem({
                  id: `ai-${conversationId}-${ts}-${items}`,
                  category: normaliseCategory(note.category),
                  content: note.content.trim(),
                  confidence: (note.confidence as 'clear' | 'needs-follow-up') ?? 'clear',
                  flag: false,
                  timestamp: new Date(),
                });
                items++;
              }
            }
            for (const action of extracted.actions ?? []) {
              if (action.title?.trim()) {
                addActionItem({
                  id: `ai-action-${conversationId}-${ts}-${actions}`,
                  title: action.title.trim(),
                  description: action.description ?? '',
                  severity: (action.severity as 'red' | 'amber') ?? 'amber',
                  status: 'todo',
                });
                actions++;
              }
            }
            console.log(`🤖 Claude extracted ${items} notes, ${actions} actions from transcript`);
          }
        }
      } catch (err) {
        console.warn('Claude AI extraction failed, using tool_calls only:', err);
      }
    } else if (!anthropicKey && transcriptText.length > 50 && items === 0) {
      // No Anthropic key and no tool_calls found — do basic keyword extraction
      // so the demo still populates the dashboard with something useful.
      const lines = transcriptText.split('\n').filter(l => l.startsWith('Narayan:'));
      for (const line of lines) {
        const text = line.replace(/^Narayan:\s*/i, '').trim();
        if (!text) continue;
        const lower = text.toLowerCase();
        let category = 'general';
        if (/will|solicitor|lpa|power of attorney|legal|document/i.test(lower)) category = 'documents';
        else if (/bank|barclays|lloyds|hsbc|pension|investment|savings|isa|premium bond/i.test(lower)) category = 'financial_accounts';
        else if (/house|flat|property|mortgage|rent/i.test(lower)) category = 'property';
        else if (/care home|nurse|hospital|medical|operation|wish|prefer|funeral/i.test(lower)) category = 'care_wishes';
        else if (/dr |doctor|solicitor|accountant|advisor|contact|friend|daughter|son/i.test(lower)) category = 'key_contacts';
        else continue; // skip small talk lines

        addCapturedItem({
          id: `keyword-${conversationId}-${ts}-${items}`,
          category,
          content: text,
          confidence: 'needs-follow-up',
          flag: false,
          timestamp: new Date(),
        });
        items++;
      }
    }

    syncedIds.current.add(conversationId);
    console.log(`✅ Synced conversation ${conversationId}: ${items} items, ${actions} actions`);
    return { items, actions, alreadySynced: false };
  }, [addCapturedItem, addActionItem]);

  // ─── Auto-sync the most recent ElevenLabs conversation ───────────────────
  const autoSyncLatest = useCallback(async (): Promise<SyncResult | null> => {
    const EL_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY as string;
    const AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID as string;
    if (!EL_KEY || !AGENT_ID) return null;

    try {
      const resp = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations?agent_id=${AGENT_ID}&page_size=1`,
        { headers: { 'xi-api-key': EL_KEY } }
      );
      if (!resp.ok) return null;
      const data = await resp.json();
      const latest = (data.conversations ?? [])[0] as { conversation_id: string } | undefined;
      if (!latest) return null;
      return syncFromConversation(latest.conversation_id);
    } catch (err) {
      console.error('autoSyncLatest failed:', err);
      return null;
    }
  }, [syncFromConversation]);

  return (
    <SessionContext.Provider
      value={{
        parentName,
        childName,
        capturedItems,
        actionItems,
        sessions,
        claraResponses,
        lastClaraMessage,
        lastUserMessage,
        isListening,
        isThinking,
        userNotes,
        setUserNote,
        addCapturedItem,
        addActionItem,
        updateActionStatus,
        updateCapturedVerification,
        setListening,
        setThinking,
        setLastClaraMessage,
        setLastUserMessage: wrappedSetLastUserMessage,
        handleAgentToolCall,
        syncFromConversation,
        autoSyncLatest,
        liveExtract,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
