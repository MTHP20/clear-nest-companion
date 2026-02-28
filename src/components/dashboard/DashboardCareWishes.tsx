import { useSession } from '@/contexts/SessionContext';

export default function DashboardCareWishes() {
  const { capturedItems } = useSession();
  const wishes = capturedItems.filter(i => i.category === 'care_wishes');

  return (
    <div className="cn-stagger">
      <p className="font-display text-lg italic text-foreground mb-6 max-w-2xl leading-relaxed">
        Arthur shared the following wishes during his conversation. These are his words, in his own voice.
      </p>

      <div className="space-y-4">
        {wishes.map(item => (
          <div key={item.id} className="cn-card bg-background">
            <p className="font-body text-foreground italic leading-relaxed text-lg">
              "{item.content}"
            </p>
          </div>
        ))}
        {wishes.length === 0 && (
          <p className="font-body text-muted-foreground">No care wishes captured yet.</p>
        )}
      </div>
    </div>
  );
}
