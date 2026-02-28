import { useEffect, useMemo, useState } from 'react';
import { useSession } from '@/contexts/SessionContext';
import { ArrowLeft, Clock, MessageSquare, ChevronRight, Loader2, AlertCircle } from 'lucide-react';

// ─── ElevenLabs API types ───────────────────────────────────────────────────

interface ELConversation {
  conversation_id: string;
  agent_id: string;
  start_time_unix_secs: number;
  call_duration_secs: number;
  message_count: number;
  status: string;
  call_successful: string;
  transcript_summary?: string;
  call_summary_title?: string;
}

interface ELTranscriptTurn {
  role: 'user' | 'agent';
  message?: string;
  time_in_call_secs: number;
  tool_calls?: unknown[];
}

interface ELConversationDetail {
  conversation_id: string;
  transcript: ELTranscriptTurn[];
  metadata?: {
    start_time_unix_secs?: number;
    call_duration_secs?: number;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY as string;
const AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID as string;
const BASE = 'https://api.elevenlabs.io/v1/convai/conversations';

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDate(unixSecs: number): string {
  return new Date(unixSecs * 1000).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTime(unixSecs: number): string {
  return new Date(unixSecs * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── iMessage bubble ────────────────────────────────────────────────────────

function Bubble({
  role,
  message,
  userName,
  agentName,
  isFirstInGroup,
}: {
  role: 'user' | 'agent';
  message: string;
  userName: string;
  agentName: string;
  isFirstInGroup: boolean;
}) {
  const isUser = role === 'user';
  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-1`}>
      {isFirstInGroup && (
        <span className={`text-xs font-body text-muted-foreground mb-1 px-1 ${isUser ? 'text-right' : 'text-left'}`}>
          {isUser ? userName : agentName}
        </span>
      )}
      <div
        className={`
          max-w-[75%] px-4 py-2.5 font-body text-[15px] leading-relaxed
          ${isUser
            ? 'bg-primary text-primary-foreground rounded-[20px] rounded-br-[5px]'
            : 'bg-muted text-foreground rounded-[20px] rounded-bl-[5px]'
          }
        `}
      >
        {message}
      </div>
    </div>
  );
}

// ─── Transcript view ─────────────────────────────────────────────────────────

function TranscriptView({
  conv,
  onBack,
  parentName,
}: {
  conv: ELConversation;
  onBack: () => void;
  parentName: string;
}) {
  const [detail, setDetail] = useState<ELConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${BASE}/${conv.conversation_id}`, {
      headers: { 'xi-api-key': API_KEY },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`ElevenLabs error ${r.status}`);
        return r.json();
      })
      .then((data: ELConversationDetail) => {
        if (!cancelled) {
          setDetail(data);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [conv.conversation_id]);

  // Only keep turns that have actual message text (skip tool calls etc.)
  const turns = useMemo(
    () => (detail?.transcript ?? []).filter((t) => t.message && t.message.trim().length > 0),
    [detail]
  );

  // Group consecutive turns to show name only at start of each group
  const turnsWithGroupFlag = useMemo(() =>
    turns.map((turn, i) => ({
      ...turn,
      isFirstInGroup: i === 0 || turns[i - 1].role !== turn.role,
    })),
    [turns]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-body text-primary hover:text-primary/70 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="h-4 w-px bg-border" />
        <div>
          <p className="font-body font-semibold text-foreground text-sm">
            {formatDate(conv.start_time_unix_secs)}
          </p>
          <p className="font-body text-xs text-muted-foreground">
            {formatDuration(conv.call_duration_secs)} · {conv.message_count} messages
          </p>
        </div>
      </div>

      {/* Summary if available */}
      {conv.transcript_summary && (
        <div className="bg-primary/8 border border-primary/20 rounded-xl px-4 py-3 mb-4">
          <p className="text-xs font-body uppercase tracking-widest text-primary mb-1">Summary</p>
          <p className="font-body text-sm text-foreground leading-relaxed">{conv.transcript_summary}</p>
        </div>
      )}

      {/* Chat area */}
      <div className="cn-card flex-1 overflow-y-auto">
        {/* Date chip at top */}
        <div className="flex justify-center mb-4">
          <span className="text-xs font-body bg-muted text-muted-foreground px-3 py-1 rounded-full">
            {formatDate(conv.start_time_unix_secs)}
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

        {!loading && !error && turnsWithGroupFlag.length === 0 && (
          <div className="text-center py-12">
            <p className="font-body text-sm text-muted-foreground">No transcript available for this conversation.</p>
          </div>
        )}

        {!loading && !error && turnsWithGroupFlag.map((turn, i) => (
          <Bubble
            key={i}
            role={turn.role}
            message={turn.message!}
            userName={parentName}
            agentName="Clara"
            isFirstInGroup={turn.isFirstInGroup}
          />
        ))}

        {/* End chip */}
        {!loading && !error && turnsWithGroupFlag.length > 0 && (
          <div className="flex justify-center mt-4">
            <span className="text-xs font-body bg-muted text-muted-foreground px-3 py-1 rounded-full">
              Conversation ended · {formatDuration(conv.call_duration_secs)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

interface DashboardSessionsProps {
  query?: string;
}

export default function DashboardSessions({ query = '' }: DashboardSessionsProps) {
  const { parentName } = useSession();
  const [conversations, setConversations] = useState<ELConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ELConversation | null>(null);

  useEffect(() => {
    if (!API_KEY || !AGENT_ID) {
      setError('ElevenLabs API key or Agent ID not configured.');
      setLoading(false);
      return;
    }

    fetch(`${BASE}?agent_id=${AGENT_ID}&page_size=50`, {
      headers: { 'xi-api-key': API_KEY },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`ElevenLabs error ${r.status}`);
        return r.json();
      })
      .then((data: { conversations: ELConversation[] }) => {
        setConversations(data.conversations ?? []);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const dateStr = formatDate(c.start_time_unix_secs).toLowerCase();
      const summary = (c.transcript_summary ?? '').toLowerCase();
      const title = (c.call_summary_title ?? '').toLowerCase();
      return dateStr.includes(q) || summary.includes(q) || title.includes(q);
    });
  }, [conversations, query]);

  // ── Transcript detail view ─────────────────────────────────────────────────
  if (selected) {
    return (
      <div className="cn-stagger">
        <TranscriptView
          conv={selected}
          onBack={() => setSelected(null)}
          parentName={parentName || 'Narayan'}
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
        All Clara sessions with {parentName || 'Narayan'}. Click any row to read the full transcript.
      </p>

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
            {query ? 'No conversations match your search.' : 'No conversations recorded yet.'}
          </p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-2">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 pb-1 text-xs font-body uppercase tracking-widest text-muted-foreground">
            <span>Date</span>
            <span className="text-right">Duration</span>
            <span className="text-right">Messages</span>
            <span />
          </div>

          {filtered.map((conv) => (
            <button
              key={conv.conversation_id}
              onClick={() => setSelected(conv)}
              className="w-full text-left cn-card cn-card-hover group"
            >
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center">
                {/* Date + summary */}
                <div>
                  <p className="font-body font-semibold text-foreground group-hover:text-primary transition-colors">
                    {formatDate(conv.start_time_unix_secs)}
                  </p>
                  {conv.call_summary_title && (
                    <p className="font-body text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {conv.call_summary_title}
                    </p>
                  )}
                  {conv.transcript_summary && !conv.call_summary_title && (
                    <p className="font-body text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {conv.transcript_summary}
                    </p>
                  )}
                </div>

                {/* Duration */}
                <div className="flex items-center gap-1 text-sm font-body text-muted-foreground whitespace-nowrap">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDuration(conv.call_duration_secs)}
                </div>

                {/* Message count */}
                <div className="flex items-center gap-1 text-sm font-body text-muted-foreground whitespace-nowrap">
                  <MessageSquare className="w-3.5 h-3.5" />
                  {conv.message_count}
                </div>

                {/* Arrow */}
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
