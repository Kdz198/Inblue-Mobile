import { NativeEventEmitter, NativeModules } from 'react-native';
import { BASE_URL } from './api';

const TARGET_SAMPLE_RATE = 16000;
const TRANSCRIBE_PATH = '/api/v1/interview/transcribe';

export interface RealtimeTranscriptionHandle {
  stop: () => Promise<void>;
}

export interface RealtimeTranscriptionOptions {
  onTranscript: (text: string, isFinal?: boolean) => void;
  expoGoRecorder?: import('expo-audio').AudioRecorder;
  onAudioLevel?: (level: number) => void;
  onReady?: () => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

type NativePcmModule = {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  addListener: (eventName: string) => void;
  removeListeners: (count: number) => void;
};

const nativePcmAudio = NativeModules.RealtimePcmAudio as NativePcmModule | undefined;
const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function getRealtimeTranscriptionUrl(): string {
  return `${BASE_URL.replace(/^http/i, 'ws')}${TRANSCRIBE_PATH}`;
}

function parseTranscriptionMessage(raw: string): { type?: string; text?: string; message?: string } | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function appendTranscriptSegment(baseText: string, segment: string): string {
  return [baseText.trim(), segment.trim()].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  if (typeof globalThis.atob === 'function') {
    const binaryString = globalThis.atob(clean);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i++) {
    const value = base64Chars.indexOf(clean[i]);
    if (value < 0) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes).buffer;
}

import { AudioQuality, IOSOutputFormat, setAudioModeAsync, type RecordingOptions } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

export const EXPO_GO_PCM_RECORDING_OPTIONS: RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: '.wav',
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.wav',
    audioQuality: AudioQuality.MAX,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
    outputFormat: IOSOutputFormat.LINEARPCM,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};

async function setRecordingAudioMode(allowsRecording: boolean): Promise<void> {
  await setAudioModeAsync({
    allowsRecording,
    playsInSilentMode: true,
    interruptionMode: 'doNotMix',
    shouldPlayInBackground: false,
    shouldRouteThroughEarpiece: false,
    allowsBackgroundRecording: false,
  });
}

export async function startRealtimeTranscription(
  initialText: string,
  options: RealtimeTranscriptionOptions
): Promise<RealtimeTranscriptionHandle> {
  if (!nativePcmAudio) {
    console.log('Realtime PCM native module not found. Using high-precision 16kHz PCM audio recording for Expo Go.');

    let stopped = false;
    const recorder = options.expoGoRecorder;
    let meterSubscription: { remove: () => void } | null = null;

    try {
      if (!recorder) {
        throw new Error('Expo Go audio recorder is unavailable.');
      }
      await setRecordingAudioMode(true);
      await recorder.prepareToRecordAsync(EXPO_GO_PCM_RECORDING_OPTIONS);
      meterSubscription = recorder.addListener('recordingStatusUpdate', status => {
        if (typeof status.metering !== 'number') return;
        const level = Math.max(0, Math.min(1, (status.metering + 60) / 60));
        options.onAudioLevel?.(level);
      });
      recorder.record();
      options.onReady?.();
    } catch (err: any) {
      console.warn('Failed to start expo-audio recording:', err);
      try {
        await setRecordingAudioMode(false);
      } catch {}
      options.onError?.(err);
      throw err;
    }

    return {
      stop: () => {
        if (stopped) return Promise.resolve();
        stopped = true;
        meterSubscription?.remove();
        meterSubscription = null;

        return new Promise<void>(async resolve => {
          let audioUri: string | null = null;

          try {
            if (recorder) {
              await recorder.stop();
              audioUri = recorder.uri;
            }
          } catch (e) {
            console.warn('Error stopping recording:', e);
          }

          try {
            await setRecordingAudioMode(false);
          } catch {}

          if (!audioUri) {
            options.onClose?.();
            resolve();
            return;
          }

          try {
            const base64Audio = await FileSystem.readAsStringAsync(audioUri, { encoding: 'base64' });
            const fullBuffer = base64ToArrayBuffer(base64Audio);
            // Strip 44-byte WAV header so backend receives raw 16kHz S16LE PCM audio
            const pcmBuffer = fullBuffer.byteLength > 44 ? fullBuffer.slice(44) : fullBuffer;

            console.log(`[Expo Go STT] Sending ${pcmBuffer.byteLength} bytes of raw 16kHz PCM audio to Gemini Live...`);

            let committedText = initialText.trim();
            const ws = new WebSocket(getRealtimeTranscriptionUrl());
            ws.binaryType = 'arraybuffer';

            let safetyTimer: NodeJS.Timeout | null = null;
            let finished = false;

            const finish = (finalText?: string) => {
              if (finished) return;
              finished = true;
              if (safetyTimer) {
                clearTimeout(safetyTimer);
                safetyTimer = null;
              }
              if (finalText !== undefined) {
                options.onTranscript(finalText, true);
              }
              try { ws.close(); } catch {}
              options.onClose?.();
              resolve();
            };

            ws.onopen = async () => {
              try {
                console.log('[Expo Go STT] Connected to backend WebSocket STT.');
                const uint8View = new Uint8Array(pcmBuffer);
                const CHUNK_SIZE = 3200; // 100ms of 16kHz 16-bit mono audio (3200 bytes)
                for (let offset = 0; offset < uint8View.length; offset += CHUNK_SIZE) {
                  if (finished || ws.readyState !== WebSocket.OPEN) return;
                  const end = Math.min(offset + CHUNK_SIZE, uint8View.length);
                  const chunk = uint8View.subarray(offset, end);
                  const chunkBuffer = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);
                  ws.send(chunkBuffer);
                  await new Promise(r => setTimeout(r, 5));
                }
                console.log('[Expo Go STT] All audio chunks sent. Sending audio_end...');
                ws.send(JSON.stringify({ type: 'audio_end' }));

                // Start waiting only after the complete recording reaches the backend.
                safetyTimer = setTimeout(() => {
                  console.log('[Expo Go STT] STT response timeout fallback.');
                  finish(committedText || undefined);
                }, 20000);
              } catch (error) {
                console.warn('[Expo Go STT] Failed while sending audio:', error);
                finish(committedText || undefined);
              }
            };

            ws.onmessage = event => {
              console.log('[Expo Go STT] Received WS msg:', event.data);
              if (typeof event.data !== 'string') return;
              const message = parseTranscriptionMessage(event.data);
              if (!message) return;

              if (message.type === 'transcript' && message.text) {
                committedText = appendTranscriptSegment(committedText, message.text);
                options.onTranscript(committedText, false);
              } else if (message.type === 'turn_complete') {
                finish(committedText);
              } else if (message.type === 'error') {
                console.warn('[Expo Go STT] STT Server Error:', message.message);
                options.onError?.(new Error(message.message || 'Transcription error'));
                finish(committedText || undefined);
              }
            };

            ws.onerror = err => {
              console.warn('[Expo Go STT] WS Error:', err);
              options.onError?.(new Error('WebSocket connection error'));
              finish(committedText || undefined);
            };

            ws.onclose = () => {
              finish(committedText || undefined);
            };
          } catch (err: any) {
            console.warn('Error sending recording audio:', err);
            options.onError?.(err);
            options.onClose?.();
            resolve();
          }
        });
      },
    };
  }

  let ws: WebSocket | null = null;
  let stopped = false;
  let committedText = initialText.trim();

  const emitter = new NativeEventEmitter(nativePcmAudio as any);
  const chunkSubscription = emitter.addListener('RealtimePcmAudioChunk', (event: { pcmBase64?: string }) => {
    if (!event.pcmBase64 || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(base64ToArrayBuffer(event.pcmBase64));
  });

  const errorSubscription = emitter.addListener('RealtimePcmAudioError', (event: { message?: string }) => {
    options.onError?.(new Error(event.message || 'Realtime audio recording failed.'));
  });

  const cleanup = async (sendAudioEnd: boolean) => {
    if (stopped) return;
    stopped = true;

    chunkSubscription.remove();
    errorSubscription.remove();

    try {
      await nativePcmAudio.stop();
    } catch {}

    if (ws && ws.readyState === WebSocket.OPEN) {
      if (sendAudioEnd) {
        ws.send(JSON.stringify({ type: 'audio_end' }));
        await new Promise(resolve => setTimeout(resolve, 1500));
        if (ws && ws.readyState === WebSocket.OPEN) ws.close();
      } else {
        ws.close();
      }
    }
  };

  await new Promise<void>((resolve, reject) => {
    ws = new WebSocket(getRealtimeTranscriptionUrl());
    ws.binaryType = 'arraybuffer';

    ws.onopen = async () => {
      try {
        await nativePcmAudio.start();
        options.onReady?.();
        resolve();
      } catch (error: any) {
        void cleanup(false);
        reject(error);
      }
    };

    ws.onmessage = event => {
      if (typeof event.data !== 'string') return;

      const message = parseTranscriptionMessage(event.data);
      if (!message) return;

      if (message.type === 'ready') {
        options.onReady?.();
        return;
      }

      if (message.type === 'transcript' && message.text) {
        committedText = appendTranscriptSegment(committedText, message.text);
        options.onTranscript(committedText, false);
        return;
      }

      if (message.type === 'turn_complete') {
        options.onTranscript(committedText, true);
        return;
      }

      if (message.type === 'error') {
        options.onError?.(new Error(message.message || 'Realtime transcription failed.'));
      }
    };

    ws.onerror = () => {
      const error = new Error('Realtime transcription WebSocket error.');
      options.onError?.(error);
      reject(error);
    };

    ws.onclose = () => {
      options.onClose?.();
    };
  });

  return {
    stop: () => cleanup(true),
  };
}

export { TARGET_SAMPLE_RATE };
