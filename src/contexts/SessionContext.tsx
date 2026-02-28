import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface CapturedItem {
  id: string;
  category: string;
  content: string;
  confidence: 'clear' | 'needs-follow-up';
  flag: boolean;
  timestamp: Date;
}

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  severity: 'red' | 'amber';
  status: 'todo' | 'in-progress' | 'done';
  learnMoreUrl?: string;
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
  demoStep: number;
  addCapturedItem: (item: CapturedItem) => void;
  addActionItem: (item: ActionItem) => void;
  updateActionStatus: (id: string, status: ActionItem['status']) => void;
  setListening: (v: boolean) => void;
  setThinking: (v: boolean) => void;
  setLastClaraMessage: (msg: string) => void;
  setLastUserMessage: (msg: string) => void;
  setUserNote: (id: string, note: string) => void;
  simulateConversationTurn: () => void;
  triggerDemoStep: () => void;
  // Called by Conversation.tsx when ElevenLabs agent emits a tool_call
  // with a structured note/action to add to the dashboard
  handleAgentToolCall: (toolName: string, parameters: Record<string, unknown>) => void;
}

const SessionContext = createContext<SessionContextType | null>(null);

// ─── Mock turns for dashboard demo button ────────────────────────────────────
const MOCK_TURNS: {
  spoken: string;
  note?: Omit<CapturedItem, 'id' | 'timestamp'>;
  action?: Omit<ActionItem, 'id'>;
}[] = [
  {
    spoken: "That's really helpful, Narayan. So you have a current account with Barclays — and you keep the statements in a blue folder in the top drawer. Is that right?",
    note: { category: 'bank_accounts', content: 'Barclays current account mentioned. Statements in blue folder, top drawer of desk in study.', confidence: 'clear', flag: false },
  },
  {
    spoken: "Thank you. Do you happen to remember if you set up a Power of Attorney with anyone — perhaps with Sunil or another family member?",
    action: { title: 'Power of Attorney — Not confirmed', description: "Narayan hasn't confirmed whether a Lasting Power of Attorney is in place. Without this, the family may face Court of Protection proceedings — costing £20,000+ and taking 9+ months.", severity: 'red', status: 'todo', learnMoreUrl: 'https://www.gov.uk/power-of-attorney' },
  },
  {
    spoken: "I understand. Do you remember the name of your pension provider? You mentioned you had a council pension.",
    note: { category: 'financial_accounts', content: 'Council pension mentioned but provider unknown.', confidence: 'needs-follow-up', flag: true },
    action: { title: 'Pension Provider — Unknown', description: "Narayan mentioned a council pension but couldn't recall the provider. Use the government's free Pension Tracing Service.", severity: 'amber', status: 'todo', learnMoreUrl: 'https://www.gov.uk/find-pension-contact-details' },
  },
  {
    spoken: "That's perfectly fine. Do you have a will, Narayan? And do you know where it's kept?",
    note: { category: 'documents', content: "Will exists, drawn up by Henderson & Partners. Kept in a brown envelope in the filing cabinet.", confidence: 'clear', flag: false },
  },
  {
    spoken: "Lovely. Is there anything you'd like your family to know about how you'd like to be cared for?",
    note: { category: 'care_wishes', content: 'Narayan would prefer to stay at home as long as possible. Would like Sunil to manage things.', confidence: 'clear', flag: false },
  },
  {
    spoken: "That's very clear, Narayan. Do you have any insurance policies? Life insurance, home insurance, anything like that?",
    note: { category: 'documents', content: "Home insurance with Aviva, renews in March. Life insurance policy exists but provider unknown.", confidence: 'needs-follow-up', flag: true },
    action: { title: 'Life Insurance Provider — Unknown', description: "Narayan has a life insurance policy but can't recall the provider. Documents may be in the filing cabinet.", severity: 'amber', status: 'todo' },
  },
];

// ─── Demo sequence (Shift+D to trigger each step instantly) ──────────────────
const DEMO_SEQUENCE: {
  note?: Omit<CapturedItem, 'id' | 'timestamp'>;
  action?: Omit<ActionItem, 'id'>;
  claraMessage: string;
}[] = [
  {
    claraMessage: "That's really helpful, Narayan. So you have a current account with Barclays — and you keep the statements in a blue folder in the top drawer. Is that right?",
    note: { category: 'bank_accounts', content: 'Barclays current account mentioned. Statements in blue folder, top drawer of desk in study.', confidence: 'clear', flag: false },
  },
  {
    claraMessage: "Thank you. Do you happen to remember if you set up a Power of Attorney with anyone — perhaps with Sunil or another family member?",
    action: { title: 'Power of Attorney — Not confirmed', description: "Narayan hasn't confirmed whether a Lasting Power of Attorney is in place. Without this, the family may face Court of Protection proceedings — costing £20,000+ and taking 9+ months.", severity: 'red', status: 'todo', learnMoreUrl: 'https://www.gov.uk/power-of-attorney' },
  },
  {
    claraMessage: "I understand. Do you remember the name of your pension provider? You mentioned you had a council pension.",
    note: { category: 'financial_accounts', content: 'Council pension mentioned but provider unknown. Narayan believes it may be through the local authority.', confidence: 'needs-follow-up', flag: true },
    action: { title: 'Pension Provider — Unknown', description: "Narayan mentioned a council pension but couldn't recall the provider. Use the government's free Pension Tracing Service.", severity: 'amber', status: 'todo', learnMoreUrl: 'https://www.gov.uk/find-pension-contact-details' },
  },
  {
    claraMessage: "That's perfectly fine. Do you have a will, Narayan? And do you know where it's kept?",
    note: { category: 'documents', content: "Will exists, drawn up by Henderson & Partners solicitors. Kept in a brown envelope in the filing cabinet.", confidence: 'clear', flag: false },
  },
  {
    claraMessage: "Lovely. Is there anything you'd like your family to know about how you'd like to be cared for?",
    note: { category: 'care_wishes', content: 'Narayan would prefer to stay at home as long as possible. Would like Sunil to manage things.', confidence: 'clear', flag: false },
  },
  {
    claraMessage: "That's very clear, Narayan. Do you have any insurance policies? Life insurance, home insurance, anything like that?",
    note: { category: 'documents', content: "Home insurance with Aviva, renews in March. Life insurance policy exists but provider unknown.", confidence: 'needs-follow-up', flag: true },
    action: { title: 'Life Insurance Provider — Unknown', description: "Narayan has a life insurance policy but can't recall the provider. Documents may be in the filing cabinet. Sunil should check.", severity: 'amber', status: 'todo' },
  },
];

// ─── Provider ─────────────────────────────────────────────────────────────────
export function SessionProvider({ children }: { children: ReactNode }) {
  const [parentName] = useState('Narayan');
  const [childName] = useState('Sunil');

  // Start completely empty — no pre-loaded data.
  const [capturedItems, setCapturedItems] = useState<CapturedItem[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [sessions] = useState<SessionEntry[]>([]);

  const [claraResponses] = useState<ClaraResponse[]>([]);
  const [lastClaraMessage, setLastClaraMessage] = useState('');
  const [lastUserMessage, setLastUserMessage] = useState('');
  const [isListening, setListening] = useState(false);
  const [isThinking, setThinking] = useState(false);
  const [turnIndex, setTurnIndex] = useState(0);
  const [userNotes, setUserNotes] = useState<Record<string, string>>({});
  const [demoStep, setDemoStep] = useState(0);

  const addCapturedItem = useCallback((item: CapturedItem) => {
    setCapturedItems(prev => [item, ...prev]);
  }, []);

  const addActionItem = useCallback((item: ActionItem) => {
    setActionItems(prev => [item, ...prev]);
  }, []);

  const updateActionStatus = useCallback((id: string, status: ActionItem['status']) => {
    setActionItems(prev => prev.map(a => (a.id === id ? { ...a, status } : a)));
  }, []);

  const setUserNote = useCallback((id: string, note: string) => {
    setUserNotes(prev => ({ ...prev, [id]: note }));
  }, []);

  // ─── ElevenLabs tool call handler ─────────────────────────────────────────
  // Called by Conversation.tsx when the ElevenLabs agent fires a tool.
  // Define "capture_note" and "flag_action" tools in your ElevenLabs agent dashboard.
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
        };
        addCapturedItem(item);
        console.log('📋 Note captured from agent:', item);
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
        console.log('⚠️ Action flagged from agent:', action);
      }
    },
    [addCapturedItem, addActionItem]
  );

  // ─── Instant demo step (Shift+D in Conversation page) ────────────────────
  const triggerDemoStep = useCallback(() => {
    const step = DEMO_SEQUENCE[demoStep % DEMO_SEQUENCE.length];
    setLastClaraMessage(step.claraMessage);
    if (step.note) {
      addCapturedItem({ ...step.note, id: `item-${Date.now()}`, timestamp: new Date() });
    }
    if (step.action) {
      addActionItem({ ...step.action, id: `action-${Date.now()}` });
    }
    setDemoStep(prev => prev + 1);
  }, [demoStep, addCapturedItem, addActionItem]);

  // ─── Mock demo turns (animated, with delays) ─────────────────────────────
  const simulateConversationTurn = useCallback(() => {
    const turn = MOCK_TURNS[turnIndex % MOCK_TURNS.length];
    setListening(true);

    setTimeout(() => {
      setListening(false);
      setThinking(true);

      setTimeout(() => {
        setThinking(false);
        setLastClaraMessage(turn.spoken);

        if (turn.note) {
          addCapturedItem({ ...turn.note, id: `item-${Date.now()}`, timestamp: new Date() });
        }
        if (turn.action) {
          addActionItem({ ...turn.action, id: `action-${Date.now()}` });
        }

        setTurnIndex(prev => prev + 1);
      }, 2000);
    }, 3000);
  }, [turnIndex, addCapturedItem, addActionItem]);

  return (
    <SessionContext.Provider
      value={{
        parentName, childName, capturedItems, actionItems, sessions, claraResponses,
        lastClaraMessage, lastUserMessage, isListening, isThinking, userNotes, demoStep,
        addCapturedItem, addActionItem, updateActionStatus,
        setListening, setThinking, setLastClaraMessage, setLastUserMessage, setUserNote,
        simulateConversationTurn, triggerDemoStep,
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
