import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

export interface AudioPlayerHandle {
  stop: () => void;
}

export interface PlayAudioOptions {
  onStart?: () => void;
  onVolume?: (level: number) => void;
  onEnd?: () => void;
  onError?: (error: any) => void;
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function playAudioUri(
  uri: string,
  options: PlayAudioOptions = {}
): Promise<AudioPlayerHandle> {
  try {
    await setAudioModeAsync({
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
  const dataUri = await blobToDataUri(blob);
  return playAudioUri(dataUri, options);
}
