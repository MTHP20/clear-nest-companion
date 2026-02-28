import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

export interface CapturedItem {
  id: string;
  category: string;
  content: string;
  confidence: 'clear' | 'needs-follow-up';
  flag: boolean;
  timestamp: Date;
  sourceQuote?: string;
  verificationStatus?: 'verified' | 'disputed' | 'unverified';
  verifiedByRole?: string;
  verifiedAt?: Date;
}

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  severity: 'red' | 'amber';
  status: 'todo' | 'in-progress' | 'done';
  learnMoreUrl?: string;
  dueDate?: string;
  assigneeRole?: string;
}

export interface SessionEntry {
  id: string;
  date: Date;
  duration: string;
  itemsCaptured: number;
  actionsFlagged: number;
}

export interface ClaraResponse {
  spoken: string;
  note?: CapturedItem;
  action?: ActionItem;
}

interface SessionContextType {
  parentName: string;
  childName: string;
  capturedItems: CapturedItem[];
  actionItems: ActionItem[];
  sessions: SessionEntry[];
  claraResponses: ClaraResponse[];
  lastClaraMessage: string;
  lastUserMessage: string;
  isListening: boolean;
  isThinking: boolean;
  userNotes: Record<string, string>;
  setUserNote: (itemId: string, note: string) => void;
  addCapturedItem: (item: CapturedItem) => void;
  addActionItem: (item: ActionItem) => void;
  updateActionStatus: (id: string, status: ActionItem['status']) => void;
  updateCapturedVerification: (id: string, status: 'verified' | 'disputed' | 'unverified') => void;
  setListening: (v: boolean) => void;
  setThinking: (v: boolean) => void;
  setLastClaraMessage: (msg: string) => void;
  setLastUserMessage: (msg: string) => void;
  handleAgentToolCall: (toolName: string, parameters: Record<string, unknown>) => void;
}

const SessionContext = createContext<SessionContextType | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [parentName] = useState('Narayan');
  const [childName] = useState('Sunil');
  const [capturedItems, setCapturedItems] = useState<CapturedItem[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [sessions] = useState<SessionEntry[]>([]);
  const [claraResponses] = useState<ClaraResponse[]>([]);
  const [lastClaraMessage, setLastClaraMessage] = useState('');
  const [lastUserMessage, setLastUserMessage] = useState('');
  // Ref so handleAgentToolCall always reads the latest user message
  const lastUserMessageRef = useRef('');
  const [isListening, setListening] = useState(false);
  const [isThinking, setThinking] = useState(false);
  const [userNotes, setUserNotes] = useState<Record<string, string>>({});

  const setUserNote = useCallback((itemId: string, note: string) => {
    setUserNotes(prev => ({ ...prev, [itemId]: note }));
  }, []);

  // Wrap setter so the ref stays in sync for use inside handleAgentToolCall
  const wrappedSetLastUserMessage = useCallback((msg: string) => {
    lastUserMessageRef.current = msg;
    setLastUserMessage(msg);
  }, []);

  const addCapturedItem = useCallback((item: CapturedItem) => {
    setCapturedItems(prev => [item, ...prev]);
  }, []);

  const addActionItem = useCallback((item: ActionItem) => {
    setActionItems(prev => [item, ...prev]);
  }, []);

  const updateActionStatus = useCallback((id: string, status: ActionItem['status']) => {
    setActionItems(prev => prev.map(a => (a.id === id ? { ...a, status } : a)));
  }, []);

  const updateCapturedVerification = useCallback(
    (id: string, status: 'verified' | 'disputed' | 'unverified') => {
      setCapturedItems(prev =>
        prev.map(i =>
          i.id === id
            ? { ...i, verificationStatus: status, verifiedByRole: 'dad', verifiedAt: new Date() }
            : i
        )
      );
    },
    []
  );

  // ─── ElevenLabs tool call handler ──────────────────────────────────────────
  // The agent can pass `source_quote` in capture_note parameters;
  // if absent we fall back to the last user utterance automatically.
  const handleAgentToolCall = useCallback(
    (toolName: string, parameters: Record<string, unknown>) => {
      console.log('🔧 Agent tool call:', toolName, parameters);

      if (toolName === 'capture_note') {
        const item: CapturedItem = {
          id: `item-${Date.now()}`,
          category: (parameters.category as string) ?? 'general',
          content: (parameters.content as string) ?? '',
          confidence: (parameters.confidence as 'clear' | 'needs-follow-up') ?? 'clear',
          flag: (parameters.flag as boolean) ?? false,
          timestamp: new Date(),
          sourceQuote: (parameters.source_quote as string) || lastUserMessageRef.current || undefined,
        };
        addCapturedItem(item);
        console.log('📋 Note captured:', item);
      }

      if (toolName === 'flag_action') {
        const action: ActionItem = {
          id: `action-${Date.now()}`,
          title: (parameters.title as string) ?? 'Action required',
          description: (parameters.description as string) ?? '',
          severity: (parameters.severity as 'red' | 'amber') ?? 'amber',
          status: 'todo',
          learnMoreUrl: (parameters.learnMoreUrl as string) ?? undefined,
        };
        addActionItem(action);
        console.log('⚠️ Action flagged:', action);
      }
    },
    [addCapturedItem, addActionItem]
  );

  return (
    <SessionContext.Provider
      value={{
        parentName,
        childName,
        capturedItems,
        actionItems,
        sessions,
        claraResponses,
        lastClaraMessage,
        lastUserMessage,
        isListening,
        isThinking,
        userNotes,
        setUserNote,
        addCapturedItem,
        addActionItem,
        updateActionStatus,
        updateCapturedVerification,
        setListening,
        setThinking,
        setLastClaraMessage,
        setLastUserMessage: wrappedSetLastUserMessage,
        handleAgentToolCall,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
