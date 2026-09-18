import { create } from 'zustand';
import { StudyMaterial, ContentType, QuizQuestion, ConceptMapData } from '../types/content';
import {
  extractPdfText,
  extractYouTubeTranscript,
  transcribeAudio,
  extractOcrText,
  summarizeContent,
  translateSummaryContent,
  generateQuizContent,
  generateConceptMapContent,
} from '../services/api';
import {
  saveMaterial,
  fetchUserMaterials,
  deleteMaterial as deleteMaterialFromService,
} from '../services/content';
import { calculateNextReview } from '../services/spacedRepetition';

interface ContentStoreState {
  materials: StudyMaterial[];
  activeMaterial: StudyMaterial | null;
  isIngesting: boolean;
  ingestionStage: string;
  ingestionType: ContentType | null;
  isSummarizing: boolean;
  isTranslating: boolean;
  isGeneratingQuiz: boolean;
  isGeneratingConceptMap: boolean;
  error: string | null;

  // Actions
  loadMaterials: (userId: string) => Promise<void>;
  ingestPdf: (fileBase64: string, fileName: string, userId: string, subject?: string) => Promise<StudyMaterial>;
  ingestYouTube: (url: string, userId: string, subject?: string) => Promise<StudyMaterial>;
  ingestAudio: (audioBase64: string, durationSeconds: number, userId: string, subject?: string) => Promise<StudyMaterial>;
  ingestOcr: (imageBase64: string, userId: string, subject?: string) => Promise<StudyMaterial>;
  generateSummaryForMaterial: (materialId: string, userId: string) => Promise<StudyMaterial>;
  translateMaterialSummary: (materialId: string, targetLang: 'roman_urdu' | 'urdu', userId: string) => Promise<StudyMaterial>;
  generateQuizForMaterial: (materialId: string, userId: string) => Promise<QuizQuestion[]>;
  generateConceptMapForMaterial: (materialId: string, userId: string) => Promise<ConceptMapData>;
  recordMaterialReview: (materialId: string, performanceScore: number) => Promise<StudyMaterial>;
  deleteMaterial: (id: string, userId: string) => Promise<void>;
  setActiveMaterial: (material: StudyMaterial | null) => void;
  clearError: () => void;
}

export const useContentStore = create<ContentStoreState>((set, get) => ({
  materials: [],
  activeMaterial: null,
  isIngesting: false,
  ingestionStage: '',
  ingestionType: null,
  isSummarizing: false,
  isTranslating: false,
  isGeneratingQuiz: false,
  isGeneratingConceptMap: false,
  error: null,

  loadMaterials: async (userId: string) => {
    try {
      const items = await fetchUserMaterials(userId);
      set({ materials: items });
      if (items.length > 0 && !get().activeMaterial) {
        set({ activeMaterial: items[0] });
      }
    } catch (err: any) {
      console.warn('Error loading materials:', err);
    }
  },

  ingestPdf: async (fileBase64: string, fileName: string, userId: string, subject: string = 'General Studies') => {
    set({
      isIngesting: true,
      ingestionStage: 'Uploading PDF to serverless backend...',
      ingestionType: 'pdf',
      error: null,
    });

    try {
      set({ ingestionStage: 'Extracting text and structure with pdf-parse...' });
      const result = await extractPdfText(fileBase64, fileName);

      set({ ingestionStage: 'Saving study material to Firestore...' });
      const newMaterial: StudyMaterial = {
        id: `mat_pdf_${Date.now()}`,
        userId,
        title: result.title || fileName,
        type: 'pdf',
        originalFileName: fileName,
        extractedText: result.text,
        wordCount: result.wordCount,
        subject,
        createdAt: new Date().toISOString(),
        status: 'ready',
      };

      await saveMaterial(newMaterial);

      const updated = [newMaterial, ...get().materials];
      set({
        materials: updated,
        activeMaterial: newMaterial,
        isIngesting: false,
        ingestionStage: '',
        ingestionType: null,
      });

      return newMaterial;
    } catch (err: any) {
      set({
        isIngesting: false,
        ingestionStage: '',
        ingestionType: null,
        error: err.message || 'PDF ingestion failed',
      });
      throw err;
    }
  },

  ingestYouTube: async (url: string, userId: string, subject: string = 'Computer Science') => {
    set({
      isIngesting: true,
      ingestionStage: 'Fetching YouTube subtitles and transcript...',
      ingestionType: 'youtube',
      error: null,
    });

    try {
      const result = await extractYouTubeTranscript(url);

      set({ ingestionStage: 'Formatting transcript and storing to Firestore...' });
      const newMaterial: StudyMaterial = {
        id: `mat_yt_${Date.now()}`,
        userId,
        title: result.title || 'YouTube Lecture',
        type: 'youtube',
        sourceUrl: url,
        extractedText: result.text,
        wordCount: result.wordCount,
        audioDurationSeconds: result.durationSeconds,
        subject,
        createdAt: new Date().toISOString(),
        status: 'ready',
      };

      await saveMaterial(newMaterial);

      const updated = [newMaterial, ...get().materials];
      set({
        materials: updated,
        activeMaterial: newMaterial,
        isIngesting: false,
        ingestionStage: '',
        ingestionType: null,
      });

      return newMaterial;
    } catch (err: any) {
      set({
        isIngesting: false,
        ingestionStage: '',
        ingestionType: null,
        error: err.message || 'YouTube ingestion failed',
      });
      throw err;
    }
  },

  ingestAudio: async (audioBase64: string, durationSeconds: number, userId: string, subject: string = 'Biology') => {
    set({
      isIngesting: true,
      ingestionStage: 'Uploading audio to Groq Whisper API...',
      ingestionType: 'audio',
      error: null,
    });

    try {
      set({ ingestionStage: 'Transcribing speech with Whisper-large-v3...' });
      const result = await transcribeAudio(audioBase64);

      set({ ingestionStage: 'Saving lecture notes to Firestore...' });
      const newMaterial: StudyMaterial = {
        id: `mat_audio_${Date.now()}`,
        userId,
        title: result.title || 'Live Audio Lecture',
        type: 'audio',
        extractedText: result.text,
        wordCount: result.wordCount,
        audioDurationSeconds: durationSeconds || result.durationSeconds,
        subject,
        createdAt: new Date().toISOString(),
        status: 'ready',
      };

      await saveMaterial(newMaterial);

      const updated = [newMaterial, ...get().materials];
      set({
        materials: updated,
        activeMaterial: newMaterial,
        isIngesting: false,
        ingestionStage: '',
        ingestionType: null,
      });

      return newMaterial;
    } catch (err: any) {
      set({
        isIngesting: false,
        ingestionStage: '',
        ingestionType: null,
        error: err.message || 'Audio transcription failed',
      });
      throw err;
    }
  },

  ingestOcr: async (imageBase64: string, userId: string, subject: string = 'History') => {
    set({
      isIngesting: true,
      ingestionStage: 'Sending handwritten photo to Google Cloud Vision...',
      ingestionType: 'ocr',
      error: null,
    });

    try {
      set({ ingestionStage: 'Running document OCR & handwriting recognition...' });
      const result = await extractOcrText(imageBase64);

      set({ ingestionStage: 'Saving digitized notes to Firestore...' });
      const newMaterial: StudyMaterial = {
        id: `mat_ocr_${Date.now()}`,
        userId,
        title: result.title || 'Handwritten Study Notes',
        type: 'ocr',
        extractedText: result.text,
        wordCount: result.wordCount,
        subject,
        createdAt: new Date().toISOString(),
        status: 'ready',
      };

      await saveMaterial(newMaterial);

      const updated = [newMaterial, ...get().materials];
      set({
        materials: updated,
        activeMaterial: newMaterial,
        isIngesting: false,
        ingestionStage: '',
        ingestionType: null,
      });

      return newMaterial;
    } catch (err: any) {
      set({
        isIngesting: false,
        ingestionStage: '',
        ingestionType: null,
        error: err.message || 'Handwritten notes OCR failed',
      });
      throw err;
    }
  },

  generateSummaryForMaterial: async (materialId: string, userId: string) => {
    const target = get().materials.find((m) => m.id === materialId);
    if (!target) throw new Error('Material not found');

    set({ isSummarizing: true, error: null });
    try {
      const summaryResult = await summarizeContent(target.extractedText, target.title, target.type);

      const updatedMaterial: StudyMaterial = {
        ...target,
        title: summaryResult.title || target.title,
        summary: {
          keyPoints: summaryResult.keyPoints,
          headings: summaryResult.headings,
          fullSummary: summaryResult.fullSummary,
        },
      };

      await saveMaterial(updatedMaterial);

      const updatedMaterials = get().materials.map((m) =>
        m.id === materialId ? updatedMaterial : m
      );

      set({
        materials: updatedMaterials,
        activeMaterial: updatedMaterial,
        isSummarizing: false,
      });

      return updatedMaterial;
    } catch (err: any) {
      set({ isSummarizing: false, error: err.message || 'Summarization failed' });
      throw err;
    }
  },

  translateMaterialSummary: async (
    materialId: string,
    targetLang: 'roman_urdu' | 'urdu',
    userId: string
  ) => {
    const target = get().materials.find((m) => m.id === materialId);
    if (!target || !target.summary) {
      throw new Error('Summary not available for translation');
    }

    // Check if translation already exists
    const existingTranslations = target.summary.translations || {};
    if (targetLang === 'roman_urdu' && existingTranslations.romanUrdu) {
      return target;
    }
    if (targetLang === 'urdu' && existingTranslations.urdu) {
      return target;
    }

    set({ isTranslating: true, error: null });
    try {
      const translationResult = await translateSummaryContent(
        {
          title: target.title,
          overview: target.summary.overview || target.summary.fullSummary.substring(0, 300),
          keyPoints: target.summary.keyPoints,
          headings: target.summary.headings,
          fullSummary: target.summary.fullSummary,
        },
        targetLang
      );

      const updatedTranslations = {
        ...existingTranslations,
        [targetLang === 'roman_urdu' ? 'romanUrdu' : 'urdu']: translationResult,
      };

      const updatedMaterial: StudyMaterial = {
        ...target,
        summary: {
          ...target.summary,
          translations: updatedTranslations,
        },
      };

      await saveMaterial(updatedMaterial);

      const updatedMaterials = get().materials.map((m) =>
        m.id === materialId ? updatedMaterial : m
      );

      set({
        materials: updatedMaterials,
        activeMaterial: updatedMaterial,
        isTranslating: false,
      });

      return updatedMaterial;
    } catch (err: any) {
      set({ isTranslating: false, error: err.message || 'Translation failed' });
      throw err;
    }
  },

  generateQuizForMaterial: async (materialId: string, userId: string) => {
    const target = get().materials.find((m) => m.id === materialId);
    if (!target) throw new Error('Material not found');

    if (target.quiz && target.quiz.length > 0) {
      return target.quiz;
    }

    set({ isGeneratingQuiz: true, error: null });
    try {
      const questions = await generateQuizContent(
        target.extractedText,
        target.title,
        target.summary?.fullSummary
      );

      const updatedMaterial: StudyMaterial = {
        ...target,
        quiz: questions,
      };

      await saveMaterial(updatedMaterial);

      const updatedMaterials = get().materials.map((m) =>
        m.id === materialId ? updatedMaterial : m
      );

      set({
        materials: updatedMaterials,
        activeMaterial: updatedMaterial,
        isGeneratingQuiz: false,
      });

      return questions;
    } catch (err: any) {
      set({ isGeneratingQuiz: false, error: err.message || 'Quiz generation failed' });
      throw err;
    }
  },

  generateConceptMapForMaterial: async (materialId: string, userId: string) => {
    const target = get().materials.find((m) => m.id === materialId);
    if (!target) throw new Error('Material not found');

    if (target.conceptMap && target.conceptMap.nodes.length > 0) {
      return target.conceptMap;
    }

    set({ isGeneratingConceptMap: true, error: null });
    try {
      const conceptMap = await generateConceptMapContent(
        target.extractedText,
        target.title,
        target.summary
      );

      const updatedMaterial: StudyMaterial = {
        ...target,
        conceptMap,
      };

      await saveMaterial(updatedMaterial);

      const updatedMaterials = get().materials.map((m) =>
        m.id === materialId ? updatedMaterial : m
      );

      set({
        materials: updatedMaterials,
        activeMaterial: updatedMaterial,
        isGeneratingConceptMap: false,
      });

      return conceptMap;
    } catch (err: any) {
      set({ isGeneratingConceptMap: false, error: err.message || 'Concept map generation failed' });
      throw err;
    }
  },

  recordMaterialReview: async (materialId: string, performanceScore: number) => {
    const target = get().materials.find((m) => m.id === materialId);
    if (!target) throw new Error('Material not found');

    const updateData = calculateNextReview(target, performanceScore);
    const updatedMaterial: StudyMaterial = {
      ...target,
      ...updateData,
    };

    await saveMaterial(updatedMaterial);

    const updatedMaterials = get().materials.map((m) =>
      m.id === materialId ? updatedMaterial : m
    );

    set({
      materials: updatedMaterials,
      activeMaterial: get().activeMaterial?.id === materialId ? updatedMaterial : get().activeMaterial,
    });

    return updatedMaterial;
  },

  deleteMaterial: async (id: string, userId: string) => {
    await deleteMaterialFromService(userId, id);
    const remaining = get().materials.filter((m) => m.id !== id);
    set({
      materials: remaining,
      activeMaterial: get().activeMaterial?.id === id ? remaining[0] || null : get().activeMaterial,
    });
  },

  setActiveMaterial: (material: StudyMaterial | null) => set({ activeMaterial: material }),
  clearError: () => set({ error: null }),
}));
