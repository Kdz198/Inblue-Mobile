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

  try {
    player.play();
    callbacks.onStart?.();
    callbacks.onVolume?.(0.34);
  } catch (error) {
    subscription?.remove();
    player.remove();
    throw error;
  }

  return {
    stop: () => {
      subscription?.remove();
      player.pause();
      player.remove();
      callbacks.onVolume?.(0);
    },
  };
}
