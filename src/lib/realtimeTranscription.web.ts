import { BASE_URL } from './api';

const TARGET_SAMPLE_RATE = 16000;
const TRANSCRIBE_PATH = '/api/v1/interview/transcribe';

export const EXPO_GO_PCM_RECORDING_OPTIONS = {
  extension: '.webm',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 128000,
  android: {
    extension: '.webm',
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
  ios: {
    extension: '.webm',
    audioQuality: 0x7f,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};

export interface RealtimeTranscriptionHandle {
  stop: () => Promise<void>;
}

export interface RealtimeTranscriptionOptions {
  onTranscript: (text: string, isFinal?: boolean) => void;
  onReady?: () => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

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

function downsampleBuffer(buffer: Float32Array, inputSampleRate: number, outputSampleRate: number): Float32Array {
  if (inputSampleRate === outputSampleRate) return buffer;

  const ratio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;

    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }

    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

function float32ToPCM16(float32Array: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);

  for (let i = 0; i < float32Array.length; i++) {
    let sample = Math.max(-1, Math.min(1, float32Array[i]));
    sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(i * 2, sample, true);
  }

  return buffer;
}

export async function startRealtimeTranscription(
  initialText: string,
  options: RealtimeTranscriptionOptions
): Promise<RealtimeTranscriptionHandle> {
  if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone recording is not supported in this browser.');
  }

  let ws: WebSocket | null = null;
  let mediaStream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let processorNode: ScriptProcessorNode | null = null;
  let muteGain: GainNode | null = null;
  let stopped = false;
  let committedText = initialText.trim();

  const cleanup = async (sendAudioEnd: boolean) => {
    if (stopped) return;
    stopped = true;

    if (processorNode) {
      processorNode.onaudioprocess = null;
      processorNode.disconnect();
      processorNode = null;
    }

    sourceNode?.disconnect();
    sourceNode = null;
    muteGain?.disconnect();
    muteGain = null;

    mediaStream?.getTracks().forEach(track => track.stop());
    mediaStream = null;

    if (audioContext) {
      await audioContext.close();
      audioContext = null;
    }

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
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
        audioContext = new AudioContextCtor();
        sourceNode = audioContext.createMediaStreamSource(mediaStream);
        processorNode = audioContext.createScriptProcessor(4096, 1, 1);
        muteGain = audioContext.createGain();
        muteGain.gain.value = 0;

        sourceNode.connect(processorNode);
        processorNode.connect(muteGain);
        muteGain.connect(audioContext.destination);

        processorNode.onaudioprocess = event => {
          if (!ws || ws.readyState !== WebSocket.OPEN || !audioContext) return;
          const input = event.inputBuffer.getChannelData(0);
          const downsampled = downsampleBuffer(input, audioContext.sampleRate, TARGET_SAMPLE_RATE);
          ws.send(float32ToPCM16(downsampled));
        };

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
