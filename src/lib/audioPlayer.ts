import {
  createAudioPlayer,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
  type AudioPlayer,
} from 'expo-audio';

export interface AudioPlayerHandle {
  stop: () => void;
}

export interface PlayAudioOptions {
  onStart?: () => void;
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
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      interruptionMode: 'doNotMix',
    });
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

    const player: AudioPlayer = createAudioPlayer({ uri }, { updateInterval: 250 });
    let subscription: { remove: () => void } | null = null;

    subscription = player.addListener('playbackStatusUpdate', (status: any) => {
      if (status.playing) {
        options.onStart?.();
        options.onVolume?.(0.34);
      }

      if (status.didJustFinish) {
        subscription?.remove();
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
    options.onVolume?.(0.34);

    return {
      stop: () => {
        subscription?.remove();
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
