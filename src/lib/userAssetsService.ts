/**
 * userAssetsService.ts
 *
 * Service layer for the three structured Supabase tables:
 *   sessions        — one row per Clara conversation
 *   extracted_data  — one row per extracted fact (auditable bridge)
 *   user_assets     — materialized current state (what the dashboard reads)
 */

import { supabase } from './supabase';

// ─── Shared fact shape stored inside user_assets JSONB arrays ────────────────
export interface AssetFact {
  content: string;
  confidence: 'clear' | 'needs-follow-up';
  source_excerpt?: string;
  captured_at: string; // ISO string
  // Verification mirrors CapturedItem so the dashboard stays in sync
  verification_status?: 'unverified' | 'verified' | 'disputed';
  verified_by_role?: string;
  verified_at?: string; // ISO string
}

// ─── Readiness history snapshot ───────────────────────────────────────────────
export interface ReadinessSnapshotRow {
  date: string;  // 'YYYY-MM-DD'
  score: number; // 0–100
}

// ─── Full user_assets row ────────────────────────────────────────────────────
export interface UserAssets {
  id?: string;
  family_id: string;
  bank_accounts: AssetFact[];
  financial_accounts: AssetFact[];
  property_details: AssetFact[];
  pension_status: Record<string, unknown>;
  lpa_confirmed: Record<string, unknown>;
  will_location: Record<string, unknown>;
  key_contacts: AssetFact[];
  care_wishes: AssetFact[];
  completion_score: number;
  readiness_history: ReadinessSnapshotRow[];
  last_session_id?: string;
  last_updated_at: string;
}

// ─── Extracted fact row ───────────────────────────────────────────────────────
export type ExtractedDataSourceType =
  | 'elevenlabs_live'
  | 'claude_postprocess'
  | 'fallback_keyword'
  | 'manual';

export interface ExtractedFact {
  item_id?: string;       // CapturedItem.id — links DB row back to runtime state
  family_id: string;
  session_id?: string | null;
  category: string;
  field_name?: string;
  value_json: Record<string, unknown>;
  confidence?: number;    // 0–1 numeric
  source_type?: ExtractedDataSourceType;
  source_excerpt?: string;
  needs_review?: boolean;
  verification_status?: 'unverified' | 'verified' | 'disputed';
  verified_by_role?: string;
  verified_at?: string;
}

// ─── Session row ─────────────────────────────────────────────────────────────
export interface SessionRow {
  conversation_id: string;
  family_id: string;
  transcript?: string;
  summary?: string;
  source?: 'voice' | 'manual' | 'import';
  status?: 'active' | 'completed' | 'failed';
  duration_seconds?: number;
  topics_covered?: string[];
}

// ─── getUserAssets ────────────────────────────────────────────────────────────
export async function getUserAssets(familyId: string): Promise<UserAssets | null> {
  const { data, error } = await supabase
    .from('user_assets')
    .select('*')
    .eq('family_id', familyId)
    .maybeSingle();

  if (error) {
    console.warn('getUserAssets error:', error.message);
    return null;
  }
  return data as UserAssets | null;
}

// ─── upsertUserAssets ─────────────────────────────────────────────────────────
export async function upsertUserAssets(assets: Omit<UserAssets, 'id'>): Promise<void> {
  const { error } = await supabase
    .from('user_assets')
    .upsert(
      { ...assets, last_updated_at: new Date().toISOString() },
      { onConflict: 'family_id' }
    );

  if (error) {
    console.warn('upsertUserAssets error:', error.message);
    throw error;
  }
}

// ─── updateReadinessHistory ───────────────────────────────────────────────────
// Merges today's score into the persisted readiness_history on user_assets.
export async function updateReadinessHistory(
  familyId: string,
  history: ReadinessSnapshotRow[]
): Promise<void> {
  const { error } = await supabase
    .from('user_assets')
    .upsert(
      {
        family_id: familyId,
        readiness_history: history,
        last_updated_at: new Date().toISOString(),
      },
      { onConflict: 'family_id' }
    );

  if (error) {
    console.warn('updateReadinessHistory error:', error.message);
  }
}

// ─── insertExtractedFacts (batch) ─────────────────────────────────────────────
export async function insertExtractedFacts(facts: ExtractedFact[]): Promise<void> {
  if (facts.length === 0) return;

  const rows = facts.map(f => ({
    ...f,
    confidence: f.confidence ?? 1.0,
    source_type: f.source_type ?? 'claude_postprocess',
    needs_review: f.needs_review ?? false,
    verification_status: f.verification_status ?? 'unverified',
  }));

  const { error } = await supabase.from('extracted_data').insert(rows);
  if (error) {
    console.warn('insertExtractedFacts error:', error.message);
  }
}

// ─── updateExtractedDataVerification ─────────────────────────────────────────
// Called when a user marks a captured item as verified/disputed/unverified.
// Matches the row by item_id (the CapturedItem.id stored at insert time).
export async function updateExtractedDataVerification(
  familyId: string,
  itemId: string,
  status: 'verified' | 'disputed' | 'unverified',
  verifiedByRole?: string
): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('extracted_data')
    .update({
      verification_status: status,
      verified_by_role: verifiedByRole ?? null,
      verified_at: status === 'unverified' ? null : now,
    })
    .eq('family_id', familyId)
    .eq('item_id', itemId);

  if (error) {
    console.warn('updateExtractedDataVerification error:', error.message);
  }
}

// ─── Session list / detail types ─────────────────────────────────────────────

export interface TranscriptTurn {
  role: 'user' | 'agent';
  message: string;
  time_in_call_secs?: number;
}

export interface PinnedSection {
  label: string;
  excerpt: string;
  turn_indices: number[];
  pinned_at: string; // ISO string
}

export interface SessionListRow {
  id: string;
  conversation_id: string;
  family_id: string;
  started_at: string | null;
  duration_seconds: number;
  message_count: number;
  call_summary_title: string | null;
  transcript_summary: string | null;
  is_pinned: boolean;
  topics_covered: string[];
  created_at: string;
}

export interface SessionDetailRow extends SessionListRow {
  transcript_turns: TranscriptTurn[];
  pinned_sections: PinnedSection[];
}

// ─── getSessionList ───────────────────────────────────────────────────────────
// Paginated list query — no OFFSET, uses keyset pagination via `before` cursor.
export async function getSessionList(
  familyId: string,
  limit = 20,
  before?: string // ISO timestamp — fetch sessions older than this
): Promise<SessionListRow[]> {
  let query = supabase
    .from('sessions')
    .select(
      'id, conversation_id, family_id, started_at, duration_seconds, message_count, call_summary_title, transcript_summary, is_pinned, topics_covered, created_at'
    )
    .eq('family_id', familyId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;
  if (error) {
    console.warn('getSessionList error:', error.message);
    return [];
  }
  return (data ?? []) as SessionListRow[];
}

// ─── getSessionDetail ─────────────────────────────────────────────────────────
// Fetches a single session with full transcript_turns and pinned_sections.
export async function getSessionDetail(
  familyId: string,
  conversationId: string
): Promise<SessionDetailRow | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('family_id', familyId)
    .eq('conversation_id', conversationId)
    .maybeSingle();

  if (error) {
    console.warn('getSessionDetail error:', error.message);
    return null;
  }
  return data as SessionDetailRow | null;
}

// ─── setSessionPinned ─────────────────────────────────────────────────────────
// Pins or unpins a session. Pinned sessions survive the 30-day auto-delete.
export async function setSessionPinned(
  familyId: string,
  conversationId: string,
  pinned: boolean
): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({ is_pinned: pinned, updated_at: new Date().toISOString() })
    .eq('family_id', familyId)
    .eq('conversation_id', conversationId);

  if (error) {
    console.warn('setSessionPinned error:', error.message);
    throw error;
  }
}

// ─── addPinnedSection ─────────────────────────────────────────────────────────
// Appends a new saved section excerpt to a session's pinned_sections array.
export async function addPinnedSection(
  familyId: string,
  conversationId: string,
  section: PinnedSection,
  currentSections: PinnedSection[]
): Promise<void> {
  const updated = [...currentSections, section];
  const { error } = await supabase
    .from('sessions')
    .update({
      pinned_sections: updated,
      is_pinned: true, // saving a section auto-pins the conversation too
      updated_at: new Date().toISOString(),
    })
    .eq('family_id', familyId)
    .eq('conversation_id', conversationId);

  if (error) {
    console.warn('addPinnedSection error:', error.message);
    throw error;
  }
}

// ─── removePinnedSection ──────────────────────────────────────────────────────
export async function removePinnedSection(
  familyId: string,
  conversationId: string,
  sectionIndex: number,
  currentSections: PinnedSection[]
): Promise<void> {
  const updated = currentSections.filter((_, i) => i !== sectionIndex);
  const { error } = await supabase
    .from('sessions')
    .update({
      pinned_sections: updated,
      updated_at: new Date().toISOString(),
    })
    .eq('family_id', familyId)
    .eq('conversation_id', conversationId);

  if (error) {
    console.warn('removePinnedSection error:', error.message);
  }
}

// ─── getExtractedItems ───────────────────────────────────────────────────────
// Reads all extracted_data rows for a family as CapturedItem-compatible objects.
// This is the primary boot source — ensures real item_ids so deletes work.
export interface ExtractedItemRow {
  id: string;              // extracted_data.id (UUID) — used as stable DB key
  item_id: string | null;  // original CapturedItem.id if set
  family_id: string;
  session_id: string | null;
  category: string;
  value_json: Record<string, unknown>;
  confidence: number;
  source_type: string;
  source_excerpt: string | null;
  needs_review: boolean;
  verification_status: 'unverified' | 'verified' | 'disputed';
  verified_by_role: string | null;
  verified_at: string | null;
  created_at: string;
}

export async function getExtractedItems(familyId: string): Promise<ExtractedItemRow[]> {
  const { data, error } = await supabase
    .from('extracted_data')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('getExtractedItems error:', error.message);
    return [];
  }
  return (data ?? []) as ExtractedItemRow[];
}

// ─── getVerifiedItems ─────────────────────────────────────────────────────────
// Returns all extracted_data rows with verification_status = 'verified'.
// Used by the Conversations page "Recently Captured" panel.
export async function getVerifiedItems(familyId: string): Promise<ExtractedItemRow[]> {
  const { data, error } = await supabase
    .from('extracted_data')
    .select('*')
    .eq('family_id', familyId)
    .eq('verification_status', 'verified')
    .order('verified_at', { ascending: false });

  if (error) {
    console.warn('getVerifiedItems error:', error.message);
    return [];
  }
  return (data ?? []) as ExtractedItemRow[];
}

// ─── insertSingleExtractedFact ────────────────────────────────────────────────
// Writes one captured item to extracted_data immediately (called from addCapturedItem).
export async function insertSingleExtractedFact(fact: ExtractedFact): Promise<void> {
  const { error } = await supabase.from('extracted_data').insert({
    item_id: fact.item_id,
    family_id: fact.family_id,
    session_id: fact.session_id ?? null,
    category: fact.category,
    field_name: fact.field_name ?? null,
    value_json: fact.value_json,
    confidence: fact.confidence ?? 1.0,
    source_type: fact.source_type ?? 'elevenlabs_live',
    source_excerpt: fact.source_excerpt ?? null,
    needs_review: fact.needs_review ?? false,
    verification_status: fact.verification_status ?? 'unverified',
  });
  if (error) {
    // Duplicate item_id is fine (idempotent) — ignore unique constraint errors
    if (error.code !== '23505') {
      console.warn('insertSingleExtractedFact error:', error.message);
    }
  }
}

// ─── deleteExtractedFact ──────────────────────────────────────────────────────
// Permanently removes an extracted_data row by its item_id (CapturedItem.id).
// Called when the user dismisses a captured item.
export async function deleteExtractedFact(familyId: string, itemId: string): Promise<void> {
  const { error } = await supabase
    .from('extracted_data')
    .delete()
    .eq('family_id', familyId)
    .eq('item_id', itemId);

  if (error) {
    console.warn('deleteExtractedFact error:', error.message);
  }
}

// ─── upsertSession ────────────────────────────────────────────────────────────
// Returns the sessions.id UUID for use as last_session_id in user_assets.
export async function upsertSession(session: SessionRow): Promise<string | null> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('sessions')
    .upsert(
      {
        conversation_id: session.conversation_id,
        family_id: session.family_id,
        transcript: session.transcript ?? '',
        summary: session.summary ?? '',
        source: session.source ?? 'voice',
        status: session.status ?? 'completed',
        duration_seconds: session.duration_seconds ?? 0,
        topics_covered: session.topics_covered ?? [],
        started_at: now,
        ended_at: now,
        updated_at: now,
      },
      { onConflict: 'conversation_id' }
    )
    .select('id')
    .maybeSingle();

  if (error) {
    console.warn('upsertSession error:', error.message);
    return null;
  }
  return (data as { id: string } | null)?.id ?? null;
}

// ─── buildUserAssetsFromItems ─────────────────────────────────────────────────
// Converts the runtime CapturedItem[] array into a UserAssets object ready
// to upsert. Preserves verification_status so the DB stays in sync.
interface CapturedItemLike {
  id: string;
  category: string;
  content: string;
  confidence: 'clear' | 'needs-follow-up';
  sourceQuote?: string;
  timestamp: Date;
  verificationStatus?: 'verified' | 'disputed' | 'unverified';
  verifiedByRole?: string;
  verifiedAt?: Date;
}

export function buildUserAssetsFromItems(
  items: CapturedItemLike[],
  familyId: string,
  lastSessionId?: string,
  readinessHistory?: ReadinessSnapshotRow[]
): Omit<UserAssets, 'id'> {
  const toFacts = (cat: string): AssetFact[] =>
    items
      .filter(i => i.category === cat)
      .map(i => ({
        content: i.content,
        confidence: i.confidence,
        source_excerpt: i.sourceQuote,
        captured_at: new Date(i.timestamp).toISOString(),
        verification_status: i.verificationStatus ?? 'unverified',
        verified_by_role: i.verifiedByRole,
        verified_at: i.verifiedAt ? new Date(i.verifiedAt).toISOString() : undefined,
      }));

  const docs = items.filter(i => i.category === 'documents');
  const lpaItem = docs.find(i => /power of attorney|lpa/i.test(i.content));
  const willItem = docs.find(i => /\bwill\b|testament/i.test(i.content));
  const pensionItem = items.find(i =>
    i.category === 'financial_accounts' && /pension/i.test(i.content)
  );

  const ALL_CATS = [
    'bank_accounts', 'financial_accounts', 'property',
    'documents', 'key_contacts', 'care_wishes',
  ];
  const covered = new Set(items.map(i => i.category));
  const score = Math.round(
    (ALL_CATS.filter(c => covered.has(c)).length / ALL_CATS.length) * 100
  );

  return {
    family_id: familyId,
    bank_accounts: toFacts('bank_accounts'),
    financial_accounts: toFacts('financial_accounts'),
    property_details: toFacts('property'),
    key_contacts: toFacts('key_contacts'),
    care_wishes: toFacts('care_wishes'),
    pension_status: pensionItem
      ? {
          content: pensionItem.content,
          confidence: pensionItem.confidence,
          verification_status: pensionItem.verificationStatus ?? 'unverified',
        }
      : {},
    lpa_confirmed: lpaItem
      ? {
          confirmed: true,
          content: lpaItem.content,
          confidence: lpaItem.confidence,
          verification_status: lpaItem.verificationStatus ?? 'unverified',
        }
      : {},
    will_location: willItem
      ? {
          content: willItem.content,
          confidence: willItem.confidence,
          verification_status: willItem.verificationStatus ?? 'unverified',
        }
      : {},
    completion_score: score,
    readiness_history: readinessHistory ?? [],
    last_session_id: lastSessionId,
    last_updated_at: new Date().toISOString(),
  };
}

// ─── buildExtractedFacts ──────────────────────────────────────────────────────
// Converts CapturedItems to ExtractedFact rows for the extracted_data table.
// item_id stores the CapturedItem.id so verification updates can find the row.
export function buildExtractedFacts(
  items: CapturedItemLike[],
  familyId: string,
  sessionId: string | null | undefined,
  sourceType: ExtractedDataSourceType = 'claude_postprocess'
): ExtractedFact[] {
  return items.map(item => ({
    item_id: item.id,
    family_id: familyId,
    session_id: sessionId ?? undefined,
    category: item.category,
    value_json: {
      content: item.content,
      confidence: item.confidence,
    },
    confidence: item.confidence === 'clear' ? 1.0 : 0.6,
    source_type: sourceType,
    source_excerpt: item.sourceQuote,
    needs_review: item.confidence === 'needs-follow-up',
    verification_status: item.verificationStatus ?? 'unverified',
    verified_by_role: item.verifiedByRole,
    verified_at: item.verifiedAt ? new Date(item.verifiedAt).toISOString() : undefined,
  }));
}
