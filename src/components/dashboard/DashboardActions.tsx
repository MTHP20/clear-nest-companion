import { useMemo, useState } from 'react';
import { useSession } from '@/contexts/SessionContext';
import type { ActionItem } from '@/contexts/SessionContext';

const FF = 'Figtree, system-ui, sans-serif';

const BANDS = [
  {
    key: 'red' as const,
    label: 'Do within 2 weeks',
    dotColor: '#FF5F52',
    cardBg: 'rgba(255,95,82,0.07)',
    cardBorder: 'rgba(255,95,82,0.18)',
    pillBg: 'rgba(255,95,82,0.12)',
    pillBorder: 'rgba(255,95,82,0.35)',
    pillColor: '#FF5F52',
  },
  {
    key: 'amber' as const,
    label: 'Do within 3 months',
    dotColor: '#F0C050',
    cardBg: 'rgba(240,192,80,0.07)',
    cardBorder: 'rgba(240,192,80,0.18)',
    pillBg: 'rgba(240,192,80,0.12)',
    pillBorder: 'rgba(240,192,80,0.35)',
    pillColor: '#F0C050',
  },
  {
    key: 'done' as const,
    label: 'Completed',
    dotColor: '#5CB85C',
    cardBg: 'rgba(92,184,92,0.07)',
    cardBorder: 'rgba(92,184,92,0.18)',
    pillBg: 'rgba(92,184,92,0.12)',
    pillBorder: 'rgba(92,184,92,0.35)',
    pillColor: '#5CB85C',
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
    <div style={{
      background: band.cardBg,
      border: `1px solid ${band.cardBorder}`,
      borderRadius: 16, padding: '16px 18px',
    }}>
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
        <span style={{
          width: 10, height: 10, borderRadius: '50%', flexShrink: 0, marginTop: 5,
          background: band.dotColor,
          boxShadow: `0 0 6px ${band.dotColor}99`,
        }} />
        <p style={{
          fontFamily: FF, fontWeight: 600, fontSize: 14, color: 'var(--ov-text)',
          textDecoration: action.status === 'done' ? 'line-through' : 'none',
          opacity: action.status === 'done' ? 0.55 : 1, margin: 0, flex: 1,
        }}>
          {action.title}
        </p>
      </div>

      {/* Description */}
      <p style={{ fontFamily: FF, fontSize: 13, color: 'var(--ov-muted)', marginBottom: 12, paddingLeft: 18 }}>
        {action.description}
      </p>

      {/* Meta pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 18, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 11, fontFamily: FF, padding: '3px 10px', borderRadius: 20,
          background: 'rgba(94,207,207,0.12)', color: '#5ECFCF',
          border: '1px solid rgba(94,207,207,0.25)',
        }}>
          {childName} (Dad)
        </span>
        <span style={{
          fontSize: 11, fontFamily: FF, padding: '3px 10px', borderRadius: 20,
          background: 'rgba(240,192,80,0.12)', color: '#F0C050',
          border: '1px solid rgba(240,192,80,0.25)',
        }}>
          Due {dueLabel}
        </span>
      </div>

      {/* Actions row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 18, flexWrap: 'wrap' }}>
        <button
          onClick={() => updateActionStatus(action.id, nextStatus)}
          style={{
            fontFamily: FF, fontSize: 12, fontWeight: 600,
            padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
            border: 'none', transition: 'opacity 0.18s',
            background: action.status === 'done'
              ? 'var(--ov-inner)' : 'var(--ov-accent)',
            color: action.status === 'done' ? 'var(--ov-muted)' : 'white',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.8'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
        >
          {nextLabel}
        </button>

        {action.learnMoreUrl && (
          <a
            href={action.learnMoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: FF, fontSize: 12, color: 'var(--ov-accent)',
              textDecoration: 'none',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none'; }}
          >
            Open guidance
          </a>
        )}

        <button
          onClick={() => setEditingNote(v => !v)}
          style={{
            fontFamily: FF, fontSize: 12, color: 'var(--ov-muted)',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            transition: 'color 0.18s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--ov-text)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--ov-muted)'; }}
        >
          {editingNote ? 'Close note' : 'Add note'}
        </button>

        {action.status === 'in-progress' && (
          <span style={{ fontSize: 12, color: 'var(--ov-accent)', fontFamily: FF, fontWeight: 600 }}>
            ● In Progress
          </span>
        )}
      </div>

      {/* Note editor */}
      {editingNote && (
        <div style={{
          marginLeft: 18, marginTop: 14, paddingTop: 14,
          borderTop: '1px solid var(--ov-card-border)',
        }}>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={2}
            placeholder="Add progress notes for this task"
            style={{
              width: '100%', fontFamily: FF, fontSize: 13,
              border: '1px solid var(--ov-card-border)', borderRadius: 10,
              padding: '10px 12px', color: 'var(--ov-text)',
              background: 'var(--ov-inner)',
              resize: 'none', outline: 'none', boxSizing: 'border-box',
            }}
          />
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <button
              onClick={() => { onSaveNote(action.id, draft.trim()); setEditingNote(false); }}
              style={{
                fontFamily: FF, fontSize: 12, fontWeight: 600,
                padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                background: 'var(--ov-accent)', color: 'white', border: 'none',
              }}
            >
              Save note
            </button>
            <button
              onClick={() => setEditingNote(false)}
              style={{
                fontFamily: FF, fontSize: 12, color: 'var(--ov-muted)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Saved note */}
      {!editingNote && actionNotes[action.id] && (
        <p style={{
          marginLeft: 18, marginTop: 10,
          fontFamily: FF, fontSize: 12, color: 'var(--ov-muted)',
        }}>
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
    return actionItems.filter(a => {
      if (!q) return true;
      return a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q);
    });
  }, [actionItems, query]);

  const redItems = filtered.filter(a => a.severity === 'red' && a.status !== 'done');
  const amberItems = filtered.filter(a => a.severity === 'amber' && a.status !== 'done');
  const doneItems = filtered.filter(a => a.status === 'done');

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
    <div className="cn-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Title */}
      <div style={{ marginBottom: 4 }}>
        <h2 style={{ fontFamily: FF, fontSize: 22, fontWeight: 700, color: 'var(--ov-text)', margin: 0 }}>
          Tasks
        </h2>
        <p style={{ fontFamily: FF, fontSize: 14, color: 'var(--ov-muted)', margin: '4px 0 0' }}>
          Prioritised by urgency. Red items first, then amber.
        </p>
      </div>

      {/* Notice */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        background: 'var(--ov-inner)',
        border: '1px solid var(--ov-card-border)',
        borderRadius: 14, padding: '12px 16px', margin: '16px 0 28px',
      }}>
        <span style={{ color: 'var(--ov-accent)', fontSize: 15, marginTop: 1, flexShrink: 0 }}>ℹ</span>
        <p style={{ fontFamily: FF, fontSize: 12, color: 'var(--ov-muted)', lineHeight: 1.6, margin: 0 }}>
          <strong style={{ color: 'var(--ov-text)' }}>Not legal or financial advice.</strong>{' '}
          These tasks are organisational reminders only. Always seek independent legal advice for matters relating to wills, Power of Attorney, and estate planning. Always seek independent financial advice for financial decisions. Pannon Ltd is not a law firm or FCA-authorised adviser.
        </p>
      </div>

      {/* Timeline */}
      <div style={{ position: 'relative' }}>
        {/* Vertical line */}
        <div style={{
          position: 'absolute', left: 20, top: 20, bottom: 20, width: 2,
          background: 'var(--ov-card-border)',
        }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
          {bandItems.map(({ band, items }) => (
            <div key={band.key} style={{ position: 'relative', paddingLeft: 52 }}>
              {/* Timeline dot */}
              <div style={{
                position: 'absolute', left: 12, top: 4,
                width: 18, height: 18, borderRadius: '50%',
                background: band.dotColor,
                boxShadow: `0 0 10px ${band.dotColor}88`,
                border: '2px solid var(--ov-card-bg)',
              }} />

              {/* Band header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{
                  fontFamily: FF, fontSize: 12, fontWeight: 700,
                  padding: '4px 12px', borderRadius: 20,
                  background: band.pillBg,
                  border: `1px solid ${band.pillBorder}`,
                  color: band.pillColor,
                }}>
                  {band.label}
                </span>
                <span style={{ fontFamily: FF, fontSize: 12, color: 'var(--ov-muted)' }}>
                  {items.length} {items.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              {/* Items */}
              {items.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {items.map(action => (
                    <ActionCard
                      key={action.id}
                      action={action}
                      band={band}
                      actionNotes={actionNotes}
                      onSaveNote={saveNote}
                    />
                  ))}
                </div>
              ) : (
                <p style={{ fontFamily: FF, fontSize: 14, color: 'var(--ov-muted)', fontStyle: 'italic' }}>
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
