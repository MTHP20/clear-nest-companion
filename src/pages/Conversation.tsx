import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClearNestLogo } from '@/components/ClearNestLogo';
import { Mic } from 'lucide-react';
import { useConversation } from '@11labs/react';
import { useSession } from '@/contexts/SessionContext';

const Conversation = () => {
  const navigate = useNavigate();
  const {
    lastClaraMessage,
    lastUserMessage,
    setLastClaraMessage,
    setLastUserMessage,
    handleAgentToolCall,
  } = useSession();

  const agentId = import.meta.env.VITE_ELEVENLABS_AGENT_ID as string;

  // ─── ElevenLabs Conversational AI ─────────────────────────────────────────
  const conversation = useConversation({
    // Fires when the agent speaks — update "Clara Said" card
    onMessage: (message: { source: string; message: string }) => {
      console.log('💬 Message:', message);
      if (message.source === 'ai') {
        setLastClaraMessage(message.message);
      } else if (message.source === 'user') {
        setLastUserMessage(message.message);
      }
    },

    // Fires when the agent calls a tool — update dashboard in real time
    onToolCall: (toolCall: { tool_name: string; parameters: Record<string, unknown> }) => {
      console.log('🔧 Tool call:', toolCall);
      handleAgentToolCall(toolCall.tool_name, toolCall.parameters);
    },

    onError: (error: string) => {
      console.error('❌ ElevenLabs error:', error);
      setLastClaraMessage(`Connection error: ${error}`);
    },

    onConnect: () => {
      console.log('✅ Connected to ElevenLabs agent');
    },

    onDisconnect: () => {
      console.log('🔌 Disconnected from ElevenLabs agent');
    },
  });

  // ─── Controls ─────────────────────────────────────────────────────────────
  const startSession = useCallback(async () => {
    if (!agentId) {
      setLastClaraMessage('Agent ID not configured. Add VITE_ELEVENLABS_AGENT_ID to your .env file.');
      return;
    }

    try {
      // Request mic permission before starting
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await conversation.startSession({ agentId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not start session';
      console.error('❌ Start session error:', msg);
      setLastClaraMessage(`Could not start: ${msg}`);
    }
  }, [conversation, agentId, setLastClaraMessage]);

  const endSession = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  // ─── Derived state from ElevenLabs SDK ───────────────────────────────────
  const isConnected = conversation.status === 'connected';
  const isAgentSpeaking = conversation.isSpeaking;

  const getButtonLabel = () => {
    if (!isConnected) return 'Press and speak';
    if (isAgentSpeaking) return 'Clara is speaking...';
    return 'Clara is listening...';
  };

  const getButtonState = () => {
    if (!isConnected) return 'idle';
    if (isAgentSpeaking) return 'speaking';
    return 'listening';
  };

  const handleMicPress = () => {
    if (!isConnected) {
      startSession();
    } else {
      endSession();
    }
  };

  const handleEndChat = () => {
    endSession();
    navigate('/dashboard');
  };

  const handleDownload = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      lastUserMessage,
      lastClaraMessage,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clearnest-summary.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const buttonState = getButtonState();

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col">

      <header className="flex items-center justify-between px-6 py-4">
        <ClearNestLogo variant="small" />
        <button
          onClick={handleEndChat}
          className="font-body text-muted-foreground hover:text-foreground transition-colors"
        >
          End Chat
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-12 max-w-xl mx-auto w-full cn-stagger">

        {/* Greeting Card */}
        <div className="cn-card w-full mb-10 text-center">
          <h1 className="font-display text-[26px] font-semibold mb-3 text-foreground">
            Hello. I'm Clara.
          </h1>
          <p className="font-body text-foreground leading-relaxed">
            I'm here for a gentle chat to help your family get organised. There are no wrong
            answers and we can go at your pace. Take as long as you need.
          </p>
        </div>

        {/* Mic Button */}
        <div className="flex flex-col items-center mb-10">
          <button
            onClick={handleMicPress}
            disabled={buttonState === 'speaking'}
            aria-label={getButtonLabel()}
            className={`
              w-[120px] h-[120px] rounded-full bg-accent
              flex items-center justify-center transition-all
              ${buttonState === 'listening' ? 'cn-pulse-listening ring-4 ring-accent/40' : ''}
              ${buttonState === 'speaking'
                ? 'opacity-70 cursor-not-allowed'
                : 'hover:bg-primary cursor-pointer'}
            `}
          >
            <Mic className="w-10 h-10 text-accent-foreground" />
          </button>

          <p className="mt-4 font-body text-foreground">
            {getButtonLabel()}
          </p>

          {/* Status indicator */}
          {isConnected && (
            <div className="mt-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm text-muted-foreground">
                {isAgentSpeaking ? 'Clara is speaking — tap to end chat' : 'Listening — speak now'}
              </span>
            </div>
          )}

          {!isConnected && (
            <p className="mt-2 text-sm text-muted-foreground">
              Tap to start your conversation with Clara
            </p>
          )}
        </div>

        {/* You Said */}
        {lastUserMessage && (
          <div className="cn-card cn-slide-in w-full text-center mb-6">
            <p className="text-xs font-body uppercase tracking-widest text-muted-foreground mb-2">
              You Said
            </p>
            <p className="font-body text-lg text-foreground leading-relaxed italic">
              "{lastUserMessage}"
            </p>
          </div>
        )}

        {/* Clara Said */}
        {lastClaraMessage && (
          <div className="cn-card cn-slide-in w-full text-center">
            <p className="text-xs font-body uppercase tracking-widest text-muted-foreground mb-3">
              Clara Said
            </p>
            <p className="font-display text-xl text-foreground leading-relaxed">
              {lastClaraMessage}
            </p>
          </div>
        )}

      </main>

      <footer className="text-center pb-6 px-4">
        <p className="text-sm text-muted-foreground">
          You can stop at any time. Just say "I'd like to stop" or press End Chat.
        </p>
      </footer>

      {/* End session modal — shown when navigating away */}
      {/* Now handled inline via handleEndChat → endSession → navigate */}

    </div>
  );
};

export default Conversation;