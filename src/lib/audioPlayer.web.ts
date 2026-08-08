export interface AudioPlayerHandle {
  stop: () => void;
}

export interface PlayAudioOptions {
  onStart?: () => void;
  onVolume?: (level: number) => void;
  onEnd?: () => void;
  onError?: (error: any) => void;
}

export async function playAudioUri(
  uri: string,
  options: PlayAudioOptions = {}
): Promise<AudioPlayerHandle> {
  const audio = new Audio(uri);
  (audio as any).playsInline = true;
  audio.crossOrigin = 'anonymous';

  let volumeInterval: any = null;

  const cleanup = () => {
    if (volumeInterval) {
      clearInterval(volumeInterval);
      volumeInterval = null;
    }
  };

  audio.onplay = () => {
    options.onStart?.();
    options.onVolume?.(0.38);
    volumeInterval = setInterval(() => {
      const energy = 0.25 + Math.random() * 0.45;
      options.onVolume?.(energy);
    }, 150);
  };

  audio.onended = () => {
    cleanup();
    options.onVolume?.(0);
    options.onEnd?.();
  };

  audio.onerror = (e) => {
    cleanup();
    options.onVolume?.(0);
    options.onError?.(e);
  };

  try {
    await audio.play();
  } catch (playErr) {
    cleanup();
    options.onVolume?.(0);
    options.onError?.(playErr);
    throw playErr;
  }

  return {
    stop: () => {
      audio.pause();
      audio.currentTime = 0;
      cleanup();
      options.onVolume?.(0);
    },
  };
}

export async function playAudioBlob(
  blob: Blob,
  options: PlayAudioOptions = {}
): Promise<AudioPlayerHandle> {
  const objectUrl = URL.createObjectURL(blob);
  const handle = await playAudioUri(objectUrl, {
    ...options,
    onEnd: () => {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {}
      options.onEnd?.();
    },
    onError: (err) => {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {}
      options.onError?.(err);
    },
  });

  return {
    stop: () => {
      handle.stop();
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {}
    },
  };
}
