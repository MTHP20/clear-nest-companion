import { useSession } from '@/contexts/SessionContext';
import EmptyState from '@/components/EmptyState';
import FamilyNoteField from '@/components/dashboard/FamilyNoteField';

export default function DashboardContacts() {
  const { capturedItems } = useSession();
  const contacts = capturedItems.filter(i => i.category === 'key_contacts');

  return (
    <div className="cn-stagger">
      <h2 className="font-display text-[22px] font-semibold mb-1 text-foreground">Key Contacts</h2>
      <p className="font-body text-muted-foreground mb-6">People mentioned by Narayan</p>

      {contacts.length === 0 ? (
        <EmptyState section="Key Contacts" />
      ) : (
        <div className="space-y-4">
          {contacts.map(item => (
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

      <button className="mt-6 border-2 border-accent text-accent font-body font-medium py-2.5 px-5 rounded-lg hover:bg-accent/10 transition-colors">
        + Add manually
      </button>
    </div>
  );
}
