import { create } from 'zustand';
import type { ChatMessage, Conversation } from '@characterverse/types';

interface StreamingMessage {
  id: string;
  content: string;
  isStreaming: boolean;
}

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, ChatMessage[]>;
  streamingMessages: Record<string, StreamingMessage | null>;
  isLoading: Record<string, boolean>;
  isSending: boolean;

  setConversations: (conversations: Conversation[]) => void;
  setActiveConversation: (id: string | null) => void;
  setMessages: (conversationId: string, messages: ChatMessage[]) => void;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  setStreamingMessage: (conversationId: string, message: StreamingMessage | null) => void;
  appendStreamChunk: (conversationId: string, chunk: string) => void;
  finalizeStreamingMessage: (conversationId: string, finalMessage: ChatMessage) => void;
  setLoading: (conversationId: string, loading: boolean) => void;
  setSending: (sending: boolean) => void;
}

export const useChatStore = create<ChatState>()((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  streamingMessages: {},
  isLoading: {},
  isSending: false,

  setConversations: (conversations) => set({ conversations }),

  setActiveConversation: (id) => set({ activeConversationId: id }),

  setMessages: (conversationId, messages) =>
    set({ messages: { ...get().messages, [conversationId]: messages } }),

  addMessage: (conversationId, message) =>
    set({
      messages: {
        ...get().messages,
        [conversationId]: [...(get().messages[conversationId] || []), message],
      },
    }),

  setStreamingMessage: (conversationId, message) =>
    set({ streamingMessages: { ...get().streamingMessages, [conversationId]: message } }),

  appendStreamChunk: (conversationId, chunk) => {
    const current = get().streamingMessages[conversationId];
    if (!current) return;
    set({
      streamingMessages: {
        ...get().streamingMessages,
        [conversationId]: { ...current, content: current.content + chunk },
      },
    });
  },

  finalizeStreamingMessage: (conversationId, finalMessage) => {
    set({
      messages: {
        ...get().messages,
        [conversationId]: [...(get().messages[conversationId] || []), finalMessage],
      },
      streamingMessages: { ...get().streamingMessages, [conversationId]: null },
    });
  },

  setLoading: (conversationId, loading) =>
    set({ isLoading: { ...get().isLoading, [conversationId]: loading } }),

  setSending: (isSending) => set({ isSending }),
}));
