import { create } from 'zustand';
import { ChatMessage, ChatLanguage, ChatSource } from '../types/chat';
import { StudyMaterial } from '../types/content';
import { askStudyChat } from '../services/api';

interface ChatStoreState {
  messagesByMaterial: Record<string, ChatMessage[]>;
  selectedMaterialId: string | null;
  chatLanguage: ChatLanguage;
  isSending: boolean;
  error: string | null;

  // Actions
  setSelectedMaterialId: (materialId: string | null) => void;
  setChatLanguage: (lang: ChatLanguage) => void;
  getMessagesForMaterial: (materialId?: string | null, material?: StudyMaterial | null) => ChatMessage[];
  sendMessage: (text: string, material: StudyMaterial | null) => Promise<void>;
  clearChat: (materialId?: string | null) => void;
}

const DEFAULT_GENERAL_KEY = 'general_study';

function formatTimestamp(): string {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minutesStr = minutes < 10 ? '0' + minutes : minutes;
  return `${hours}:${minutesStr} ${ampm}`;
}

export const useChatStore = create<ChatStoreState>((set, get) => ({
  messagesByMaterial: {},
  selectedMaterialId: null,
  chatLanguage: 'en',
  isSending: false,
  error: null,

  setSelectedMaterialId: (materialId: string | null) => {
    set({ selectedMaterialId: materialId });
  },

  setChatLanguage: (lang: ChatLanguage) => {
    set({ chatLanguage: lang });
  },

  getMessagesForMaterial: (materialId?: string | null, material?: StudyMaterial | null) => {
    const key = materialId || material?.id || DEFAULT_GENERAL_KEY;
    const existing = get().messagesByMaterial[key];

    if (existing && existing.length > 0) {
      return existing;
    }

    // Default welcoming message
    const title = material?.title || 'your coursework';
    const welcomeMsg: ChatMessage = {
      id: `welcome_${key}`,
      sender: 'assistant',
      text: `Hello! I'm CampusMind, your study companion for ${title}. Ask me anything grounded in this lecture, request an explanation of tricky concepts, or ask what might appear on your exam!`,
      timestamp: formatTimestamp(),
      materialId: material?.id,
      language: get().chatLanguage,
    };

    return [welcomeMsg];
  },

  sendMessage: async (text: string, material: StudyMaterial | null) => {
    const cleanText = text.trim();
    if (!cleanText || get().isSending) return;

    const key = material?.id || DEFAULT_GENERAL_KEY;
    const currentList = get().getMessagesForMaterial(key, material);
    const activeLanguage = get().chatLanguage;

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: cleanText,
      timestamp: formatTimestamp(),
      materialId: material?.id,
      language: activeLanguage,
    };

    // Optimistically add user message
    const updatedMessages = [...currentList, userMessage];
    set((state) => ({
      messagesByMaterial: {
        ...state.messagesByMaterial,
        [key]: updatedMessages,
      },
      isSending: true,
      error: null,
    }));

    try {
      // Build history for backend
      const history = updatedMessages.slice(-6).map((m) => ({
        role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.text,
      }));

      const res = await askStudyChat({
        message: cleanText,
        materialId: material?.id,
        materialTitle: material?.title,
        materialText: material?.extractedText,
        materialSummary: material?.summary,
        history,
        language: activeLanguage,
      });

      const assistantMessage: ChatMessage = {
        id: `ai_${Date.now()}`,
        sender: 'assistant',
        text: res.reply,
        timestamp: formatTimestamp(),
        sources: res.sources,
        materialId: material?.id,
        language: activeLanguage,
      };

      set((state) => ({
        messagesByMaterial: {
          ...state.messagesByMaterial,
          [key]: [...(state.messagesByMaterial[key] || updatedMessages), assistantMessage],
        },
        isSending: false,
      }));
    } catch (err: any) {
      console.error('StudyChat error:', err);
      const errorMessage: ChatMessage = {
        id: `err_${Date.now()}`,
        sender: 'assistant',
        text:
          activeLanguage === 'roman_urdu'
            ? 'Maazrat, abhi network issue ki wajah se jawab generate nahi ho saka. Baraye meherbani dobara koshish karein.'
            : activeLanguage === 'urdu'
            ? 'معذرت، ابھی رابطہ قائم نہیں ہو سکا۔ برائے مہربانی دوبارہ کوشش کریں۔'
            : "I'm having a little trouble connecting right now. Please verify your connection or try asking again in a moment.",
        timestamp: formatTimestamp(),
        materialId: material?.id,
        language: activeLanguage,
      };

      set((state) => ({
        messagesByMaterial: {
          ...state.messagesByMaterial,
          [key]: [...(state.messagesByMaterial[key] || updatedMessages), errorMessage],
        },
        isSending: false,
        error: err.message || 'Failed to send message',
      }));
    }
  },

  clearChat: (materialId?: string | null) => {
    const key = materialId || DEFAULT_GENERAL_KEY;
    set((state) => {
      const copy = { ...state.messagesByMaterial };
      delete copy[key];
      return { messagesByMaterial: copy };
    });
  },
}));
