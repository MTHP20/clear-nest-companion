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
  family_id: string;
  session_id?: string | null;
  category: string;
  field_name?: string;
  value_json: Record<string, unknown>;
  confidence?: number;        // 0–1 numeric
  source_type?: ExtractedDataSourceType;
  source_excerpt?: string;
  needs_review?: boolean;
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

// ─── insertExtractedFact ──────────────────────────────────────────────────────
export async function insertExtractedFact(fact: ExtractedFact): Promise<void> {
  const { error } = await supabase.from('extracted_data').insert({
    ...fact,
    confidence: fact.confidence ?? 1.0,
    source_type: fact.source_type ?? 'claude_postprocess',
    needs_review: fact.needs_review ?? false,
  });

  if (error) {
    // Non-fatal — log but don't block the UI
    console.warn('insertExtractedFact error:', error.message);
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
  }));

  const { error } = await supabase.from('extracted_data').insert(rows);
  if (error) {
    console.warn('insertExtractedFacts error:', error.message);
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
// to upsert. Import CapturedItem type inline to avoid circular dependency.
interface CapturedItemLike {
  category: string;
  content: string;
  confidence: 'clear' | 'needs-follow-up';
  sourceQuote?: string;
  timestamp: Date;
}

export function buildUserAssetsFromItems(
  items: CapturedItemLike[],
  familyId: string,
  lastSessionId?: string
): Omit<UserAssets, 'id'> {
  const toFacts = (cat: string): AssetFact[] =>
    items
      .filter(i => i.category === cat)
      .map(i => ({
        content: i.content,
        confidence: i.confidence,
        source_excerpt: i.sourceQuote,
        captured_at: new Date(i.timestamp).toISOString(),
      }));

  const docs = items.filter(i => i.category === 'documents');
  const lpaItem = docs.find(i =>
    /power of attorney|lpa/i.test(i.content)
  );
  const willItem = docs.find(i =>
    /\bwill\b|testament/i.test(i.content)
  );
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
      ? { content: pensionItem.content, confidence: pensionItem.confidence }
      : {},
    lpa_confirmed: lpaItem
      ? { confirmed: true, content: lpaItem.content, confidence: lpaItem.confidence }
      : {},
    will_location: willItem
      ? { content: willItem.content, confidence: willItem.confidence }
      : {},
    completion_score: score,
    last_session_id: lastSessionId,
    last_updated_at: new Date().toISOString(),
  };
}

// ─── buildExtractedFacts ──────────────────────────────────────────────────────
// Converts CapturedItems to ExtractedFact rows for the extracted_data table.
export function buildExtractedFacts(
  items: CapturedItemLike[],
  familyId: string,
  sessionId: string | null | undefined,
  sourceType: ExtractedDataSourceType = 'claude_postprocess'
): ExtractedFact[] {
  return items.map(item => ({
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
  }));
}
