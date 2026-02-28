import { useSession } from '@/contexts/SessionContext';
import EmptyState from '@/components/EmptyState';
import FamilyNoteField from '@/components/dashboard/FamilyNoteField';

export default function DashboardDocuments() {
  const { capturedItems } = useSession();
  const docs = capturedItems.filter(i => i.category === 'documents');

  return (
    <div className="cn-stagger">
      <h2 className="font-display text-[22px] font-semibold mb-1 text-foreground">Documents & Will</h2>
      <p className="font-body text-muted-foreground mb-6">Important documents mentioned by Narayan</p>

      {docs.length === 0 ? (
        <EmptyState section="Documents" />
      ) : (
        <div className="space-y-4">
          {docs.map(item => (
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
