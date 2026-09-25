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
import { useAuthStore } from './useAuthStore';

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
  saveExtractedMaterial: (params: {
    title: string;
    subject: string;
    type: ContentType;
    text: string;
    userId: string;
    originalFileName?: string;
    sourceUrl?: string;
    audioDurationSeconds?: number;
  }) => Promise<StudyMaterial>;
  generateSummaryForMaterial: (materialId: string, userId: string) => Promise<StudyMaterial>;
  translateMaterialSummary: (materialId: string, targetLang: 'roman_urdu' | 'urdu', userId: string) => Promise<StudyMaterial>;
  generateQuizForMaterial: (materialId: string, userId: string) => Promise<QuizQuestion[]>;
  generateConceptMapForMaterial: (materialId: string, userId: string) => Promise<ConceptMapData>;
  recordMaterialReview: (materialId: string, performanceScore: number) => Promise<StudyMaterial>;
  deleteMaterial: (id: string, userId: string) => Promise<void>;
  setActiveMaterial: (material: StudyMaterial | null) => void;
  clearError: () => void;
}

function notifyMaterialCountChange(delta: number) {
  try {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const currentCount = user.totalMaterialsUploaded ?? useContentStore.getState().materials.length;
    const newCount = Math.max(0, currentCount + delta);
    useAuthStore.getState().updateUserProfile({ totalMaterialsUploaded: newCount });
    if (!user.isAnonymous && !user.uid.startsWith('guest_')) {
      import('../services/firebase').then(({ db }) => {
        import('firebase/firestore').then(({ doc, setDoc, increment }) => {
          setDoc(doc(db, 'users', user.uid), { totalMaterialsUploaded: increment(delta) }, { merge: true }).catch(() => {});
        });
      });
    }
  } catch {}
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
      ingestionStage: 'Uploading document...',
      ingestionType: 'pdf',
      error: null,
    });

    try {
      set({ ingestionStage: 'Extracting document text...' });
      const result = await extractPdfText(fileBase64, fileName);

      if (!result.text || result.text.trim().length < 20) {
        throw new Error(`Could not extract readable text from "${fileName}". Minimum 20 characters required.`);
      }

      set({ ingestionStage: 'Saving study material...' });
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
      notifyMaterialCountChange(1);

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
      ingestionStage: 'Fetching YouTube transcript...',
      ingestionType: 'youtube',
      error: null,
    });

    try {
      const result = await extractYouTubeTranscript(url);

      if (!result.text || result.text.trim().length < 20) {
        throw new Error('Could not extract readable transcript from video. Minimum 20 characters required.');
      }

      set({ ingestionStage: 'Formatting and saving transcript...' });
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
      notifyMaterialCountChange(1);

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
      ingestionStage: 'Processing lecture audio...',
      ingestionType: 'audio',
      error: null,
    });

    try {
      set({ ingestionStage: 'Transcribing speech to text...' });
      const result = await transcribeAudio(audioBase64);

      if (!result.text || result.text.trim().length < 10) {
        throw new Error('No speech detected in audio recording. Minimum 10 characters required.');
      }

      set({ ingestionStage: 'Saving lecture notes...' });
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
      notifyMaterialCountChange(1);

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
      ingestionStage: 'Scanning handwritten document...',
      ingestionType: 'ocr',
      error: null,
    });

    try {
      set({ ingestionStage: 'Recognizing handwriting and text...' });
      const result = await extractOcrText(imageBase64);

      if (!result.text || result.text.trim().length < 10) {
        throw new Error('No readable text found in this photo. Please retake with better lighting and focus.');
      }

      set({ ingestionStage: 'Saving digitized study notes...' });
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

  saveExtractedMaterial: async (params: {
    title: string;
    subject: string;
    type: ContentType;
    text: string;
    userId: string;
    originalFileName?: string;
    sourceUrl?: string;
    audioDurationSeconds?: number;
  }) => {
    const trimmed = params.text.trim();
    if (!trimmed || trimmed.length < 10) {
      throw new Error('No readable text found. Minimum 10 characters required.');
    }

    const newMaterial: StudyMaterial = {
      id: `mat_${params.type}_${Date.now()}`,
      userId: params.userId,
      title: params.title || 'Study Material',
      type: params.type,
      originalFileName: params.originalFileName,
      sourceUrl: params.sourceUrl,
      audioDurationSeconds: params.audioDurationSeconds,
      extractedText: trimmed,
      wordCount: trimmed.split(/\s+/).filter(Boolean).length,
      subject: params.subject,
      createdAt: new Date().toISOString(),
      status: 'ready',
    };

    await saveMaterial(newMaterial);
    notifyMaterialCountChange(1);
    const updated = [newMaterial, ...get().materials];
    set({
      materials: updated,
      activeMaterial: newMaterial,
      isIngesting: false,
      ingestionStage: '',
      ingestionType: null,
    });
    return newMaterial;
  },

  generateSummaryForMaterial: async (materialId: string, userId: string) => {
    const target = get().materials.find((m) => m.id === materialId);
    if (!target) throw new Error('Material not found');

    if (!target.extractedText || target.extractedText.trim().length < 20) {
      throw new Error("We couldn't extract enough readable text from this material to summarize. Please provide clearer notes.");
    }

    set({ isSummarizing: true, error: null });
    try {
      const currentUser = useAuthStore.getState().user;
      const educationLevel = currentUser?.educationLevel || 'Bachelors';
      const summaryResult = await summarizeContent(
        target.extractedText,
        target.title,
        target.type,
        educationLevel
      );

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
      const currentUser = useAuthStore.getState().user;
      const educationLevel = currentUser?.educationLevel || 'Bachelors';
      const questions = await generateQuizContent(
        target.extractedText,
        target.title,
        target.summary?.fullSummary,
        6,
        educationLevel
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
    notifyMaterialCountChange(-1);
    const remaining = get().materials.filter((m) => m.id !== id);
    set({
      materials: remaining,
      activeMaterial: get().activeMaterial?.id === id ? remaining[0] || null : get().activeMaterial,
    });
  },

  setActiveMaterial: (material: StudyMaterial | null) => set({ activeMaterial: material }),
  clearError: () => set({ error: null }),
}));
