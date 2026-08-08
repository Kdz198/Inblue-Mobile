/**
 * nativeSTT.ts — Native iOS/Android speech-to-text using expo-av recording
 * then sending audio to the backend Whisper STT endpoint.
 *
 * This is a no-op stub that returns the same interface as the web version.
 * Platform-specific logic is in nativeSTT.native.ts
 */

export interface NativeSTTHandle {
  stop: () => Promise<string | null>;
  isActive: () => boolean;
}

export interface NativeSTTOptions {
  onInterimTranscript?: (text: string) => void;
  sessionKey?: string;
}

// Web stub — not used (web uses SpeechRecognition)
export async function startNativeSTT(
  _options: NativeSTTOptions = {}
): Promise<NativeSTTHandle> {
  return {
    stop: async () => null,
    isActive: () => false,
  };
}
