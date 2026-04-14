import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import EmptyState from '@/components/EmptyState';
import FamilyNoteField from '@/components/dashboard/FamilyNoteField';

interface DashboardContactsProps {
  query?: string;
  confidenceFilter?: string;
}

const FF = 'Figtree, system-ui, sans-serif';

export default function DashboardContacts({ query = '', confidenceFilter = 'all' }: DashboardContactsProps) {
  const { capturedItems, parentName } = useSession();
  const navigate = useNavigate();
  const contacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return capturedItems.filter((item) => {
      if (item.category !== 'key_contacts') return false;
      const matchesQuery = !q || item.content.toLowerCase().includes(q) || (item.sourceQuote ?? '').toLowerCase().includes(q);
      const matchesConfidence = confidenceFilter === 'all' || item.confidence === confidenceFilter;
      return matchesQuery && matchesConfidence;
    });
  }, [capturedItems, query, confidenceFilter]);

  return (
    <div className="cn-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Title */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: FF, fontSize: 22, fontWeight: 700, color: 'var(--ov-text)', margin: 0 }}>
          Key Contacts
        </h2>
        <p style={{ fontFamily: FF, fontSize: 14, color: 'var(--ov-muted)', margin: '4px 0 0' }}>
          People mentioned by {parentName}
        </p>
      </div>

      {/* Content */}
      {contacts.length === 0 ? (
        <EmptyState section="Key Contacts" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {contacts.map(item => (
            <div key={item.id} style={{
              background: 'var(--ov-card-bg)',
              backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
              border: '1px solid var(--ov-card-border)',
              borderRadius: 18, padding: '20px 22px',
              boxShadow: 'var(--ov-shadow)',
              transition: 'transform 0.18s',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}
            >
              <p style={{ fontFamily: FF, fontSize: 14, color: 'var(--ov-text)', marginBottom: 12 }}>
                {item.content}
              </p>
              <span style={{
                display: 'inline-block', fontSize: 11, fontWeight: 600,
                padding: '3px 10px', borderRadius: 20,
                background: item.confidence === 'clear'
                  ? 'rgba(94,207,207,0.15)' : 'rgba(240,192,80,0.15)',
                color: item.confidence === 'clear' ? '#5ECFCF' : '#F0C050',
                border: item.confidence === 'clear'
                  ? '1px solid rgba(94,207,207,0.3)' : '1px solid rgba(240,192,80,0.3)',
              }}>
                {item.confidence === 'clear' ? 'Confirmed' : 'Needs follow-up'}
              </span>
              <FamilyNoteField itemId={item.id} />
            </div>
          ))}
        </div>
      )}

      {/* CTA */}
      <button
        onClick={() => navigate('/conversation')}
        style={{
          alignSelf: 'flex-start', marginTop: 24,
          background: 'var(--ov-inner)',
          border: '2px solid var(--ov-accent)',
          color: 'var(--ov-accent)',
          fontFamily: FF, fontWeight: 600, fontSize: 14,
          padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
          transition: 'background 0.18s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(70,99,172,0.08)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--ov-inner)'; }}
      >
        Continue conversation
      </button>
    </div>
  );
}
