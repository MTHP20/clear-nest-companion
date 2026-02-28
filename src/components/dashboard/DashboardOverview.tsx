import { useSession } from '@/contexts/SessionContext';

const CATEGORY_LABELS: Record<string, string> = {
  bank_accounts: 'Bank Accounts',
  financial_accounts: 'Financial Accounts',
  documents: 'Documents',
  care_wishes: 'Care Wishes',
  property: 'Property',
  key_contacts: 'Key Contacts',
};

export default function DashboardOverview() {
  const { capturedItems, actionItems, sessions } = useSession();
  const activeActions = actionItems.filter(a => a.status !== 'done').length;

  return (
    <div className="cn-stagger">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Items Captured', value: capturedItems.length },
          { label: 'Actions Required', value: activeActions, amber: true },
          { label: 'Sessions Completed', value: sessions.length },
          { label: 'Last Updated', value: 'Today' },
        ].map((stat) => (
          <div key={stat.label} className="cn-card cn-card-hover">
            <p className="font-body text-sm text-muted-foreground mb-1">{stat.label}</p>
            <p className={`font-display text-3xl font-bold ${stat.amber ? 'text-alert' : 'text-foreground'}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Recently Captured */}
        <div className="lg:col-span-3">
          <h2 className="font-display text-xl font-semibold mb-4 text-foreground">Recently Captured</h2>
          <div className="space-y-3 cn-stagger">
            {capturedItems.slice(0, 4).map(item => (
              <div key={item.id} className="cn-card cn-card-hover cn-slide-in">
                <p className="text-xs font-body uppercase tracking-widest text-primary mb-2">
                  {CATEGORY_LABELS[item.category] || item.category}
                </p>
                <p className="font-body text-foreground mb-2">{item.content}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${item.confidence === 'clear' ? 'bg-primary' : 'bg-alert'}`} />
                    <span className="text-sm text-muted-foreground font-body">
                      {item.confidence === 'clear' ? 'Clear' : 'Needs follow-up'}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground font-body">
                    {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Urgent Actions */}
        <div className="lg:col-span-2">
          <div className="bg-alert/10 rounded-lg p-4 mb-4">
            <h2 className="font-display text-xl font-semibold text-alert-foreground">Urgent Actions</h2>
          </div>
          <div className="space-y-3">
            {actionItems.filter(a => a.status !== 'done').slice(0, 3).map(action => (
              <div key={action.id} className="cn-card-amber cn-card-hover">
                <div className="flex items-start gap-2 mb-2">
                  <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${action.severity === 'red' ? 'bg-destructive' : 'bg-alert'}`} />
                  <p className="font-body font-semibold text-foreground">{action.title}</p>
                </div>
                <p className="font-body text-sm text-muted-foreground mb-2 line-clamp-2">{action.description}</p>
                {action.learnMoreUrl && (
                  <a href={action.learnMoreUrl} target="_blank" rel="noopener noreferrer" className="font-body text-sm text-primary hover:underline">
                    What to do →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
