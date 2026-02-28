

# Fix Conversation Screen — Clara Not Responding & PTT Broken

## Root Causes Found

### 1. `onToolCall` is not a valid callback (CRITICAL)
The code passes `onToolCall` to `useConversation` (line 166), but this callback does **not exist** in the ElevenLabs React SDK. The valid callbacks are: `onConnect`, `onDisconnect`, `onError`, `onMessage`, `onAudio`, `onDebug`, `onUnhandledClientToolCall`.

Agent-initiated tool calls (like `capture_note`, `flag_action`) must be handled via the `clientTools` config property instead. Currently, all tool calls from Clara are silently dropped.

### 2. Unstable `conversation` object in dependency array
The `useConversation` hook returns a **new object on every render** (no internal useMemo). Since `conversation` is in the `useCallback` dependency array for `startSession` (line 277), the `startSession` function is recreated every render. This makes the ref-based guards (`isStartingRef`, `isSessionActiveRef`) potentially unreliable when React batches state updates from `onDisconnect` triggering re-renders.

### 3. Hook does NOT auto-connect (user's diagnosis is wrong)
Confirmed by reading the SDK source: `useConversation` never calls `startSession` automatically. It only cleans up (calls `endSession`) on unmount.

## Plan

### Step 1: Replace `onToolCall` with `clientTools`
Move tool call handling from the invalid `onToolCall` callback into the `clientTools` config property of `useConversation`. Define `capture_note` and `flag_action` as client tool functions that call `handleAgentToolCall`.

```
// Before (broken - silently ignored):
onToolCall: (toolCall) => {
  handleAgentToolCall(toolCall.tool_name, toolCall.parameters);
}

// After (correct):
clientTools: {
  capture_note: (params) => {
    handleAgentToolCall('capture_note', params);
    return "Note captured";
  },
  flag_action: (params) => {
    handleAgentToolCall('flag_action', params);
    return "Action flagged";
  },
}
```

### Step 2: Stabilize `startSession` with a ref for the conversation object
Store the `conversation` object's `startSession` and `endSession` methods in a ref to prevent the `useCallback` from being recreated on every render.

### Step 3: Use `conversation.status` as source of truth
Replace the manual `isSessionActive` / `isStarting` state with the hook's built-in `conversation.status` property (`'disconnected' | 'connecting' | 'connected' | 'disconnecting'`). This eliminates the state sync bugs between the component state and the SDK's internal state.

### Technical Details
- File changed: `src/pages/Conversation.tsx`
- No new dependencies needed
- The `onConnect` / `onDisconnect` callbacks can be simplified since `status` is managed by the hook internally
- The PTT (press-to-talk) logic remains the same but uses `conversation.status === 'connected'` instead of `isSessionActive`

