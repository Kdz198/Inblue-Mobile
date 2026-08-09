import {
  createAudioPlayer,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
  type AudioPlayer,
  type AudioSample,
} from 'expo-audio';

export interface AudioPlayerHandle {
  stop: () => void;
}

export interface PlayAudioOptions {
  onStart?: () => void;
  onProgress?: (currentTime: number, duration: number) => void;
  onVolume?: (level: number) => void;
  onEnd?: () => void;
  onError?: (error: any) => void;
}

export async function requestMicrophonePermissionAsync(): Promise<boolean> {
  try {
    const current = await getRecordingPermissionsAsync();
    let granted = current.granted || current.status === 'granted';
    if (!granted) {
      const requested = await requestRecordingPermissionsAsync();
      granted = requested.granted || requested.status === 'granted';
    }
    return granted;
  } catch (error) {
    console.warn('Failed to request native recording permissions:', error);
    return false;
  }
}

import * as FileSystem from 'expo-file-system/legacy';

async function blobToFileUri(blob: Blob): Promise<string> {
  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const b64 = reader.result as string;
      const dataPart = b64.includes(',') ? b64.split(',')[1] : b64;
      resolve(dataPart);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  
  const fileUri = `${FileSystem.cacheDirectory}tts-${Date.now()}.mp3`;
  await FileSystem.writeAsStringAsync(fileUri, base64Data, {
    encoding: (FileSystem.EncodingType?.Base64 || 'base64') as any,
  });
  
  return fileUri;
}

export async function playAudioUri(
  uri: string,
  options: PlayAudioOptions = {}
): Promise<AudioPlayerHandle> {
  try {
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      interruptionMode: 'doNotMix',
    });

    const player: AudioPlayer = createAudioPlayer({ uri }, { updateInterval: 80 });
    let subscription: { remove: () => void } | null = null;
    let sampleSubscription: { remove: () => void } | null = null;

    const removeListeners = () => {
      subscription?.remove();
      sampleSubscription?.remove();
      subscription = null;
      sampleSubscription = null;
      try {
        player.setAudioSamplingEnabled(false);
      } catch {}
    };

    const emitAudioLevel = (sample: AudioSample) => {
      const frames = sample.channels[0]?.frames;
      if (!frames?.length) return;

      let sumSquares = 0;
      const stride = Math.max(1, Math.floor(frames.length / 192));
      let count = 0;
      for (let index = 0; index < frames.length; index += stride) {
        sumSquares += frames[index] * frames[index];
        count++;
      }

      const rms = Math.sqrt(sumSquares / Math.max(1, count));
      options.onVolume?.(Math.max(0, Math.min(1, rms * 3.5)));
    };

    try {
      player.setAudioSamplingEnabled(true);
      sampleSubscription = player.addListener('audioSampleUpdate', emitAudioLevel);
    } catch (error) {
      console.warn('Unable to sample TTS audio:', error);
    }

    subscription = player.addListener('playbackStatusUpdate', (status: any) => {
      if (status.duration > 0) {
        options.onProgress?.(status.currentTime, status.duration);
      }

      if (status.playing) {
        options.onStart?.();
      }

      if (status.didJustFinish) {
        removeListeners();
        try {
          player.pause();
          player.remove();
        } catch {}
        options.onVolume?.(0);
        options.onEnd?.();
      }
    });

    player.play();
    options.onStart?.();

    return {
      stop: () => {
        removeListeners();
        try {
          player.pause();
          player.remove();
        } catch {}
        options.onVolume?.(0);
      },
    };
  } catch (error) {
    options.onError?.(error);
    throw error;
  }
}

export async function playAudioBlob(
  blob: Blob,
  options: PlayAudioOptions = {}
): Promise<AudioPlayerHandle> {
  const fileUri = await blobToFileUri(blob);
  return playAudioUri(fileUri, options);
}
