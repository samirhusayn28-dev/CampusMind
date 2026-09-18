import * as Speech from 'expo-speech';

export interface SpeechOptions {
  rate?: number;
  pitch?: number;
  language?: string;
  onStart?: () => void;
  onDone?: () => void;
  onStopped?: () => void;
  onError?: (err: any) => void;
}

export async function speakText(text: string, options: SpeechOptions = {}): Promise<void> {
  const isSpeaking = await Speech.isSpeakingAsync();
  if (isSpeaking) {
    await Speech.stop();
  }

  const cleanText = text
    .replace(/[•\-\*]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  Speech.speak(cleanText, {
    rate: options.rate || 1.0,
    pitch: options.pitch || 1.0,
    language: options.language || 'en-US',
    onStart: options.onStart,
    onDone: options.onDone,
    onStopped: options.onStopped,
    onError: options.onError,
  });
}

export async function stopSpeech(): Promise<void> {
  try {
    await Speech.stop();
  } catch (e) {
    console.warn('Speech stop error:', e);
  }
}

export async function pauseSpeech(): Promise<void> {
  try {
    // pause is supported on iOS and certain Android engines
    if (typeof (Speech as any).pause === 'function') {
      await (Speech as any).pause();
    } else {
      await Speech.stop();
    }
  } catch {
    await Speech.stop();
  }
}

export async function resumeSpeech(): Promise<void> {
  try {
    if (typeof (Speech as any).resume === 'function') {
      await (Speech as any).resume();
    }
  } catch (e) {
    console.warn('Speech resume error:', e);
  }
}

export async function isSpeakingNow(): Promise<boolean> {
  try {
    return await Speech.isSpeakingAsync();
  } catch {
    return false;
  }
}
