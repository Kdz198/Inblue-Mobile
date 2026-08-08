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
  const cleanBase64 = base64.replace(/=+$/, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (let i = 0; i < cleanBase64.length; i++) {
    const value = base64Chars.indexOf(cleanBase64[i]);
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

export async function startRealtimeTranscription(
  initialText: string,
  options: RealtimeTranscriptionOptions
): Promise<RealtimeTranscriptionHandle> {
  if (!nativePcmAudio) {
    throw new Error('Realtime PCM audio module is not available on this platform.');
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
