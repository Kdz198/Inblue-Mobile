import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

export interface TtsPlayback {
  stop: () => void;
}

export interface TtsPlaybackCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: unknown) => void;
  onVolume?: (energy: number) => void;
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function playTtsAudioBlob(blob: Blob, callbacks: TtsPlaybackCallbacks = {}): Promise<TtsPlayback> {
  // Web Platform (Safari iOS, iPadOS, Chrome, Firefox, Vercel)
  if (Platform.OS === 'web') {
    const objectUrl = URL.createObjectURL(blob);
    const audio = new Audio(objectUrl);
    (audio as any).playsInline = true;
    audio.crossOrigin = 'anonymous';

    let volumeInterval: any = null;

    const cleanup = () => {
      if (volumeInterval) {
        clearInterval(volumeInterval);
        volumeInterval = null;
      }
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {}
    };

    audio.onplay = () => {
      callbacks.onStart?.();
      callbacks.onVolume?.(0.38);
      volumeInterval = setInterval(() => {
        const energy = 0.25 + Math.random() * 0.45;
        callbacks.onVolume?.(energy);
      }, 150);
    };

    audio.onended = () => {
      cleanup();
      callbacks.onVolume?.(0);
      callbacks.onEnd?.();
    };

    audio.onerror = (e) => {
      cleanup();
      callbacks.onVolume?.(0);
      callbacks.onError?.(e);
    };

    try {
      await audio.play();
    } catch (playErr) {
      cleanup();
      callbacks.onVolume?.(0);
      callbacks.onError?.(playErr);
      throw playErr;
    }

    return {
      stop: () => {
        audio.pause();
        audio.currentTime = 0;
        cleanup();
        callbacks.onVolume?.(0);
      },
    };
  }

  // Native Platform (Expo Go on iOS / iPad / Android)
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'doNotMix',
    });

    const audioUri = await blobToDataUri(blob);
    const player: AudioPlayer = createAudioPlayer({ uri: audioUri }, { updateInterval: 250 });
    let subscription: { remove: () => void } | null = null;

    subscription = player.addListener('playbackStatusUpdate', (status: any) => {
      if (status.playing) {
        callbacks.onStart?.();
        callbacks.onVolume?.(0.34);
      }

      if (status.didJustFinish) {
        subscription?.remove();
        player.remove();
        callbacks.onVolume?.(0);
        callbacks.onEnd?.();
      }
    });

    player.play();
    callbacks.onStart?.();
    callbacks.onVolume?.(0.34);

    return {
      stop: () => {
        subscription?.remove();
        try {
          player.pause();
          player.remove();
        } catch {}
        callbacks.onVolume?.(0);
      },
    };
  } catch (error) {
    callbacks.onError?.(error);
    throw error;
  }
}
