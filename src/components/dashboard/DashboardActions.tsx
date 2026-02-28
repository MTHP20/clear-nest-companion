import { useMemo, useState } from 'react';
import { useSession } from '@/contexts/SessionContext';
import type { ActionItem } from '@/contexts/SessionContext';

const BANDS = [
  {
    key: 'red' as const,
    label: 'Do within 2 weeks',
    dot: 'bg-red-500',
    border: 'border-red-300',
    bg: 'bg-red-50',
    pill: 'bg-red-100 text-red-700',
  },
  {
    key: 'amber' as const,
    label: 'Do within 3 months',
    dot: 'bg-amber-500',
    border: 'border-amber-300',
    bg: 'bg-amber-50',
    pill: 'bg-amber-100 text-amber-700',
  },
  {
    key: 'done' as const,
    label: 'Completed',
    dot: 'bg-green-500',
    border: 'border-green-300',
    bg: 'bg-green-50',
    pill: 'bg-green-100 text-green-700',
  },
];

function loadActionNotes(): Record<string, string> {
  try {
    const raw = localStorage.getItem('cn-action-notes');
    return raw ? JSON.parse(raw) as Record<string, string> : {};
  } catch {
    return {};
  }
}

function saveActionNotes(notes: Record<string, string>) {
  localStorage.setItem('cn-action-notes', JSON.stringify(notes));
}

function ActionCard({
  action,
  band,
  actionNotes,
  onSaveNote,
}: {
  action: ActionItem;
  band: typeof BANDS[number];
  actionNotes: Record<string, string>;
  onSaveNote: (id: string, note: string) => void;
}) {
  const { updateActionStatus, childName } = useSession();
  const [draft, setDraft] = useState(actionNotes[action.id] ?? '');
  const [editingNote, setEditingNote] = useState(false);

  const nextLabel =
    action.status === 'todo' ? 'Mark In Progress' :
    action.status === 'in-progress' ? 'Mark Done' : 'Reopen';

  const nextStatus: ActionItem['status'] =
    action.status === 'todo' ? 'in-progress' :
    action.status === 'in-progress' ? 'done' : 'todo';

  const dueLabel = action.dueDate
    ? new Date(`${action.dueDate}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'TBD';

  return (
    <div className={`rounded-xl border ${band.border} ${band.bg} p-4`}>
      <div className="flex items-start gap-2 mb-2">
        <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${band.dot}`} />
        <p className={`font-body font-semibold text-foreground ${action.status === 'done' ? 'line-through opacity-60' : ''}`}>
          {action.title}
        </p>
      </div>
      <p className="font-body text-sm text-muted-foreground mb-3 ml-4">{action.description}</p>

      <div className="ml-4 flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs font-body px-2 py-1 rounded-full bg-sky-100 text-sky-700">
          {childName} (Dad)
        </span>
        <span className="text-xs font-body px-2 py-1 rounded-full bg-amber-100 text-amber-700">
          Due {dueLabel}
        </span>
      </div>

      <div className="flex items-center gap-2 ml-4 flex-wrap">
        <button
          onClick={() => updateActionStatus(action.id, nextStatus)}
          className={`font-body text-xs font-medium px-3 py-1.5 rounded-md transition-opacity hover:opacity-80 ${
            action.status === 'done'
              ? 'bg-muted text-muted-foreground'
              : 'bg-primary text-primary-foreground'
          }`}
        >
          {nextLabel}
        </button>
        {action.learnMoreUrl && (
          <a
            href={action.learnMoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-body text-xs text-primary hover:underline"
          >
            Open guidance
          </a>
        )}
        <button
          onClick={() => setEditingNote((v) => !v)}
          className="font-body text-xs text-muted-foreground hover:text-foreground"
        >
          {editingNote ? 'Close note' : 'Add note'}
        </button>
        {action.status === 'in-progress' && (
          <span className="text-xs text-primary font-body font-medium">● In Progress</span>
        )}
      </div>

      {editingNote && (
        <div className="ml-4 mt-3 pt-3 border-t border-border">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder="Add progress notes for this task"
            className="w-full font-body text-sm border border-border rounded-lg px-3 py-2 text-foreground bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => {
                onSaveNote(action.id, draft.trim());
                setEditingNote(false);
              }}
              className="font-body text-xs font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:opacity-90"
            >
              Save note
            </button>
            <button
              onClick={() => setEditingNote(false)}
              className="font-body text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!editingNote && actionNotes[action.id] && (
        <p className="ml-4 mt-3 text-xs font-body text-muted-foreground">
          Note: {actionNotes[action.id]}
        </p>
      )}
    </div>
  );
}

interface DashboardActionsProps {
  query?: string;
}

export default function DashboardActions({ query = '' }: DashboardActionsProps) {
  const { actionItems } = useSession();
  const [actionNotes, setActionNotes] = useState<Record<string, string>>(loadActionNotes);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return actionItems.filter((a) => {
      if (!q) return true;
      return a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q);
    });
  }, [actionItems, query]);

  const redItems = filtered.filter((a) => a.severity === 'red' && a.status !== 'done');
  const amberItems = filtered.filter((a) => a.severity === 'amber' && a.status !== 'done');
  const doneItems = filtered.filter((a) => a.status === 'done');

  const bandItems = [
    { band: BANDS[0], items: redItems },
    { band: BANDS[1], items: amberItems },
    { band: BANDS[2], items: doneItems },
  ];

  const saveNote = (id: string, note: string) => {
    const next = { ...actionNotes, [id]: note };
    setActionNotes(next);
    saveActionNotes(next);
  };

  return (
    <div className="cn-stagger">
      <h2 className="font-display text-[22px] font-semibold mb-1 text-foreground">Tasks</h2>
      <p className="font-body text-muted-foreground mb-8">Prioritised by urgency. Red items first, then amber.</p>

      <div className="relative">
        <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-border" />

        <div className="space-y-10">
          {bandItems.map(({ band, items }) => (
            <div key={band.key} className="relative pl-14">
              <div className={`absolute left-[13px] top-1 w-5 h-5 rounded-full ${band.dot} border-2 border-card shadow-sm`} />

              <div className="flex items-center gap-3 mb-4">
                <span className={`font-body text-xs font-semibold px-2.5 py-1 rounded-full ${band.pill}`}>
                  {band.label}
                </span>
                <span className="font-body text-xs text-muted-foreground">
                  {items.length} {items.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              {items.length > 0 ? (
                <div className="space-y-3">
                  {items.map((action) => (
                    <ActionCard key={action.id} action={action} band={band} actionNotes={actionNotes} onSaveNote={saveNote} />
                  ))}
                </div>
              ) : (
                <p className="font-body text-sm text-muted-foreground italic">
                  {band.key === 'done' ? 'No completed tasks yet.' : 'Nothing in this category right now.'}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
