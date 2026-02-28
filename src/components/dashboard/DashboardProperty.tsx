import { useMemo } from 'react';
import { useSession } from '@/contexts/SessionContext';
import EmptyState from '@/components/EmptyState';
import FamilyNoteField from '@/components/dashboard/FamilyNoteField';

interface DashboardPropertyProps {
  query?: string;
  confidenceFilter?: string;
}

export default function DashboardProperty({ query = '', confidenceFilter = 'all' }: DashboardPropertyProps) {
  const { capturedItems, parentName } = useSession();
  const property = useMemo(() => {
    const q = query.trim().toLowerCase();
    return capturedItems.filter((item) => {
      if (item.category !== 'property') return false;
      const matchesQuery = !q || item.content.toLowerCase().includes(q) || (item.sourceQuote ?? '').toLowerCase().includes(q);
      const matchesConfidence = confidenceFilter === 'all' || item.confidence === confidenceFilter;
      return matchesQuery && matchesConfidence;
    });
  }, [capturedItems, query, confidenceFilter]);

  return (
    <div className="cn-stagger">
      <h2 className="font-display text-[22px] font-semibold mb-1 text-foreground">Property</h2>
      <p className="font-body text-muted-foreground mb-6">Property information mentioned by {parentName}</p>

      {property.length === 0 ? (
        <EmptyState section="Property" />
      ) : (
        <div className="space-y-4">
          {property.map(item => (
            <div key={item.id} className="cn-card cn-card-hover">
              <p className="font-body text-foreground mb-3">{item.content}</p>
              <span className={`inline-block text-xs font-body font-medium px-3 py-1 rounded-full ${
                item.confidence === 'clear' ? 'bg-primary/10 text-primary' : 'bg-alert/10 text-alert'
              }`}>
                {item.confidence === 'clear' ? 'Confirmed' : 'Needs follow-up'}
              </span>
              <FamilyNoteField itemId={item.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
