import { useNavigate } from 'react-router-dom';
import logoImage from '@/assets/clearnest-logo.png';

interface EmptyStateProps {
  section: string;
}

export default function EmptyState({ section }: EmptyStateProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <img
        src={logoImage}
        alt="ClearNest bird"
        className="h-14 w-14 rounded-full object-cover opacity-40 mb-4"
      />
      <h3 className="font-display text-lg font-semibold text-foreground mb-2">
        Nothing captured here yet
      </h3>
      <p className="font-body text-muted-foreground max-w-xs mb-6">
        Start a new conversation with Narayan to fill in their {section.toLowerCase()} details.
      </p>
      <button
        onClick={() => navigate('/conversation')}
        className="bg-primary text-primary-foreground font-body font-medium py-2.5 px-5 rounded-lg hover:opacity-90 transition-opacity"
      >
        Start New Conversation
      </button>
    </div>
  );
}
