export type ContentType = 'pdf' | 'youtube' | 'audio' | 'ocr';

export interface TranslatedContent {
  language: 'roman_urdu' | 'urdu';
  title: string;
  overview: string;
  keyPoints: string[];
  headings: {
    title: string;
    points: string[];
  }[];
  fullSummary: string;
}

export interface StudySummary {
  overview?: string;
  keyPoints: string[];
  headings: {
    title: string;
    points: string[];
  }[];
  fullSummary: string;
  translations?: {
    romanUrdu?: TranslatedContent;
    urdu?: TranslatedContent;
  };
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface ConceptNode {
  id: string;
  label: string;
  category: 'root' | 'core' | 'mechanism' | 'application' | 'example';
  description: string;
}

export interface ConceptEdge {
  source: string;
  target: string;
  label: string;
}

export interface ConceptMapData {
  nodes: ConceptNode[];
  edges: ConceptEdge[];
}

export interface StudyMaterial {
  id: string;
  userId: string;
  title: string;
  type: ContentType;
  extractedText: string;
  wordCount: number;
  summary?: StudySummary;
  quiz?: QuizQuestion[];
  conceptMap?: ConceptMapData;
  subject: string;
  sourceUrl?: string;
  originalFileName?: string;
  audioDurationSeconds?: number;
  createdAt: string;
  lastReviewedAt?: string;
  nextReviewDate?: string;
  reviewIntervalDays?: number;
  easeFactor?: number;
  repetitionNumber?: number;
  lastReviewScore?: number;
  retentionStatus?: 'new' | 'learning' | 'review_due' | 'mastered';
  status: 'processing' | 'ready' | 'error';
  errorMessage?: string;
}

export interface IngestionProgress {
  isIngesting: boolean;
  stage: string;
  type?: ContentType;
  progressPercent?: number;
}
