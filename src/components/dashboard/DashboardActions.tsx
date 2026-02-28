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

function ActionCard({ action, band }: { action: ActionItem; band: typeof BANDS[number] }) {
  const { updateActionStatus } = useSession();

  const nextLabel =
    action.status === 'todo' ? 'Mark In Progress' :
    action.status === 'in-progress' ? 'Mark Done' : 'Reopen';

  const nextStatus: ActionItem['status'] =
    action.status === 'todo' ? 'in-progress' :
    action.status === 'in-progress' ? 'done' : 'todo';

  return (
    <div className={`rounded-xl border ${band.border} ${band.bg} p-4`}>
      <div className="flex items-start gap-2 mb-2">
        <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${band.dot}`} />
        <p className={`font-body font-semibold text-foreground ${action.status === 'done' ? 'line-through opacity-60' : ''}`}>
          {action.title}
        </p>
      </div>
      <p className="font-body text-sm text-muted-foreground mb-3 ml-4">{action.description}</p>
      <div className="flex items-center gap-3 ml-4">
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
            Learn more →
          </a>
        )}
        {action.status === 'in-progress' && (
          <span className="text-xs text-primary font-body font-medium">● In Progress</span>
        )}
      </div>
    </div>
  );
}

export default function DashboardActions() {
  const { actionItems } = useSession();

  const redItems = actionItems.filter(a => a.severity === 'red' && a.status !== 'done');
  const amberItems = actionItems.filter(a => a.severity === 'amber' && a.status !== 'done');
  const doneItems = actionItems.filter(a => a.status === 'done');

  const bandItems = [
    { band: BANDS[0], items: redItems },
    { band: BANDS[1], items: amberItems },
    { band: BANDS[2], items: doneItems },
  ];

  return (
    <div className="cn-stagger">
      <h2 className="font-display text-[22px] font-semibold mb-1 text-foreground">Action Required</h2>
      <p className="font-body text-muted-foreground mb-8">Prioritised by urgency — address red items first</p>

      {/* Urgency Timeline */}
      <div className="relative">
        {/* Vertical rail */}
        <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-border" />

        <div className="space-y-10">
          {bandItems.map(({ band, items }) => (
            <div key={band.key} className="relative pl-14">
              {/* Timeline dot */}
              <div className={`absolute left-[13px] top-1 w-5 h-5 rounded-full ${band.dot} border-2 border-card shadow-sm`} />

              {/* Band header */}
              <div className="flex items-center gap-3 mb-4">
                <span className={`font-body text-xs font-semibold px-2.5 py-1 rounded-full ${band.pill}`}>
                  {band.label}
                </span>
                <span className="font-body text-xs text-muted-foreground">
                  {items.length} {items.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              {/* Action cards */}
              {items.length > 0 ? (
                <div className="space-y-3">
                  {items.map(action => (
                    <ActionCard key={action.id} action={action} band={band} />
                  ))}
                </div>
              ) : (
                <p className="font-body text-sm text-muted-foreground italic">
                  {band.key === 'done' ? 'No completed actions yet.' : 'Nothing in this category — great!'}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
