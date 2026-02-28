import { useSession } from '@/contexts/SessionContext';
import { Check } from 'lucide-react';

export default function DashboardActions() {
  const { actionItems, updateActionStatus } = useSession();
  const active = actionItems.filter(a => a.status !== 'done');
  const done = actionItems.filter(a => a.status === 'done');

  const nextStatus = (current: string) => {
    if (current === 'todo') return 'in-progress' as const;
    if (current === 'in-progress') return 'done' as const;
    return 'todo' as const;
  };

  const statusLabel = (status: string) => {
    if (status === 'todo') return 'Mark as In Progress';
    if (status === 'in-progress') return 'Mark as Done';
    return 'Reopen';
  };

  return (
    <div className="cn-stagger">
      <div className="bg-alert/10 rounded-lg p-4 mb-6">
        <h2 className="font-display text-xl font-semibold text-alert-foreground">These need attention</h2>
      </div>

      <div className="space-y-4">
        {active.map(action => (
          <div key={action.id} className="cn-card-amber cn-card-hover">
            <div className="flex items-start gap-2 mb-3">
              <span className={`w-3 h-3 rounded-full mt-1 shrink-0 ${action.severity === 'red' ? 'bg-destructive' : 'bg-alert'}`} />
              <h3 className="font-body text-lg font-semibold text-foreground">{action.title}</h3>
            </div>
            <p className="font-body text-foreground mb-4 leading-relaxed">{action.description}</p>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => updateActionStatus(action.id, nextStatus(action.status))}
                className="bg-accent text-accent-foreground font-body text-sm font-medium py-2 px-4 rounded-lg hover:bg-primary transition-colors"
              >
                {statusLabel(action.status)}
              </button>
              {action.learnMoreUrl && (
                <a href={action.learnMoreUrl} target="_blank" rel="noopener noreferrer" className="font-body text-sm text-primary hover:underline">
                  Learn More →
                </a>
              )}
              {action.status === 'in-progress' && (
                <span className="text-sm text-primary font-body font-medium">● In Progress</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {done.length > 0 && (
        <div className="mt-8">
          <h3 className="font-display text-lg text-muted-foreground mb-4">Completed</h3>
          <div className="space-y-3 opacity-60">
            {done.map(action => (
              <div key={action.id} className="cn-card flex items-center gap-3">
                <Check className="w-5 h-5 text-primary shrink-0" />
                <span className="font-body text-foreground line-through">{action.title}</span>
                <button
                  onClick={() => updateActionStatus(action.id, 'todo')}
                  className="ml-auto text-sm text-muted-foreground hover:text-foreground font-body"
                >
                  Reopen
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
