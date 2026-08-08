/**
 * nativeSTT.native.ts — Native iOS/Android speech-to-text
 *
 * Strategy:
 *  1. Request mic permission (expo-audio)
 *  2. Use expo-av Audio.Recording to capture audio chunks
 *  3. After stop(), upload the m4a to the backend Whisper STT endpoint
 *  4. Return the transcribed text
 */

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { BASE_URL } from './api';

export interface NativeSTTHandle {
  stop: () => Promise<string | null>;
  isActive: () => boolean;
}

export interface NativeSTTOptions {
  onInterimTranscript?: (text: string) => void;
  sessionKey?: string;
}

export async function startNativeSTT(
  options: NativeSTTOptions = {}
): Promise<NativeSTTHandle> {
  let recording: Audio.Recording | null = null;
  let active = true;

  try {
    // Configure audio session for recording
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
      shouldDuckAndroid: true,
    });

    const { recording: rec } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    recording = rec;

    // Interim pulse every 5 seconds — no real-time transcription on native
    let interimInterval: any = null;
    if (options.onInterimTranscript) {
      let elapsed = 0;
      interimInterval = setInterval(() => {
        elapsed += 5;
        // just ping UI that we're recording
        options.onInterimTranscript?.('…');
      }, 5000);
    }

    return {
      isActive: () => active,
      stop: async () => {
        if (!active) return null;
        active = false;

        if (interimInterval) {
          clearInterval(interimInterval);
        }

        try {
          await recording?.stopAndUnloadAsync();
        } catch (e) {
          console.warn('nativeSTT: stopAndUnload error', e);
        }

        // Reset audio mode back to playback
        try {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
          });
        } catch {}

        const uri = recording?.getURI();
        if (!uri) return null;

        // Try to send to backend STT endpoint
        try {
          const sttEndpoint = `${BASE_URL}/api/v1/interview/stt`;
          const uploadResult = await FileSystem.uploadAsync(sttEndpoint, uri, {
            httpMethod: 'POST',
            uploadType: FileSystem.FileSystemUploadType.MULTIPART,
            fieldName: 'audio',
            mimeType: 'audio/m4a',
            parameters: options.sessionKey
              ? { sessionKey: options.sessionKey }
              : {},
          });

          if (uploadResult.status >= 200 && uploadResult.status < 300) {
            const parsed = JSON.parse(uploadResult.body);
            // Accept { text: "..." } or { transcript: "..." } or { result: "..." }
            const text =
              parsed.text ||
              parsed.transcript ||
              parsed.result ||
              parsed.content ||
              null;
            if (text && typeof text === 'string' && text.trim()) {
              return text.trim();
            }
          }
        } catch (sttErr) {
          console.warn('nativeSTT: STT backend error, falling back to empty', sttErr);
        }

        // Fallback: clean up file and return null
        try {
          await FileSystem.deleteAsync(uri, { idempotent: true });
        } catch {}

        return null;
      },
    };
  } catch (err) {
    console.warn('nativeSTT: Failed to start recording', err);
    return {
      stop: async () => null,
      isActive: () => false,
    };
  }
}
