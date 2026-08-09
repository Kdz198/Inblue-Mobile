import { NativeEventEmitter, NativeModules } from 'react-native';
import { BASE_URL } from './api';

const TARGET_SAMPLE_RATE = 16000;
const TRANSCRIBE_PATH = '/api/v1/interview/transcribe';

export interface RealtimeTranscriptionHandle {
  stop: () => Promise<void>;
}

export interface RealtimeTranscriptionOptions {
  onTranscript: (text: string, isFinal?: boolean) => void;
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

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

const LINEAR_PCM_16K_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: '.wav',
    outputFormat: Audio.AndroidOutputFormat.THREE_GPP,
    audioEncoder: Audio.AndroidAudioEncoder.AMR_NB,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.wav',
    audioQuality: Audio.IOSAudioQuality.MAX,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};

export async function startRealtimeTranscription(
  initialText: string,
  options: RealtimeTranscriptionOptions
): Promise<RealtimeTranscriptionHandle> {
  if (!nativePcmAudio) {
    console.log('Realtime PCM native module not found. Using expo-av 16kHz PCM recording fallback for Expo Go.');

    let ws: WebSocket | null = null;
    let recording: Audio.Recording | null = null;
    let stopped = false;
    let committedText = initialText.trim();

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      recording = new Audio.Recording();
      await recording.prepareToRecordAsync(LINEAR_PCM_16K_OPTIONS);
      await recording.startAsync();
      options.onReady?.();
    } catch (err: any) {
      console.warn('Failed to start expo-av recording:', err);
      options.onError?.(err);
      throw err;
    }

    return {
      stop: async () => {
        if (stopped) return;
        stopped = true;

        let audioUri: string | null = null;
        try {
          if (recording) {
            await recording.stopAndUnloadAsync();
            audioUri = recording.getURI();
          }
        } catch (e) {
          console.warn('Error stopping recording:', e);
        }

        if (!audioUri) {
          options.onClose?.();
          return;
        }

        try {
          const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
            encoding: 'base64',
          });

          const fullBuffer = base64ToArrayBuffer(base64Audio);
          const pcmBuffer = fullBuffer.byteLength > 44 ? fullBuffer.slice(44) : fullBuffer;

          console.log(`[Expo Go Fallback] Sending ${pcmBuffer.byteLength} bytes of raw PCM audio to WebSocket...`);

          await new Promise<void>((resolve, reject) => {
            ws = new WebSocket(getRealtimeTranscriptionUrl());
            ws.binaryType = 'arraybuffer';

            ws.onopen = async () => {
              console.log('[Expo Go Fallback] WebSocket connected to backend STT.');
              const uint8View = new Uint8Array(pcmBuffer);
              const CHUNK_SIZE = 4096;
              for (let offset = 0; offset < uint8View.length; offset += CHUNK_SIZE) {
                const chunk = uint8View.subarray(offset, offset + CHUNK_SIZE);
                ws?.send(chunk.buffer);
                await new Promise(r => setTimeout(r, 20));
              }
              console.log('[Expo Go Fallback] Audio chunks sent, sending audio_end.');
              ws?.send(JSON.stringify({ type: 'audio_end' }));
            };

            ws.onmessage = event => {
              console.log('[Expo Go Fallback] Received WS msg:', event.data);
              if (typeof event.data !== 'string') return;
              const message = parseTranscriptionMessage(event.data);
              if (!message) return;

              if (message.type === 'transcript' && message.text) {
                committedText = appendTranscriptSegment(committedText, message.text);
                options.onTranscript(committedText, false);
              } else if (message.type === 'turn_complete') {
                options.onTranscript(committedText, true);
                ws?.close();
                resolve();
              } else if (message.type === 'error') {
                console.warn('[Expo Go Fallback] STT Server Error:', message.message);
                options.onError?.(new Error(message.message || 'Transcription error'));
                ws?.close();
                reject(new Error(message.message));
              }
            };

            ws.onerror = err => {
              console.warn('[Expo Go Fallback] WS Error:', err);
              options.onError?.(new Error('WebSocket connection error'));
              reject(err);
            };

            ws.onclose = () => {
              options.onClose?.();
              resolve();
            };

            setTimeout(() => {
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.close();
              }
              resolve();
            }, 12000);
          });
        } catch (err: any) {
          console.warn('Error sending recording audio:', err);
          options.onError?.(err);
        } finally {
          options.onClose?.();
        }
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
