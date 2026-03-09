import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClearNestLogo } from '@/components/ClearNestLogo';
import { Mic, LayoutDashboard, CheckCircle2, Loader2, X } from 'lucide-react';

const CONSENT_KEY = 'cn-consent-v1';

function hasGivenConsent(): boolean {
  try { return localStorage.getItem(CONSENT_KEY) === 'true'; } catch { return false; }
}

function saveConsent() {
  try { localStorage.setItem(CONSENT_KEY, 'true'); } catch { /* ignore */ }
}

function ConsentModal({ onAccept, onClose }: { onAccept: () => void; onClose: () => void }) {
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const canProceed = terms && privacy;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
    >
      <div className="bg-background rounded-2xl shadow-2xl max-w-md w-full p-7 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 id="consent-title" className="font-display text-xl font-semibold text-foreground mb-2">
          Before you begin
        </h2>
        <p className="font-body text-sm text-muted-foreground mb-5 leading-relaxed">
          Clara will have a gentle conversation to help organise important family information.
          Please read and agree to the following before starting.
        </p>

        <div className="space-y-4 mb-6">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded border-border accent-primary shrink-0 cursor-pointer"
            />
            <span className="font-body text-sm text-foreground leading-relaxed">
              I have read and agree to the{' '}
              <a
                href="/terms-of-service.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:opacity-80"
              >
                Terms of Service
              </a>
              , including that ClearNest is not legal or financial advice.
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={privacy}
              onChange={(e) => setPrivacy(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded border-border accent-primary shrink-0 cursor-pointer"
            />
            <span className="font-body text-sm text-foreground leading-relaxed">
              I understand how my data is handled as described in the{' '}
              <a
                href="/privacy-policy.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:opacity-80"
              >
                Privacy Policy
              </a>
              , including that voice conversations are processed by ElevenLabs.
            </span>
          </label>
        </div>

        <p className="font-body text-xs text-muted-foreground mb-5 leading-relaxed border-l-2 border-border pl-3">
          The person speaking with Clara must have the capacity to consent and must be doing so
          voluntarily. ClearNest must not be used coercively.
        </p>

        <button
          onClick={() => {
            if (!canProceed) return;
            saveConsent();
            onAccept();
          }}
          disabled={!canProceed}
          className="w-full bg-accent text-white font-body font-semibold py-3 rounded-lg transition-all duration-200 hover:bg-primary disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          I agree — start talking to Clara
        </button>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  borderLeft: 'none',
  boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
  borderRadius: '12px',
};

const Landing = () => {
  const navigate = useNavigate();
  const [connecting, setConnecting] = useState(false);
  const [showConsent, setShowConsent] = useState(false);

  const proceedToConversation = () => {
    setShowConsent(false);
    setConnecting(true);
    setTimeout(() => navigate('/conversation'), 900);
  };

  // UX #8 — show connecting state before navigating so user knows something is happening
  const handleStartTalking = () => {
    if (connecting) return;
    // Skip consent modal if user has already accepted in a previous session
    if (hasGivenConsent()) {
      setConnecting(true);
      setTimeout(() => navigate('/conversation'), 900);
    } else {
      setShowConsent(true);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-background flex flex-col items-center justify-center px-6">
      {showConsent && (
        <ConsentModal
          onAccept={proceedToConversation}
          onClose={() => setShowConsent(false)}
        />
      )}

      {/* Logo & Tagline */}
      <div className="text-center mb-10">
        <div className="flex justify-center mb-3">
          <ClearNestLogo />
        </div>
        <p className="font-body text-muted-foreground text-base tracking-wide">
          A gentle way to get organised.
        </p>
        {/* UX #5 — warm onboarding sentence so first-time visitors understand what they're entering */}
        <p className="font-body text-sm mt-2 max-w-md mx-auto leading-relaxed" style={{ color: '#9CA3AF' }}>
          Clara gently helps you and your family organise what matters most.
        </p>
      </div>

      {/* Cards */}
      <div className="flex flex-row gap-5 w-full max-w-2xl items-stretch">

        {/* ── Elderly card — UX #4: entire card is the tap target ── */}
        <button
          onClick={handleStartTalking}
          disabled={connecting}
          className="cn-card flex-1 flex flex-col items-center text-center p-8 group transition-all duration-200 hover:scale-[1.01] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-wait"
          style={cardStyle}
          aria-label="Start talking to Clara"
        >
          {/* UI #2 — warm tinted icon circle, not cold grey */}
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mb-5 transition-colors duration-200 group-hover:bg-primary/20"
            style={{ backgroundColor: '#EBF2F8' }}
          >
            <Mic className="w-7 h-7 text-primary" />
          </div>

          {/* UI #4 — font-display = Playfair Display, trustworthy heading */}
          <h2 className="font-display text-xl font-semibold text-foreground mb-2">
            I'd like to have a chat
          </h2>
          <p className="font-body text-muted-foreground text-sm mb-8 leading-relaxed">
            For Mum, Dad, or a loved one
          </p>

          <div className="flex-1" />

          {/* UI #3 — 8px radius per design system; UX #8 — connecting state feedback */}
          <div
            className={`w-full flex flex-col items-center justify-center gap-3 font-bold transition-all duration-200 text-white ${
              connecting ? 'bg-primary/70' : 'bg-accent group-hover:bg-primary'
            }`}
            style={{
              padding: '32px 24px',
              minHeight: '110px',
              fontSize: '24px',
              lineHeight: '1.3',
              borderRadius: '8px',
            }}
          >
            {connecting ? (
              <>
                <Loader2 className="w-8 h-8 animate-spin" />
                <span>Connecting</span>
                <span>to Clara…</span>
              </>
            ) : (
              <>
                <Mic className="w-8 h-8 mb-1" />
                <span>Start Talking</span>
                <span>to Clara</span>
              </>
            )}
          </div>
        </button>

        {/* ── Divider — UI #6: amber accent + larger text ── */}
        <div className="flex flex-col items-center justify-center gap-3 flex-shrink-0 px-1">
          <div className="w-px flex-1 bg-border" />
          <span
            className="text-sm font-semibold uppercase tracking-widest font-body"
            style={{ color: '#F4A261' }}
          >
            or
          </span>
          <div className="w-px flex-1 bg-border" />
        </div>

        {/* ── Family card ── */}
        <div className="cn-card flex-1 flex flex-col items-center text-center p-8" style={cardStyle}>
          {/* UI #2 — warm tinted icon circle */}
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mb-5"
            style={{ backgroundColor: '#EBF2F8' }}
          >
            <LayoutDashboard className="w-7 h-7 text-primary" />
          </div>

          <h2 className="font-display text-xl font-semibold text-foreground mb-2">
            I'm supporting a family member
          </h2>
          <p className="font-body text-muted-foreground text-sm mb-6 leading-relaxed">
            View the family summary and next steps
          </p>

          {/* UI #7 — check icons instead of plain dots, adds warmth and clarity */}
          <ul className="text-left w-full space-y-3 mb-8 flex-1">
            {[
              'See what Clara has captured',
              'Track what still needs doing',
              'Share with family',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm font-body text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: '#5B8DB8' }} />
                {item}
              </li>
            ))}
          </ul>

          {/* UI #3 — 8px radius per design system */}
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full flex items-center justify-center gap-3 bg-accent text-white font-body font-semibold transition-colors duration-200 hover:bg-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            style={{ padding: '18px 24px', fontSize: '18px', borderRadius: '8px' }}
          >
            <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
            Open Dashboard
          </button>
        </div>

      </div>

      {/* UI #10 — privacy as a trust signal, text-base (18px minimum), never fine print */}
      <p className="mt-6 text-base text-muted-foreground text-center max-w-sm leading-relaxed font-body">
        ClearNest never stores your information on our servers. Everything stays with your family.
      </p>

    </div>
  );
};

export default Landing;
