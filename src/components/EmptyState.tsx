import { useNavigate } from 'react-router-dom';
import logoImage from '@/assets/clearnest-logo.png';
import { useSession } from '@/contexts/SessionContext';

interface EmptyStateProps {
  section: string;
}

const FF = 'Figtree, system-ui, sans-serif';

export default function EmptyState({ section }: EmptyStateProps) {
  const navigate = useNavigate();
  const { parentName } = useSession();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', textAlign: 'center' }}>
      <img
        src={logoImage}
        alt="ClearNest bird"
        style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', opacity: 0.35, marginBottom: 16 }}
      />
      <h3 style={{ fontFamily: FF, fontSize: 18, fontWeight: 700, color: 'var(--ov-text)', marginBottom: 8 }}>
        Nothing captured here yet
      </h3>
      <p style={{ fontFamily: FF, fontSize: 14, color: 'var(--ov-muted)', maxWidth: 280, marginBottom: 24, lineHeight: 1.6 }}>
        Start a new conversation with {parentName} to fill in their {section.toLowerCase()} details.
      </p>
      <button
        onClick={() => navigate('/conversation')}
        style={{
          background: 'var(--ov-accent)', color: 'white',
          fontFamily: FF, fontWeight: 600, fontSize: 14,
          padding: '11px 22px', borderRadius: 10, border: 'none',
          cursor: 'pointer', transition: 'opacity 0.18s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
      >
        Start New Conversation
      </button>
    </div>
  );
}
