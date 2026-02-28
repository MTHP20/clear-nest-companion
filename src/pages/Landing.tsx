import { useNavigate } from 'react-router-dom';
import { ClearNestLogo } from '@/components/ClearNestLogo';
import { Mic, LayoutDashboard } from 'lucide-react';

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="h-screen overflow-hidden bg-background flex flex-col items-center justify-center px-6">

      {/* Logo & Tagline */}
      <div className="text-center mb-10">
        <div className="flex justify-center mb-3">
          <ClearNestLogo />
        </div>
        <p className="font-body text-muted-foreground text-base tracking-wide">
          A gentle way to get organised.
        </p>
      </div>

      {/* Cards */}
      <div className="flex flex-row gap-5 w-full max-w-2xl items-stretch">

        {/* ── Elderly card ── */}
        <div className="cn-card flex-1 flex flex-col items-center text-center p-8">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-5">
            <Mic className="w-7 h-7 text-primary" />
          </div>

          <h2 className="font-display text-xl font-semibold text-foreground mb-2">
            I'd like to have a chat
          </h2>
          <p className="font-body text-muted-foreground text-sm mb-8 leading-relaxed">
            For Mum, Dad, or a loved one
          </p>

          {/* Spacer pushes button to bottom so both cards align */}
          <div className="flex-1" />

          <button
            onClick={() => navigate('/conversation')}
            className="w-full flex flex-col items-center justify-center gap-3 bg-accent text-accent-foreground font-bold rounded-2xl transition-all hover:bg-primary"
            style={{
              padding: '32px 24px',
              minHeight: '110px',
              fontSize: '24px',
              lineHeight: '1.3',
            }}
          >
            <Mic className="w-8 h-8 mb-1" />
            <span>Start Talking</span>
            <span>to Clara</span>
          </button>
        </div>

        {/* ── Divider ── */}
        <div className="flex flex-col items-center justify-center gap-3 flex-shrink-0 px-1">
          <div className="w-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground uppercase tracking-widest font-body">or</span>
          <div className="w-px flex-1 bg-border" />
        </div>

        {/* ── Family card ── */}
        <div className="cn-card flex-1 flex flex-col items-center text-center p-8">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-5">
            <LayoutDashboard className="w-7 h-7 text-primary" />
          </div>

          <h2 className="font-display text-xl font-semibold text-foreground mb-2">
            I'm supporting a family member
          </h2>
          <p className="font-body text-muted-foreground text-sm mb-6 leading-relaxed">
            View the family summary and next steps
          </p>

          <ul className="text-left w-full space-y-2 mb-8 flex-1">
            {['See what Clara has captured', 'Track what still needs doing', 'Share with family'].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm font-body text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>

          <button
            onClick={() => navigate('/dashboard')}
            className="w-full flex items-center justify-center gap-3 bg-accent text-accent-foreground font-body font-semibold rounded-xl transition-colors hover:bg-primary"
            style={{ padding: '18px 24px', fontSize: '18px' }}
          >
            <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
            Open Dashboard
          </button>
        </div>

      </div>

      {/* Privacy */}
      <p className="mt-8 text-xs text-muted-foreground text-center max-w-sm leading-relaxed font-body">
        ClearNest never stores your information on our servers. Everything stays with your family.
      </p>

    </div>
  );
};

export default Landing;