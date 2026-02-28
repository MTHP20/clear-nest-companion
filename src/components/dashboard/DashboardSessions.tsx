import { useSession } from '@/contexts/SessionContext';

export default function DashboardSessions() {
  const { sessions } = useSession();

  return (
    <div className="cn-stagger">
      <h2 className="font-display text-[22px] font-semibold mb-6 text-foreground">Session History</h2>

      <div className="relative pl-8">
        {/* Timeline line */}
        <div className="absolute left-3 top-2 bottom-2 w-px bg-secondary" />

        <div className="space-y-6">
          {sessions.map(session => (
            <div key={session.id} className="relative">
              {/* Dot */}
              <div className="absolute -left-5 top-2 w-3 h-3 rounded-full bg-primary border-2 border-card" />

              <div className="cn-card cn-card-hover">
                <div className="flex items-center gap-2 mb-2">
                  <p className="font-body font-semibold text-foreground">
                    {session.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                  <span className="text-muted-foreground font-body">—</span>
                  <p className="font-body text-muted-foreground">
                    {session.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {session.duration}
                  </p>
                </div>
                <p className="font-body text-foreground mb-3">
                  {session.itemsCaptured} items captured. {session.actionsFlagged} actions flagged.
                </p>
                <button className="font-body text-sm text-primary hover:underline">
                  View Full Transcript
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
