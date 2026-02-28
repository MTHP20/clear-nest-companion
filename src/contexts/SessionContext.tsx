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
  capturedItems: CapturedItem[];
  actionItems: ActionItem[];
  sessions: SessionEntry[];
  claraResponses: ClaraResponse[];
  lastClaraMessage: string;
  lastUserMessage: string;
  isListening: boolean;
  isThinking: boolean;
  // Notes Sarah can add manually to any captured item
  userNotes: Record<string, string>;
  setUserNote: (itemId: string, note: string) => void;
  addCapturedItem: (item: CapturedItem) => void;
  addActionItem: (item: ActionItem) => void;
  updateActionStatus: (id: string, status: ActionItem['status']) => void;
  setListening: (v: boolean) => void;
  setThinking: (v: boolean) => void;
  setLastClaraMessage: (msg: string) => void;
  setLastUserMessage: (msg: string) => void;
  simulateConversationTurn: () => void;
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
    spoken: "That's really helpful, Arthur. So you have a current account with Barclays — and you keep the statements in a blue folder in the top drawer. Is that right?",
    note: { category: 'bank_accounts', content: 'Barclays current account mentioned. Statements in blue folder, top drawer of desk in study.', confidence: 'clear', flag: false },
  },
  {
    spoken: "Thank you. Do you happen to remember if you set up a Power of Attorney with anyone — perhaps with Sarah or another family member?",
    action: { title: 'Power of Attorney — Not confirmed', description: "Arthur hasn't confirmed whether a Lasting Power of Attorney is in place. Without this, the family may face Court of Protection proceedings — costing £20,000+ and taking 9+ months.", severity: 'red', status: 'todo', learnMoreUrl: 'https://www.gov.uk/power-of-attorney' },
  },
  {
    spoken: "I understand. Do you remember the name of your pension provider? You mentioned you had a council pension.",
    note: { category: 'financial_accounts', content: 'Council pension mentioned but provider unknown.', confidence: 'needs-follow-up', flag: true },
    action: { title: 'Pension Provider — Unknown', description: "Arthur mentioned a council pension but couldn't recall the provider. Use the government's free Pension Tracing Service.", severity: 'amber', status: 'todo', learnMoreUrl: 'https://www.gov.uk/find-pension-contact-details' },
  },
  {
    spoken: "That's perfectly fine. Do you have a will, Arthur? And do you know where it's kept?",
    note: { category: 'documents', content: 'Will exists, drawn up by Henderson & Partners. Kept in a brown envelope in the filing cabinet.', confidence: 'clear', flag: false },
  },
  {
    spoken: "Lovely. Is there anything you'd like your family to know about how you'd like to be cared for?",
    note: { category: 'care_wishes', content: 'Arthur would prefer to stay at home as long as possible. Would like Sarah to manage things.', confidence: 'clear', flag: false },
  },
  {
    spoken: "That's very clear, Arthur. Do you have any insurance policies? Life insurance, home insurance, anything like that?",
    note: { category: 'documents', content: 'Home insurance with Aviva, renews in March. Life insurance policy exists but provider unknown.', confidence: 'needs-follow-up', flag: true },
    action: { title: 'Life Insurance Provider — Unknown', description: "Arthur has a life insurance policy but can't recall the provider. Documents may be in the filing cabinet.", severity: 'amber', status: 'todo' },
  },
];

// ─── Pre-loaded demo data ─────────────────────────────────────────────────────
const INITIAL_ITEMS: CapturedItem[] = [
  { id: '1', category: 'bank_accounts', content: 'Barclays current account mentioned. Statements in blue folder, top drawer of desk in study.', confidence: 'clear', flag: false, timestamp: new Date(Date.now() - 600000) },
  { id: '2', category: 'documents', content: 'Will exists, drawn up by Henderson & Partners solicitors on the High Street. Kept in a brown envelope in the filing cabinet.', confidence: 'clear', flag: false, timestamp: new Date(Date.now() - 480000) },
  { id: '3', category: 'financial_accounts', content: 'Council pension mentioned but provider unknown. Arthur believes it may be through the local authority.', confidence: 'needs-follow-up', flag: true, timestamp: new Date(Date.now() - 360000) },
  { id: '4', category: 'care_wishes', content: "Arthur would prefer to stay at home as long as possible. Doesn't want to go into a care home. Would like Sarah to manage things.", confidence: 'clear', flag: false, timestamp: new Date(Date.now() - 240000) },
  { id: '5', category: 'documents', content: "Home insurance with Aviva, renews in March. Life insurance policy exists but Arthur can't remember the provider.", confidence: 'needs-follow-up', flag: true, timestamp: new Date(Date.now() - 120000) },
  { id: '6', category: 'property', content: 'Family home owned outright, no mortgage. Deeds held by Henderson & Partners.', confidence: 'clear', flag: false, timestamp: new Date(Date.now() - 60000) },
  { id: '7', category: 'key_contacts', content: 'GP is Dr. Patel at Meadowbank Surgery. NHS number in a letter in the kitchen drawer.', confidence: 'clear', flag: false, timestamp: new Date() },
];

const INITIAL_ACTIONS: ActionItem[] = [
  { id: 'a1', title: 'Power of Attorney — Not confirmed', description: "Arthur hasn't confirmed whether a Lasting Power of Attorney is in place. Without this, the family may face Court of Protection proceedings — costing £20,000+ and taking 9+ months.", severity: 'red', status: 'todo', learnMoreUrl: 'https://www.gov.uk/power-of-attorney' },
  { id: 'a2', title: 'Pension Provider — Unknown', description: "Arthur mentioned a council pension but couldn't recall the provider. Use the government's free Pension Tracing Service.", severity: 'amber', status: 'todo', learnMoreUrl: 'https://www.gov.uk/find-pension-contact-details' },
  { id: 'a3', title: 'Life Insurance Provider — Unknown', description: "Arthur has a life insurance policy but can't recall the provider. Documents may be in the filing cabinet. Sarah should check.", severity: 'amber', status: 'todo' },
];

const INITIAL_SESSIONS: SessionEntry[] = [
  { id: 's1', date: new Date(), duration: '8 minutes', itemsCaptured: 7, actionsFlagged: 3 },
];

// ─── Provider ─────────────────────────────────────────────────────────────────
export function SessionProvider({ children }: { children: ReactNode }) {
  const [parentName] = useState('Arthur');
  const [capturedItems, setCapturedItems] = useState<CapturedItem[]>(INITIAL_ITEMS);
  const [actionItems, setActionItems] = useState<ActionItem[]>(INITIAL_ACTIONS);
  const [sessions] = useState<SessionEntry[]>(INITIAL_SESSIONS);
  const [claraResponses] = useState<ClaraResponse[]>([]);
  const [lastClaraMessage, setLastClaraMessage] = useState('');
  const [lastUserMessage, setLastUserMessage] = useState('');
  const [isListening, setListening] = useState(false);
  const [isThinking, setThinking] = useState(false);
  const [turnIndex, setTurnIndex] = useState(0);

  // Sarah's manual notes keyed by captured item ID
  const [userNotes, setUserNotes] = useState<Record<string, string>>({});

  const setUserNote = useCallback((itemId: string, note: string) => {
    setUserNotes(prev => ({ ...prev, [itemId]: note }));
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

  // ─── Mock demo turns ──────────────────────────────────────────────────────
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
        parentName,
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
        setListening,
        setThinking,
        setLastClaraMessage,
        setLastUserMessage,
        simulateConversationTurn,
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