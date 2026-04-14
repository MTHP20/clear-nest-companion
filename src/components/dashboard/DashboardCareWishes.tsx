import { useMemo } from 'react';
import { useSession } from '@/contexts/SessionContext';
import EmptyState from '@/components/EmptyState';
import FamilyNoteField from '@/components/dashboard/FamilyNoteField';

interface DashboardCareWishesProps {
  query?: string;
}

const FF = 'Figtree, system-ui, sans-serif';

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
    <div className="cn-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Intro */}
      <p style={{
        fontFamily: FF, fontSize: 16, fontStyle: 'italic',
        color: 'var(--ov-text)', marginBottom: 24, maxWidth: 640, lineHeight: 1.6,
      }}>
        {parentName} shared the following wishes during the conversation. These are shown in {parentName}'s own voice.
      </p>

      {/* Content */}
      {wishes.length === 0 ? (
        <EmptyState section="Care Wishes" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {wishes.map(item => (
            <div key={item.id} style={{
              background: 'var(--ov-card-bg)',
              backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
              border: '1px solid var(--ov-card-border)',
              borderRadius: 18, padding: '22px 24px',
              boxShadow: 'var(--ov-shadow)',
            }}>
              <p style={{
                fontFamily: FF, fontSize: 16, fontStyle: 'italic',
                color: 'var(--ov-text)', lineHeight: 1.65,
              }}>
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
