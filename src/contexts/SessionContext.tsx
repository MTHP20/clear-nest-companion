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
  isListening: boolean;
  isThinking: boolean;
  userNotes: Record<string, string>;
  demoStep: number;
  addCapturedItem: (item: CapturedItem) => void;
  addActionItem: (item: ActionItem) => void;
  updateActionStatus: (id: string, status: ActionItem['status']) => void;
  setUserNote: (id: string, note: string) => void;
  setListening: (v: boolean) => void;
  setThinking: (v: boolean) => void;
  setLastClaraMessage: (msg: string) => void;
  triggerDemoStep: () => void;
  simulateConversationTurn: () => void;
}

const SessionContext = createContext<SessionContextType | null>(null);

// ---------------------------------------------------------------------------
// DEMO SEQUENCE — 6 steps triggered by Shift+D on the conversation screen.
// Each step simulates one structured note (and optional action) coming back
// from Clara as if Narayan had just spoken that part of the conversation.
//
// MICHAEL — CONNECT HERE:
// Replace this demo sequence with real data from the ElevenLabs agent.
// When the agent returns a tool-call / structured response, parse the JSON
// and call addCapturedItem(structuredNote) and/or addActionItem(actionItem).
// The shape of CapturedItem and ActionItem is defined above.
// ---------------------------------------------------------------------------
const DEMO_SEQUENCE: {
  claraSpoke: string;
  note?: Omit<CapturedItem, 'id' | 'timestamp'>;
  action?: Omit<ActionItem, 'id'>;
}[] = [
  {
    // Step 1 — Bank account
    claraSpoke: "That's really helpful. So you have a current account with Barclays — and you keep the statements in the blue folder in the top drawer. Is that right?",
    note: {
      category: 'bank_accounts',
      content: 'Barclays current account. Statements in blue folder, top drawer.',
      confidence: 'clear',
      flag: false,
    },
  },
  {
    // Step 2 — Pension (flags action)
    claraSpoke: "I understand. Do you remember the name of your pension provider? You mentioned you had a council pension.",
    note: {
      category: 'financial_accounts',
      content: 'Council pension mentioned. Provider unknown — may be through local authority.',
      confidence: 'needs-follow-up',
      flag: true,
    },
    action: {
      title: 'Pension Provider — Unknown',
      description: "Narayan mentioned a council pension but couldn't recall the provider. Use the government's free Pension Tracing Service to locate it.",
      severity: 'amber',
      status: 'todo',
      learnMoreUrl: 'https://www.gov.uk/find-pension-contact-details',
    },
  },
  {
    // Step 3 — Power of Attorney (action only, no captured note)
    claraSpoke: "Do you happen to know if you've ever set up a Power of Attorney — perhaps with Sunil or another family member?",
    action: {
      title: 'Power of Attorney — Not confirmed',
      description: "Narayan hasn't confirmed whether a Lasting Power of Attorney is in place. Without this, the family may face Court of Protection proceedings — costing £20,000+ and taking 9+ months.",
      severity: 'red',
      status: 'todo',
      learnMoreUrl: 'https://www.gov.uk/power-of-attorney',
    },
  },
  {
    // Step 4 — Property
    claraSpoke: "Lovely. And do you own your home, Narayan? Do you know where the property deeds are kept?",
    note: {
      category: 'property',
      content: 'Owns family home. Deeds location unknown — may be with solicitors.',
      confidence: 'needs-follow-up',
      flag: true,
    },
  },
  {
    // Step 5 — Care wishes
    claraSpoke: "Is there anything you'd like your family to know about how you'd like to be cared for, if you ever needed extra help?",
    note: {
      category: 'care_wishes',
      content: 'Prefers to remain at home if possible. Would like Sunil to manage things.',
      confidence: 'clear',
      flag: false,
    },
  },
  {
    // Step 6 — Will
    claraSpoke: "One last thing — do you have a will, and do you know where it's kept?",
    note: {
      category: 'documents',
      content: 'Will exists. Kept in brown envelope in the filing cabinet in the study.',
      confidence: 'clear',
      flag: false,
    },
  },
];

// ---------------------------------------------------------------------------
// MOCK_TURNS — used by simulateConversationTurn (the mic button on the
// conversation screen). Points at the same DEMO_SEQUENCE so both the
// mic button and Shift+D drive identical demo data.
// ---------------------------------------------------------------------------
const MOCK_TURNS = DEMO_SEQUENCE;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [parentName] = useState('Narayan');

  // Start completely empty — no pre-loaded data.
  const [capturedItems, setCapturedItems] = useState<CapturedItem[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [sessions] = useState<SessionEntry[]>([]);

  const [claraResponses] = useState<ClaraResponse[]>([]);
  const [lastClaraMessage, setLastClaraMessage] = useState('');
  const [isListening, setListening] = useState(false);
  const [isThinking, setThinking] = useState(false);
  const [turnIndex, setTurnIndex] = useState(0);
  const [demoStep, setDemoStep] = useState(0);
  const [userNotes, setUserNotes] = useState<Record<string, string>>({});

  // ---------------------------------------------------------------------------
  // MICHAEL — CONNECT HERE:
  // addCapturedItem is the single function that populates the dashboard.
  // Call it whenever the ElevenLabs agent returns a structured note:
  //
  //   addCapturedItem({
  //     id: crypto.randomUUID(),
  //     category: 'bank_accounts', // or 'documents', 'property', etc.
  //     content: 'Narayan has a Barclays current account.',
  //     confidence: 'clear',       // or 'needs-follow-up'
  //     flag: false,
  //     timestamp: new Date(),
  //   });
  //
  // Similarly, call addActionItem() for any flagged issues.
  // ---------------------------------------------------------------------------
  const addCapturedItem = useCallback((item: CapturedItem) => {
    setCapturedItems(prev => [item, ...prev]);
  }, []);

  const addActionItem = useCallback((item: ActionItem) => {
    setActionItems(prev => [item, ...prev]);
  }, []);

  const updateActionStatus = useCallback((id: string, status: ActionItem['status']) => {
    setActionItems(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  }, []);

  const setUserNote = useCallback((id: string, note: string) => {
    setUserNotes(prev => ({ ...prev, [id]: note }));
  }, []);

  // triggerDemoStep — instant version for Shift+D (no listening/thinking delay).
  // Fires the next item in DEMO_SEQUENCE and moves the pointer forward.
  const triggerDemoStep = useCallback(() => {
    if (demoStep >= DEMO_SEQUENCE.length) return;

    const step = DEMO_SEQUENCE[demoStep];
    const ts = Date.now();

    setLastClaraMessage(step.claraSpoke);

    if (step.note) {
      addCapturedItem({
        ...step.note,
        id: `item-${ts}`,
        timestamp: new Date(),
      });
    }

    if (step.action) {
      addActionItem({
        ...step.action,
        id: `action-${ts}`,
      });
    }

    setDemoStep(prev => prev + 1);
  }, [demoStep, addCapturedItem, addActionItem]);

  // simulateConversationTurn — used by the mic button, adds listening/thinking
  // animation then fires the same DEMO_SEQUENCE data.
  const simulateConversationTurn = useCallback(() => {
    const turn = MOCK_TURNS[turnIndex % MOCK_TURNS.length];
    setListening(true);

    setTimeout(() => {
      setListening(false);
      setThinking(true);

      setTimeout(() => {
        setThinking(false);
        setLastClaraMessage(turn.claraSpoke);

        if (turn.note) {
          addCapturedItem({
            ...turn.note,
            id: `item-${Date.now()}`,
            timestamp: new Date(),
          });
        }

        if (turn.action) {
          addActionItem({
            ...turn.action,
            id: `action-${Date.now()}`,
          });
        }

        setTurnIndex(prev => prev + 1);
      }, 2000);
    }, 3000);
  }, [turnIndex, addCapturedItem, addActionItem]);

  return (
    <SessionContext.Provider value={{
      parentName, capturedItems, actionItems, sessions, claraResponses,
      lastClaraMessage, isListening, isThinking, userNotes, demoStep,
      addCapturedItem, addActionItem, updateActionStatus, setUserNote,
      setListening, setThinking, setLastClaraMessage,
      triggerDemoStep, simulateConversationTurn,
    }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
