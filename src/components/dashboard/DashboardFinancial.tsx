import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import EmptyState from '@/components/EmptyState';
import FamilyNoteField from '@/components/dashboard/FamilyNoteField';

interface DashboardFinancialProps {
  query?: string;
  confidenceFilter?: string;
}

export default function DashboardFinancial({ query = '', confidenceFilter = 'all' }: DashboardFinancialProps) {
  const { capturedItems, parentName } = useSession();
  const navigate = useNavigate();
  const financial = useMemo(() => {
    const q = query.trim().toLowerCase();
    return capturedItems.filter((item) => {
      const inCategory = item.category === 'bank_accounts' || item.category === 'financial_accounts';
      if (!inCategory) return false;
      const matchesQuery = !q || item.content.toLowerCase().includes(q) || (item.sourceQuote ?? '').toLowerCase().includes(q);
      const matchesConfidence = confidenceFilter === 'all' || item.confidence === confidenceFilter;
      return matchesQuery && matchesConfidence;
    });
  }, [capturedItems, query, confidenceFilter]);

  return (
    <div className="cn-stagger">
      <h2 className="font-display text-[22px] font-semibold mb-1 text-foreground">Financial Accounts</h2>
      <p className="font-body text-muted-foreground mb-6">Captured from {parentName}'s conversation</p>

      {financial.length === 0 ? (
        <EmptyState section="Financial Accounts" />
      ) : (
        <div className="space-y-4">
          {financial.map(item => (
            <div key={item.id} className="cn-card cn-card-hover">
              <p className="font-body font-semibold text-foreground mb-2">{item.content.split('.')[0]}</p>
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

      <button
        onClick={() => navigate('/conversation')}
        className="mt-6 border-2 border-accent text-accent font-body font-medium py-2.5 px-5 rounded-lg hover:bg-accent/10 transition-colors"
      >
        Continue conversation
      </button>
    </div>
  );
}
