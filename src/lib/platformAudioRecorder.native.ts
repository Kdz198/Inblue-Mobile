import { useAudioRecorder } from 'expo-audio';
import { EXPO_GO_PCM_RECORDING_OPTIONS } from './realtimeTranscription';

export function usePlatformAudioRecorder() {
  return useAudioRecorder(EXPO_GO_PCM_RECORDING_OPTIONS);
}
