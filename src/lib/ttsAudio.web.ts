export interface TtsPlayback {
  stop: () => void;
}

export interface TtsPlaybackCallbacks {
  onStart?: () => void;
  onProgress?: (currentTime: number, duration: number) => void;
  onEnd?: () => void;
  onError?: (error: unknown) => void;
  onVolume?: (energy: number) => void;
}

export async function playTtsAudioBlob(blob: Blob, callbacks: TtsPlaybackCallbacks = {}): Promise<TtsPlayback> {
  const objectUrl = window.URL.createObjectURL(blob);
  const audio = new Audio(objectUrl);
  let isCleanedUp = false;
  let audioContext: AudioContext | null = null;
  let source: MediaElementAudioSourceNode | null = null;
  let analyser: AnalyserNode | null = null;
  let volumeFrame: number | null = null;
  let progressInterval: ReturnType<typeof setInterval> | null = null;

  const emitProgress = () => {
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    if (duration <= 0) return;

    const currentTime = Math.max(0, Math.min(duration, audio.currentTime));
    callbacks.onProgress?.(currentTime, duration);
  };

  const stopVolumeMeter = () => {
    if (volumeFrame !== null) {
      window.cancelAnimationFrame(volumeFrame);
      volumeFrame = null;
    }

    source?.disconnect();
    source = null;
    analyser = null;

    audioContext?.close();
    audioContext = null;
    callbacks.onVolume?.(0);
  };

  const cleanup = () => {
    if (isCleanedUp) return;
    isCleanedUp = true;
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
    audio.removeEventListener('timeupdate', emitProgress);
    stopVolumeMeter();
    window.URL.revokeObjectURL(objectUrl);
  };

  const startVolumeMeter = () => {
    try {
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor || audioContext) return;

      audioContext = new AudioContextCtor();
      source = audioContext.createMediaElementSource(audio);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.74;
      source.connect(analyser);
      analyser.connect(audioContext.destination);

      const dataArray = new Uint8Array(analyser.fftSize);
      const updateVolume = () => {
        if (!analyser || audio.paused || audio.ended) {
          callbacks.onVolume?.(0);
          volumeFrame = null;
          return;
        }

        analyser.getByteTimeDomainData(dataArray);
        let sumSquares = 0;

        for (let i = 0; i < dataArray.length; i++) {
          const centeredSample = dataArray[i] - 128;
          sumSquares += centeredSample * centeredSample;
        }

        const rms = Math.sqrt(sumSquares / dataArray.length) / 128;
        callbacks.onVolume?.(Math.max(0, Math.min(1, (rms - 0.012) * 8.5)));
        volumeFrame = window.requestAnimationFrame(updateVolume);
      };

      updateVolume();
    } catch (error) {
      console.warn('Unable to attach TTS volume meter:', error);
      callbacks.onVolume?.(0.28);
    }
  };

  audio.addEventListener('timeupdate', emitProgress);

  audio.onplay = () => {
    callbacks.onStart?.();
    startVolumeMeter();
    emitProgress();
    progressInterval = setInterval(emitProgress, 80);
  };
  audio.onpause = () => callbacks.onVolume?.(0);
  audio.onended = () => {
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 1;
    callbacks.onProgress?.(duration, duration);
    cleanup();
    callbacks.onEnd?.();
  };
  audio.onerror = () => {
    cleanup();
    callbacks.onError?.(new Error('Unable to play TTS audio'));
  };

  try {
    await audio.play();
  } catch (error) {
    cleanup();
    throw error;
  }

  return {
    stop: () => {
      audio.pause();
      cleanup();
    },
  };
}
