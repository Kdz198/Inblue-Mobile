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

let globalExpoAvRecording: Audio.Recording | null = null;

export async function startRealtimeTranscription(
  initialText: string,
  options: RealtimeTranscriptionOptions
): Promise<RealtimeTranscriptionHandle> {
  if (!nativePcmAudio) {
    console.log('Realtime PCM native module not found. Starting progressive 16kHz live streaming for Expo Go.');

    let ws: WebSocket | null = null;
    let streamTimer: NodeJS.Timeout | null = null;
    let stopped = false;
    let committedText = initialText.trim();
    let lastSentOffset = 44; // Skip 44-byte WAV header

    // Clean up any stale recording left over from a previous crash/error
    if (globalExpoAvRecording) {
      try {
        await globalExpoAvRecording.stopAndUnloadAsync();
      } catch {}
      globalExpoAvRecording = null;
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const rec = new Audio.Recording();
      globalExpoAvRecording = rec;
      await rec.prepareToRecordAsync(LINEAR_PCM_16K_OPTIONS);
      await rec.startAsync();
      options.onReady?.();
    } catch (err: any) {
      console.warn('Failed to start expo-av recording:', err);
      if (globalExpoAvRecording) {
        try {
          await globalExpoAvRecording.stopAndUnloadAsync();
        } catch {}
        globalExpoAvRecording = null;
      }
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });
      } catch {}
      options.onError?.(err);
      throw err;
    }

    let onTurnCompleteHandler: (() => void) | null = null;

    // Connect WebSocket immediately for live streaming
    try {
      ws = new WebSocket(getRealtimeTranscriptionUrl());
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        console.log('[Expo Go Realtime] Live WebSocket connected to backend STT.');
      };

      ws.onmessage = event => {
        console.log('[Expo Go Realtime] Received WS msg:', event.data);
        if (typeof event.data !== 'string') return;
        const message = parseTranscriptionMessage(event.data);
        if (!message) return;

        if (message.type === 'transcript' && message.text) {
          committedText = appendTranscriptSegment(committedText, message.text);
          options.onTranscript(committedText, false);
        } else if (message.type === 'turn_complete') {
          options.onTranscript(committedText, true);
          if (onTurnCompleteHandler) {
            onTurnCompleteHandler();
            onTurnCompleteHandler = null;
          }
        } else if (message.type === 'error') {
          console.warn('[Expo Go Realtime] STT Server Error:', message.message);
          options.onError?.(new Error(message.message || 'Transcription error'));
          if (onTurnCompleteHandler) {
            onTurnCompleteHandler();
            onTurnCompleteHandler = null;
          }
        }
      };

      ws.onerror = err => {
        console.warn('[Expo Go Realtime] WS Error:', err);
      };
    } catch (e) {
      console.warn('[Expo Go Realtime] Failed to initialize WebSocket:', e);
    }

    // Progressive live stream timer: read growing WAV file and send 2-byte sample aligned PCM chunks every 250ms
    streamTimer = setInterval(async () => {
      if (stopped || !globalExpoAvRecording || !ws || ws.readyState !== WebSocket.OPEN) return;

      try {
        const audioUri = globalExpoAvRecording.getURI();
        if (!audioUri) return;

        const base64Audio = await FileSystem.readAsStringAsync(audioUri, { encoding: 'base64' });
        const fullBuffer = base64ToArrayBuffer(base64Audio);
        const availableBytes = fullBuffer.byteLength - lastSentOffset;

        if (availableBytes >= 2) {
          // Force 2-byte sample alignment (16-bit PCM S16LE requirement)
          const alignedLength = (availableBytes >> 1) << 1;
          const chunk = fullBuffer.slice(lastSentOffset, lastSentOffset + alignedLength);
          lastSentOffset += alignedLength;
          ws.send(chunk);
          console.log(`[Expo Go Realtime] Streamed ${chunk.byteLength} aligned PCM bytes live...`);
        }
      } catch (err) {
        // file read race condition during active recording is normal
      }
    }, 250);

    return {
      stop: () => {
        if (stopped) return Promise.resolve();
        stopped = true;

        if (streamTimer) {
          clearInterval(streamTimer);
          streamTimer = null;
        }

        return new Promise<void>(async resolve => {
          let audioUri: string | null = null;
          const currentRec = globalExpoAvRecording;
          globalExpoAvRecording = null;

          try {
            if (currentRec) {
              await currentRec.stopAndUnloadAsync();
              audioUri = currentRec.getURI();
            }
          } catch (e) {
            console.warn('Error stopping recording:', e);
          }

          try {
            await Audio.setAudioModeAsync({
              allowsRecordingIOS: false,
              playsInSilentModeIOS: true,
            });
          } catch {}

          if (audioUri && ws && ws.readyState === WebSocket.OPEN) {
            try {
              const base64Audio = await FileSystem.readAsStringAsync(audioUri, { encoding: 'base64' });
              const fullBuffer = base64ToArrayBuffer(base64Audio);
              const availableBytes = fullBuffer.byteLength - lastSentOffset;

              if (availableBytes >= 2) {
                const alignedLength = (availableBytes >> 1) << 1;
                const finalChunk = fullBuffer.slice(lastSentOffset, lastSentOffset + alignedLength);
                ws.send(finalChunk);
              }
              console.log('[Expo Go Realtime] Sent final audio chunk. Sending audio_end...');
              ws.send(JSON.stringify({ type: 'audio_end' }));
            } catch (e) {
              console.warn('Error sending final audio chunk:', e);
            }
          }

          // Safety timeout of 3s to resolve if server turn_complete doesn't arrive
          const safetyTimeout = setTimeout(() => {
            console.log('[Expo Go Realtime] Turn complete safety timeout reached.');
            onTurnCompleteHandler = null;
            try { ws?.close(); } catch {}
            options.onClose?.();
            resolve();
          }, 3000);

          onTurnCompleteHandler = () => {
            clearTimeout(safetyTimeout);
            try { ws?.close(); } catch {}
            options.onClose?.();
            resolve();
          };
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
