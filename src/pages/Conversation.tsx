import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClearNestLogo } from '@/components/ClearNestLogo';
import { Mic } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';

type RecordingState = 'idle' | 'listening' | 'thinking';

interface GoogleSTTResponse {
  results?: Array<{
    alternatives?: Array<{ transcript: string; confidence: number }>;
  }>;
  error?: { code: number; message: string; status: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const getGoogleEncoding = (mimeType: string): string => {
  if (mimeType.includes('webm')) return 'WEBM_OPUS';
  if (mimeType.includes('ogg')) return 'OGG_OPUS';
  return 'WEBM_OPUS';
};

// ─── Component ────────────────────────────────────────────────────────────────

const Conversation = () => {
  const navigate = useNavigate();
  const { lastClaraMessage, processTranscript } = useSession();

  const [showEndModal, setShowEndModal] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [transcript, setTranscript] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeTypeRef = useRef<string>('audio/webm;codecs=opus');

  // ─── Google STT ───────────────────────────────────────────────────────────
  const sendToGoogleSTT = useCallback(async (audioBlob: Blob) => {
    setErrorMessage(null);

    const apiKey = import.meta.env.VITE_GOOGLE_STT_API_KEY as string | undefined;
    if (!apiKey) {
      setErrorMessage('Google STT API key not found. Add VITE_GOOGLE_STT_API_KEY to your .env file.');
      setRecordingState('idle');
      return;
    }

    try {
      console.log('🔄 Converting blob to base64…', { size: audioBlob.size, type: audioBlob.type });
      const base64Audio = await blobToBase64(audioBlob);

      const requestBody = {
        config: {
          encoding: getGoogleEncoding(mimeTypeRef.current),
          languageCode: 'en-GB',
          enableAutomaticPunctuation: true,
          model: 'latest_long',
          useEnhanced: true,
        },
        audio: { content: base64Audio },
      };

      console.log('📤 Sending to Google STT…');
      const response = await fetch(
        `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        }
      );

      const data: GoogleSTTResponse = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error?.message ?? `HTTP ${response.status}`);
      }

      const transcriptText = data.results?.[0]?.alternatives?.[0]?.transcript ?? '';
      const confidence = data.results?.[0]?.alternatives?.[0]?.confidence ?? 0;

      if (!transcriptText) {
        console.warn('⚠️ No transcript returned from Google STT');
        setErrorMessage("Sorry, I couldn't make that out. Could you try again?");
        setRecordingState('idle');
        return;
      }

      console.log(`✅ Transcript: "${transcriptText}" (confidence: ${(confidence * 100).toFixed(1)}%)`);

      // Show what user said immediately
      setTranscript(transcriptText);

      // Pass to Gemini via SessionContext → updates Clara response + dashboard
      // ElevenLabs TTS also fires inside processTranscript after Gemini responds
      await processTranscript(transcriptText);

      setRecordingState('idle');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('❌ Google STT error:', message);
      setErrorMessage(`Transcription failed: ${message}`);
      setRecordingState('idle');
    }
  }, [processTranscript]);

  // ─── Recording controls ───────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (recordingState !== 'idle') return;

    setErrorMessage(null);
    setTranscript(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
        },
      });
      streamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg;codecs=opus';

      mimeTypeRef.current = mimeType;
      console.log('🎙️ Recording started. MIME type:', mimeType);

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        streamRef.current?.getTracks().forEach(track => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        console.log('🛑 Recording stopped. Blob size:', audioBlob.size, 'bytes');

        if (audioBlob.size < 1000) {
          setErrorMessage("That was too short or silent. Please try again.");
          setRecordingState('idle');
          return;
        }

        sendToGoogleSTT(audioBlob);
      };

      mediaRecorder.start(250);
      setRecordingState('listening');
    } catch (err) {
      console.error('❌ Mic error:', err);
      setErrorMessage('Microphone access was denied. Please check your browser permissions.');
    }
  }, [recordingState, sendToGoogleSTT]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setRecordingState('thinking');
    }
  }, []);

  // ─── UI helpers ───────────────────────────────────────────────────────────
  const getButtonLabel = () => {
    if (recordingState === 'listening') return 'Clara is listening...';
    if (recordingState === 'thinking') return 'Clara is thinking...';
    return 'Press and speak';
  };

  const handleMicPress = () => {
    if (recordingState === 'idle') startRecording();
    else if (recordingState === 'listening') stopRecording();
  };

  const handleEndChat = () => setShowEndModal(true);

  const handleDownload = () => {
    const data = { exportedAt: new Date().toISOString(), transcript, lastClaraMessage };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clearnest-summary.json';
    a.click();
    URL.revokeObjectURL(url);
  };

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
            disabled={recordingState === 'thinking'}
            aria-label={getButtonLabel()}
            className={`
              w-[120px] h-[120px] rounded-full bg-accent
              flex items-center justify-center transition-all
              ${recordingState === 'listening' ? 'cn-pulse-listening ring-4 ring-accent/40' : ''}
              ${recordingState === 'thinking'
                ? 'opacity-70 cursor-not-allowed'
                : 'hover:bg-primary cursor-pointer'}
            `}
          >
            <Mic className="w-10 h-10 text-accent-foreground" />
          </button>

          <p className="mt-4 font-body text-foreground">{getButtonLabel()}</p>

          {recordingState === 'listening' && (
            <p className="mt-1 text-sm text-muted-foreground animate-pulse">
              Tap again when you've finished speaking
            </p>
          )}
        </div>

        {/* Error */}
        {errorMessage && (
          <div className="cn-card cn-slide-in w-full text-center mb-6 border-l-4 border-amber-400">
            <p className="font-body text-amber-700 leading-relaxed">{errorMessage}</p>
          </div>
        )}

        {/* You Said */}
        {transcript && !errorMessage && (
          <div className="cn-card cn-slide-in w-full text-center mb-6">
            <p className="text-xs font-body uppercase tracking-widest text-muted-foreground mb-2">
              You Said
            </p>
            <p className="font-body text-lg text-foreground leading-relaxed italic">
              "{transcript}"
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

      {showEndModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl p-8 max-w-md w-full shadow-xl cn-slide-in">
            <h2 className="font-display text-2xl font-semibold mb-3 text-foreground">
              Your session is complete
            </h2>
            <p className="font-body text-foreground mb-6 leading-relaxed">
              Arthur's summary is ready for your family to review. This information is only stored
              on your device — ClearNest never holds your data.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleDownload}
                className="flex-1 border-2 border-accent text-accent font-body font-medium py-3 px-6 rounded-lg hover:bg-accent/10 transition-colors"
              >
                Download Summary
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="flex-1 bg-accent text-accent-foreground font-body font-medium py-3 px-6 rounded-lg hover:bg-primary transition-colors"
              >
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