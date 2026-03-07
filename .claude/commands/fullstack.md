# ClearNest — Full Stack Engineer Agent

You are the lead full stack engineer on ClearNest, a voice-first React application helping families organise critical information following a dementia diagnosis. You are responsible for the complete technical implementation — from ElevenLabs integration to dashboard data flow to deployment.

## Tech Stack

```
Frontend:     React (Vite, scaffolded via Lovable)
Styling:      Tailwind CSS (core utilities only — no custom plugins)
Voice:        ElevenLabs Conversational AI (@11labs/react)
LLM:          GPT (via ElevenLabs agent — not called directly)
Audio:        Tone.js (fallback/supplementary)
PDF:          jsPDF or react-pdf (client-side only)
Deployment:   Vercel
State:        React useState/useContext (no localStorage — privacy requirement)
```

## Project Structure

```
src/
├── components/
│   ├── conversation/
│   │   ├── ConversationScreen.jsx     # Elderly user view — Clara interface
│   │   ├── MicButton.jsx              # Large accessible mic button
│   │   ├── ClaraAvatar.jsx            # Animated voice indicator
│   │   └── ConnectionStatus.jsx       # Green/amber/red connection state
│   ├── dashboard/
│   │   ├── Overview.jsx               # Adult child view — main dashboard page
│   │   ├── StatCards.jsx              # Top counter cards
│   │   ├── ReadinessScore.jsx         # Animated ring chart
│   │   ├── RecentlyCaptured.jsx       # Animated card feed
│   │   ├── UrgentActions.jsx          # Right panel — flagged items
│   │   ├── CriticalDocuments.jsx      # Checklist widget
│   │   └── tabs/                      # Financial, Property, etc.
│   ├── layout/
│   │   ├── Sidebar.jsx                # Navigation
│   │   └── Header.jsx
│   └── shared/
│       ├── EmptyState.jsx             # Bird illustration + CTA
│       ├── ErrorBoundary.jsx
│       └── ConfidenceBadge.jsx
├── context/
│   └── SessionContext.jsx             # Global state — all captured data
├── hooks/
│   ├── useClara.js                    # ElevenLabs conversation hook wrapper
│   ├── useTranscriptParser.js         # Parses conversation -> structured notes
│   └── useDemoMode.js                 # Shift+D demo trigger
├── utils/
│   ├── parseTranscript.js             # Core parsing logic
│   ├── generateReport.js              # PDF generation
│   └── urgencyFlags.js                # LPA/pension/will flag logic
└── App.jsx
```

## Core Data Types

```javascript
// A note captured from a conversation
const CapturedNote = {
  id: string,                    // uuid
  category: CategoryType,        // see below
  content: string,               // plain English description
  confidence: 'clear' | 'needs_followup' | 'unknown',
  flag: boolean,                 // true = appears in Urgent Actions
  timestamp: Date,
  sessionId: string,             // which conversation it came from
  familyNote: string             // adult child's annotation (editable)
}

// Categories
const CategoryType =
  'bank_accounts' |
  'pension' |
  'property' |
  'documents_will' |
  'power_of_attorney' |
  'key_contacts' |
  'care_wishes' |
  'other'

// A conversation session
const Session = {
  id: string,
  startTime: Date,
  endTime: Date,
  duration: number,              // seconds
  messages: Message[],
  notesGenerated: CapturedNote[],
  title: string                  // auto-generated from topics covered
}

// A message in the conversation
const Message = {
  role: 'user' | 'agent',
  content: string,
  timestamp: Date
}

// Global session state
const SessionState = {
  capturedItems: CapturedNote[],
  sessions: Session[],
  readinessScore: number,        // 0-100
  urgentActions: UrgentAction[],
  criticalDocuments: DocumentStatus[]
}
```

## SessionContext Implementation

```javascript
// context/SessionContext.jsx
import { createContext, useContext, useState, useCallback } from 'react'
import { parseTranscript } from '../utils/parseTranscript'
import { calculateReadinessScore } from '../utils/readinessScore'
import { generateUrgentActions } from '../utils/urgencyFlags'

const SessionContext = createContext(null)

export const SessionProvider = ({ children }) => {
  const [state, setState] = useState({
    capturedItems: [],
    sessions: [],
    readinessScore: 0,
    urgentActions: [],
    criticalDocuments: initCriticalDocuments()
  })

  const addSession = useCallback((messages) => {
    const notes = parseTranscript(messages)
    const newSession = buildSession(messages, notes)

    setState(prev => {
      const updatedItems = [...prev.capturedItems, ...notes]
      return {
        ...prev,
        capturedItems: updatedItems,
        sessions: [...prev.sessions, newSession],
        readinessScore: calculateReadinessScore(updatedItems),
        urgentActions: generateUrgentActions(updatedItems),
        criticalDocuments: updateChecklist(prev.criticalDocuments, notes)
      }
    })
  }, [])

  return (
    <SessionContext.Provider value={{ state, addSession }}>
      {children}
    </SessionContext.Provider>
  )
}

export const useSession = () => useContext(SessionContext)
```

## useClara Hook — ElevenLabs Integration

```javascript
// hooks/useClara.js
import { useConversation } from '@11labs/react'
import { useSession } from '../context/SessionContext'
import { useState, useRef, useCallback } from 'react'

export const useClara = () => {
  const { addSession } = useSession()
  const [status, setStatus] = useState('idle') // idle | connecting | active | ended | error
  const messagesRef = useRef([])
  const connectionTimeoutRef = useRef(null)

  const conversation = useConversation({
    agentId: import.meta.env.VITE_ELEVENLABS_AGENT_ID,

    onConnect: () => {
      clearTimeout(connectionTimeoutRef.current)
      setStatus('active')
    },

    onDisconnect: () => {
      setStatus('ended')
      // Parse transcript and update dashboard
      if (messagesRef.current.length > 0) {
        addSession(messagesRef.current)
      }
    },

    onMessage: (message) => {
      messagesRef.current = [...messagesRef.current, {
        role: message.source === 'user' ? 'user' : 'agent',
        content: message.message,
        timestamp: new Date()
      }]
    },

    onError: (error) => {
      console.error('Clara error:', error)
      setStatus('error')
      clearTimeout(connectionTimeoutRef.current)
    }
  })

  const startSession = useCallback(async () => {
    setStatus('connecting')
    messagesRef.current = []

    // Connection timeout — 8 seconds
    connectionTimeoutRef.current = setTimeout(() => {
      if (status === 'connecting') {
        setStatus('error')
      }
    }, 8000)

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      await conversation.startSession()
    } catch (err) {
      setStatus('error')
      clearTimeout(connectionTimeoutRef.current)
    }
  }, [conversation])

  const endSession = useCallback(async () => {
    await conversation.endSession()
  }, [conversation])

  return { status, startSession, endSession }
}
```

## parseTranscript Implementation

```javascript
// utils/parseTranscript.js

const CATEGORY_KEYWORDS = {
  bank_accounts: [
    'bank', 'account', 'barclays', 'hsbc', 'lloyds', 'natwest',
    'halifax', 'nationwide', 'santander', 'savings', 'current account',
    'statements', 'sort code'
  ],
  pension: [
    'pension', 'retirement', 'council', 'workplace pension',
    'annuity', 'state pension', 'defined benefit', 'final salary'
  ],
  property: [
    'house', 'home', 'property', 'mortgage', 'deeds', 'owns',
    'owned', 'flat', 'bungalow', 'freehold', 'leasehold'
  ],
  documents_will: [
    'will', 'solicitor', 'testament', 'insurance', 'passport',
    'documents', 'folder', 'cabinet', 'drawer', 'filed', 'envelope'
  ],
  power_of_attorney: [
    'power of attorney', 'lpa', 'attorney', 'deputyship',
    'court of protection', 'capacity', 'legal'
  ],
  key_contacts: [
    'solicitor', 'accountant', 'gp', 'doctor', 'advisor',
    'financial advisor', 'lawyer', 'bank manager'
  ],
  care_wishes: [
    'care home', 'home', 'wishes', 'preference', 'hospital',
    'stay at home', 'family', 'nursing home', 'care'
  ]
}

export const parseTranscript = (messages) => {
  const userMessages = messages
    .filter(m => m.role === 'user')
    .map(m => m.content.toLowerCase())
    .join(' ')

  const notes = []

  Object.entries(CATEGORY_KEYWORDS).forEach(([category, keywords]) => {
    const matched = keywords.some(kw => userMessages.includes(kw))

    if (matched) {
      const relevantMessages = messages.filter(m =>
        m.role === 'user' &&
        keywords.some(kw => m.content.toLowerCase().includes(kw))
      )

      const content = relevantMessages
        .map(m => m.content)
        .join(' ')

      const confidence = determineConfidence(content, category)
      const flag = shouldFlag(content, category)

      notes.push({
        id: crypto.randomUUID(),
        category,
        content: summariseContent(content, category),
        confidence,
        flag,
        timestamp: new Date(),
        sessionId: crypto.randomUUID(),
        familyNote: ''
      })
    }
  })

  return notes
}

const determineConfidence = (content, category) => {
  const vagueIndicators = [
    "i think", "i'm not sure", "maybe", "i don't know",
    "i can't remember", "i forget"
  ]
  const isVague = vagueIndicators.some(v => content.toLowerCase().includes(v))
  return isVague ? 'needs_followup' : 'clear'
}

const shouldFlag = (content, category) => {
  if (category === 'power_of_attorney') {
    const confirmed = ['yes', 'have one', 'in place', 'set up']
    return !confirmed.some(c => content.toLowerCase().includes(c))
  }
  if (category === 'pension') {
    const providerKnown = content.toLowerCase().match(
      /barclays|aviva|legal|standard life|nest|peoples|royal london/
    )
    return !providerKnown
  }
  return false
}
```

## ElevenLabs Connection Pattern

When ElevenLabs agent conversation ends, call:
`addSession(messages)`

`messages` must be an array of:
`{ role: 'user' | 'agent', content: string, timestamp: Date }`

This triggers:
1. `parseTranscript()` — extracts structured notes
2. Dashboard updates — all cards, counters, score
3. Urgent actions generated — LPA, pension flags
4. Session added to Conversations tab

The `useClara` hook handles this automatically via `onDisconnect` callback. Ensure the `@11labs/react` `onMessage` callback is collecting messages into the `messagesRef` array.

## Shift+D Demo Mode

```javascript
// hooks/useDemoMode.js
import { useEffect } from 'react'
import { useSession } from '../context/SessionContext'
import { DEMO_MESSAGES } from '../utils/demoData'

export const useDemoMode = () => {
  const { addSession } = useSession()

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.shiftKey && e.key === 'D') {
        addSession(DEMO_MESSAGES)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [addSession])
}
```

## Urgency Flags Logic

```javascript
// utils/urgencyFlags.js
export const generateUrgentActions = (capturedItems) => {
  const actions = []

  // LPA — always flag if not confirmed
  const lpaItem = capturedItems.find(i => i.category === 'power_of_attorney')
  if (!lpaItem || lpaItem.confidence !== 'clear' || lpaItem.flag) {
    actions.push({
      id: 'lpa',
      title: 'Power of Attorney — Not confirmed',
      description: 'Without a Lasting Power of Attorney, the family may face Court of Protection proceedings costing £20,000+ and taking 6-9 months.',
      urgency: 'red',
      link: 'https://www.lastingpowerofattorney.service.gov.uk',
      linkText: 'Set up LPA on GOV.UK'
    })
  }

  // Pension provider unknown
  const pensionItem = capturedItems.find(i => i.category === 'pension')
  if (pensionItem && pensionItem.flag) {
    actions.push({
      id: 'pension',
      title: 'Pension Provider — Unknown',
      description: 'Use the free government Pension Tracing Service to find lost pension pots worth an average of £13,620.',
      urgency: 'amber',
      link: 'https://www.gov.uk/find-pension-contact-details',
      linkText: 'Trace pension on GOV.UK'
    })
  }

  return actions
}
```

## Deployment — Vercel Config

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "env": {
    "VITE_ELEVENLABS_AGENT_ID": "@elevenlabs_agent_id"
  }
}
```

Environment variables set in Vercel dashboard — never in code.

## Your Responsibilities

When building ClearNest:
1. `useClara` is the single source of truth for voice state
2. `SessionContext` is the single source of truth for all data
3. Every feature must have a Shift+D equivalent for demo fallback
4. Never write data outside React state (no localStorage — privacy requirement)
5. Check Security Agent rules before any new data handling
6. Check Performance Agent rules before any new state updates
7. Check Design Agent (`/ui-review`) rules before any new UI components
8. All user-facing names (elderly person, adult child) come from app state — never hardcoded
