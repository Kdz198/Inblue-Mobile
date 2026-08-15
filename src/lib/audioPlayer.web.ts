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
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return false;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error) {
    console.warn('Microphone permission not granted on web:', error);
    return false;
  }
}

export async function playAudioUri(
  uri: string,
  options: PlayAudioOptions = {}
): Promise<AudioPlayerHandle> {
  const audio = new Audio(uri);
  (audio as any).playsInline = true;
  audio.crossOrigin = 'anonymous';

  let volumeInterval: any = null;
  let progressInterval: any = null;

  const emitProgress = () => {
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    if (duration > 0) {
      options.onProgress?.(audio.currentTime, duration);
    }
  };

  const cleanup = () => {
    if (volumeInterval) {
      clearInterval(volumeInterval);
      volumeInterval = null;
    }
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
    audio.removeEventListener('timeupdate', emitProgress);
  };

  audio.addEventListener('timeupdate', emitProgress);

  audio.onplay = () => {
    options.onStart?.();
    options.onVolume?.(0.38);
    emitProgress();
    volumeInterval = setInterval(() => {
      const energy = 0.25 + Math.random() * 0.45;
      options.onVolume?.(energy);
    }, 150);
    progressInterval = setInterval(emitProgress, 80);
  };

  audio.onended = () => {
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 1;
    options.onProgress?.(duration, duration);
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
  try {
    const AudioContextCtor =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) {
      throw new Error('Web Audio API is not available');
    }

    const audioContext = new AudioContextCtor();
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const source = audioContext.createBufferSource();
    const analyser = audioContext.createAnalyser();
    const gainNode = audioContext.createGain();
    const volumeData = new Uint8Array(analyser.frequencyBinCount);

    source.buffer = audioBuffer;
    analyser.fftSize = 256;
    source.connect(analyser);
    analyser.connect(gainNode);
    gainNode.connect(audioContext.destination);

    let stopped = false;
    let progressInterval: any = null;
    let volumeFrame: number | null = null;
    let startTime = 0;

    const cleanup = () => {
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      if (volumeFrame != null) {
        cancelAnimationFrame(volumeFrame);
        volumeFrame = null;
      }
      try {
        source.disconnect();
      } catch {}
      try {
        analyser.disconnect();
      } catch {}
      try {
        gainNode.disconnect();
      } catch {}
      void audioContext.close().catch(() => {});
    };

    const emitProgress = () => {
      if (stopped) return;
      const currentTime = Math.min(audioBuffer.duration, audioContext.currentTime - startTime);
      options.onProgress?.(currentTime, audioBuffer.duration);
    };

    const emitVolume = () => {
      if (stopped) return;
      analyser.getByteFrequencyData(volumeData);
      let sum = 0;
      for (let index = 0; index < volumeData.length; index += 1) {
        sum += volumeData[index];
      }
      const average = sum / Math.max(1, volumeData.length);
      options.onVolume?.(Math.max(0.15, Math.min(1, average / 120)));
      volumeFrame = requestAnimationFrame(emitVolume);
    };

    source.onended = () => {
      if (stopped) return;
      stopped = true;
      options.onProgress?.(audioBuffer.duration, audioBuffer.duration);
      options.onVolume?.(0);
      cleanup();
      options.onEnd?.();
    };

    startTime = audioContext.currentTime;
    source.start(0);
    options.onStart?.();
    emitProgress();
    emitVolume();
    progressInterval = setInterval(emitProgress, 80);

    return {
      stop: () => {
        if (stopped) return;
        stopped = true;
        try {
          source.stop();
        } catch {}
        options.onVolume?.(0);
        cleanup();
      },
    };
  } catch {}

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
