import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from '@/contexts/SessionContext';
import {
  ArrowLeft,
  Clock,
  MessageSquare,
  ChevronRight,
  Loader2,
  AlertCircle,
  Pin,
  PinOff,
  Bookmark,
  Trash2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Tag,
} from 'lucide-react';
import {
  getSessionList,
  getSessionDetail,
  setSessionPinned,
  addPinnedSection,
  removePinnedSection,
  getVerifiedItems,
  type SessionListRow,
  type SessionDetailRow,
  type PinnedSection,
  type TranscriptTurn,
  type ExtractedItemRow,
} from '@/lib/userAssetsService';

const FF = 'Figtree, system-ui, sans-serif';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Unknown date';
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ─── iMessage bubble ────────────────────────────────────────────────────────

function Bubble({
  role, message, userName, agentName, isFirstInGroup, isSelected, onSelect,
}: {
  role: 'user' | 'agent';
  message: string;
  userName: string;
  agentName: string;
  isFirstInGroup: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const isUser = role === 'user';
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', marginBottom: 4, cursor: 'pointer' }}
      onClick={onSelect}
    >
      {isFirstInGroup && (
        <span style={{ fontFamily: FF, fontSize: 11, color: 'var(--ov-muted)', marginBottom: 3, paddingLeft: 4, paddingRight: 4, textAlign: isUser ? 'right' : 'left' }}>
          {isUser ? userName : agentName}
        </span>
      )}
      <div style={{
        maxWidth: '75%', padding: '10px 16px',
        fontFamily: FF, fontSize: 15, lineHeight: 1.55,
        transition: 'all 0.15s',
        outline: isSelected ? '2px solid var(--ov-accent)' : 'none',
        outlineOffset: isSelected ? 2 : 0,
        background: isUser ? 'var(--ov-accent)' : 'var(--ov-inner)',
        color: isUser ? 'white' : 'var(--ov-text)',
        borderRadius: isUser ? '20px 20px 5px 20px' : '20px 20px 20px 5px',
        border: isUser ? 'none' : '1px solid var(--ov-card-border)',
      }}>
        {message}
      </div>
      {isSelected && (
        <span style={{ fontFamily: FF, fontSize: 10, color: 'var(--ov-accent)', marginTop: 2, paddingLeft: 4 }}>
          Selected — click "Save Section" to save
        </span>
      )}
    </div>
  );
}

// ─── Pinned sections panel ──────────────────────────────────────────────────

function PinnedSectionsPanel({
  sections,
  onRemove,
}: {
  sections: PinnedSection[];
  onRemove: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  if (sections.length === 0) return null;

  return (
    <div style={{
      background: 'var(--ov-card-bg)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
      border: '1px solid var(--ov-card-border)', borderRadius: 18,
      boxShadow: 'var(--ov-shadow)', marginBottom: 16, overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', fontFamily: FF, fontSize: 14, fontWeight: 600,
          color: 'var(--ov-accent)', background: 'none', border: 'none', cursor: 'pointer',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Bookmark style={{ width: 16, height: 16 }} />
          {sections.length} Saved Section{sections.length !== 1 ? 's' : ''}
        </span>
        {open ? <ChevronUp style={{ width: 16, height: 16 }} /> : <ChevronDown style={{ width: 16, height: 16 }} />}
      </button>
      {open && (
        <div style={{ borderTop: '1px solid var(--ov-card-border)' }}>
          {sections.map((s, i) => (
            <div key={i} style={{
              padding: '12px 20px', display: 'flex', alignItems: 'flex-start', gap: 12,
              borderBottom: i < sections.length - 1 ? '1px solid var(--ov-card-border)' : 'none',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: FF, fontSize: 12, fontWeight: 600, color: 'var(--ov-accent)', marginBottom: 4 }}>{s.label}</p>
                <p style={{ fontFamily: FF, fontSize: 13, color: 'var(--ov-text)', lineHeight: 1.55, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                  &ldquo;{s.excerpt}&rdquo;
                </p>
                <p style={{ fontFamily: FF, fontSize: 10, color: 'var(--ov-muted)', marginTop: 4 }}>
                  Saved {new Date(s.pinned_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <button
                onClick={() => onRemove(i)}
                style={{ color: 'var(--ov-muted)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, marginTop: 2 }}
                aria-label="Remove saved section"
              >
                <Trash2 style={{ width: 14, height: 14 }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Transcript detail view ─────────────────────────────────────────────────

function TranscriptView({
  conv,
  onBack,
  parentName,
  familyId,
}: {
  conv: SessionListRow;
  onBack: () => void;
  parentName: string;
  familyId: string;
}) {
  const [detail, setDetail] = useState<SessionDetailRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(conv.is_pinned);
  const [pinning, setPinning] = useState(false);
  const [selectedTurnIndex, setSelectedTurnIndex] = useState<number | null>(null);
  const [savingSection, setSavingSection] = useState(false);
  const [sections, setSections] = useState<PinnedSection[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getSessionDetail(familyId, conv.conversation_id).then(data => {
      if (!cancelled) {
        setDetail(data);
        setSections(data?.pinned_sections ?? []);
        setLoading(false);
      }
    }).catch(err => {
      if (!cancelled) {
        setError((err as Error).message);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [conv.conversation_id, familyId]);

  const turns = useMemo<TranscriptTurn[]>(() => {
    if (!detail?.transcript_turns?.length) return [];
    return detail.transcript_turns.filter(t => t.message?.trim());
  }, [detail]);

  const turnsWithGroup = useMemo(() =>
    turns.map((turn, i) => ({
      ...turn,
      isFirstInGroup: i === 0 || turns[i - 1].role !== turn.role,
    })), [turns]);

  const handlePin = async () => {
    setPinning(true);
    try {
      await setSessionPinned(familyId, conv.conversation_id, !isPinned);
      setIsPinned(v => !v);
    } catch { /* non-fatal */ } finally {
      setPinning(false);
    }
  };

  const handleSaveSection = useCallback(async () => {
    if (selectedTurnIndex === null || !detail) return;
    const turn = turns[selectedTurnIndex];
    if (!turn) return;

    const label = window.prompt('Label this saved section:', `${parentName}'s key point`);
    if (!label?.trim()) return;

    setSavingSection(true);
    try {
      const section: PinnedSection = {
        label: label.trim(),
        excerpt: turn.message.slice(0, 300),
        turn_indices: [selectedTurnIndex],
        pinned_at: new Date().toISOString(),
      };
      await addPinnedSection(familyId, conv.conversation_id, section, sections);
      setSections(prev => [...prev, section]);
      setIsPinned(true); // saving a section auto-pins
      setSelectedTurnIndex(null);
    } catch { /* non-fatal */ } finally {
      setSavingSection(false);
    }
  }, [selectedTurnIndex, detail, turns, familyId, conv.conversation_id, sections, parentName]);

  const handleRemoveSection = useCallback(async (index: number) => {
    try {
      await removePinnedSection(familyId, conv.conversation_id, index, sections);
      setSections(prev => prev.filter((_, i) => i !== index));
    } catch { /* non-fatal */ }
  }, [familyId, conv.conversation_id, sections]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: FF, fontSize: 14, color: 'var(--ov-accent)',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}
        >
          <ArrowLeft style={{ width: 16, height: 16 }} />
          Back
        </button>
        <div style={{ width: 1, height: 16, background: 'var(--ov-card-border)' }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontFamily: FF, fontWeight: 600, color: 'var(--ov-text)', fontSize: 14, margin: 0 }}>
            {conv.call_summary_title ?? formatDate(conv.started_at)}
          </p>
          <p style={{ fontFamily: FF, fontSize: 12, color: 'var(--ov-muted)', margin: '2px 0 0' }}>
            {formatDuration(conv.duration_seconds)} · {conv.message_count} messages
            {isPinned && <span style={{ marginLeft: 8, color: 'var(--ov-accent)' }}>· Pinned — won't auto-delete</span>}
          </p>
        </div>

        {selectedTurnIndex !== null && (
          <button
            onClick={handleSaveSection}
            disabled={savingSection}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: FF, fontSize: 13, fontWeight: 600,
              background: 'var(--ov-accent)', color: 'white',
              padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
              opacity: savingSection ? 0.6 : 1,
            }}
          >
            {savingSection ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <Bookmark style={{ width: 14, height: 14 }} />}
            Save Section
          </button>
        )}

        <button
          onClick={handlePin}
          disabled={pinning}
          title={isPinned ? 'Unpin — will auto-delete after 30 days' : 'Pin — save forever'}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: FF, fontSize: 13, fontWeight: 600,
            background: isPinned ? 'rgba(70,99,172,0.1)' : 'var(--ov-inner)',
            color: 'var(--ov-accent)',
            border: '1px solid var(--ov-card-border)',
            padding: '7px 14px', borderRadius: 10, cursor: 'pointer',
            opacity: pinning ? 0.6 : 1,
          }}
        >
          {pinning ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> :
            isPinned ? <PinOff style={{ width: 14, height: 14 }} /> : <Pin style={{ width: 14, height: 14 }} />}
          {isPinned ? 'Unpin' : 'Pin'}
        </button>
      </div>

      {/* Summary */}
      {conv.transcript_summary && (
        <div style={{
          background: 'var(--ov-inner)', border: '1px solid var(--ov-card-border)',
          borderRadius: 14, padding: '12px 16px', marginBottom: 14,
        }}>
          <p style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ov-accent)', marginBottom: 4 }}>Summary</p>
          <p style={{ fontFamily: FF, fontSize: 13, color: 'var(--ov-text)', lineHeight: 1.6 }}>{conv.transcript_summary}</p>
        </div>
      )}

      {/* Pinned sections */}
      <PinnedSectionsPanel sections={sections} onRemove={handleRemoveSection} />

      {/* Select-a-turn hint */}
      {!loading && !error && turns.length > 0 && selectedTurnIndex === null && (
        <p style={{ fontFamily: FF, fontSize: 12, color: 'var(--ov-muted)', marginBottom: 12, textAlign: 'center' }}>
          Tap any message to select it, then click "Save Section" to bookmark it permanently.
        </p>
      )}

      {/* Chat area */}
      <div style={{
        background: 'var(--ov-card-bg)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
        border: '1px solid var(--ov-card-border)', borderRadius: 18,
        boxShadow: 'var(--ov-shadow)', flex: 1, overflowY: 'auto', padding: '20px 22px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <span style={{
            fontFamily: FF, fontSize: 11, color: 'var(--ov-muted)',
            background: 'var(--ov-inner)', border: '1px solid var(--ov-card-border)',
            padding: '3px 12px', borderRadius: 20,
          }}>
            {formatDate(conv.started_at)}
          </span>
        </div>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', gap: 12 }}>
            <Loader2 style={{ width: 24, height: 24, color: 'var(--ov-accent)' }} className="animate-spin" />
            <p style={{ fontFamily: FF, fontSize: 14, color: 'var(--ov-muted)' }}>Loading transcript…</p>
          </div>
        )}

        {error && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', gap: 12, textAlign: 'center' }}>
            <AlertCircle style={{ width: 24, height: 24, color: '#FF5F52' }} />
            <p style={{ fontFamily: FF, fontSize: 14, color: 'var(--ov-muted)' }}>{error}</p>
          </div>
        )}

        {!loading && !error && turns.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <p style={{ fontFamily: FF, fontSize: 14, color: 'var(--ov-muted)' }}>
              Full transcript not available for this session.
            </p>
            <p style={{ fontFamily: FF, fontSize: 11, color: 'var(--ov-muted)', marginTop: 4, opacity: 0.6 }}>
              Transcripts are stored from new sessions onwards.
            </p>
          </div>
        )}

        {!loading && !error && turnsWithGroup.map((turn, i) => (
          <Bubble
            key={i}
            role={turn.role}
            message={turn.message}
            userName={parentName}
            agentName="Clara"
            isFirstInGroup={turn.isFirstInGroup}
            isSelected={selectedTurnIndex === i}
            onSelect={() => setSelectedTurnIndex(prev => prev === i ? null : i)}
          />
        ))}

        {!loading && !error && turns.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <span style={{
              fontFamily: FF, fontSize: 11, color: 'var(--ov-muted)',
              background: 'var(--ov-inner)', border: '1px solid var(--ov-card-border)',
              padding: '3px 12px', borderRadius: 20,
            }}>
              Conversation ended · {formatDuration(conv.duration_seconds)}
            </span>
          </div>
        )}
      </div>

      {/* 30-day notice */}
      {!isPinned && (
        <p style={{ fontFamily: FF, fontSize: 10, color: 'var(--ov-muted)', textAlign: 'center', marginTop: 12, opacity: 0.55 }}>
          This conversation auto-deletes 30 days after it was recorded · Pin to keep it permanently
        </p>
      )}
    </div>
  );
}

// ─── Category label map ──────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  bank_accounts: 'Bank',
  financial_accounts: 'Finance',
  property: 'Property',
  documents: 'Documents',
  key_contacts: 'Contact',
  care_wishes: 'Care',
  general: 'General',
};

// ─── Recently Captured panel ─────────────────────────────────────────────────
// Shows all verified captured items for a family, loaded directly from
// extracted_data WHERE verification_status = 'verified'.

function RecentlyCapturedPanel({ familyId }: { familyId: string }) {
  const [items, setItems] = useState<ExtractedItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!familyId || familyId === 'unknown') { setLoading(false); return; }
    getVerifiedItems(familyId)
      .then(rows => { setItems(rows); setLoading(false); })
      .catch(() => setLoading(false));
  }, [familyId]);

  if (!loading && items.length === 0) return null;

  return (
    <div style={{
      background: 'var(--ov-card-bg)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
      border: '1px solid var(--ov-card-border)', borderRadius: 18,
      boxShadow: 'var(--ov-shadow)', marginBottom: 20, overflow: 'hidden',
    }}>
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 22px', background: 'none', border: 'none', cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 style={{ width: 16, height: 16, color: 'var(--ov-accent)', flexShrink: 0 }} />
          <span style={{ fontFamily: FF, fontWeight: 600, color: 'var(--ov-text)', fontSize: 14 }}>
            Recently Captured
          </span>
          {!loading && (
            <span style={{ fontFamily: FF, fontSize: 12, color: 'var(--ov-muted)', marginLeft: 2 }}>
              · {items.length} verified item{items.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {loading
          ? <Loader2 style={{ width: 16, height: 16, color: 'var(--ov-muted)' }} className="animate-spin" />
          : open
            ? <ChevronUp style={{ width: 16, height: 16, color: 'var(--ov-muted)' }} />
            : <ChevronDown style={{ width: 16, height: 16, color: 'var(--ov-muted)' }} />
        }
      </button>

      {open && !loading && (
        <div style={{ borderTop: '1px solid var(--ov-card-border)' }}>
          {items.map((item, idx) => {
            const content = (item.value_json as { content?: string })?.content ?? '';
            const catLabel = CATEGORY_LABELS[item.category] ?? item.category.replace(/_/g, ' ');
            return (
              <div key={item.id} style={{
                padding: '12px 22px', display: 'flex', alignItems: 'flex-start', gap: 12,
                borderBottom: idx < items.length - 1 ? '1px solid var(--ov-card-border)' : 'none',
              }}>
                <span style={{
                  marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 4,
                  flexShrink: 0, background: 'rgba(70,99,172,0.1)',
                  color: 'var(--ov-accent)', fontSize: 10, fontFamily: FF, fontWeight: 700,
                  padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  <Tag style={{ width: 10, height: 10 }} />
                  {catLabel}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: FF, fontSize: 13, color: 'var(--ov-text)', lineHeight: 1.55, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {content}
                  </p>
                  {item.source_excerpt && (
                    <p style={{ fontFamily: FF, fontSize: 12, color: 'var(--ov-muted)', marginTop: 2, fontStyle: 'italic', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                      &ldquo;{item.source_excerpt}&rdquo;
                    </p>
                  )}
                  <p style={{ fontFamily: FF, fontSize: 10, color: 'var(--ov-muted)', marginTop: 3 }}>
                    Verified {item.verified_at
                      ? new Date(item.verified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                      : new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {item.verified_by_role && ` by ${item.verified_by_role}`}
                  </p>
                </div>
                <CheckCircle2 style={{ width: 16, height: 16, color: '#5CB85C', flexShrink: 0, marginTop: 2 }} />
              </div>
            );
          })}

          {items.length === 0 && (
            <div style={{ padding: '24px 22px', textAlign: 'center' }}>
              <p style={{ fontFamily: FF, fontSize: 13, color: 'var(--ov-muted)' }}>
                No verified captures yet. Verify items from the dashboard to save them here.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

interface DashboardSessionsProps {
  query?: string;
}

export default function DashboardSessions({ query = '' }: DashboardSessionsProps) {
  const { parentName, familyId } = useSession();
  const [conversations, setConversations] = useState<SessionListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SessionListRow | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const PAGE_SIZE = 20;

  useEffect(() => {
    if (!familyId || familyId === 'unknown') {
      setError('No family profile set up yet.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    getSessionList(familyId, PAGE_SIZE).then(rows => {
      setConversations(rows);
      setHasMore(rows.length === PAGE_SIZE);
      setLoading(false);
    }).catch(err => {
      setError((err as Error).message);
      setLoading(false);
    });
  }, [familyId]);

  const loadMore = useCallback(async () => {
    if (!familyId || familyId === 'unknown' || loadingMore || !hasMore) return;
    const oldest = conversations[conversations.length - 1]?.created_at;
    if (!oldest) return;
    setLoadingMore(true);
    try {
      const more = await getSessionList(familyId, PAGE_SIZE, oldest);
      setConversations(prev => [...prev, ...more]);
      setHasMore(more.length === PAGE_SIZE);
    } catch { /* non-fatal */ } finally {
      setLoadingMore(false);
    }
  }, [familyId, conversations, loadingMore, hasMore]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(c => {
      const title = (c.call_summary_title ?? '').toLowerCase();
      const summary = (c.transcript_summary ?? '').toLowerCase();
      const date = formatDate(c.started_at).toLowerCase();
      return title.includes(q) || summary.includes(q) || date.includes(q);
    });
  }, [conversations, query]);

  // ── Detail view ────────────────────────────────────────────────────────────
  if (selected) {
    return (
      <div className="cn-stagger">
        <TranscriptView
          conv={selected}
          onBack={() => setSelected(null)}
          parentName={parentName || 'You'}
          familyId={familyId}
        />
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <div className="cn-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Title */}
      <div style={{ marginBottom: 6 }}>
        <h2 style={{ fontFamily: FF, fontSize: 22, fontWeight: 700, color: 'var(--ov-text)', margin: 0 }}>
          Conversations
        </h2>
        <p style={{ fontFamily: FF, fontSize: 14, color: 'var(--ov-muted)', margin: '4px 0 20px' }}>
          All Clara sessions with {parentName || 'you'}. Pinned sessions are kept forever — others auto-delete after 30 days.
        </p>
      </div>

      {/* Recently Captured */}
      <RecentlyCapturedPanel familyId={familyId} />

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 12 }}>
          <Loader2 style={{ width: 28, height: 28, color: 'var(--ov-accent)' }} className="animate-spin" />
          <p style={{ fontFamily: FF, fontSize: 14, color: 'var(--ov-muted)' }}>Loading conversations…</p>
        </div>
      )}

      {error && (
        <div style={{
          background: 'var(--ov-card-bg)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
          border: '1px solid var(--ov-card-border)', borderRadius: 18, padding: '18px 22px',
          boxShadow: 'var(--ov-shadow)', display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <AlertCircle style={{ width: 20, height: 20, color: '#FF5F52', flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ fontFamily: FF, fontWeight: 600, color: 'var(--ov-text)', marginBottom: 4 }}>Could not load conversations</p>
            <p style={{ fontFamily: FF, fontSize: 13, color: 'var(--ov-muted)' }}>{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div style={{
          background: 'var(--ov-card-bg)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
          border: '1px solid var(--ov-card-border)', borderRadius: 18, padding: '40px 22px',
          boxShadow: 'var(--ov-shadow)', textAlign: 'center',
        }}>
          <p style={{ fontFamily: FF, fontSize: 14, color: 'var(--ov-muted)' }}>
            {query ? 'No conversations match your search.' : 'No conversations recorded yet. Start a session with Clara to see them here.'}
          </p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Column headers */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr auto auto auto auto',
              gap: 16, padding: '0 18px 4px',
              fontFamily: FF, fontSize: 11, textTransform: 'uppercase',
              letterSpacing: '0.08em', color: 'var(--ov-muted)',
            }}>
              <span>Date</span>
              <span style={{ textAlign: 'right' }}>Duration</span>
              <span style={{ textAlign: 'right' }}>Messages</span>
              <span />
              <span />
            </div>

            {filtered.map((conv) => (
              <button
                key={conv.conversation_id}
                onClick={() => setSelected(conv)}
                style={{
                  width: '100%', textAlign: 'left',
                  background: 'var(--ov-card-bg)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
                  border: '1px solid var(--ov-card-border)', borderRadius: 18,
                  padding: '16px 18px', boxShadow: 'var(--ov-shadow)',
                  cursor: 'pointer', transition: 'transform 0.18s, box-shadow 0.18s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: 16, alignItems: 'center' }}>
                  {/* Date + summary */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <p style={{ fontFamily: FF, fontWeight: 600, color: 'var(--ov-text)', fontSize: 14, margin: 0 }}>
                        {conv.call_summary_title ?? formatDate(conv.started_at)}
                      </p>
                      {conv.is_pinned && (
                        <Pin style={{ width: 12, height: 12, color: 'var(--ov-accent)', flexShrink: 0 }} aria-label="Pinned" />
                      )}
                    </div>
                    {conv.transcript_summary && (
                      <p style={{ fontFamily: FF, fontSize: 12, color: 'var(--ov-muted)', marginTop: 2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                        {conv.transcript_summary}
                      </p>
                    )}
                    {!conv.call_summary_title && (
                      <p style={{ fontFamily: FF, fontSize: 12, color: 'var(--ov-muted)', marginTop: 2 }}>
                        {formatDate(conv.started_at)}
                      </p>
                    )}
                  </div>

                  {/* Duration */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: FF, fontSize: 13, color: 'var(--ov-muted)', whiteSpace: 'nowrap' }}>
                    <Clock style={{ width: 14, height: 14 }} />
                    {formatDuration(conv.duration_seconds)}
                  </div>

                  {/* Message count */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: FF, fontSize: 13, color: 'var(--ov-muted)', whiteSpace: 'nowrap' }}>
                    <MessageSquare style={{ width: 14, height: 14 }} />
                    {conv.message_count}
                  </div>

                  {/* TTL badge */}
                  <div style={{ fontFamily: FF, fontSize: 10, whiteSpace: 'nowrap' }}>
                    {conv.is_pinned ? (
                      <span style={{ color: 'var(--ov-accent)', fontWeight: 700 }}>Pinned</span>
                    ) : (
                      <span style={{ color: 'var(--ov-muted)', opacity: 0.6 }}>30d</span>
                    )}
                  </div>

                  {/* Arrow */}
                  <ChevronRight style={{ width: 16, height: 16, color: 'var(--ov-muted)' }} />
                </div>
              </button>
            ))}
          </div>

          {/* Load more */}
          {hasMore && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
              <button
                onClick={loadMore}
                disabled={loadingMore}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontFamily: FF, fontSize: 13, fontWeight: 600, color: 'var(--ov-accent)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  opacity: loadingMore ? 0.5 : 1,
                }}
              >
                {loadingMore && <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />}
                {loadingMore ? 'Loading…' : 'Load older conversations'}
              </button>
            </div>
          )}

          <p style={{ fontFamily: FF, fontSize: 10, color: 'var(--ov-muted)', textAlign: 'center', marginTop: 16, opacity: 0.55 }}>
            Conversations auto-delete after 30 days unless pinned · Pinned conversations and saved sections are kept permanently
          </p>
        </>
      )}
    </div>
  );
}
