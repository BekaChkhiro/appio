import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface ChatState {
  messages: ChatMessage[];
  draft: string;
  isStreaming: boolean;
  addMessage: (msg: Omit<ChatMessage, "id" | "timestamp">) => void;
  setMessages: (messages: ChatMessage[]) => void;
  setDraft: (draft: string) => void;
  setStreaming: (streaming: boolean) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      draft: "",
      isStreaming: false,
      addMessage: (msg) =>
        set((state) => ({
          messages: [
            ...state.messages,
            {
              ...msg,
              id: crypto.randomUUID(),
              timestamp: Date.now(),
            },
          ],
        })),
      setMessages: (messages) => set({ messages }),
      setDraft: (draft) => set({ draft }),
      setStreaming: (streaming) => set({ isStreaming: streaming }),
      clearMessages: () => set({ messages: [] }),
    }),
    {
      name: "appio-chat",
      partialize: (state) => ({
        messages: state.messages,
        draft: state.draft,
      }),
    }
  )
);
