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
  deleteSupabaseStorageFiles,
} from '../services/api';
import {
  saveMaterial,
  fetchUserMaterials,
  deleteMaterial as deleteMaterialFromService,
  getCachedMaterials,
} from '../services/content';
import { calculateNextReview } from '../services/spacedRepetition';
import { useAuthStore } from './useAuthStore';
import { isTextReadable } from '../utils/textQuality';

interface ContentStoreState {
  materials: StudyMaterial[];
  activeMaterial: StudyMaterial | null;
  isIngesting: boolean;
  ingestionStage: string;
  ingestionType: ContentType | null;
  uploadProgress: number;
  isSummarizing: boolean;
  isTranslating: boolean;
  isGeneratingQuiz: boolean;
  isGeneratingConceptMap: boolean;
  error: string | null;

  // Actions
  loadMaterials: (userId: string) => Promise<void>;
  setUploadProgress: (progress: number) => void;
  ingestPdf: (
    storagePath: string,
    fileName: string,
    userId: string,
    subject?: string,
    localFileUri?: string
  ) => Promise<StudyMaterial>;
  ingestDocument: (
    storagePath: string,
    fileName: string,
    userId: string,
    subject?: string,
    localFileUri?: string
  ) => Promise<StudyMaterial>;
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
    storagePath?: string;
  }) => Promise<StudyMaterial>;
  generateSummaryForMaterial: (materialId: string, userId: string) => Promise<StudyMaterial>;
  translateMaterialSummary: (materialId: string, targetLang: 'roman_urdu' | 'urdu', userId: string) => Promise<StudyMaterial>;
  generateQuizForMaterial: (materialId: string, userId: string) => Promise<QuizQuestion[]>;
  generateConceptMapForMaterial: (materialId: string, userId: string) => Promise<ConceptMapData>;
  recordMaterialReview: (materialId: string, performanceScore: number) => Promise<StudyMaterial>;
  updateMaterialContent: (
    materialId: string,
    updates: {
      title: string;
      subject: string;
      extractedText: string;
      wordCount: number;
    },
    fallbackMaterial?: StudyMaterial
  ) => Promise<StudyMaterial>;
  deleteMaterial: (id: string, userId: string) => Promise<void>;
  cascadeDeleteSubject: (subjectName: string, userId: string) => Promise<number>;
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
  uploadProgress: 0,
  isSummarizing: false,
  isTranslating: false,
  isGeneratingQuiz: false,
  isGeneratingConceptMap: false,
  error: null,

  loadMaterials: async (userId: string) => {
    try {
      const items = await fetchUserMaterials(userId);
      // Migration & quality check for legacy saved materials:
      // Flag any legacy materials whose extractedText is unreadable/garbled
      const sanitizedItems = items.map((m) => {
        if (m.extractedText && !isTextReadable(m.extractedText).readable) {
          return {
            ...m,
            status: 'error' as const,
            errorMessage: "We couldn't read this material's text properly. Try re-exporting it, or use Notes OCR instead.",
          };
        }
        return m;
      });

      set({ materials: sanitizedItems });
      if (sanitizedItems.length > 0 && !get().activeMaterial) {
        set({ activeMaterial: sanitizedItems[0] });
      }
    } catch (err: any) {
      console.warn('Error loading materials:', err);
    }
  },

  setUploadProgress: (progress: number) => set({ uploadProgress: progress }),

  ingestDocument: async (
    storagePath: string,
    fileName: string,
    userId: string,
    subject: string = 'General Studies',
    localFileUri?: string
  ) => {
    set({
      isIngesting: true,
      ingestionStage: 'Extracting document text...',
      ingestionType: 'pdf',
      error: null,
    });

    try {
      const result = await extractPdfText(storagePath, fileName, localFileUri);

      if (!result.text || result.text.trim().length < 20 || !isTextReadable(result.text).readable) {
        throw new Error(
          /\.pdf$/i.test(fileName)
            ? 'Could not extract text from this PDF. It may be scanned or image-based. Try using Notes OCR instead.'
            : "We couldn't read this document's text properly. Try re-exporting it, or use Notes OCR instead."
        );
      }

      set({ ingestionStage: 'Saving study material...' });
      const newMaterial: StudyMaterial = {
        id: `mat_doc_${Date.now()}`,
        userId,
        title: result.title || fileName,
        type: 'pdf',
        originalFileName: fileName,
        storagePath,
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
        uploadProgress: 0,
      });

      return newMaterial;
    } catch (err: any) {
      set({
        isIngesting: false,
        ingestionStage: '',
        ingestionType: null,
        uploadProgress: 0,
        error: err.message || 'Failed to ingest document',
      });
      throw err;
    }
  },

  ingestPdf: async (
    storagePath: string,
    fileName: string,
    userId: string,
    subject: string = 'General Studies',
    localFileUri?: string
  ) => {
    return get().ingestDocument(storagePath, fileName, userId, subject, localFileUri);
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
    storagePath?: string;
  }) => {
    const trimmed = params.text.trim();
    if (!trimmed || trimmed.length < 10) {
      throw new Error('No readable text found. Minimum 10 characters required.');
    }

    if (!isTextReadable(trimmed).readable) {
      throw new Error("We couldn't read this material's text properly. Try re-exporting it, or use Notes OCR instead.");
    }

    const newMaterial: StudyMaterial = {
      id: `mat_${params.type}_${Date.now()}`,
      userId: params.userId,
      title: params.title || 'Study Material',
      type: params.type,
      originalFileName: params.originalFileName,
      sourceUrl: params.sourceUrl,
      storagePath: params.storagePath,
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

    if (!target.extractedText || target.extractedText.trim().length < 20 || !isTextReadable(target.extractedText).readable) {
      throw new Error("We couldn't read this material's text properly. Try re-exporting it, or use Notes OCR instead.");
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

    if (!target.extractedText || target.extractedText.trim().length < 20 || !isTextReadable(target.extractedText).readable) {
      throw new Error("We couldn't read this material's text properly. Try re-exporting it, or use Notes OCR instead.");
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

  updateMaterialContent: async (
    materialId: string,
    updates: {
      title: string;
      subject: string;
      extractedText: string;
      wordCount: number;
    },
    fallbackMaterial?: StudyMaterial
  ): Promise<StudyMaterial> => {
    let target = get().materials.find((m) => m.id === materialId);
    if (!target && get().activeMaterial?.id === materialId) {
      target = get().activeMaterial || undefined;
    }
    if (!target) {
      try {
        const cached = await getCachedMaterials();
        target = cached.find((m: StudyMaterial) => m.id === materialId);
      } catch {}
    }
    if (!target && fallbackMaterial && fallbackMaterial.id === materialId) {
      target = fallbackMaterial;
    }

    if (!target) {
      throw new Error('The requested study resource was not found. Please try again.');
    }

    const updatedMaterial: StudyMaterial = {
      ...target,
      title: updates.title,
      subject: updates.subject,
      extractedText: updates.extractedText,
      wordCount: updates.wordCount,
      updatedAt: new Date().toISOString(),
    };

    await saveMaterial(updatedMaterial);

    const updatedMaterials = get().materials.map((m) =>
      m.id === materialId ? updatedMaterial : m
    );

    const finalMaterials = updatedMaterials.some((m) => m.id === materialId)
      ? updatedMaterials
      : [updatedMaterial, ...get().materials];

    set({
      materials: finalMaterials,
      activeMaterial:
        get().activeMaterial?.id === materialId ? updatedMaterial : get().activeMaterial,
    });

    return updatedMaterial;
  },

  deleteMaterial: async (id: string, userId: string) => {
    const target = get().materials.find((m) => m.id === id);
    if (target?.storagePath) {
      deleteSupabaseStorageFiles([target.storagePath]).catch((err) =>
        console.warn('[Storage Delete Warning]:', err)
      );
    }
    await deleteMaterialFromService(userId, id);
    notifyMaterialCountChange(-1);
    const remaining = get().materials.filter((m) => m.id !== id);
    set({
      materials: remaining,
      activeMaterial: get().activeMaterial?.id === id ? remaining[0] || null : get().activeMaterial,
    });
  },

  cascadeDeleteSubject: async (subjectName: string, userId: string): Promise<number> => {
    const cleanSubj = subjectName.trim().toLowerCase();
    const matchingMaterials = get().materials.filter(
      (m) => (m.subject || '').trim().toLowerCase() === cleanSubj
    );

    // 1. Delete physical files from Supabase Storage to avoid orphaned cloud storage
    const storagePaths = matchingMaterials
      .map((m) => m.storagePath)
      .filter((p): p is string => Boolean(p && typeof p === 'string'));

    if (storagePaths.length > 0) {
      await deleteSupabaseStorageFiles(storagePaths).catch((err) =>
        console.warn('[CascadeDelete] Storage file deletion warning:', err)
      );
    }

    // 2. Cascade delete all documents from Firestore
    for (const mat of matchingMaterials) {
      await deleteMaterialFromService(userId, mat.id).catch((err) =>
        console.warn(`[CascadeDelete] Firestore error on ${mat.id}:`, err)
      );
    }
    notifyMaterialCountChange(-matchingMaterials.length);

    // 3. Update local state
    const remaining = get().materials.filter(
      (m) => (m.subject || '').trim().toLowerCase() !== cleanSubj
    );
    set({
      materials: remaining,
      activeMaterial:
        (get().activeMaterial?.subject || '').trim().toLowerCase() === cleanSubj
          ? remaining[0] || null
          : get().activeMaterial,
    });

    return matchingMaterials.length;
  },

  setActiveMaterial: (material: StudyMaterial | null) => set({ activeMaterial: material }),
  clearError: () => set({ error: null }),
}));
