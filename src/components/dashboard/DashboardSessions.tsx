import { useMemo } from 'react';
import { useSession } from '@/contexts/SessionContext';

interface DashboardSessionsProps {
  query?: string;
}

export default function DashboardSessions({ query = '' }: DashboardSessionsProps) {
  const { sessions } = useSession();
  const filteredSessions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter((session) => {
      if (!q) return true;
      const dateLabel = session.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).toLowerCase();
      return (
        dateLabel.includes(q)
        || session.duration.toLowerCase().includes(q)
        || String(session.itemsCaptured).includes(q)
        || String(session.actionsFlagged).includes(q)
      );
    });
  }, [sessions, query]);

  return (
    <div className="cn-stagger">
      <h2 className="font-display text-[22px] font-semibold mb-6 text-foreground">Conversations Timeline</h2>

      {filteredSessions.length === 0 ? (
        <div className="cn-card text-center py-8">
          <p className="font-body text-muted-foreground">No conversation sessions match your search yet.</p>
        </div>
      ) : (
        <div className="relative pl-8">
          <div className="absolute left-3 top-2 bottom-2 w-px bg-secondary" />

          <div className="space-y-6">
            {filteredSessions.map(session => (
              <div key={session.id} className="relative">
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
                  <p className="font-body text-foreground mb-2">
                    {session.itemsCaptured} items captured. {session.actionsFlagged} actions flagged.
                  </p>
                  <p className="font-body text-sm text-muted-foreground">
                    Transcript linking is not configured yet for this project.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
