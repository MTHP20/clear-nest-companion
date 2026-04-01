import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { supabase as sharedSupabase } from '@/lib/supabase';

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

export interface ReadinessSnapshot {
  date: string; // ISO date string 'YYYY-MM-DD'
  score: number; // 0–100
}

interface SessionContextType {
  parentName: string;
  childName: string;
  familyId: string;
  capturedItems: CapturedItem[];
  actionItems: ActionItem[];
  sessions: SessionEntry[];
  readinessHistory: ReadinessSnapshot[];
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
  if (lower.includes('document') || lower.includes('will') || lower.includes('legal')) return 'documents';
  if (lower.includes('bank')) return 'bank_accounts';
  if (lower.includes('financ') || lower.includes('pension') || lower.includes('invest')) return 'financial_accounts';
  if (lower.includes('propert') || lower.includes('house') || lower.includes('home')) return 'property';
  if (lower.includes('care') || lower.includes('wish') || lower.includes('prefer')) return 'care_wishes';
  if (lower.includes('contact') || lower.includes('person') || lower.includes('doctor') || lower.includes('solicitor')) return 'key_contacts';
  return 'general';
}

// ─── Shared keyword patterns ──────────────────────────────────────────────────
type PatternEntry = { re: RegExp; category: string; confidence: 'clear' | 'needs-follow-up' };
const KEYWORD_PATTERNS: PatternEntry[] = [
  {
    re: /\b(barclays|lloyds|natwest|hsbc|santander|nationwide|monzo|starling|halifax|first direct|metro bank|co-op bank|bank(?:ing)?|current account|savings account|bank account)\b/i,
    category: 'bank_accounts', confidence: 'clear',
  },
  {
    re: /\b(pension|nhs pension|teacher.?s pension|civil service pension|isa|stocks? and shares|premium bond|investment|annuity|retirement fund|workplace pension|final salary|defined benefit)\b/i,
    category: 'financial_accounts', confidence: 'clear',
  },
  {
    re: /\b(own(?:s|ed)?\s+(?:my|the|a)\s+(?:house|flat|home|property|bungalow|apartment)|mortgage|freehold|leasehold|property deed|title deed|house deed|bought (?:my|the) house|live in (?:my|a) (?:house|flat|home))\b/i,
    category: 'property', confidence: 'clear',
  },
  {
    re: /\b(will|last (?:will|testament)|solicitor|power of attorney|lasting power|lpa|insurance polic(?:y|ies)|life insurance|home insurance|trust fund|probate|executor)\b/i,
    category: 'documents', confidence: 'clear',
  },
  {
    re: /\b(dr\.?\s+[a-z]+|doctor\s+[a-z]+|my gp|general practitioner|my solicitor|my accountant|financial advis(?:er|or)|my lawyer|my (?:son|daughter|wife|husband|partner) is)\b/i,
    category: 'key_contacts', confidence: 'clear',
  },
  {
    re: /\b(care home|nursing home|residential home|(?:want|prefer|like|wish) to (?:stay|remain|live|be cared for) at home|end of life|do not resuscitate|dnr|funeral|cremation|burial|hospice|palliative)\b/i,
    category: 'care_wishes', confidence: 'clear',
  },
  {
    re: /\b(deeds?|mortgage(?:d)?|renting|rented|landlord)\b/i,
    category: 'property', confidence: 'needs-follow-up',
  },
  {
    re: /\b(my (?:gp|doctor) is|my solicitor is|accountant called|adviser named)\b/i,
    category: 'key_contacts', confidence: 'clear',
  },
];

// ─── localStorage helpers ─────────────────────────────────────────────────────
function loadLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}
function saveLS(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota exceeded */ }
}

function loadProfileNames(): { parentName: string; childName: string; familyId: string } {
  try {
    const raw = localStorage.getItem('cn-user-profile');
    if (!raw) return { parentName: 'You', childName: 'Family', familyId: 'unknown' };
    const p = JSON.parse(raw) as { elderlyName?: string; trustedContactName?: string; sessionToken?: string };
    return {
      parentName: p.elderlyName?.trim() || 'You',
      childName: p.trustedContactName?.trim() || 'Family',
      familyId: p.sessionToken || 'unknown',
    };
  } catch { return { parentName: 'You', childName: 'Family', familyId: 'unknown' }; }
}

// ─── Supabase client (shared instance) ───────────────────────────────────────
const supabase = sharedSupabase;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [parentName] = useState(() => loadProfileNames().parentName);
  const [childName] = useState(() => loadProfileNames().childName);
  const [familyId] = useState(() => loadProfileNames().familyId);

  const [capturedItems, setCapturedItems] = useState<CapturedItem[]>(() =>
    loadLS<CapturedItem[]>('cn-captured-items', [])
  );
  const [actionItems, setActionItems] = useState<ActionItem[]>(() =>
    loadLS<ActionItem[]>('cn-action-items', [])
  );

  const [sessions] = useState<SessionEntry[]>([]);
  const [claraResponses] = useState<ClaraResponse[]>([]);
  const [lastClaraMessage, setLastClaraMessage] = useState('');
  const [lastUserMessage, setLastUserMessage] = useState('');
  const lastUserMessageRef = useRef('');
  const [isListening, setListening] = useState(false);
  const [isThinking, setThinking] = useState(false);
  const [userNotes, setUserNotes] = useState<Record<string, string>>({});
  const [readinessHistory, setReadinessHistory] = useState<ReadinessSnapshot[]>(() =>
    loadLS<ReadinessSnapshot[]>('cn-readiness-history', [])
  );

  useEffect(() => { saveLS('cn-captured-items', capturedItems); }, [capturedItems]);
  useEffect(() => { saveLS('cn-action-items', actionItems); }, [actionItems]);
  useEffect(() => { saveLS('cn-readiness-history', readinessHistory); }, [readinessHistory]);

  useEffect(() => {
    if (capturedItems.length === 0) return;
    const ALL_CATS = ['bank_accounts', 'financial_accounts', 'property', 'documents', 'key_contacts', 'care_wishes'];
    const coveredCats = new Set(capturedItems.map(i => i.category));
    const score = Math.round((ALL_CATS.filter(c => coveredCats.has(c)).length / ALL_CATS.length) * 100);
    const today = new Date().toISOString().slice(0, 10);
    setReadinessHistory(prev => {
      const without = prev.filter(s => s.date !== today);
      return [...without, { date: today, score }].slice(-30);
    });
  }, [capturedItems]);

  const syncedIds = useRef<Set<string>>(
    new Set(loadLS<string[]>('cn-synced-ids-v2', []))
  );

  const setUserNote = useCallback((itemId: string, note: string) => {
    setUserNotes(prev => ({ ...prev, [itemId]: note }));
  }, []);

  const wrappedSetLastUserMessage = useCallback((msg: string) => {
    lastUserMessageRef.current = msg;
    setLastUserMessage(msg);
  }, []);

  const addCapturedItem = useCallback((item: CapturedItem) => {
    setCapturedItems(prev => {
      if (prev.some(e => e.category === item.category && e.content.trim() === item.content.trim())) return prev;
      return [item, ...prev];
    });
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
        const content = (parameters.content as string) ?? '';
        let category = normaliseCategory((parameters.category as string) ?? 'general');

        if (category === 'general' && content) {
          for (const { re, category: patternCategory } of KEYWORD_PATTERNS) {
            if (re.test(content)) {
              category = patternCategory;
              break;
            }
          }
        }

        const item: CapturedItem = {
          id: `item-${Date.now()}`,
          category,
          content,
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
  const liveExtract = useCallback(async (recentTranscript: string): Promise<void> => {
    if (!recentTranscript.trim()) return;

    const speakerPrefix = `${parentName}:`;
    const narayanLines = recentTranscript
      .split('\n')
      .filter(l => l.startsWith(speakerPrefix))
      .map(l => l.replace(new RegExp(`^${parentName}:\\s*`, 'i'), '').trim())
      .filter(l => l.length > 8);

    if (narayanLines.length === 0) return;

    for (const text of narayanLines) {
      for (const { re, category, confidence } of KEYWORD_PATTERNS) {
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
          break;
        }
      }
    }
  }, [addCapturedItem, parentName]);

  // ─── Sync a past ElevenLabs conversation into the dashboard ──────────────
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

    // ── Step 1: extract tool_calls from the ElevenLabs transcript ──────────
    // ElevenLabs may store tool calls inside individual transcript turns OR
    // as a top-level array — check both locations.
    type RawTurn = { role: string; message?: string; tool_calls?: unknown[] };
    type RawToolCall = {
      tool_name?: string; name?: string;
      params_as_json?: string; parameters?: Record<string, unknown>;
    };

    const allToolCalls: RawToolCall[] = [];

    // Per-turn tool_calls (standard location)
    for (const turn of (data.transcript ?? []) as RawTurn[]) {
      for (const tc of (turn.tool_calls ?? [])) {
        allToolCalls.push(tc as RawToolCall);
      }
    }

    // Top-level tool_results (alternative ElevenLabs API shape)
    for (const tc of (data.tool_results ?? data.analysis?.tool_results ?? [])) {
      allToolCalls.push(tc as RawToolCall);
    }

    for (const toolCall of allToolCalls) {
      try {
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

    // ── Step 2: Claude AI extraction (strict tool_use) ──────────────────────
    const anthropicKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;
    const transcriptText = ((data.transcript ?? []) as RawTurn[])
      .filter(t => t.message && t.message.trim())
      .map(t => `${t.role === 'agent' ? 'Clara' : parentName}: ${t.message}`)
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
            max_tokens: 1200,
            system: 'Extract factual information from a care-planning conversation. Only include what was clearly stated.',
            tools: [
              {
                name: 'store_notes',
                description: 'Store all extracted notes and flagged actions from the conversation.',
                input_schema: {
                  type: 'object',
                  properties: {
                    notes: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          category: {
                            type: 'string',
                            enum: ['documents', 'bank_accounts', 'financial_accounts', 'property', 'care_wishes', 'key_contacts', 'general'],
                          },
                          content: { type: 'string', description: '1-sentence factual statement' },
                          confidence: { type: 'string', enum: ['clear', 'needs-follow-up'] },
                        },
                        required: ['category', 'content', 'confidence'],
                      },
                    },
                    actions: {
                      type: 'array',
                      description: 'Urgent gaps only — e.g. no will, no LPA set up.',
                      items: {
                        type: 'object',
                        properties: {
                          title: { type: 'string' },
                          description: { type: 'string' },
                          severity: { type: 'string', enum: ['red', 'amber'] },
                        },
                        required: ['title', 'description', 'severity'],
                      },
                    },
                  },
                  required: ['notes', 'actions'],
                },
              },
            ],
            tool_choice: { type: 'tool', name: 'store_notes' },
            messages: [
              {
                role: 'user',
                content: `Extract all factual information from this care-planning conversation:\n\n${transcriptText.slice(0, 4000)}`,
              },
            ],
          }),
        });

        if (claudeResp.ok) {
          const claudeData = await claudeResp.json();
          const toolUse = (claudeData.content ?? []).find(
            (b: { type: string }) => b.type === 'tool_use'
          ) as { input?: { notes?: unknown[]; actions?: unknown[] } } | undefined;

          if (toolUse?.input) {
            const { notes = [], actions = [] } = toolUse.input;

            for (const note of notes as Array<{ category: string; content: string; confidence: string }>) {
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
            for (const action of actions as Array<{ title: string; description: string; severity: string }>) {
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
    } else if (transcriptText.length > 50 && items === 0) {
      // Last resort: keyword matching on the elderly person's lines
      const narayanLines = transcriptText
        .split('\n')
        .filter(l => l.startsWith(`${parentName}:`))
        .map(l => l.replace(new RegExp(`^${parentName}:\\s*`, 'i'), '').trim())
        .filter(l => l.length > 8);

      for (const text of narayanLines) {
        for (const { re, category, confidence } of KEYWORD_PATTERNS) {
          if (re.test(text)) {
            addCapturedItem({
              id: `keyword-${conversationId}-${ts}-${items}`,
              category,
              content: text,
              confidence,
              flag: false,
              timestamp: new Date(),
            });
            items++;
            break;
          }
        }
      }
    }

    if (items > 0 || actions > 0) {
      syncedIds.current.add(conversationId);
      saveLS('cn-synced-ids-v2', [...syncedIds.current]);
    }
    console.log(`✅ Synced conversation ${conversationId}: ${items} items, ${actions} actions`);
    return { items, actions, alreadySynced: false };
  }, [addCapturedItem, addActionItem, parentName]);

  // ─── Auto-sync all unsynced ElevenLabs conversations ────────────────────
  const autoSyncLatest = useCallback(async (): Promise<SyncResult | null> => {
    const EL_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY as string;
    const AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID as string;
    if (!EL_KEY || !AGENT_ID) return null;

    try {
      const resp = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations?agent_id=${AGENT_ID}&page_size=20`,
        { headers: { 'xi-api-key': EL_KEY } }
      );
      if (!resp.ok) return null;
      const data = await resp.json();
      const convs = (data.conversations ?? []) as { conversation_id: string }[];

      let totalItems = 0;
      let totalActions = 0;
      for (const conv of convs) {
        if (syncedIds.current.has(conv.conversation_id)) continue;
        try {
          const result = await syncFromConversation(conv.conversation_id);
          if (!result.alreadySynced) {
            totalItems += result.items;
            totalActions += result.actions;
          }
        } catch { /* skip failed syncs */ }
      }
      return { items: totalItems, actions: totalActions, alreadySynced: totalItems === 0 && totalActions === 0 };
    } catch (err) {
      console.error('autoSyncLatest failed:', err);
      return null;
    }
  }, [syncFromConversation]);

  // ─── Supabase profile hydration ──────────────────────────────────────────
  // After ElevenLabs sync, pull the structured profiles row from Supabase and
  // merge any server-extracted data that isn't already in localStorage.
  const hydrateFromSupabase = useCallback(async () => {
    if (!familyId || familyId === 'unknown') return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('bank_accounts, financial_accounts, property_details, pension_status, will_location, key_contacts, care_wishes, lpa_confirmed')
        .eq('family_id', familyId)
        .maybeSingle();

      if (error || !data) return;

      const now = new Date();

      // Convert each structured field into CapturedItems and merge
      type BankRow = { bank_name: string; account_type: string; notes: string };
      for (const row of (data.bank_accounts ?? []) as BankRow[]) {
        if (row.bank_name) {
          addCapturedItem({
            id: `sb-bank-${row.bank_name.toLowerCase().replace(/\s+/g, '-')}`,
            category: 'bank_accounts',
            content: `${row.bank_name} — ${row.account_type}${row.notes ? `. ${row.notes}` : ''}`,
            confidence: 'clear',
            flag: false,
            timestamp: now,
          });
        }
      }

      type FinRow = { type: string; provider: string; notes: string };
      for (const row of (data.financial_accounts ?? []) as FinRow[]) {
        if (row.type || row.provider) {
          addCapturedItem({
            id: `sb-fin-${(row.provider || row.type).toLowerCase().replace(/\s+/g, '-')}`,
            category: 'financial_accounts',
            content: `${row.type}${row.provider ? ` with ${row.provider}` : ''}${row.notes ? `. ${row.notes}` : ''}`,
            confidence: 'clear',
            flag: false,
            timestamp: now,
          });
        }
      }

      type PropRow = { description: string; ownership_type: string; notes: string };
      for (const row of (data.property_details ?? []) as PropRow[]) {
        if (row.description) {
          addCapturedItem({
            id: `sb-prop-${row.description.slice(0, 20).toLowerCase().replace(/\s+/g, '-')}`,
            category: 'property',
            content: `${row.description} (${row.ownership_type})${row.notes ? `. ${row.notes}` : ''}`,
            confidence: 'clear',
            flag: false,
            timestamp: now,
          });
        }
      }

      type ContactRow = { name: string; role: string; phone?: string };
      for (const row of (data.key_contacts ?? []) as ContactRow[]) {
        if (row.name) {
          addCapturedItem({
            id: `sb-contact-${row.name.toLowerCase().replace(/\s+/g, '-')}`,
            category: 'key_contacts',
            content: `${row.name} (${row.role})${row.phone ? ` — ${row.phone}` : ''}`,
            confidence: 'clear',
            flag: false,
            timestamp: now,
          });
        }
      }

      if (data.pension_status) {
        addCapturedItem({
          id: 'sb-pension',
          category: 'financial_accounts',
          content: data.pension_status,
          confidence: 'clear',
          flag: false,
          timestamp: now,
        });
      }

      if (data.will_location) {
        addCapturedItem({
          id: 'sb-will',
          category: 'documents',
          content: `Will stored at: ${data.will_location}`,
          confidence: 'clear',
          flag: false,
          timestamp: now,
        });
      }

      if (data.lpa_confirmed) {
        addCapturedItem({
          id: 'sb-lpa',
          category: 'documents',
          content: 'Lasting Power of Attorney is confirmed and signed.',
          confidence: 'clear',
          flag: false,
          timestamp: now,
        });
      }

      if (data.care_wishes) {
        addCapturedItem({
          id: 'sb-care',
          category: 'care_wishes',
          content: data.care_wishes,
          confidence: 'clear',
          flag: false,
          timestamp: now,
        });
      }

      console.log('☁️ Supabase profile hydrated into dashboard');
    } catch (err) {
      console.warn('Supabase hydration failed (non-fatal):', err);
    }
  }, [familyId, addCapturedItem]);

  // ─── On mount: ElevenLabs sync, then Supabase hydration ─────────────────
  useEffect(() => {
    autoSyncLatest()
      .then(r => {
        if (r && !r.alreadySynced) console.log(`🔄 Boot sync: ${r.items} notes, ${r.actions} actions`);
        return hydrateFromSupabase();
      })
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SessionContext.Provider
      value={{
        parentName,
        childName,
        familyId,
        capturedItems,
        actionItems,
        sessions,
        readinessHistory,
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
