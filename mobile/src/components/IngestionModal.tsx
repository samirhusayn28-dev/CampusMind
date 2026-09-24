import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import {
  useAudioRecorder,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  RecordingPresets,
} from 'expo-audio';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { useContentStore } from '../store/useContentStore';
import { ContentType } from '../types/content';
import { Card } from './Card';
import { Badge } from './Badge';
import { ThemedLoader } from './ThemedLoader';
import { showThemedAlert, showThemedToast } from '../store/useNotificationStore';
import { triggerHaptic } from '../services/haptics';
import { extractOcrText } from '../services/api';
import { spacing, borderRadius, shadows } from '../theme/spacing';
import { typography } from '../theme/typography';

interface IngestionModalProps {
  visible: boolean;
  onClose: () => void;
  initialType?: ContentType;
}

const subjects = ['Computer Science', 'Biology', 'History', 'Physics', 'Psychology', 'General'];

export const IngestionModal: React.FC<IngestionModalProps> = ({
  visible,
  onClose,
  initialType = 'pdf',
}) => {
  const { colors, isDark } = useThemeStore();
  const user = useAuthStore((state) => state.user);
  const {
    isIngesting,
    ingestionStage,
    ingestPdf,
    ingestYouTube,
    ingestAudio,
    saveExtractedMaterial,
    generateSummaryForMaterial,
  } = useContentStore();

  const [activeTab, setActiveTab] = useState<ContentType>(initialType);
  const [selectedSubject, setSelectedSubject] = useState('Computer Science');

  // YouTube State
  const [youtubeUrl, setYoutubeUrl] = useState('');

  // Audio Recording State
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const timerRef = useRef<any>(null);

  // OCR Processing & Review State
  const [isScanningOcr, setIsScanningOcr] = useState(false);
  const [isReviewingOcr, setIsReviewingOcr] = useState(false);
  const [ocrTitle, setOcrTitle] = useState('Handwritten Study Notes');
  const [ocrText, setOcrText] = useState('');
  const [isConfirmingOcr, setIsConfirmingOcr] = useState(false);

  useEffect(() => {
    if (visible) {
      setActiveTab(initialType || 'pdf');
      setIsReviewingOcr(false);
      setIsScanningOcr(false);
      setIsConfirmingOcr(false);
      setOcrText('');
      setYoutubeUrl('');
    }
  }, [visible, initialType]);

  // Clean up audio recording on unmount or close
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (isRecording) {
        recorder.stop().catch(() => {});
      }
    };
  }, [isRecording, recorder]);

  const handleTabSwitch = (type: ContentType) => {
    triggerHaptic('selection');
    setActiveTab(type);
    setIsReviewingOcr(false);
  };

  // Handle PDF Picking
  const handlePickPdf = async () => {
    try {
      triggerHaptic('lightImpact');
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) return;

      const file = res.assets[0];
      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const userId = user?.uid || 'guest_user';
      await ingestPdf(base64, file.name, userId, selectedSubject);
      triggerHaptic('successNotification');
      onClose();
      showThemedToast('success', `"${file.name}" processed and saved!`);
    } catch (err: any) {
      triggerHaptic('errorNotification');
      showThemedAlert('PDF Upload Error', err.message || 'Could not process PDF document.');
    }
  };

  // Handle YouTube Ingestion
  const handleIngestYouTube = async () => {
    if (!youtubeUrl.trim()) {
      showThemedAlert('Enter URL', 'Please paste a valid YouTube video URL.');
      return;
    }

    try {
      triggerHaptic('lightImpact');
      const userId = user?.uid || 'guest_user';
      await ingestYouTube(youtubeUrl.trim(), userId, selectedSubject);
      setYoutubeUrl('');
      triggerHaptic('successNotification');
      onClose();
      showThemedToast('success', 'Video transcript extracted and saved!');
    } catch (err: any) {
      triggerHaptic('errorNotification');
      showThemedAlert('YouTube Error', err.message || 'Could not extract video transcript.');
    }
  };

  // Audio Recording Handlers
  const startRecording = async () => {
    try {
      triggerHaptic('mediumImpact');
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        showThemedAlert('Microphone Access', 'Permission to access microphone is required for live recording.');
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();

      setIsRecording(true);
      setRecordDuration(0);

      timerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      triggerHaptic('errorNotification');
      showThemedAlert('Recording Error', err.message || 'Could not start audio recording.');
    }
  };

  const stopAndUploadRecording = async () => {
    try {
      triggerHaptic('mediumImpact');
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);

      if (recordDuration < 3) {
        showThemedAlert('Recording Too Short', 'Please record for at least 3 seconds.');
        return;
      }

      await recorder.stop();
      const uri = recorder.uri;

      if (!uri) throw new Error('Recording file not found.');

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const userId = user?.uid || 'guest_user';
      await ingestAudio(base64, recordDuration, userId, selectedSubject);
      setRecordDuration(0);
      triggerHaptic('successNotification');
      onClose();
      showThemedToast('success', 'Lecture audio transcribed and saved!');
    } catch (err: any) {
      triggerHaptic('errorNotification');
      showThemedAlert('Audio Error', err.message || 'Could not process audio recording.');
    }
  };

  // Photo / OCR Preprocessing and Extraction
  const handlePickPhoto = async (useCamera: boolean) => {
    try {
      triggerHaptic('lightImpact');
      if (useCamera) {
        const camPerm = await ImagePicker.requestCameraPermissionsAsync();
        if (!camPerm.granted) {
          showThemedAlert('Camera Access', 'Camera permission is required to capture handwritten notes.');
          return;
        }
      } else {
        const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!libPerm.granted) {
          showThemedAlert('Library Access', 'Photo library permission is required to select handwritten notes.');
          return;
        }
      }

      const pickerOptions: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.9,
      };

      const result = useCamera
        ? await ImagePicker.launchCameraAsync(pickerOptions)
        : await ImagePicker.launchImageLibraryAsync(pickerOptions);

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];

      setIsScanningOcr(true);

      // Pre-process image: Resize longest edge to ~1800px, compress to 0.8 JPEG, normalize EXIF orientation
      const origWidth = asset.width || 1800;
      const origHeight = asset.height || 1800;
      const longestEdge = Math.max(origWidth, origHeight);
      const scale = longestEdge > 1800 ? 1800 / longestEdge : 1;
      const targetWidth = Math.round(origWidth * scale);
      const targetHeight = Math.round(origHeight * scale);

      const manipResult = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: targetWidth, height: targetHeight } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      const base64Data = manipResult.base64;
      if (!base64Data) {
        throw new Error('Could not process photo image data.');
      }

      // Call OCR endpoint
      const extracted = await extractOcrText(base64Data);
      const cleanText = (extracted.text || '').trim();

      setIsScanningOcr(false);

      if (!cleanText || cleanText.length < 10) {
        triggerHaptic('errorNotification');
        showThemedAlert(
          'No Readable Text Found',
          'No readable text could be recognized in this photo. Please retake with better lighting and focus.'
        );
        return;
      }

      // Transition to Text Review/Edit screen
      triggerHaptic('mediumImpact');
      setOcrTitle(extracted.title || 'Handwritten Study Notes');
      setOcrText(cleanText);
      setIsReviewingOcr(true);
    } catch (err: any) {
      setIsScanningOcr(false);
      triggerHaptic('errorNotification');
      showThemedAlert('Note Scanner Error', err.message || 'Could not read text from this image. Please try a clearer, well-lit photo.');
    }
  };

  // Confirm Reviewed OCR Text & Save / Summarize
  const handleConfirmOcr = async (shouldSummarize: boolean = true) => {
    const trimmed = ocrText.trim();
    if (!trimmed || trimmed.length < 10) {
      showThemedAlert(
        'No Readable Text',
        'No readable text found in this photo. Please retake with better lighting and focus.'
      );
      return;
    }

    try {
      setIsConfirmingOcr(true);
      triggerHaptic('lightImpact');
      const userId = user?.uid || 'guest_user';

      const savedMaterial = await saveExtractedMaterial({
        title: ocrTitle.trim() || 'Handwritten Study Notes',
        subject: selectedSubject,
        type: 'ocr',
        text: trimmed,
        userId,
      });

      if (shouldSummarize) {
        try {
          await generateSummaryForMaterial(savedMaterial.id, userId);
        } catch {
          // If summary fails, material is still saved
        }
      }

      setIsConfirmingOcr(false);
      setIsReviewingOcr(false);
      triggerHaptic('successNotification');
      onClose();
      showThemedToast(
        'success',
        shouldSummarize ? 'Notes saved and summarized!' : 'Notes saved to library!'
      );
    } catch (err: any) {
      setIsConfirmingOcr(false);
      triggerHaptic('errorNotification');
      showThemedAlert('Save Error', err.message || 'Failed to save notes.');
    }
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {isReviewingOcr ? 'Review Digitized Notes' : 'Add Study Material'}
              </Text>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                {isReviewingOcr
                  ? 'Verify or edit your transcribed text before saving'
                  : 'Select content source to process with AI'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.closeBtn, { backgroundColor: colors.surfaceSubtle }]}
              onPress={onClose}
              disabled={isIngesting || isScanningOcr || isConfirmingOcr}
            >
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* If Reviewing OCR Text */}
          {isReviewingOcr ? (
            <ScrollView
              style={styles.reviewScroll}
              contentContainerStyle={styles.reviewScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Title Input */}
              <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Title</Text>
              <TextInput
                value={ocrTitle}
                onChangeText={setOcrTitle}
                placeholder="Title for these notes..."
                placeholderTextColor={colors.textTertiary}
                style={[
                  styles.titleInput,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    color: colors.textPrimary,
                    borderColor: colors.borderSubtle,
                  },
                ]}
              />

              {/* Subject Selector */}
              <Text style={[styles.fieldLabel, { color: colors.textPrimary, marginTop: spacing.sm }]}>
                Assign Course / Subject
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.subjectScroll}
              >
                {subjects.map((subj) => {
                  const isSel = selectedSubject === subj;
                  return (
                    <TouchableOpacity
                      key={subj}
                      style={[
                        styles.subjectChip,
                        { backgroundColor: isSel ? colors.primary : colors.surface },
                      ]}
                      onPress={() => setSelectedSubject(subj)}
                    >
                      <Text
                        style={[
                          styles.subjectText,
                          { color: isSel ? colors.onPrimary : colors.textSecondary },
                        ]}
                      >
                        {subj}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Extracted Text Review Area */}
              <View style={styles.reviewTextHeaderRow}>
                <Text style={[styles.fieldLabel, { color: colors.textPrimary, marginBottom: 0 }]}>
                  Transcribed Text (Editable)
                </Text>
                <Badge
                  label={`${ocrText.split(/\s+/).filter(Boolean).length} words`}
                  variant="sky"
                />
              </View>
              <TextInput
                value={ocrText}
                onChangeText={setOcrText}
                multiline
                numberOfLines={8}
                textAlignVertical="top"
                placeholder="Transcribed notes will appear here..."
                placeholderTextColor={colors.textTertiary}
                style={[
                  styles.reviewTextArea,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    color: colors.textPrimary,
                    borderColor: colors.borderSubtle,
                  },
                ]}
              />

              {/* Action Buttons */}
              <View style={styles.reviewActionButtons}>
                <TouchableOpacity
                  style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
                  onPress={() => handleConfirmOcr(true)}
                  disabled={isConfirmingOcr}
                  activeOpacity={0.85}
                >
                  {isConfirmingOcr ? (
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={18} color={colors.onPrimary} />
                      <Text style={[styles.primaryActionText, { color: colors.onPrimary }]}>
                        Confirm & Summarize
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <View style={styles.secondaryBtnRow}>
                  <TouchableOpacity
                    style={[styles.secondaryActionBtn, { backgroundColor: colors.surfaceSubtle }]}
                    onPress={() => handleConfirmOcr(false)}
                    disabled={isConfirmingOcr}
                  >
                    <Ionicons name="save-outline" size={16} color={colors.textPrimary} />
                    <Text style={[styles.secondaryActionText, { color: colors.textPrimary }]}>
                      Save Only
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.secondaryActionBtn, { backgroundColor: colors.surfaceSubtle }]}
                    onPress={() => setIsReviewingOcr(false)}
                    disabled={isConfirmingOcr}
                  >
                    <Ionicons name="refresh-outline" size={16} color={colors.textSecondary} />
                    <Text style={[styles.secondaryActionText, { color: colors.textSecondary }]}>
                      Retake Photo
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          ) : (
            <>
              {/* Type Tabs */}
              <View style={[styles.tabBar, { backgroundColor: colors.surfaceSubtle }]}>
                {(
                  [
                    { type: 'pdf', label: 'PDF', icon: 'document-text' },
                    { type: 'youtube', label: 'YouTube', icon: 'logo-youtube' },
                    { type: 'audio', label: 'Audio', icon: 'mic' },
                    { type: 'ocr', label: 'Notes OCR', icon: 'camera' },
                  ] as const
                ).map((tab) => {
                  const isActive = activeTab === tab.type;
                  return (
                    <TouchableOpacity
                      key={tab.type}
                      style={[
                        styles.tabItem,
                        isActive && { backgroundColor: colors.surface, ...shadows.subtle },
                      ]}
                      onPress={() => handleTabSwitch(tab.type)}
                      disabled={isIngesting || isScanningOcr}
                    >
                      <Ionicons
                        name={tab.icon as any}
                        size={16}
                        color={isActive ? colors.primary : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.tabLabel,
                          { color: isActive ? colors.textPrimary : colors.textSecondary },
                        ]}
                      >
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Subject Selector */}
              <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Assign Course / Subject</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.subjectScroll}
              >
                {subjects.map((subj) => {
                  const isSel = selectedSubject === subj;
                  return (
                    <TouchableOpacity
                      key={subj}
                      style={[
                        styles.subjectChip,
                        { backgroundColor: isSel ? colors.primary : colors.surface },
                      ]}
                      onPress={() => setSelectedSubject(subj)}
                      disabled={isIngesting || isScanningOcr}
                    >
                      <Text
                        style={[
                          styles.subjectText,
                          { color: isSel ? colors.onPrimary : colors.textSecondary },
                        ]}
                      >
                        {subj}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Tab Content */}
              <View style={styles.bodyContent}>
                {/* 1. PDF Tab */}
                {activeTab === 'pdf' && (
                  <Card variant="surface" style={styles.tabContentCard}>
                    <View style={[styles.actionIconCircle, { backgroundColor: colors.primaryContainer }]}>
                      <Ionicons name="document-text" size={32} color={colors.primary} />
                    </View>
                    <Text style={[styles.contentCardTitle, { color: colors.textPrimary }]}>
                      Upload Lecture PDF
                    </Text>
                    <Text style={[styles.contentCardDesc, { color: colors.textSecondary }]}>
                      Upload lecture slide decks, syllabus sheets, or textbook chapters.
                    </Text>

                    <TouchableOpacity
                      style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
                      onPress={handlePickPdf}
                      disabled={isIngesting}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="folder-open-outline" size={18} color={colors.onPrimary} />
                      <Text style={[styles.primaryActionText, { color: colors.onPrimary }]}>
                        Choose PDF from Files
                      </Text>
                    </TouchableOpacity>
                  </Card>
                )}

                {/* 2. YouTube Tab */}
                {activeTab === 'youtube' && (
                  <Card variant="surface" style={styles.tabContentCard}>
                    <View style={[styles.actionIconCircle, { backgroundColor: colors.peachContainer }]}>
                      <Ionicons name="logo-youtube" size={32} color={colors.peach} />
                    </View>
                    <Text style={[styles.contentCardTitle, { color: colors.textPrimary }]}>
                      Import YouTube Lecture
                    </Text>
                    <Text style={[styles.contentCardDesc, { color: colors.textSecondary }]}>
                      Paste any public YouTube lecture or tutorial link to extract the transcript.
                    </Text>

                    <TextInput
                      placeholder="https://www.youtube.com/watch?v=..."
                      placeholderTextColor={colors.textTertiary}
                      value={youtubeUrl}
                      onChangeText={setYoutubeUrl}
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={[
                        styles.urlInput,
                        {
                          backgroundColor: colors.surfaceSubtle,
                          color: colors.textPrimary,
                          borderColor: colors.borderSubtle,
                        },
                      ]}
                    />

                    <TouchableOpacity
                      style={[styles.primaryActionBtn, { backgroundColor: colors.peach }]}
                      onPress={handleIngestYouTube}
                      disabled={isIngesting || !youtubeUrl.trim()}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="cloud-download-outline" size={18} color={colors.onPeach} />
                      <Text style={[styles.primaryActionText, { color: colors.onPeach }]}>
                        Extract Transcript
                      </Text>
                    </TouchableOpacity>
                  </Card>
                )}

                {/* 3. Audio Recording Tab */}
                {activeTab === 'audio' && (
                  <Card variant="surface" style={styles.tabContentCard}>
                    <View style={[styles.actionIconCircle, { backgroundColor: colors.lavenderContainer }]}>
                      <Ionicons name="mic" size={32} color={colors.lavender} />
                    </View>
                    <Text style={[styles.contentCardTitle, { color: colors.textPrimary }]}>
                      Live Audio Lecture
                    </Text>
                    <Text style={[styles.contentCardDesc, { color: colors.textSecondary }]}>
                      Record in-class discussions, seminars, or lectures with Smart Audio Transcription.
                    </Text>

                    {isRecording && (
                      <View style={styles.recordingTimerBox}>
                        <View style={styles.pulsingDot} />
                        <Text style={[styles.recordingTimerText, { color: colors.peach }]}>
                          {formatSeconds(recordDuration)}
                        </Text>
                      </View>
                    )}

                    <View style={styles.audioBtnRow}>
                      {!isRecording ? (
                        <TouchableOpacity
                          style={[styles.primaryActionBtn, { backgroundColor: colors.lavender, flex: 1 }]}
                          onPress={startRecording}
                          disabled={isIngesting}
                        >
                          <Ionicons name="radio-button-on" size={18} color={colors.onLavender} />
                          <Text style={[styles.primaryActionText, { color: colors.onLavender }]}>
                            Start Recording
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.primaryActionBtn, { backgroundColor: colors.peach, flex: 1 }]}
                          onPress={stopAndUploadRecording}
                          disabled={isIngesting}
                        >
                          <Ionicons name="stop-circle-outline" size={18} color={colors.onPeach} />
                          <Text style={[styles.primaryActionText, { color: colors.onPeach }]}>
                            Finish & Transcribe
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </Card>
                )}

                {/* 4. Notes OCR Tab */}
                {activeTab === 'ocr' && (
                  <Card variant="surface" style={styles.tabContentCard}>
                    <View style={[styles.actionIconCircle, { backgroundColor: colors.skyContainer }]}>
                      <Ionicons name="camera" size={32} color={colors.sky} />
                    </View>
                    <Text style={[styles.contentCardTitle, { color: colors.textPrimary }]}>
                      Handwritten Notes Scanner
                    </Text>
                    <Text style={[styles.contentCardDesc, { color: colors.textSecondary }]}>
                      Capture photos of your handwritten notebook pages, whiteboards, or handouts.
                    </Text>

                    <View style={styles.ocrBtnRow}>
                      <TouchableOpacity
                        style={[styles.ocrActionBtn, { backgroundColor: colors.sky }]}
                        onPress={() => handlePickPhoto(true)}
                        disabled={isIngesting || isScanningOcr}
                      >
                        <Ionicons name="camera-outline" size={18} color={colors.onSky} />
                        <Text style={[styles.primaryActionText, { color: colors.onSky }]}>Take Photo</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.ocrActionBtn, { backgroundColor: colors.surfaceSubtle }]}
                        onPress={() => handlePickPhoto(false)}
                        disabled={isIngesting || isScanningOcr}
                      >
                        <Ionicons name="images-outline" size={18} color={colors.textPrimary} />
                        <Text style={[styles.primaryActionText, { color: colors.textPrimary }]}>From Gallery</Text>
                      </TouchableOpacity>
                    </View>
                  </Card>
                )}
              </View>
            </>
          )}

          {/* OCR Scanning In-Progress Overlay */}
          {isScanningOcr && (
            <View style={[styles.loadingOverlay, { backgroundColor: colors.surfaceElevated }]}>
              <ThemedLoader
                title="Scanning Handwritten Notes"
                stage="Recognizing handwriting & equations..."
                stages={[
                  'Optimizing image resolution & orientation...',
                  'Recognizing handwriting & equations...',
                  'Validating character accuracy...',
                  'Preparing editable review screen...',
                ]}
                subtext="Please keep the app open while we read your notes."
                icon="scan-outline"
                variant="primary"
                size="medium"
              />
            </View>
          )}

          {/* General Ingestion Processing Overlay */}
          {isIngesting && (
            <View style={[styles.loadingOverlay, { backgroundColor: colors.surfaceElevated }]}>
              <ThemedLoader
                title="Processing Lecture"
                stage={ingestionStage || 'Extracting and processing study material...'}
                stages={[
                  ingestionStage || 'Extracting lecture content...',
                  'Validating document format & text fidelity...',
                  'Structuring study knowledge points...',
                  'Finishing ingestion pipeline...',
                ]}
                subtext="Your materials are being safely organized."
                icon="cloud-upload-outline"
                variant="primary"
                size="medium"
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.52)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 40 : spacing.xl,
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    ...typography.presets.headline,
    fontSize: 20,
  },
  modalSubtitle: {
    ...typography.presets.bodySmall,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: borderRadius.full,
    padding: spacing.xxs,
    marginBottom: spacing.md,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  tabLabel: {
    ...typography.presets.labelMedium,
    fontSize: 12,
  },
  fieldLabel: {
    ...typography.presets.labelMedium,
    marginBottom: spacing.xs,
  },
  subjectScroll: {
    gap: spacing.xs + 2,
    paddingBottom: spacing.md,
  },
  subjectChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
  },
  subjectText: {
    ...typography.presets.labelMedium,
    fontSize: 12,
  },
  bodyContent: {
    minHeight: 260,
  },
  tabContentCard: {
    padding: spacing.xl,
    alignItems: 'center',
    textAlign: 'center',
  },
  actionIconCircle: {
    width: 68,
    height: 68,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  contentCardTitle: {
    ...typography.presets.titleMedium,
    marginBottom: spacing.xs,
  },
  contentCardDesc: {
    ...typography.presets.bodySmall,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 50,
    width: '100%',
    borderRadius: borderRadius.full,
    ...shadows.card,
  },
  primaryActionText: {
    ...typography.presets.labelLarge,
    fontWeight: '700',
  },
  urlInput: {
    width: '100%',
    height: 48,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    ...typography.presets.bodyMedium,
  },
  recordingTimerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  pulsingDot: {
    width: 12,
    height: 12,
    borderRadius: borderRadius.full,
    backgroundColor: '#D96B43',
  },
  recordingTimerText: {
    ...typography.presets.titleLarge,
    fontWeight: '700',
  },
  audioBtnRow: {
    flexDirection: 'row',
    width: '100%',
  },
  ocrBtnRow: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  ocrActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    height: 48,
    borderRadius: borderRadius.full,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: borderRadius.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  reviewScroll: {
    maxHeight: 460,
  },
  reviewScrollContent: {
    paddingBottom: spacing.lg,
  },
  titleInput: {
    width: '100%',
    height: 46,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    ...typography.presets.bodyMedium,
    marginBottom: spacing.sm,
  },
  reviewTextHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
  },
  reviewTextArea: {
    width: '100%',
    minHeight: 140,
    maxHeight: 200,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    ...typography.presets.bodyMedium,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  reviewActionButtons: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  secondaryBtnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 44,
    borderRadius: borderRadius.full,
  },
  secondaryActionText: {
    ...typography.presets.labelMedium,
    fontWeight: '600',
  },
});
