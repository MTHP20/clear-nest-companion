import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClearNestLogo } from '@/components/ClearNestLogo';
import { Mic } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';

const Conversation = () => {
  const navigate = useNavigate();
  const { isListening, isThinking, lastClaraMessage, simulateConversationTurn, triggerDemoStep, demoStep } = useSession();
  const [showEndModal, setShowEndModal] = useState(false);

  // -------------------------------------------------------------------------
  // DEMO SHORTCUT — Shift+D fires the next item in the demo sequence so
  // judges can see the dashboard populate live without a live voice API.
  // Remove this block once the real ElevenLabs integration is wired up.
  //
  // MICHAEL — CONNECT HERE:
  // Replace triggerDemoStep() with the real ElevenLabs agent connection.
  // When the agent completes a turn, parse the STRUCTURED_NOTE from the
  // response and call addCapturedItem(structuredNote) on the context.
  // The agent webhook / tool-call handler should live alongside this file.
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === 'D') {
        e.preventDefault();
        triggerDemoStep();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerDemoStep]);

  const handleMicPress = () => {
    if (!isListening && !isThinking) {
      simulateConversationTurn();
    }
  };

  const getButtonLabel = () => {
    if (isListening) return 'Clara is listening...';
    if (isThinking) return 'Clara is thinking...';
    return 'Press and speak';
  };

  const handleEndChat = () => setShowEndModal(true);

  const handleDownload = () => {
    const data = { exportedAt: new Date().toISOString(), message: "Session data export placeholder" };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clearnest-summary.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4">
        <ClearNestLogo variant="small" href="/" />
        <button onClick={handleEndChat} className="font-body text-muted-foreground hover:text-foreground transition-colors">
          End Chat
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-12 max-w-xl mx-auto w-full cn-stagger">
        {/* Greeting Card */}
        <div className="cn-card w-full mb-10 text-center">
          <h1 className="font-display text-[26px] font-semibold mb-3 text-foreground">
            Hello. I'm Clara.
          </h1>
          <p className="font-body text-foreground leading-relaxed">
            I'm here for a gentle chat to help your family get organised. There are no wrong answers and we can go at your pace. Take as long as you need.
          </p>
        </div>

        {/* Mic Button */}
        <div className="flex flex-col items-center mb-10">
          <button
            onClick={handleMicPress}
            disabled={isListening || isThinking}
            className={`w-[120px] h-[120px] rounded-full bg-accent flex items-center justify-center transition-all ${
              isListening ? 'cn-pulse-listening' : ''
            } ${isListening || isThinking ? 'opacity-90' : 'hover:bg-primary cursor-pointer'}`}
          >
            <Mic className="w-10 h-10 text-accent-foreground" />
          </button>
          <p className="mt-4 font-body text-foreground">
            {getButtonLabel()}
          </p>
        </div>

        {/* Clara's Response */}
        {lastClaraMessage && (
          <div className="cn-card cn-slide-in w-full text-center">
            <p className="text-xs font-body uppercase tracking-widest text-muted-foreground mb-3">Clara Said</p>
            <p className="font-display text-xl text-foreground leading-relaxed">
              {lastClaraMessage}
            </p>
          </div>
        )}
      </main>

      {/* Bottom Notice */}
      <footer className="text-center pb-6 px-4">
        <p className="text-sm text-muted-foreground">
          You can stop at any time. Just say "I'd like to stop" or press End Chat.
        </p>
        {/* DEV HINT — remove before production */}
        <p className="text-xs text-muted-foreground/40 mt-2">
          Demo: press <kbd className="font-mono bg-muted px-1 rounded">Shift+D</kbd> to simulate a response
          {demoStep > 0 && ` · ${demoStep}/6 captured`}
        </p>
      </footer>

      {/* End Session Modal */}
      {showEndModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl p-8 max-w-md w-full shadow-xl cn-slide-in">
            <h2 className="font-display text-2xl font-semibold mb-3 text-foreground">Your session is complete</h2>
            <p className="font-body text-foreground mb-6 leading-relaxed">
              Narayan's summary is ready for your family to review. This information is only stored on your device — ClearNest never holds your data.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={handleDownload} className="flex-1 border-2 border-accent text-accent font-body font-medium py-3 px-6 rounded-lg hover:bg-accent/10 transition-colors">
                Download Summary
              </button>
              <button onClick={() => navigate('/dashboard')} className="flex-1 bg-accent text-accent-foreground font-body font-medium py-3 px-6 rounded-lg hover:bg-primary transition-colors">
                Open Family Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Conversation;
