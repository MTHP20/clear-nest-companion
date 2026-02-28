import { useMemo } from 'react';
import { useSession } from '@/contexts/SessionContext';
import EmptyState from '@/components/EmptyState';
import FamilyNoteField from '@/components/dashboard/FamilyNoteField';

interface DashboardCareWishesProps {
  query?: string;
}

export default function DashboardCareWishes({ query = '' }: DashboardCareWishesProps) {
  const { capturedItems, parentName } = useSession();
  const wishes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return capturedItems.filter((item) => {
      if (item.category !== 'care_wishes') return false;
      if (!q) return true;
      return item.content.toLowerCase().includes(q) || (item.sourceQuote ?? '').toLowerCase().includes(q);
    });
  }, [capturedItems, query]);

  return (
    <div className="cn-stagger">
      <p className="font-display text-lg italic text-foreground mb-6 max-w-2xl leading-relaxed">
        {parentName} shared the following wishes during the conversation. These are shown in {parentName}'s own voice.
      </p>

      {wishes.length === 0 ? (
        <EmptyState section="Care Wishes" />
      ) : (
        <div className="space-y-4">
          {wishes.map(item => (
            <div key={item.id} className="cn-card bg-background">
              <p className="font-body text-foreground italic leading-relaxed text-lg">
                "{item.content}"
              </p>
              <FamilyNoteField itemId={item.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
