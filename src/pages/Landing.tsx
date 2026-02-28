import { useNavigate } from 'react-router-dom';
import { ClearNestLogo } from '@/components/ClearNestLogo';
import { User, Users } from 'lucide-react';

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      {/* Logo & Tagline */}
      <div className="text-center mb-12 cn-stagger">
        <div className="flex justify-center mb-4">
          <ClearNestLogo />
        </div>
        <p className="font-body text-muted-foreground text-lg">
          A gentle way to get organised.
        </p>
      </div>

      {/* Door Cards */}
      <div className="flex flex-col md:flex-row gap-6 max-w-2xl w-full cn-stagger">
        {/* Elderly Person Card */}
        <div className="cn-card cn-card-hover flex-1 flex flex-col items-center text-center p-8 cursor-pointer" onClick={() => navigate('/conversation')}>
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-5">
            <User className="w-8 h-8 text-primary" />
          </div>
          <h2 className="font-display text-[22px] font-semibold mb-2 text-foreground">
            I'd like to have a chat
          </h2>
          <p className="font-body text-muted-foreground mb-6">
            For Mum, Dad, or a loved one
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); navigate('/conversation'); }}
            className="w-full bg-accent text-accent-foreground font-body font-medium py-3 px-6 rounded-lg hover:bg-primary transition-colors"
          >
            Start Conversation
          </button>
        </div>

        {/* Family Member Card */}
        <div className="cn-card cn-card-hover flex-1 flex flex-col items-center text-center p-8 cursor-pointer" onClick={() => navigate('/dashboard')}>
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-5">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <h2 className="font-display text-[22px] font-semibold mb-2 text-foreground">
            I'm supporting a family member
          </h2>
          <p className="font-body text-muted-foreground mb-6">
            View the family summary and next steps
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); navigate('/dashboard'); }}
            className="w-full bg-accent text-accent-foreground font-body font-medium py-3 px-6 rounded-lg hover:bg-primary transition-colors"
          >
            Open Dashboard
          </button>
        </div>
      </div>

      {/* Privacy Notice */}
      <p className="mt-12 text-sm text-muted-foreground text-center max-w-md">
        ClearNest never stores your information on our servers. Everything stays with your family.
      </p>
    </div>
  );
};

export default Landing;
