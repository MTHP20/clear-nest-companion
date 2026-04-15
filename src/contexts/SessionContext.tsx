import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { supabase as sharedSupabase } from '@/lib/supabase';
import {
  getUserAssets,
  upsertUserAssets,
  upsertSession,
  insertExtractedFacts,
  insertSingleExtractedFact,
  buildUserAssetsFromItems,
  buildExtractedFacts,
  updateExtractedDataVerification,
  updateReadinessHistory,
  deleteExtractedFact,
  getExtractedItems,
  upsertFamilyProfile,
  getFamilyProfile,
  upsertActionItems,
} from '@/lib/userAssetsService';

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

export interface ProfileUpdate {
  elderlyName: string;
  age: string;
  gender: 'male' | 'female' | 'prefer-not-to-say';
  trustedContactName: string;
}

interface SessionContextType {
  parentName: string;
  childName: string;
  familyId: string;
  updateProfile: (update: ProfileUpdate) => Promise<void>;
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
  removeCapturedItem: (id: string) => void;
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
  const [parentName, setParentName] = useState(() => loadProfileNames().parentName);
  const [childName, setChildName] = useState(() => loadProfileNames().childName);
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
  useEffect(() => {
    saveLS('cn-action-items', actionItems);
    if (familyId && familyId !== 'unknown') {
      upsertActionItems(familyId, actionItems).catch(() => {});
    }
  }, [actionItems, familyId]);
  useEffect(() => {
    saveLS('cn-readiness-history', readinessHistory);
    // Persist to Supabase so the chart survives across devices/sessions
    if (familyId && familyId !== 'unknown' && readinessHistory.length > 0) {
      updateReadinessHistory(familyId, readinessHistory).catch(() => {
        // Non-fatal — localStorage is the fallback
      });
    }
  }, [readinessHistory, familyId]);

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

  // ─── Hydrate from Supabase on mount ────────────────────────────────────────
  useEffect(() => {
    if (!familyId || familyId === 'unknown') return;
    getFamilyProfile(familyId).then(profile => {
      if (!profile) return;
      // Update context names from DB (authoritative source)
      if (profile.elderly_name) setParentName(profile.elderly_name);
      if (profile.trusted_contact_name) setChildName(profile.trusted_contact_name);
      // Keep localStorage in sync
      try {
        const raw = localStorage.getItem('cn-user-profile');
        const existing = raw ? JSON.parse(raw) : {};
        localStorage.setItem('cn-user-profile', JSON.stringify({
          ...existing,
          elderlyName: profile.elderly_name,
          age: profile.age,
          gender: profile.gender,
          trustedContactName: profile.trusted_contact_name,
        }));
      } catch { /* ignore */ }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId]);

  // ─── updateProfile ──────────────────────────────────────────────────────────
  const updateProfile = useCallback(async (update: ProfileUpdate) => {
    // 1. Update context state immediately
    setParentName(update.elderlyName);
    setChildName(update.trustedContactName);

    // 2. Persist to localStorage
    try {
      const raw = localStorage.getItem('cn-user-profile');
      const existing = raw ? JSON.parse(raw) : {};
      localStorage.setItem('cn-user-profile', JSON.stringify({
        ...existing,
        elderlyName: update.elderlyName,
        age: update.age,
        gender: update.gender,
        trustedContactName: update.trustedContactName,
      }));
    } catch { /* ignore */ }

    // 3. Persist to Supabase
    if (familyId && familyId !== 'unknown') {
      await upsertFamilyProfile({
        family_id: familyId,
        elderly_name: update.elderlyName,
        age: update.age,
        gender: update.gender,
        trusted_contact_name: update.trustedContactName,
      });
    }
  }, [familyId]);

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

    // Persist to extracted_data so it survives across sessions and devices.
    // Non-blocking — localStorage is the local fallback if this fails.
    if (familyId && familyId !== 'unknown') {
      insertSingleExtractedFact({
        item_id: item.id,
        family_id: familyId,
        category: item.category,
        value_json: { content: item.content, confidence: item.confidence },
        confidence: item.confidence === 'clear' ? 1.0 : 0.6,
        source_type: item.id.startsWith('ai-') ? 'claude_postprocess'
          : item.id.startsWith('keyword-') ? 'fallback_keyword'
          : item.id.startsWith('sync-') ? 'elevenlabs_live'
          : 'elevenlabs_live',
        source_excerpt: item.sourceQuote,
        needs_review: item.flag || item.confidence === 'needs-follow-up',
        verification_status: item.verificationStatus ?? 'unverified',
      }).catch(() => { /* non-fatal */ });
    }
  }, [familyId]);

  const addActionItem = useCallback((item: ActionItem) => {
    setActionItems(prev => [item, ...prev]);
  }, []);

  const removeCapturedItem = useCallback((id: string) => {
    // Remove from runtime state immediately
    setCapturedItems(prev => prev.filter(i => i.id !== id));

    // Persist deletion to Supabase (non-blocking)
    if (familyId && familyId !== 'unknown') {
      deleteExtractedFact(familyId, id).catch(err =>
        console.warn('deleteExtractedFact failed (non-fatal):', err)
      );

      // Rebuild user_assets to reflect the removal
      setTimeout(() => {
        const remaining = loadLS<CapturedItem[]>('cn-captured-items', []).filter(i => i.id !== id);
        const assets = buildUserAssetsFromItems(
          remaining, familyId, undefined,
          loadLS<ReadinessSnapshot[]>('cn-readiness-history', [])
        );
        upsertUserAssets(assets).catch(err =>
          console.warn('upsertUserAssets after remove failed (non-fatal):', err)
        );
      }, 0);
    }
  }, [familyId]);

  const updateActionStatus = useCallback((id: string, status: ActionItem['status']) => {
    setActionItems(prev => prev.map(a => (a.id === id ? { ...a, status } : a)));
  }, []);

  const updateCapturedVerification = useCallback(
    (id: string, status: 'verified' | 'disputed' | 'unverified') => {
      const now = new Date();
      const role = 'family';

      // Update runtime state
      setCapturedItems(prev =>
        prev.map(i =>
          i.id === id
            ? { ...i, verificationStatus: status, verifiedByRole: role, verifiedAt: now }
            : i
        )
      );

      // Persist to extracted_data in Supabase (non-blocking)
      if (familyId && familyId !== 'unknown') {
        updateExtractedDataVerification(familyId, id, status, role).catch(err =>
          console.warn('Failed to persist verification to Supabase:', err)
        );

        // Also reflect the verification change in user_assets JSONB arrays
        // by re-building from the updated item list (deferred to next tick so state has settled)
        setTimeout(() => {
          const allItems = loadLS<CapturedItem[]>('cn-captured-items', []);
          const updatedItems = allItems.map(i =>
            i.id === id
              ? { ...i, verificationStatus: status, verifiedByRole: role, verifiedAt: now }
              : i
          );
          const assets = buildUserAssetsFromItems(updatedItems, familyId, undefined, undefined);
          upsertUserAssets(assets).catch(err =>
            console.warn('Failed to update user_assets after verification:', err)
          );
        }, 0);
      }
    },
    [familyId]
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

    // ── Step 2: OpenAI extraction (function calling) ──────────────────────
    const openaiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;
    const transcriptText = ((data.transcript ?? []) as RawTurn[])
      .filter(t => t.message && t.message.trim())
      .map(t => `${t.role === 'agent' ? 'Clara' : parentName}: ${t.message}`)
      .join('\n');

    if (openaiKey && transcriptText.length > 50) {
      try {
        const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: 1200,
            tools: [
              {
                type: 'function',
                function: {
                  name: 'store_notes',
                  description: 'Store all extracted notes and flagged actions from the conversation.',
                  parameters: {
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
              },
            ],
            tool_choice: { type: 'function', function: { name: 'store_notes' } },
            messages: [
              {
                role: 'system',
                content: 'Extract factual information from a care-planning conversation. Only include what was clearly stated.',
              },
              {
                role: 'user',
                content: `Extract all factual information from this care-planning conversation:\n\n${transcriptText.slice(0, 4000)}`,
              },
            ],
          }),
        });

        if (openaiResp.ok) {
          const openaiData = await openaiResp.json();
          const toolCall = openaiData.choices?.[0]?.message?.tool_calls?.[0];
          const parsed = toolCall?.function?.arguments
            ? JSON.parse(toolCall.function.arguments)
            : undefined;

          if (parsed) {
            const { notes = [], actions: actionItems = [] } = parsed as { notes?: unknown[]; actions?: unknown[] };

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
            let actionCount = 0;
            for (const action of actionItems as Array<{ title: string; description: string; severity: string }>) {
              if (action.title?.trim()) {
                addActionItem({
                  id: `ai-action-${conversationId}-${ts}-${actionCount}`,
                  title: action.title.trim(),
                  description: action.description ?? '',
                  severity: (action.severity as 'red' | 'amber') ?? 'amber',
                  status: 'todo',
                });
                actionCount++;
              }
            }
            console.log(`🤖 OpenAI extracted ${items} notes, ${actionCount} actions from transcript`);
          }
        }
      } catch (err) {
        console.warn('OpenAI extraction failed, using tool_calls only:', err);
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

    // ── Persist to Supabase structured tables ──────────────────────────────
    if (familyId && familyId !== 'unknown') {
      try {
        // 1) Upsert the session record and get its UUID
        const transcriptText2 = ((data as { transcript?: Array<{ role: string; message?: string }> }).transcript ?? [])
          .filter(t => t.message?.trim())
          .map(t => `${t.role === 'agent' ? 'Clara' : parentName}: ${t.message}`)
          .join('\n');

        const sessionRowId = await upsertSession({
          conversation_id: conversationId,
          family_id: familyId,
          transcript: transcriptText2.slice(0, 8000),
          source: 'voice',
          status: 'completed',
          duration_seconds: (data as { metadata?: { call_duration_secs?: number } }).metadata?.call_duration_secs ?? 0,
        });

        // 2) Get the current full item list from localStorage to build facts
        const allItems = loadLS<CapturedItem[]>('cn-captured-items', []);

        // 3) Insert extracted facts for items captured in this sync
        const newItems = allItems.filter(i =>
          i.id.includes(conversationId) || i.id.startsWith('ai-') || i.id.startsWith('sync-') || i.id.startsWith('keyword-')
        );
        if (newItems.length > 0) {
          const sourceType = newItems[0].id.startsWith('ai-') ? 'claude_postprocess'
            : newItems[0].id.startsWith('keyword-') ? 'fallback_keyword'
            : 'elevenlabs_live';
          const facts = buildExtractedFacts(newItems, familyId, sessionRowId, sourceType);
          await insertExtractedFacts(facts);
        }

        // 4) Upsert user_assets with the full aggregated state (including readiness history)
        const currentHistory = loadLS<ReadinessSnapshot[]>('cn-readiness-history', []);
        const assets = buildUserAssetsFromItems(allItems, familyId, sessionRowId ?? undefined, currentHistory);
        await upsertUserAssets(assets);

        console.log('☁️ Structured data persisted to Supabase');
      } catch (err) {
        console.warn('Supabase structured persist failed (non-fatal):', err);
      }
    }

    return { items, actions, alreadySynced: false };
  }, [addCapturedItem, addActionItem, parentName, familyId]);

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

  // ─── Supabase hydration from extracted_data ─────────────────────────────
  // Primary source of truth for capturedItems.
  // Each row's item_id (or DB id as fallback) becomes CapturedItem.id so
  // that deletes and verification updates find the right row.
  const hydrateFromSupabase = useCallback(async () => {
    if (!familyId || familyId === 'unknown') return;

    try {
      // ── Primary: extracted_data table ────────────────────────────────────
      const rows = await getExtractedItems(familyId);

      if (rows.length > 0) {
        for (const row of rows) {
          const content = (row.value_json as { content?: string })?.content ?? '';
          if (!content.trim()) continue;

          // Use item_id if set (original CapturedItem.id), else DB UUID
          const id = row.item_id ?? row.id;

          addCapturedItem({
            id,
            category: row.category,
            content,
            confidence: row.confidence >= 0.8 ? 'clear' : 'needs-follow-up',
            flag: row.needs_review,
            timestamp: new Date(row.created_at),
            sourceQuote: row.source_excerpt ?? undefined,
            verificationStatus: row.verification_status ?? 'unverified',
            verifiedByRole: row.verified_by_role ?? undefined,
            verifiedAt: row.verified_at ? new Date(row.verified_at) : undefined,
          });
        }
        console.log(`☁️ extracted_data hydrated ${rows.length} items into dashboard`);

        // Also restore readiness history from user_assets if available
        const assets = await getUserAssets(familyId);
        if (assets?.readiness_history?.length) {
          setReadinessHistory(prev => {
            if (prev.length >= assets.readiness_history.length) return prev;
            return assets.readiness_history;
          });
        }
        return;
      }

      // ── Fallback: user_assets (older data before extracted_data migration) ──
      const assets = await getUserAssets(familyId);
      if (assets) {
        // Restore readiness history
        if (assets.readiness_history?.length) {
          setReadinessHistory(prev => {
            if (prev.length >= assets.readiness_history.length) return prev;
            return assets.readiness_history;
          });
        }

        type AssetFact = { content: string; confidence: string; source_excerpt?: string };
        const now = new Date();
        const addFact = (id: string, category: string, fact: AssetFact) => {
          if (!fact.content?.trim()) return;
          addCapturedItem({ id, category, content: fact.content, confidence: (fact.confidence as 'clear' | 'needs-follow-up') ?? 'clear', flag: false, timestamp: now, sourceQuote: fact.source_excerpt });
        };

        (assets.bank_accounts ?? []).forEach((f, i) => addFact(`ua-bank-${i}`, 'bank_accounts', f as AssetFact));
        (assets.financial_accounts ?? []).forEach((f, i) => addFact(`ua-fin-${i}`, 'financial_accounts', f as AssetFact));
        (assets.property_details ?? []).forEach((f, i) => addFact(`ua-prop-${i}`, 'property', f as AssetFact));
        (assets.key_contacts ?? []).forEach((f, i) => addFact(`ua-contact-${i}`, 'key_contacts', f as AssetFact));
        (assets.care_wishes ?? []).forEach((f, i) => addFact(`ua-care-${i}`, 'care_wishes', f as AssetFact));

        if ((assets.lpa_confirmed as AssetFact)?.content) addFact('ua-lpa', 'documents', assets.lpa_confirmed as AssetFact);
        if ((assets.will_location as AssetFact)?.content) addFact('ua-will', 'documents', assets.will_location as AssetFact);
        if ((assets.pension_status as AssetFact)?.content) addFact('ua-pension', 'financial_accounts', assets.pension_status as AssetFact);

        console.log('☁️ user_assets fallback hydrated into dashboard');
      }
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
        updateProfile,
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
        removeCapturedItem,
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
