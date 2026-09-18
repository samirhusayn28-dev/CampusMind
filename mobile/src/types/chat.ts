export type ChatLanguage = 'en' | 'roman_urdu' | 'urdu';

export interface ChatSource {
  chunkIndex: number;
  textSnippet: string;
  score: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  sources?: ChatSource[];
  materialId?: string;
  language?: ChatLanguage;
}
