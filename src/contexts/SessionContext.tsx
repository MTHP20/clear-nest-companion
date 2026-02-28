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

  // ─── Real-time AI extraction during a live session ───────────────────────
  // Called every few exchanges during the conversation. Sends the recent
  // transcript snippet to Claude and immediately adds any new findings to
  // the dashboard sections as cards — no page refresh needed.
  const liveExtract = useCallback(async (recentTranscript: string): Promise<void> => {
    const anthropicKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;
    if (!anthropicKey || !recentTranscript.trim()) return;

    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 800,
          messages: [
            {
              role: 'user',
              content: `You are listening to a live conversation between Clara (AI care-planning assistant) and an elderly person. Extract any NEW factual information just mentioned that belongs to one of these 7 categories:

1. bank_accounts — which bank(s) they use, account types, where bank cards/documents are kept
2. financial_accounts — pension details (provider name, whether it exists), investments, ISAs, savings accounts
3. property — owns/rents home, property address, where deeds are kept, mortgage info
4. documents — will (does one exist, where kept, solicitor name), insurance policies, Power of Attorney (LPA: is one set up, who is named)
5. key_contacts — named people: GP name, solicitor name, accountant, financial adviser, close family/friends with roles
6. care_wishes — preferred place to be cared for (home/care home), medical preferences, end-of-life wishes, funeral wishes
7. general — other important life information mentioned

Return ONLY valid JSON — no explanation, no markdown:
{"extractions": [{"category": "bank_accounts|financial_accounts|property|documents|key_contacts|care_wishes|general", "content": "clear 1-sentence fact", "confidence": "clear|needs-follow-up"}]}

If nothing from these categories was mentioned, return: {"extractions": []}

Recent conversation:
${recentTranscript}`,
            },
          ],
        }),
      });

      if (!resp.ok) return;
      const data = await resp.json();
      const text: string = data.content?.[0]?.text ?? '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return;

      const result = JSON.parse(match[0]) as {
        extractions?: Array<{ category: string; content: string; confidence: string }>;
      };

      let added = 0;
      for (const item of result.extractions ?? []) {
        if (item.content?.trim()) {
          addCapturedItem({
            id: `live-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            category: normaliseCategory(item.category),
            content: item.content.trim(),
            confidence: (item.confidence as 'clear' | 'needs-follow-up') ?? 'clear',
            flag: false,
            timestamp: new Date(),
          });
          added++;
        }
      }
      if (added > 0) console.log(`🧠 Live extract: ${added} new card(s) added to dashboard`);
    } catch (err) {
      console.warn('liveExtract failed:', err);
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
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1500,
            messages: [
              {
                role: 'user',
                content: `You are extracting structured information from a conversation between Clara (an AI care-planning assistant) and Narayan (an elderly person whose family is preparing estate/care plans).

Extract ALL substantive factual information Narayan mentions. Return strict JSON (no markdown):
{
  "notes": [
    { "category": "...", "content": "...", "confidence": "clear" | "needs-follow-up" }
  ],
  "actions": [
    { "title": "...", "description": "...", "severity": "red" | "amber" }
  ]
}

Category must be one of: documents, bank_accounts, financial_accounts, property, care_wishes, key_contacts, general

Use "documents" for: wills, LPAs, solicitors, legal papers
Use "bank_accounts" / "financial_accounts" for: banks, pensions, investments, savings
Use "property" for: house, flat, mortgage, rental
Use "care_wishes" for: medical preferences, end-of-life wishes, care home preferences
Use "key_contacts" for: named people (doctors, solicitors, family, friends)

Actions (red = urgent legal/financial, amber = should-do): only create if something clearly needs follow-up.

Conversation:
${transcriptText.slice(0, 5000)}`,
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
