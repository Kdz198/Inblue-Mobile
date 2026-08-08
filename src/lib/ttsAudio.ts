import { playAudioBlob, type AudioPlayerHandle, type PlayAudioOptions } from './audioPlayer';

export type TtsPlayback = AudioPlayerHandle;
export type TtsPlaybackCallbacks = PlayAudioOptions;

export async function playTtsAudioBlob(
  blob: Blob,
  callbacks: TtsPlaybackCallbacks = {}
): Promise<TtsPlayback> {
  return playAudioBlob(blob, callbacks);
}
