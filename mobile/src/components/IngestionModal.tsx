import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import {
  useAudioRecorder,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  RecordingPresets,
  type AudioRecorder,
} from 'expo-audio';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { useContentStore } from '../store/useContentStore';
import { ContentType } from '../types/content';
import { Card } from './Card';
import { Badge } from './Badge';
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
  const { colors } = useThemeStore();
  const user = useAuthStore((state) => state.user);
  const {
    isIngesting,
    ingestionStage,
    ingestPdf,
    ingestYouTube,
    ingestAudio,
    ingestOcr,
  } = useContentStore();

  const [activeTab, setActiveTab] = useState<ContentType>(initialType);
  const [selectedSubject, setSelectedSubject] = useState('Computer Science');

  // YouTube State
  const [youtubeUrl, setYoutubeUrl] = useState('');

  // Audio Recording State — using expo-audio recorder
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (visible && initialType) {
      setActiveTab(initialType);
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

  // Handle PDF Picking
  const handlePickPdf = async () => {
    try {
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
      onClose();
      Alert.alert('Success', `"${file.name}" has been processed and saved!`);
    } catch (err: any) {
      Alert.alert('PDF Upload Error', err.message || 'Could not process PDF document.');
    }
  };

  // Handle YouTube Ingestion
  const handleIngestYouTube = async () => {
    if (!youtubeUrl.trim()) {
      Alert.alert('Enter URL', 'Please paste a valid YouTube video URL.');
      return;
    }

    try {
      const userId = user?.uid || 'guest_user';
      await ingestYouTube(youtubeUrl.trim(), userId, selectedSubject);
      setYoutubeUrl('');
      onClose();
      Alert.alert('Success', 'YouTube lecture transcript extracted and saved!');
    } catch (err: any) {
      Alert.alert('YouTube Error', err.message || 'Could not extract YouTube transcript.');
    }
  };

  // Audio Recording Handlers
  const startRecording = async () => {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Microphone Access', 'Permission to access microphone is required for live recording.');
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
      Alert.alert('Recording Error', err.message || 'Could not start audio recording.');
    }
  };

  const stopAndUploadRecording = async () => {
    try {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);

      await recorder.stop();
      const uri = recorder.uri;

      if (!uri) throw new Error('Recording URI is missing');

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const userId = user?.uid || 'guest_user';
      await ingestAudio(base64, recordDuration, userId, selectedSubject);
      setRecordDuration(0);
      onClose();
      Alert.alert('Success', 'Lecture audio transcribed via Groq Whisper and saved!');
    } catch (err: any) {
      Alert.alert('Audio Error', err.message || 'Could not process audio recording.');
    }
  };

  // Photo / OCR Handlers
  const handlePickPhoto = async (useCamera: boolean) => {
    try {
      if (useCamera) {
        const camPerm = await ImagePicker.requestCameraPermissionsAsync();
        if (!camPerm.granted) {
          Alert.alert('Camera Access', 'Camera permission is required to capture handwritten notes.');
          return;
        }
      } else {
        const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!libPerm.granted) {
          Alert.alert('Library Access', 'Photo library permission is required to select handwritten notes.');
          return;
        }
      }

      const pickerOptions: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      };

      const result = useCamera
        ? await ImagePicker.launchCameraAsync(pickerOptions)
        : await ImagePicker.launchImageLibraryAsync(pickerOptions);

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      let base64 = asset.base64;

      if (!base64 && asset.uri) {
        base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      if (!base64) throw new Error('Failed to read image data');

      const userId = user?.uid || 'guest_user';
      await ingestOcr(base64, userId, selectedSubject);
      onClose();
      Alert.alert('Success', 'Handwritten notes OCR completed and saved!');
    } catch (err: any) {
      Alert.alert('OCR Error', err.message || 'Could not extract text from notes photo.');
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
            <View>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Add Study Material</Text>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                Select content source to process with AI
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.closeBtn, { backgroundColor: colors.surfaceSubtle }]}
              onPress={onClose}
              disabled={isIngesting}
            >
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

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
                  onPress={() => setActiveTab(tab.type)}
                  disabled={isIngesting}
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subjectScroll}>
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
                  disabled={isIngesting}
                >
                  <Text style={[styles.subjectText, { color: isSel ? colors.onPrimary : colors.textSecondary }]}>
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
                  Upload slide decks, research papers, or syllabus documents. Text is parsed on the serverless backend.
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
                  Paste any public YouTube lecture or educational video URL. Transcript will be extracted automatically.
                </Text>

                <TextInput
                  placeholder="https://www.youtube.com/watch?v=..."
                  placeholderTextColor={colors.textTertiary}
                  value={youtubeUrl}
                  onChangeText={setYoutubeUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.urlInput, { backgroundColor: colors.surfaceSubtle, color: colors.textPrimary }]}
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
                  Record your live class or tutorial. Audio is uploaded to Groq Whisper for instant high-accuracy transcription.
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
                  Handwritten Notes OCR
                </Text>
                <Text style={[styles.contentCardDesc, { color: colors.textSecondary }]}>
                  Take a photo of your notebook or whiteboard. Processed by Google Cloud Vision OCR on our serverless backend.
                </Text>

                <View style={styles.ocrBtnRow}>
                  <TouchableOpacity
                    style={[styles.ocrActionBtn, { backgroundColor: colors.sky }]}
                    onPress={() => handlePickPhoto(true)}
                    disabled={isIngesting}
                  >
                    <Ionicons name="camera-outline" size={18} color={colors.onSky} />
                    <Text style={[styles.primaryActionText, { color: colors.onSky }]}>Take Photo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.ocrActionBtn, { backgroundColor: colors.surfaceSubtle }]}
                    onPress={() => handlePickPhoto(false)}
                    disabled={isIngesting}
                  >
                    <Ionicons name="images-outline" size={18} color={colors.textPrimary} />
                    <Text style={[styles.primaryActionText, { color: colors.textPrimary }]}>From Gallery</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            )}
          </View>

          {/* Ingestion Processing Overlay */}
          {isIngesting && (
            <View style={[styles.loadingOverlay, { backgroundColor: colors.surfaceElevated }]}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingStageText, { color: colors.textPrimary }]}>
                {ingestionStage || 'Processing study material...'}
              </Text>
              <Text style={[styles.loadingSubtext, { color: colors.textSecondary }]}>
                Cloud serverless pipeline running safely in background.
              </Text>
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
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 40 : spacing.xl,
    maxHeight: '90%',
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
  },
  urlInput: {
    width: '100%',
    height: 48,
    borderRadius: borderRadius.full,
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
  loadingStageText: {
    ...typography.presets.titleMedium,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  loadingSubtext: {
    ...typography.presets.caption,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});
