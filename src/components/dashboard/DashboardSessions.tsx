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
      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-1 cursor-pointer group`}
      onClick={onSelect}
    >
      {isFirstInGroup && (
        <span className={`text-xs font-body text-muted-foreground mb-1 px-1 ${isUser ? 'text-right' : 'text-left'}`}>
          {isUser ? userName : agentName}
        </span>
      )}
      <div
        className={`
          max-w-[75%] px-4 py-2.5 font-body text-[15px] leading-relaxed transition-all
          ${isSelected ? 'ring-2 ring-primary ring-offset-1' : ''}
          ${isUser
            ? 'bg-primary text-primary-foreground rounded-[20px] rounded-br-[5px]'
            : 'bg-muted text-foreground rounded-[20px] rounded-bl-[5px]'
          }
        `}
      >
        {message}
      </div>
      {isSelected && (
        <span className="text-[10px] text-primary mt-0.5 px-1 font-body">
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
    <div className="cn-card mb-4 border border-primary/20">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-body font-semibold text-primary"
      >
        <span className="flex items-center gap-1.5">
          <Bookmark className="w-4 h-4" />
          {sections.length} Saved Section{sections.length !== 1 ? 's' : ''}
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="border-t border-border divide-y divide-border">
          {sections.map((s, i) => (
            <div key={i} className="px-4 py-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-body text-xs font-semibold text-primary mb-1">{s.label}</p>
                <p className="font-body text-sm text-foreground leading-relaxed line-clamp-3">
                  &ldquo;{s.excerpt}&rdquo;
                </p>
                <p className="font-body text-[10px] text-muted-foreground mt-1">
                  Saved {new Date(s.pinned_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <button
                onClick={() => onRemove(i)}
                className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-0.5"
                aria-label="Remove saved section"
              >
                <Trash2 className="w-3.5 h-3.5" />
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-body text-primary hover:text-primary/70 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="h-4 w-px bg-border" />
        <div className="flex-1">
          <p className="font-body font-semibold text-foreground text-sm">
            {conv.call_summary_title ?? formatDate(conv.started_at)}
          </p>
          <p className="font-body text-xs text-muted-foreground">
            {formatDuration(conv.duration_seconds)} · {conv.message_count} messages
            {isPinned && <span className="ml-2 text-primary">· Pinned — won't auto-delete</span>}
          </p>
        </div>

        {/* Save section button */}
        {selectedTurnIndex !== null && (
          <button
            onClick={handleSaveSection}
            disabled={savingSection}
            className="flex items-center gap-1.5 text-sm font-body font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/80 transition-colors disabled:opacity-60"
          >
            {savingSection ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bookmark className="w-3.5 h-3.5" />}
            Save Section
          </button>
        )}

        {/* Pin button */}
        <button
          onClick={handlePin}
          disabled={pinning}
          title={isPinned ? 'Unpin — will auto-delete after 30 days' : 'Pin — save forever'}
          className={`flex items-center gap-1.5 text-sm font-body font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60
            ${isPinned ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'bg-accent text-accent-foreground hover:bg-primary hover:text-primary-foreground'}`}
        >
          {pinning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
            isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
          {isPinned ? 'Unpin' : 'Pin'}
        </button>
      </div>

      {/* Summary */}
      {conv.transcript_summary && (
        <div className="bg-primary/8 border border-primary/20 rounded-xl px-4 py-3 mb-4">
          <p className="text-xs font-body uppercase tracking-widest text-primary mb-1">Summary</p>
          <p className="font-body text-sm text-foreground leading-relaxed">{conv.transcript_summary}</p>
        </div>
      )}

      {/* Pinned sections */}
      <PinnedSectionsPanel sections={sections} onRemove={handleRemoveSection} />

      {/* Select-a-turn hint */}
      {!loading && !error && turns.length > 0 && selectedTurnIndex === null && (
        <p className="font-body text-xs text-muted-foreground mb-3 text-center">
          Tap any message to select it, then click "Save Section" to bookmark it permanently.
        </p>
      )}

      {/* Chat area */}
      <div className="cn-card flex-1 overflow-y-auto">
        <div className="flex justify-center mb-4">
          <span className="text-xs font-body bg-muted text-muted-foreground px-3 py-1 rounded-full">
            {formatDate(conv.started_at)}
          </span>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <p className="font-body text-sm text-muted-foreground">Loading transcript…</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <AlertCircle className="w-6 h-6 text-alert" />
            <p className="font-body text-sm text-muted-foreground">{error}</p>
          </div>
        )}

        {!loading && !error && turns.length === 0 && (
          <div className="text-center py-12">
            <p className="font-body text-sm text-muted-foreground">
              Full transcript not available for this session.
            </p>
            <p className="font-body text-xs text-muted-foreground mt-1 opacity-60">
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
          <div className="flex justify-center mt-4">
            <span className="text-xs font-body bg-muted text-muted-foreground px-3 py-1 rounded-full">
              Conversation ended · {formatDuration(conv.duration_seconds)}
            </span>
          </div>
        )}
      </div>

      {/* 30-day notice */}
      {!isPinned && (
        <p className="font-body text-[10px] text-muted-foreground text-center mt-3 opacity-55">
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
    <div className="cn-card mb-6 border border-primary/20">
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4"
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
          <span className="font-body font-semibold text-foreground text-sm">
            Recently Captured
          </span>
          {!loading && (
            <span className="ml-1 text-xs font-body text-muted-foreground">
              · {items.length} verified item{items.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {loading
          ? <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          : open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />
        }
      </button>

      {open && !loading && (
        <div className="border-t border-border divide-y divide-border">
          {items.map(item => {
            const content = (item.value_json as { content?: string })?.content ?? '';
            const catLabel = CATEGORY_LABELS[item.category] ?? item.category.replace(/_/g, ' ');
            return (
              <div key={item.id} className="px-5 py-3 flex items-start gap-3">
                {/* Category pill */}
                <span className="mt-0.5 inline-flex items-center gap-1 shrink-0 bg-primary/10 text-primary text-[10px] font-body font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide">
                  <Tag className="w-2.5 h-2.5" />
                  {catLabel}
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm text-foreground leading-relaxed line-clamp-2">
                    {content}
                  </p>
                  {item.source_excerpt && (
                    <p className="font-body text-xs text-muted-foreground mt-0.5 italic line-clamp-1">
                      &ldquo;{item.source_excerpt}&rdquo;
                    </p>
                  )}
                  <p className="font-body text-[10px] text-muted-foreground mt-1">
                    Verified {item.verified_at
                      ? new Date(item.verified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                      : new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {item.verified_by_role && ` by ${item.verified_by_role}`}
                  </p>
                </div>

                {/* Verified badge */}
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
              </div>
            );
          })}

          {items.length === 0 && (
            <div className="px-5 py-6 text-center">
              <p className="font-body text-sm text-muted-foreground">
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
    <div className="cn-stagger">
      <h2 className="font-display text-[22px] font-semibold mb-2 text-foreground">
        Conversations
      </h2>
      <p className="font-body text-sm text-muted-foreground mb-6">
        All Clara sessions with {parentName || 'you'}. Pinned sessions are kept forever — others auto-delete after 30 days.
      </p>

      {/* Recently Captured — verified items from extracted_data */}
      <RecentlyCapturedPanel familyId={familyId} />

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-7 h-7 text-primary animate-spin" />
          <p className="font-body text-sm text-muted-foreground">Loading conversations…</p>
        </div>
      )}

      {error && (
        <div className="cn-card flex items-start gap-3 text-sm">
          <AlertCircle className="w-5 h-5 text-alert shrink-0 mt-0.5" />
          <div>
            <p className="font-body font-semibold text-foreground mb-1">Could not load conversations</p>
            <p className="font-body text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="cn-card text-center py-10">
          <p className="font-body text-muted-foreground">
            {query ? 'No conversations match your search.' : 'No conversations recorded yet. Start a session with Clara to see them here.'}
          </p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <>
          <div className="space-y-2">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 pb-1 text-xs font-body uppercase tracking-widest text-muted-foreground">
              <span>Date</span>
              <span className="text-right">Duration</span>
              <span className="text-right">Messages</span>
              <span />
              <span />
            </div>

            {filtered.map((conv) => (
              <button
                key={conv.conversation_id}
                onClick={() => setSelected(conv)}
                className="w-full text-left cn-card cn-card-hover group"
              >
                <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center">
                  {/* Date + summary */}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-body font-semibold text-foreground group-hover:text-primary transition-colors">
                        {conv.call_summary_title ?? formatDate(conv.started_at)}
                      </p>
                      {conv.is_pinned && (
                        <Pin className="w-3 h-3 text-primary shrink-0" aria-label="Pinned" />
                      )}
                    </div>
                    {conv.transcript_summary && (
                      <p className="font-body text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {conv.transcript_summary}
                      </p>
                    )}
                    {!conv.call_summary_title && (
                      <p className="font-body text-xs text-muted-foreground mt-0.5">
                        {formatDate(conv.started_at)}
                      </p>
                    )}
                  </div>

                  {/* Duration */}
                  <div className="flex items-center gap-1 text-sm font-body text-muted-foreground whitespace-nowrap">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDuration(conv.duration_seconds)}
                  </div>

                  {/* Message count */}
                  <div className="flex items-center gap-1 text-sm font-body text-muted-foreground whitespace-nowrap">
                    <MessageSquare className="w-3.5 h-3.5" />
                    {conv.message_count}
                  </div>

                  {/* TTL badge */}
                  <div className="text-[10px] font-body whitespace-nowrap">
                    {conv.is_pinned ? (
                      <span className="text-primary font-semibold">Pinned</span>
                    ) : (
                      <span className="text-muted-foreground opacity-60">30d</span>
                    )}
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </button>
            ))}
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center mt-6">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 text-sm font-body font-medium text-primary hover:text-primary/70 transition-colors disabled:opacity-50"
              >
                {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loadingMore ? 'Loading…' : 'Load older conversations'}
              </button>
            </div>
          )}

          <p className="font-body text-[10px] text-muted-foreground text-center mt-4 opacity-55">
            Conversations auto-delete after 30 days unless pinned · Pinned conversations and saved sections are kept permanently
          </p>
        </>
      )}
    </div>
  );
}
