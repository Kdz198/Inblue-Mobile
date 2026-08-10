import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  ChatMessage,
  InterviewStartResponse,
  generateTtsAudioApi,
  startInterviewApi,
  submitAnswerApi,
  type VoiceOption,
} from '../lib/api';
import { CyberCanvasBackground } from './CyberCanvasBackground';
import { playTtsAudioBlob, type TtsPlayback } from '../lib/ttsAudio';
import { requestMicrophonePermissionAsync } from '../lib/audioPlayer';
import {
  startRealtimeTranscription,
  type RealtimeTranscriptionHandle,
} from '../lib/realtimeTranscription';
import { usePlatformAudioRecorder } from '../lib/platformAudioRecorder';
import { NativeMaterialIcon } from './NativeMaterialIcon';

interface AIInterviewRoomProps {
  sessionKey: string;
  initialVoiceId?: string;
  voices?: VoiceOption[];
  onVoiceChange?: (voiceId: string) => void;
  onFinish: () => void;
}

interface SpeechCallbacks {
  onStart?: () => void;
  onProgress?: (currentTime: number, duration: number) => void;
  onEnd?: () => void;
}

const iconStroke = '#98CBFF';
const audioWaveRestingLevels = [0.55, 0.78, 1.05, 0.72, 1.25, 0.88, 1.42, 1.08, 1.62, 1.08, 1.42, 0.88, 1.25, 0.72, 1.05, 0.78, 0.55];
const micWaveMultipliers = [0.34, 0.58, 0.92, 0.5, 1.2, 0.68, 1.42, 0.9, 1.68, 0.9, 1.42, 0.68, 1.2, 0.5, 0.92, 0.58, 0.34];

function LineIcon({
  name,
  size = 18,
  color = iconStroke,
}: {
  name: 'clock' | 'history' | 'hide' | 'mic' | 'stop' | 'transcript' | 'edit' | 'send' | 'ai' | 'user' | 'question' | 'bot';
  size?: number;
  color?: string;
}) {
  if (Platform.OS !== 'web') {
    if (name === 'bot') {
      return <NativeMaterialIcon name="robot-outline" size={size} color={color} />;
    }
    const fallback: Record<typeof name, string> = {
      clock: '◷',
      history: '▤',
      hide: '◌',
      mic: '◉',
      stop: '■',
      transcript: '▤',
      edit: '✎',
      send: '›',
      ai: 'AI',
      user: 'U',
      question: '?',
      bot: 'AI',
    };
    return <Text style={{ color, fontSize: Math.max(10, size * 0.7), fontWeight: '800' }}>{fallback[name]}</Text>;
  }

  const common = {
    fill: 'none',
    stroke: color,
    strokeWidth: 1.75,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as any;

  const paths: Record<typeof name, React.ReactNode> = {
    clock: (
      <>
        <circle cx="12" cy="12" r="9" {...common} />
        <path d="M12 7v5l3 2" {...common} />
      </>
    ),
    history: (
      <>
        <path d="M5 6.5h11.5a2.5 2.5 0 0 1 2.5 2.5v6a2.5 2.5 0 0 1-2.5 2.5H9l-4 3v-3.5A2.5 2.5 0 0 1 2.5 15V9A2.5 2.5 0 0 1 5 6.5Z" {...common} />
        <path d="M7 10h8M7 13.5h5" {...common} />
      </>
    ),
    hide: (
      <>
        <path d="M3 12s3.4-5 9-5 9 5 9 5-3.4 5-9 5-9-5-9-5Z" {...common} />
        <path d="m4 4 16 16" {...common} />
        <path d="M10.5 10.5a2.1 2.1 0 0 0 3 3" {...common} />
      </>
    ),
    mic: (
      <>
        <path d="M12 3.5a3 3 0 0 0-3 3V12a3 3 0 0 0 6 0V6.5a3 3 0 0 0-3-3Z" {...common} />
        <path d="M6 11.5a6 6 0 0 0 12 0M12 17.5V21M9 21h6" {...common} />
      </>
    ),
    stop: <rect x="7" y="7" width="10" height="10" rx="2" {...common} />,
    transcript: (
      <>
        <rect x="4" y="5" width="16" height="14" rx="2" {...common} />
        <path d="M8 9h8M8 12h8M8 15h5" {...common} />
      </>
    ),
    edit: (
      <>
        <path d="M4 20h4l10-10a2.8 2.8 0 0 0-4-4L4 16v4Z" {...common} />
        <path d="m13.5 6.5 4 4" {...common} />
      </>
    ),
    send: (
      <>
        <path d="M21 3 10 14" {...common} />
        <path d="m21 3-7 18-4-7-7-4 18-7Z" {...common} />
      </>
    ),
    ai: (
      <>
        <rect x="6" y="8" width="12" height="9" rx="3" {...common} />
        <path d="M9 8V5.5M15 8V5.5M9.5 12h.01M14.5 12h.01M10 15h4" {...common} />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="3.5" {...common} />
        <path d="M5 20a7 7 0 0 1 14 0" {...common} />
      </>
    ),
    question: (
      <>
        <circle cx="12" cy="12" r="9" {...common} />
        <path d="M9.8 9.5a2.5 2.5 0 0 1 4.7 1.2c0 1.8-2.5 2.2-2.5 4" {...common} />
        <path d="M12 18h.01" {...common} />
      </>
    ),
    bot: (
      <>
        <rect x="5" y="8" width="14" height="10" rx="4" {...common} />
        <path d="M12 8V4.5M8.5 4.5h7M8.5 13h.01M15.5 13h.01M10 16h4" {...common} />
        <path d="M5 12H3M21 12h-2" {...common} />
      </>
    ),
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export function AIInterviewRoom({
  sessionKey,
  initialVoiceId = '',
  voices = [],
  onVoiceChange,
  onFinish,
}: AIInterviewRoomProps) {
  const expoGoRecorder = usePlatformAudioRecorder();
  const { width, height } = useWindowDimensions();
  const isDesktop = width >= 1200;
  const isTablet = width >= 768 && width < 1200;
  const isMobile = width < 768;
  const isWide = width >= 1024;
  const isConstrainedHeight = height <= 880;
  const isShort = height <= 780;
  const isKioskCompact = height <= 820 || width <= 1024;

  const botIconSize = isDesktop ? 72 : (isTablet ? 56 : 48);
  const micIconSize = isDesktop ? 28 : (isTablet ? 24 : 22);

  const styles = useMemo(
    () =>
      createRoomStyles({
        width,
        height,
        isWide,
        isTablet,
        isDesktop,
        isMobile,
        isConstrainedHeight,
        isShort,
      }),
    [width, height, isWide, isTablet, isDesktop, isMobile, isConstrainedHeight, isShort]
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [spokenQuestionText, setSpokenQuestionText] = useState('');
  const [currentPhase, setCurrentPhase] = useState('Vòng 7: Phỏng Vấn AI');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState(5);

  const [answerInput, setAnswerInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingTranscript, setIsProcessingTranscript] = useState(false);
  const [hasTranscriptResponse, setHasTranscriptResponse] = useState(false);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(true);
  const [isQuestionAudioLoading, setIsQuestionAudioLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [thinkingDotStep, setThinkingDotStep] = useState(0);
  const [selectedVoiceId, setSelectedVoiceId] = useState(initialVoiceId || voices[0]?.id || '');
  const [isVoiceMenuOpen, setIsVoiceMenuOpen] = useState(false);

  const scrollViewRef = useRef<ScrollView | null>(null);
  const transcriptScrollViewRef = useRef<ScrollView | null>(null);
  const speechResultsEnabledRef = useRef(false);
  const realtimeTranscriptionRef = useRef<RealtimeTranscriptionHandle | null>(null);
  const recordingBaseTranscriptRef = useRef('');
  const finalTranscriptRef = useRef('');
  const silenceStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toggleRecordingRef = useRef<(() => Promise<void>) | null>(null);
  const micAudioContextRef = useRef<any>(null);
  const micAudioSourceRef = useRef<any>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micWaveFrameRef = useRef<number | null>(null);
  const ttsPlaybackRef = useRef<TtsPlayback | null>(null);

  // Pulse animation for central AI Avatar Orb
  const orbScale = useRef(new Animated.Value(1)).current;
  const orbGlow = useRef(new Animated.Value(0.4)).current;
  const waveScale = useRef(new Animated.Value(1)).current;
  const waveAlpha = useRef(new Animated.Value(0.6)).current;
  const audioWaveLevels = useRef(audioWaveRestingLevels.map(level => new Animated.Value(level))).current;
  const aiSpeechAuraScale = useRef(new Animated.Value(1)).current;
  const aiSpeechAuraOpacity = useRef(new Animated.Value(0)).current;

  // Real-time clock
  const [clockStr, setClockStr] = useState('');

  useEffect(() => {
    function updateClock() {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      setClockStr(`${h}:${m}:${s}`);
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // AI Orb Pulsing Animation Loop
  useEffect(() => {
    const orbAnim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(orbScale, { toValue: 1.12, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(orbGlow, { toValue: 0.85, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(waveScale, { toValue: 1.45, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(waveAlpha, { toValue: 0.1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(orbScale, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(orbGlow, { toValue: 0.4, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(waveScale, { toValue: 1, duration: 1600, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.timing(waveAlpha, { toValue: 0.6, duration: 1600, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
      ])
    );
    orbAnim.start();
    return () => orbAnim.stop();
  }, [orbScale, orbGlow, waveScale, waveAlpha]);

  useEffect(() => {
    return () => {
      realtimeTranscriptionRef.current?.stop();
      realtimeTranscriptionRef.current = null;
      speechResultsEnabledRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isLoadingQuestion && !isSubmitting) {
      setThinkingDotStep(0);
      return undefined;
    }

    const interval = setInterval(() => {
      setThinkingDotStep(prev => (prev + 1) % 3);
    }, 330);

    return () => clearInterval(interval);
  }, [isLoadingQuestion, isSubmitting]);

  useEffect(() => {
    if (initialVoiceId) {
      setSelectedVoiceId(initialVoiceId);
    } else if (!selectedVoiceId && voices[0]?.id) {
      setSelectedVoiceId(voices[0].id);
    }
  }, [initialVoiceId, selectedVoiceId, voices]);

  useEffect(() => {
    transcriptScrollViewRef.current?.scrollToEnd({ animated: true });
  }, [answerInput]);

  const resetAudioWave = useCallback((duration = 180) => {
    audioWaveLevels.forEach((level, index) => {
      Animated.timing(level, {
        toValue: audioWaveRestingLevels[index],
        duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    });
  }, [audioWaveLevels]);

  const setAudioWaveEnergy = useCallback((energy: number) => {
    const normalizedEnergy = Math.max(0, Math.min(1, energy));

    audioWaveLevels.forEach((level, index) => {
      Animated.timing(level, {
        toValue: audioWaveRestingLevels[index] + normalizedEnergy * micWaveMultipliers[index],
        duration: 72,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    });
  }, [audioWaveLevels]);

  const nativeWaveIntervalRef = useRef<any>(null);

  const stopMicAudioMeter = useCallback(() => {
    if (nativeWaveIntervalRef.current) {
      clearInterval(nativeWaveIntervalRef.current);
      nativeWaveIntervalRef.current = null;
    }

    if (micWaveFrameRef.current !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(micWaveFrameRef.current);
      micWaveFrameRef.current = null;
    }

    micAudioSourceRef.current?.disconnect?.();
    micAudioSourceRef.current = null;

    micStreamRef.current?.getTracks().forEach(track => track.stop());
    micStreamRef.current = null;

    micAudioContextRef.current?.close?.();
    micAudioContextRef.current = null;

    resetAudioWave();
  }, [resetAudioWave]);

  const startMicAudioMeter = useCallback(async () => {
    stopMicAudioMeter();

    if (Platform.OS !== 'web') {
      // Native audio visualizer animation loop
      nativeWaveIntervalRef.current = setInterval(() => {
        const randomEnergy = 0.28 + Math.random() * 0.54;
        setAudioWaveEnergy(randomEnergy);
      }, 180);
      return;
    }

    if (
      !('mediaDevices' in navigator) ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      return;
    }

    try {
      const AudioContextCtor = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) return;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const audioContext = new AudioContextCtor();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.fftSize);
      micStreamRef.current = stream;
      micAudioContextRef.current = audioContext;
      micAudioSourceRef.current = source;

      const updateMeter = () => {
        analyser.getByteTimeDomainData(dataArray);

        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const centeredSample = dataArray[i] - 128;
          sumSquares += centeredSample * centeredSample;
        }

        const rms = Math.sqrt(sumSquares / dataArray.length) / 128;
        const voiceEnergy = Math.max(0, Math.min(1, (rms - 0.018) * 9.5));
        setAudioWaveEnergy(voiceEnergy);
        micWaveFrameRef.current = window.requestAnimationFrame(updateMeter);
      };

      updateMeter();
    } catch (e) {
      console.warn('Unable to start mic wave meter:', e);
      stopMicAudioMeter();
    }
  }, [setAudioWaveEnergy, stopMicAudioMeter]);

  const pulseAiSpeechAura = useCallback(() => {
    aiSpeechAuraScale.stopAnimation();
    aiSpeechAuraOpacity.stopAnimation();
    aiSpeechAuraScale.setValue(0.98);
    aiSpeechAuraOpacity.setValue(0.2);

    Animated.parallel([
      Animated.timing(aiSpeechAuraScale, {
        toValue: 1.1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(aiSpeechAuraOpacity, {
        toValue: 0.06,
        duration: 420,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [aiSpeechAuraOpacity, aiSpeechAuraScale]);

  const setAiSpeechAuraEnergy = useCallback((energy: number) => {
    const normalizedEnergy = Math.max(0, Math.min(1, energy));
    aiSpeechAuraScale.setValue(0.99 + normalizedEnergy * 0.14);
    aiSpeechAuraOpacity.setValue(normalizedEnergy > 0.018 ? 0.08 + normalizedEnergy * 0.22 : 0);
  }, [aiSpeechAuraOpacity, aiSpeechAuraScale]);

  useEffect(() => {
    return () => {
      stopMicAudioMeter();
    };
  }, [stopMicAudioMeter]);

  const stopTtsPlayback = useCallback(() => {
    ttsPlaybackRef.current?.stop();
    ttsPlaybackRef.current = null;
    aiSpeechAuraScale.setValue(1);
    aiSpeechAuraOpacity.setValue(0);

    if (Platform.OS === 'web' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, [aiSpeechAuraOpacity, aiSpeechAuraScale]);

  const speakWithBrowserFallback = useCallback((text: string) => {
    if (Platform.OS === 'web' && 'speechSynthesis' in window) {
      try {
        resetAudioWave(120);
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'vi-VN';
        utterance.rate = 1.0;
        utterance.onstart = () => {
          setIsAiSpeaking(true);
          pulseAiSpeechAura();
        };
        utterance.onboundary = () => pulseAiSpeechAura();
        utterance.onpause = () => setIsAiSpeaking(false);
        utterance.onresume = () => {
          setIsAiSpeaking(true);
          pulseAiSpeechAura();
        };
        utterance.onend = () => {
          setIsAiSpeaking(false);
          setAiSpeechAuraEnergy(0);
          resetAudioWave();
        };
        utterance.onerror = () => {
          setIsAiSpeaking(false);
          setAiSpeechAuraEnergy(0);
          resetAudioWave();
        };
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn(e);
        setIsAiSpeaking(false);
        setAiSpeechAuraEnergy(0);
        resetAudioWave();
      }
    }
  }, [pulseAiSpeechAura, resetAudioWave, setAiSpeechAuraEnergy]);

  // Speak AI Question using backend TTS audio, with browser TTS as a web fallback.
  const speakText = useCallback(async (text: string, voiceIdOverride?: string, callbacks: SpeechCallbacks = {}) => {
    stopTtsPlayback();
    let speechStarted = false;
    const notifyStart = () => {
      if (speechStarted) return;
      speechStarted = true;
      callbacks.onStart?.();
    };

    try {
      resetAudioWave(120);
      setIsAiSpeaking(true);
      pulseAiSpeechAura();

      const audioBlob = await generateTtsAudioApi(text, voiceIdOverride || selectedVoiceId);
      ttsPlaybackRef.current = await playTtsAudioBlob(audioBlob, {
        onStart: () => {
          setIsAiSpeaking(true);
          pulseAiSpeechAura();
          notifyStart();
        },
        onProgress: (currentTime, duration) => {
          callbacks.onProgress?.(currentTime, duration);
        },
        onEnd: () => {
          setIsAiSpeaking(false);
          setAiSpeechAuraEnergy(0);
          resetAudioWave();
          ttsPlaybackRef.current = null;
          callbacks.onEnd?.();
        },
        onError: error => {
          console.warn('Unable to play backend TTS audio:', error);
          setIsAiSpeaking(false);
          setAiSpeechAuraEnergy(0);
          resetAudioWave();
          notifyStart();
          callbacks.onProgress?.(1, 1);
          speakWithBrowserFallback(text);
        },
        onVolume: energy => {
          setAiSpeechAuraEnergy(energy);
        },
      });
    } catch (e) {
      console.warn('Unable to play backend TTS audio:', e);
      setIsAiSpeaking(false);
      setAiSpeechAuraEnergy(0);
      resetAudioWave();
      notifyStart();
      callbacks.onProgress?.(1, 1);
      speakWithBrowserFallback(text);
    }
  }, [
    pulseAiSpeechAura,
    resetAudioWave,
    setAiSpeechAuraEnergy,
    selectedVoiceId,
    speakWithBrowserFallback,
    stopTtsPlayback,
  ]);

  useEffect(() => {
    return () => {
      stopTtsPlayback();
    };
  }, [stopTtsPlayback]);

  // Handle Response from API (Start or Submit)
  const handleApiResponse = useCallback((data: InterviewStartResponse) => {
    if (data.phaseName) setCurrentPhase(data.phaseName);
    if (data.currentQuestionIndex) setCurrentQuestionIndex(data.currentQuestionIndex);
    if (data.totalQuestionsInPhase) setTotalQuestions(data.totalQuestionsInPhase);

    if (data.finished) {
      setIsEvaluating(true);
      setTimeout(() => {
        setIsEvaluating(false);
        setIsFinished(true);
      }, 3000);
      return;
    }

    if (data.questionContent) {
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const newMsg: ChatMessage = {
        id: Date.now(),
        role: 'ai',
        content: data.questionContent,
        timestamp: nowStr,
      };
      setSpokenQuestionText('');
      setIsQuestionAudioLoading(true);
      speakText(data.questionContent, undefined, {
        onStart: () => {
          setIsQuestionAudioLoading(false);
          setSpokenQuestionText(' ');
          setMessages(prev => [...prev, newMsg]);
        },
        onProgress: (currentTime, duration) => {
          const progress = Math.max(0, Math.min(1, currentTime / duration));
          const characterCount = Math.max(1, Math.floor(data.questionContent!.length * progress));
          setSpokenQuestionText(data.questionContent!.slice(0, characterCount));
        },
        onEnd: () => {
          setSpokenQuestionText(data.questionContent!);
        },
      });
    }
  }, [speakText]);

  const handleApiResponseRef = useRef(handleApiResponse);

  useEffect(() => {
    handleApiResponseRef.current = handleApiResponse;
  }, [handleApiResponse]);

  // Load First Question upon entry
  useEffect(() => {
    let mounted = true;
    async function loadStart() {
      try {
        setIsLoadingQuestion(true);
        const data = await startInterviewApi(sessionKey);
        if (mounted) {
          handleApiResponseRef.current(data);
        }
      } catch (err) {
        console.warn('Start interview fallback mock:', err);
        if (mounted) {
          handleApiResponseRef.current({
            questionContent: 'Chào bạn! Mình là AI Interviewer. Rất vui được trao đổi với bạn hôm nay. Để bắt đầu, bạn hãy giới thiệu ngắn gọn về bản thân và những dự án bạn tự tâm đắc nhất nhé?',
            phaseName: 'Vòng 7: Phỏng Vấn AI',
            currentQuestionIndex: 1,
            totalQuestionsInPhase: 5,
          });
        }
      } finally {
        if (mounted) setIsLoadingQuestion(false);
      }
    }
    loadStart();
    return () => { mounted = false; };
  }, [sessionKey]);

  // Speech-To-Text (STT) Recording Toggle
  const toggleRecording = async () => {
    if (isSubmitting || isFinished || isEvaluating) return;

    if (isRecording) {
      if (silenceStopTimerRef.current) {
        clearTimeout(silenceStopTimerRef.current);
        silenceStopTimerRef.current = null;
      }
      setIsRecording(false);
      setIsProcessingTranscript(true);
      stopMicAudioMeter();
      const activeTranscription = realtimeTranscriptionRef.current;
      if (!activeTranscription) {
        setIsProcessingTranscript(false);
        speechResultsEnabledRef.current = false;
        return;
      }
      try {
        await activeTranscription.stop();
      } catch {
        setIsProcessingTranscript(false);
        speechResultsEnabledRef.current = false;
        realtimeTranscriptionRef.current = null;
      }
      return;
    }

    // 1. Request microphone permission (triggers native iOS/iPadOS dialog or browser prompt)
    try {
      await requestMicrophonePermissionAsync();
    } catch (permErr) {
      console.warn('Microphone permission request error:', permErr);
    }

    // 2. Start audio meter (Web Audio API or Native animated pulse) & update button state immediately
    void startMicAudioMeter();
    setIsRecording(true);
    setIsProcessingTranscript(false);
    setHasTranscriptResponse(false);

    speechResultsEnabledRef.current = true;
    recordingBaseTranscriptRef.current = answerInput.trim();
    finalTranscriptRef.current = recordingBaseTranscriptRef.current;
    silenceStopTimerRef.current = null;

    try {
      realtimeTranscriptionRef.current = await startRealtimeTranscription(recordingBaseTranscriptRef.current, {
        expoGoRecorder,
        onAudioLevel: level => {
          if (level >= 0.08) {
            if (silenceStopTimerRef.current) {
              clearTimeout(silenceStopTimerRef.current);
              silenceStopTimerRef.current = null;
            }
            return;
          }

          if (!silenceStopTimerRef.current) {
            silenceStopTimerRef.current = setTimeout(() => {
              silenceStopTimerRef.current = null;
              void toggleRecordingRef.current?.();
            }, 5000);
          }
        },
        onTranscript: text => {
          if (!speechResultsEnabledRef.current) return;
          finalTranscriptRef.current = text;
          setHasTranscriptResponse(true);
          setAnswerInput(text);
        },
        onError: error => {
          console.warn('Realtime transcription error:', error);
        },
        onClose: () => {
          if (silenceStopTimerRef.current) {
            clearTimeout(silenceStopTimerRef.current);
            silenceStopTimerRef.current = null;
          }
          if (!speechResultsEnabledRef.current) return;
          speechResultsEnabledRef.current = false;
          realtimeTranscriptionRef.current = null;
          setIsProcessingTranscript(false);
          stopMicAudioMeter();
          setIsRecording(false);
        },
      });
    } catch (e) {
      console.warn('Realtime transcription start failed:', e);
      if (silenceStopTimerRef.current) {
        clearTimeout(silenceStopTimerRef.current);
        silenceStopTimerRef.current = null;
      }
      speechResultsEnabledRef.current = false;
      realtimeTranscriptionRef.current = null;
      setIsProcessingTranscript(false);
      setHasTranscriptResponse(false);
      stopMicAudioMeter();
      setIsRecording(false);
    }
  };

  toggleRecordingRef.current = toggleRecording;

  // Submit Answer Action
  const handleSubmitAnswer = async (answerOverride?: string) => {
    const textToSend = (answerOverride ?? answerInput).trim() || 'Tôi đã hoàn thành câu trả lời.';
    if (isSubmitting) return;

    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: textToSend,
      timestamp: nowStr,
    };

    setMessages(prev => [...prev, userMsg]);
    if (silenceStopTimerRef.current) {
      clearTimeout(silenceStopTimerRef.current);
      silenceStopTimerRef.current = null;
    }
    speechResultsEnabledRef.current = false;
    setIsProcessingTranscript(false);
    try {
      await realtimeTranscriptionRef.current?.stop();
    } catch {}
    realtimeTranscriptionRef.current = null;
    setAnswerInput('');
    recordingBaseTranscriptRef.current = '';
    finalTranscriptRef.current = '';
    stopMicAudioMeter();
    setIsRecording(false);
    setIsSubmitting(true);

    try {
      const data = await submitAnswerApi(sessionKey, textToSend);
      handleApiResponse(data);
    } catch (err) {
      console.warn('Submit answer fallback mock:', err);
      if (currentQuestionIndex >= totalQuestions) {
        setIsEvaluating(true);
        setTimeout(() => {
          setIsEvaluating(false);
          setIsFinished(true);
        }, 3000);
      } else {
        const nextIdx = currentQuestionIndex + 1;
        setCurrentQuestionIndex(nextIdx);
        handleApiResponse({
          questionContent: `Câu hỏi ${nextIdx}: Bạn hãy chia sẻ kinh nghiệm xử lý sự cố hoặc quyết định kiến trúc quan trọng nhất mà bạn từng đưa ra?`,
          phaseName: currentPhase,
          currentQuestionIndex: nextIdx,
          totalQuestionsInPhase: totalQuestions,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Latest AI Question for display on main stage
  const latestAiQuestion = spokenQuestionText || messages.filter(m => m.role === 'ai').pop()?.content || 'Đang kết nối với Trợ lý phỏng vấn AI...';
  const isQuestionPending = isLoadingQuestion || isSubmitting || isQuestionAudioLoading;
  const selectedVoice = voices.find(voice => voice.id === selectedVoiceId) || voices[0];
  const handleSelectVoiceDuringInterview = (voiceId: string) => {
    setSelectedVoiceId(voiceId);
    onVoiceChange?.(voiceId);
    setIsVoiceMenuOpen(false);

    const lastQuestion = messages.filter(m => m.role === 'ai').pop()?.content;
    if (lastQuestion) {
      void speakText(lastQuestion, voiceId);
    }
  };

  return (
    <View style={styles.container}>
      {/* Dynamic Animated Cyber Constellation Canvas Background */}

      {/* ── Top Header Navigation Bar ── */}
      <View style={styles.topHeader}>
        {/* Left: Brand Logo & Title */}
        <View style={styles.headerLeft}>
          <Text style={styles.brandTitle}>INBLUE</Text>
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText}>AI KIOSK MODE</Text>
          </View>
        </View>

        {/* Right: Status & Clock */}
        <View style={styles.headerRight}>
          <View style={styles.liveBadge}>
            <View style={styles.liveBadgeDot} />
            <Text style={styles.liveBadgeText}>System Online</Text>
          </View>

          <View style={styles.clockBox}>
            <LineIcon name="clock" size={18} />
            <Text style={styles.clockText}>{clockStr}</Text>
          </View>

          {voices.length > 0 && (
            <View style={styles.voiceSwitcherWrap}>
              <Pressable
                onPress={() => setIsVoiceMenuOpen(prev => !prev)}
                style={({ pressed }) => [styles.voiceSwitcherBtn, pressed && { opacity: 0.85 }]}
              >
                <LineIcon name="ai" size={16} color="#98CBFF" />
                <Text style={styles.voiceSwitcherText} numberOfLines={1}>
                  {selectedVoice?.name || 'Giọng AI'}
                </Text>
              </Pressable>

              {isVoiceMenuOpen && (
                <View style={styles.voiceMenu}>
                  {voices.map(voice => {
                    const active = voice.id === selectedVoiceId;

                    return (
                      <Pressable
                        key={voice.id}
                        onPress={() => {
                          handleSelectVoiceDuringInterview(voice.id);
                        }}
                        style={({ pressed }) => [
                          styles.voiceMenuItem,
                          active && styles.voiceMenuItemActive,
                          pressed && { opacity: 0.88 },
                        ]}
                      >
                        <Text style={styles.voiceMenuName}>{voice.name}</Text>
                        <Text style={styles.voiceMenuDesc} numberOfLines={2}>{voice.description}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          <Pressable
            onPress={() => setIsDrawerOpen(!isDrawerOpen)}
            style={({ pressed }) => [styles.drawerToggleBtn, pressed && { opacity: 0.8 }]}
          >
            <LineIcon name={isDrawerOpen ? 'hide' : 'history'} size={18} color="#CBD5E1" />
            <Text style={styles.drawerToggleText}>{isDrawerOpen ? 'Ẩn lịch sử' : 'Lịch sử trao đổi'}</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Main Workspace ── */}
      <View style={styles.mainWorkspace}>
        {/* ── Left / Center Primary Interview Stage ── */}
        <View style={[styles.stageArea, isKioskCompact && styles.stageAreaCompact]}>
          <CyberCanvasBackground />
          {isFinished ? (
            /* Finished Stage Card */
            <View style={styles.glassCardStage}>
              <Text style={{ fontSize: 64, marginBottom: 16 }}>🏆</Text>
              <Text style={styles.stageFinishTitle}>Hoàn Thành Phỏng Vấn AI</Text>
              <Text style={styles.stageFinishSub}>
                Cảm ơn bạn đã hoàn thành bài phỏng vấn tại Kiosk. Kết quả đánh giá đã được lưu an toàn vào hệ thống.
              </Text>
              <Pressable
                onPress={onFinish}
                style={({ pressed }) => [styles.stageExitBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
              >
                <Text style={styles.stageExitBtnText}>Trở Về Trang Chủ Kiosk →</Text>
              </Pressable>
            </View>
          ) : isEvaluating ? (
            /* Evaluating Stage Card */
            <View style={styles.glassCardStage}>
              <Text style={{ fontSize: 52, marginBottom: 16 }}>⏳</Text>
              <Text style={styles.stageEvalTitle}>Đang Đánh Giá Kết Quả...</Text>
              <Text style={styles.stageEvalSub}>
                Hệ thống AI đang tổng hợp câu trả lời của bạn. Vui lòng chờ trong giây lát.
              </Text>
            </View>
          ) : (
            /* Active Interview Stage */
            <View style={[styles.activeStageWrapper, isKioskCompact && styles.activeStageWrapperCompact]}>
              <View style={[styles.interviewFocusStack, isKioskCompact && styles.interviewFocusStackCompact]}>
                <View style={[styles.currentQuestionGlassCard, isQuestionPending && styles.currentQuestionThinkingCard]}>
                  <View style={[styles.questionCardHeader, isQuestionPending && styles.questionCardHeaderThinking]}>
                    <View style={styles.questionCardBadgeWrap}>
                      <View style={styles.questionCardRule} />
                      <LineIcon name="question" size={14} color="#00A3FF" />
                      <Text style={styles.questionCardBadge}>{isQuestionPending ? 'AI ĐANG SUY NGHĨ' : 'CÂU HỎI HIỆN TẠI'}</Text>
                      <View style={styles.questionCardRule} />
                    </View>
                    {!isQuestionPending && (
                      <Text style={styles.questionCardPhase}>Q{String(currentQuestionIndex).padStart(2, '0')} / {String(totalQuestions).padStart(2, '0')}</Text>
                    )}
                  </View>
                  {isQuestionPending ? (
                    <View style={styles.questionThinkingWrap}>
                      <View style={styles.questionThinkingDots}>
                        {[0, 1, 2].map(index => (
                          <View
                            key={index}
                            style={[
                              styles.questionThinkingDot,
                              thinkingDotStep === index && styles.questionThinkingDotActive,
                            ]}
                          />
                        ))}
                      </View>
                    </View>
                  ) : (
                    <ScrollView
                      style={{ maxHeight: isDesktop ? 120 : (isTablet ? 82 : 72), width: '100%' }}
                      contentContainerStyle={{ alignItems: 'center', justifyContent: 'center' }}
                      showsVerticalScrollIndicator={false}
                      nestedScrollEnabled
                    >
                      <Text style={styles.questionCardBody}>{latestAiQuestion}</Text>
                    </ScrollView>
                  )}
                  <View style={styles.questionBubbleTail} />
                </View>

                <View style={[styles.aiHolographicNode, isKioskCompact && styles.aiHolographicNodeCompact]}>
                  {isAiSpeaking && (
                    <Animated.View
                      style={[
                        styles.aiSpeechAura,
                        {
                          transform: [{ scale: aiSpeechAuraScale }],
                          opacity: aiSpeechAuraOpacity,
                        },
                      ]}
                    />
                  )}

                  <Animated.View
                    style={[
                      styles.aiWaveRing,
                      {
                        transform: [{ scale: waveScale }],
                        opacity: waveAlpha,
                      },
                    ]}
                  />

                  <Animated.View
                    style={[
                      styles.aiOrbHalo,
                      {
                        transform: [{ scale: orbScale }],
                        opacity: orbGlow,
                      },
                    ]}
                  />

                  <View style={styles.aiOrbSphere}>
                    <View style={styles.aiOrbInnerAura}>
                      <LineIcon name="bot" size={botIconSize} color="#98CBFF" />
                    </View>
                  </View>
                </View>
              </View>

              <View style={[styles.voiceInteractionHub, isKioskCompact && styles.voiceInteractionHubCompact]}>
                <View style={styles.micControlWrap}>
                  <Pressable
                    onPress={toggleRecording}
                    disabled={isSubmitting || isLoadingQuestion || isProcessingTranscript}
                    style={({ pressed }) => [
                      styles.micOrbButton,
                      isRecording ? styles.micOrbButtonStop : styles.micOrbButtonStart,
                      pressed && { opacity: 0.9, transform: [{ scale: 0.96 }] },
                    ]}
                  >
                    <LineIcon name={isRecording ? 'stop' : 'mic'} size={micIconSize} />
                  </Pressable>
                  <View style={styles.micVisualizer}>
                    <View style={styles.micWaveBaseline} />
                    {audioWaveLevels.map((level, index) => (
                      <Animated.View
                        key={index}
                        style={[
                          styles.micBar,
                          index % 4 === 0 && styles.micBarSoft,
                          index === 8 && styles.micBarCore,
                          { transform: [{ scaleY: level }] },
                        ]}
                      />
                    ))}
                  </View>
                </View>

                <View nativeID="live-transcript-hud" style={styles.liveTranscriptHud}>
                  {isProcessingTranscript && !hasTranscriptResponse && (
                    <View pointerEvents="none" style={styles.transcriptProcessingOverlay}>
                      <ActivityIndicator size="large" color="#00A3FF" />
                      <Text style={styles.transcriptProcessingText}>ĐANG XỬ LÝ BẢN GHI ÂM...</Text>
                    </View>
                  )}
                  <View style={styles.hudCornerTopLeft} />
                  <View style={styles.hudCornerBottomRight} />
                  <View style={styles.transcriptHeader}>
                    <View style={styles.transcriptTitleWrap}>
                      <LineIcon name="transcript" size={14} color="#00A3FF" />
                      <Text style={styles.transcriptTitle}>BẢN DỊCH TRỰC TIẾP</Text>
                    </View>
                    <Pressable
                      onPress={() => setIsDrawerOpen(true)}
                      style={({ pressed }) => [styles.transcriptEditBtn, pressed && { opacity: 0.75 }]}
                    >
                      <Text style={styles.transcriptEditText}>CHỈNH SỬA</Text>
                      <LineIcon name="edit" size={13} color="#9CAFC5" />
                    </Pressable>
                  </View>
                  <ScrollView
                    ref={transcriptScrollViewRef}
                    onContentSizeChange={() => transcriptScrollViewRef.current?.scrollToEnd({ animated: true })}
                    nativeID="transcript-scroll"
                    style={styles.transcriptBody}
                    contentContainerStyle={styles.transcriptBodyContent}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled
                  >
                    <Text style={styles.transcriptText}>
                      {isProcessingTranscript
                        ? '"Đang xử lý bản ghi âm..."'
                        : answerInput.trim()
                        ? `"${answerInput.trim()}"`
                        : isRecording
                        ? '"Đang lắng nghe câu trả lời của bạn..."'
                        : '"Nhấn mic để bắt đầu trả lời bằng giọng nói."'}
                    </Text>
                    <Text style={styles.transcriptTextLegacyHidden}>
                      {isProcessingTranscript
                        ? '"Äang xá»­ lÃ½ báº£n ghi Ã¢m..."'
                        : answerInput.trim()
                        ? `"${answerInput.trim()}"`
                        : isRecording
                        ? '"Đang lắng nghe câu trả lời của bạn..."'
                        : '"Nhấn mic để bắt đầu trả lời bằng giọng nói."'}
                    </Text>
                  </ScrollView>
                  <View style={styles.transcriptFooter}>
                    <View style={styles.transcriptStateWrap}>
                      <Text style={styles.transcriptState}>
                        {isProcessingTranscript ? 'PROCESSING...' : isRecording ? 'LISTENING...' : 'VOICE READY'}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => handleSubmitAnswer()}
                      disabled={!answerInput.trim() || isSubmitting || isProcessingTranscript}
                      style={({ pressed }) => [
                        styles.sendAnswerBtn,
                        (!answerInput.trim() || isSubmitting || isProcessingTranscript) && styles.sendAnswerBtnDisabled,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text style={styles.sendAnswerText}>GỬI PHẢN HỒI</Text>
                      <LineIcon name="send" size={13} color="#98CBFF" />
                    </Pressable>
                  </View>
                </View>

                <Text style={styles.giantMicHint}>
                  {isRecording
                    ? 'Nhấn mic lần nữa để tạm dừng ghi âm và gửi câu trả lời.'
                    : 'Nhấn vào mic để bắt đầu nói trực tiếp với Trợ lý phỏng vấn AI.'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Right Secondary Collapsible Chat Drawer ── */}
        {isDrawerOpen && (
          <View style={[styles.chatDrawer, !isWide && styles.chatDrawerMobile]}>
            {/* Drawer Header */}
            <View style={styles.drawerHeader}>
              <View style={styles.drawerTitleWrap}>
                <LineIcon name="history" size={18} />
                <Text style={styles.drawerTitle}>Lịch Sử Trao Đổi</Text>
              </View>
              <Text style={styles.drawerCountText}>{messages.length} tin nhắn</Text>
            </View>

            {/* Chat Messages List */}
            <ScrollView
              ref={scrollViewRef}
              onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
              style={styles.drawerScrollView}
              contentContainerStyle={styles.drawerScrollContent}
              showsVerticalScrollIndicator={Platform.OS === 'web'}
              nestedScrollEnabled
            >
              {messages.map((msg, index) => {
                const isAi = msg.role === 'ai';
                return (
                  <View
                    key={msg.id || index}
                    style={[
                      styles.drawerBubbleRow,
                      isAi ? styles.drawerBubbleRowAi : styles.drawerBubbleRowUser,
                    ]}
                  >
                    <View
                      style={[
                        styles.drawerBubble,
                        isAi ? styles.drawerBubbleAi : styles.drawerBubbleUser,
                      ]}
                    >
                      <View style={[styles.drawerRoleRow, !isAi && styles.drawerRoleRowUser]}>
                        <LineIcon name={isAi ? 'ai' : 'user'} size={12} color={isAi ? '#98CBFF' : '#CBD5E1'} />
                        <Text style={[styles.drawerRole, !isAi && styles.drawerRoleUser]}>{isAi ? 'INBLUE AI' : 'Thí sinh'}</Text>
                      </View>
                      <Text style={styles.drawerText}>{msg.content}</Text>
                      <Text style={styles.drawerTime}>{msg.timestamp}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.drawerTypingRow}>
              <View style={styles.drawerTypingDots}>
                <View style={styles.drawerTypingDotMuted} />
                <View style={styles.drawerTypingDot} />
                <View style={styles.drawerTypingDotStrong} />
              </View>
              <Text style={styles.drawerTypingText}>THANH LAN IS TYPING...</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.footerBar}>
        <View style={styles.footerMetaGroup}>
          <Text style={styles.footerText}>FPT UNIVERSITY</Text>
          <View style={styles.footerDivider} />
          <Text style={styles.footerText}>SOFTWARE ENGINEERING</Text>
          <View style={styles.footerDivider} />
          <Text style={styles.footerText}>SUMMER 2026</Text>
        </View>
        <Text style={styles.footerText}>POWERED BY INBLUE PLATFORM</Text>
      </View>
    </View>
  );
}

interface RoomResponsiveParams {
  width: number;
  height: number;
  isWide: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isMobile: boolean;
  isConstrainedHeight: boolean;
  isShort: boolean;
}

function createRoomStyles({
  width,
  height,
  isWide,
  isTablet,
  isDesktop,
  isMobile,
  isConstrainedHeight,
  isShort,
}: RoomResponsiveParams) {
  return StyleSheet.create({
    container: {
      flex: 1,
      height: Platform.OS === 'web' ? ('100dvh' as any) : '100%',
      minHeight: Platform.OS === 'web' ? ('100vh' as any) : undefined,
      width: '100%',
      backgroundColor: '#050A1A',
      overflow: 'hidden',
    },

    /* ── Top Header Navigation ── */
    topHeader: {
      height: isDesktop ? 68 : (isTablet ? 56 : 52),
      flexShrink: 0,
      backgroundColor: 'rgba(5, 10, 26, 0.64)',
      borderBottomWidth: 0,
      borderColor: 'rgba(152, 203, 255, 0.08)',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingLeft: isDesktop ? 40 : (isTablet ? 20 : 12),
      paddingRight: isDesktop ? 48 : (isTablet ? 24 : 14),
      zIndex: 20,
      ...(Platform.OS === 'web' ? {
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      } as any : {}),
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: isDesktop ? 12 : 8,
    },
    brandTitle: {
      color: '#98CBFF',
      fontSize: isDesktop ? 36 : (isTablet ? 26 : 20),
      fontWeight: '900',
      letterSpacing: 0,
    },
    brandBadge: {
      backgroundColor: 'rgba(152, 203, 255, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(152, 203, 255, 0.22)',
      borderRadius: 999,
      paddingHorizontal: isDesktop ? 12 : 8,
      paddingVertical: isDesktop ? 5 : 4,
    },
    brandBadgeText: {
      color: '#98CBFF',
      fontSize: isDesktop ? 11 : 9.5,
      fontWeight: '800',
      letterSpacing: 1.2,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: isDesktop ? 14 : 8,
    },
    liveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(16, 185, 129, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(16, 185, 129, 0.3)',
      borderRadius: 999,
      paddingHorizontal: isDesktop ? 14 : 10,
      paddingVertical: isDesktop ? 6 : 5,
    },
    liveBadgeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#10B981',
    },
    liveBadgeText: {
      color: '#10B981',
      fontSize: isDesktop ? 12 : 10.5,
      fontWeight: '600',
    },
    clockBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(26, 34, 53, 0.6)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: 999,
      paddingHorizontal: isDesktop ? 14 : 10,
      paddingVertical: isDesktop ? 6 : 5,
    },
    clockText: {
      color: '#E2E8F0',
      fontSize: isDesktop ? 12.5 : 11,
      fontWeight: '700',
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    voiceSwitcherWrap: {
      position: 'relative',
      zIndex: 80,
    },
    voiceSwitcherBtn: {
      maxWidth: isDesktop ? 190 : 160,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(15, 23, 42, 0.58)',
      borderWidth: 1,
      borderColor: 'rgba(152, 203, 255, 0.18)',
      borderRadius: 999,
      paddingHorizontal: isDesktop ? 14 : 10,
      paddingVertical: isDesktop ? 6 : 5,
    },
    voiceSwitcherText: {
      flexShrink: 1,
      color: '#CBD5E1',
      fontSize: isDesktop ? 12 : 10.5,
      fontWeight: '800',
    },
    voiceMenu: {
      position: 'absolute',
      top: 38,
      right: 0,
      width: 280,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(0, 163, 255, 0.22)',
      backgroundColor: 'rgba(5, 10, 26, 0.96)',
      padding: 8,
      gap: 6,
      shadowColor: '#000',
      shadowOpacity: 0.42,
      shadowRadius: 24,
      ...(Platform.OS === 'web' ? {
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      } as any : {}),
    },
    voiceMenuItem: {
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: 'rgba(152, 203, 255, 0.08)',
      backgroundColor: 'rgba(15, 23, 42, 0.42)',
    },
    voiceMenuItemActive: {
      borderColor: 'rgba(0, 163, 255, 0.52)',
      backgroundColor: 'rgba(0, 163, 255, 0.14)',
    },
    voiceMenuName: {
      color: '#F1F5F9',
      fontSize: 12,
      fontWeight: '900',
      marginBottom: 3,
    },
    voiceMenuDesc: {
      color: 'rgba(203, 213, 225, 0.72)',
      fontSize: 10,
      lineHeight: 14,
    },
    drawerToggleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(15, 23, 42, 0.58)',
      borderWidth: 1,
      borderColor: 'rgba(152, 203, 255, 0.13)',
      borderRadius: 999,
      paddingHorizontal: isDesktop ? 14 : 10,
      paddingVertical: isDesktop ? 6 : 5,
    },
    drawerToggleText: {
      color: '#CBD5E1',
      fontSize: isDesktop ? 12 : 10.5,
      fontWeight: '700',
    },

    /* ── Main Workspace ── */
    mainWorkspace: {
      flex: 1,
      flexBasis: 0,
      height: Platform.OS === 'web' ? (isDesktop ? 'calc(100dvh - 116px)' : 'calc(100dvh - 98px)') as any : undefined,
      maxHeight: Platform.OS === 'web' ? (isDesktop ? 'calc(100dvh - 116px)' : 'calc(100dvh - 98px)') as any : undefined,
      minHeight: 0,
      flexDirection: 'row',
      overflow: 'hidden',
      paddingHorizontal: isDesktop ? 40 : (isTablet ? 18 : 12),
      gap: isDesktop ? 22 : (isTablet ? 14 : 10),
    },
    stageArea: {
      flex: 1,
      minHeight: 0,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
      paddingHorizontal: 0,
      paddingTop: isDesktop ? 16 : (isTablet ? 12 : 8),
      paddingBottom: isDesktop ? 16 : (isTablet ? 12 : 8),
      backgroundColor: 'rgba(2, 8, 23, 0.1)',
    },
    stageAreaCompact: {
      paddingTop: 4,
      paddingBottom: 4,
    },

    /* ── Central Hologram Node & Orb ── */
    activeStageWrapper: {
      flex: 1,
      minHeight: 0,
      width: '100%',
      maxWidth: isDesktop ? 700 : (isTablet ? 600 : 480),
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: isDesktop ? 0 : (isTablet ? 0 : 0),
      paddingBottom: isDesktop ? 20 : (isTablet ? 16 : 12),
    },
    activeStageWrapperCompact: {
      maxWidth: isDesktop ? 680 : (isTablet ? 580 : 480),
      paddingBottom: 10,
    },
    interviewFocusStack: {
      width: '100%',
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingTop: isDesktop ? 8 : (isTablet ? 6 : 4),
    },
    interviewFocusStackCompact: {
      paddingTop: 4,
    },
    aiHolographicNode: {
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      width: isDesktop ? 260 : (isTablet ? 210 : (isShort ? 170 : 196)),
      height: isDesktop ? 260 : (isTablet ? 210 : (isShort ? 170 : 196)),
      marginTop: 0,
    },
    aiHolographicNodeCompact: {
      width: isDesktop ? 230 : (isTablet ? 185 : 160),
      height: isDesktop ? 230 : (isTablet ? 185 : 160),
      marginTop: 0,
    },
    aiWaveRing: {
      position: 'absolute',
      width: isDesktop ? 246 : (isTablet ? 196 : 166),
      height: isDesktop ? 246 : (isTablet ? 196 : 166),
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(0, 163, 255, 0.16)',
    },
    aiSpeechAura: {
      position: 'absolute',
      width: isDesktop ? 214 : (isTablet ? 170 : 144),
      height: isDesktop ? 214 : (isTablet ? 170 : 144),
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(152, 203, 255, 0.72)',
      backgroundColor: 'rgba(0, 163, 255, 0.08)',
      shadowColor: '#98CBFF',
      shadowOpacity: 0.5,
      shadowRadius: 30,
      elevation: 5,
    },
    aiOrbHalo: {
      position: 'absolute',
      width: isDesktop ? 190 : (isTablet ? 150 : 128),
      height: isDesktop ? 190 : (isTablet ? 150 : 128),
      borderRadius: 999,
      backgroundColor: 'rgba(0, 163, 255, 0.18)',
    },
    aiOrbSphere: {
      width: isDesktop ? 168 : (isTablet ? 130 : 112),
      height: isDesktop ? 168 : (isTablet ? 130 : 112),
      borderRadius: 999,
      backgroundColor: '#0F172A',
      borderWidth: 1.5,
      borderColor: '#98CBFF',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#00A3FF',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.7,
      shadowRadius: isDesktop ? 32 : 22,
      elevation: 8,
    },
    aiOrbInnerAura: {
      width: isDesktop ? 112 : (isTablet ? 86 : 74),
      height: isDesktop ? 112 : (isTablet ? 86 : 74),
      borderRadius: 999,
      backgroundColor: 'rgba(0, 163, 255, 0.16)',
      alignItems: 'center',
      justifyContent: 'center',
    },

    /* ── Current Question Glass Card ── */
    currentQuestionGlassCard: {
      width: '100%',
      maxWidth: isDesktop ? 660 : (isTablet ? 560 : 460),
      backgroundColor: 'rgba(26, 34, 53, 0.64)',
      borderWidth: 1,
      borderColor: 'rgba(0, 163, 255, 0.36)',
      borderRadius: 10,
      paddingHorizontal: isDesktop ? 26 : (isTablet ? 18 : 14),
      paddingTop: isDesktop ? 14 : (isTablet ? 10 : 8),
      paddingBottom: isDesktop ? 16 : (isTablet ? 11 : 9),
      marginBottom: isDesktop ? 14 : (isTablet ? 10 : 6),
      alignItems: 'center',
      position: 'relative',
      shadowColor: '#00A3FF',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.16,
      shadowRadius: 24,
      ...(Platform.OS === 'web' ? {
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      } as any : {}),
    },
    currentQuestionThinkingCard: {
      maxWidth: 420,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 14,
      marginBottom: isTablet ? 8 : 14,
    },
    questionCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      marginBottom: isDesktop ? 9 : 6,
      width: '100%',
    },
    questionCardHeaderThinking: {
      marginBottom: 4,
    },
    questionCardBadge: {
      color: '#00A3FF',
      fontSize: isDesktop ? 11 : 9.5,
      fontWeight: '800',
      letterSpacing: 2,
    },
    questionCardPhase: {
      color: '#94A3B8',
      fontSize: isDesktop ? 10 : 9,
      fontWeight: '800',
      letterSpacing: 1.4,
      position: 'absolute',
      right: 0,
    },
    questionCardBadgeWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    questionCardRule: {
      width: isDesktop ? 32 : 20,
      height: 1,
      backgroundColor: 'rgba(0, 163, 255, 0.32)',
    },
    questionThinkingWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 3,
      paddingBottom: 2,
    },
    questionThinkingDots: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
    },
    questionThinkingDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: 'rgba(0, 163, 255, 0.42)',
      shadowColor: '#00A3FF',
      shadowOpacity: 0.24,
      shadowRadius: 8,
      transform: [{ scale: 0.82 }],
    },
    questionThinkingDotActive: {
      backgroundColor: '#98CBFF',
      shadowOpacity: 0.86,
      shadowRadius: 14,
      transform: [{ scale: 1.22 }],
    },
    questionCardBody: {
      color: '#F1F5F9',
      fontSize: isDesktop ? 15.5 : (isTablet ? 13.5 : 12.5),
      lineHeight: isDesktop ? 23 : (isTablet ? 19.5 : 17.5),
      fontWeight: '600',
      letterSpacing: 0,
      textAlign: 'center',
    },
    questionBubbleTail: {
      position: 'absolute',
      bottom: -7,
      width: 14,
      height: 14,
      backgroundColor: 'rgba(26, 34, 53, 0.64)',
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderColor: 'rgba(0, 163, 255, 0.34)',
      transform: [{ rotate: '45deg' }],
    },

    giantMicHint: {
      color: '#94A3B8',
      fontSize: isDesktop ? 10 : 9,
      fontWeight: '500',
      textAlign: 'center',
      marginTop: isDesktop ? 6 : (isTablet ? 4 : 3),
      marginBottom: 2,
    },

    /* ── Voice Interaction Hub ── */
    voiceInteractionHub: {
      width: '100%',
      alignItems: 'center',
      gap: isDesktop ? 0 : 0,
      paddingHorizontal: isDesktop ? 12 : (isTablet ? 8 : 4),
    },
    voiceInteractionHubCompact: {
      gap: 0,
    },
    micControlWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: isDesktop ? 16 : (isTablet ? 14 : 12),
    },
    micOrbButton: {
      width: isDesktop ? 58 : (isTablet ? 52 : 48),
      height: isDesktop ? 58 : (isTablet ? 52 : 48),
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: 'rgba(0, 163, 255, 0.42)',
      shadowColor: '#00A3FF',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.38,
      shadowRadius: 26,
    },
    micOrbButtonStart: {
      backgroundColor: 'rgba(0, 163, 255, 0.14)',
    },
    micOrbButtonStop: {
      backgroundColor: 'rgba(239, 68, 68, 0.18)',
      borderColor: 'rgba(239, 68, 68, 0.55)',
      shadowColor: '#EF4444',
    },
    micVisualizer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2.5,
      width: 108,
      height: isDesktop ? 26 : 20,
      marginTop: 0,
      marginBottom: isDesktop ? 14 : (isTablet ? 11 : 9),
      position: 'relative',
    },
    micWaveBaseline: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: '50%',
      height: 1,
      backgroundColor: 'rgba(0, 163, 255, 0.28)',
      shadowColor: '#00A3FF',
      shadowOpacity: 0.24,
      shadowRadius: 8,
    },
    micBar: {
      width: 2.5,
      height: isDesktop ? 12 : 9,
      borderRadius: 2,
      backgroundColor: '#00A3FF',
      shadowColor: '#00A3FF',
      shadowOpacity: 0.72,
      shadowRadius: 8,
    },
    micBarSoft: {
      opacity: 0.58,
    },
    micBarCore: {
      width: 3.5,
      height: isDesktop ? 14 : 11,
      opacity: 1,
      backgroundColor: '#98CBFF',
    },

    /* ── Live Transcript HUD ── */
    liveTranscriptHud: {
      width: '100%',
      maxWidth: '100%',
      minHeight: isDesktop ? 116 : (isTablet ? 94 : 86),
      maxHeight: isDesktop ? 150 : (isTablet ? 122 : 110),
      flexShrink: 0,
      backgroundColor: 'rgba(5, 10, 26, 0.68)',
      borderWidth: 1,
      borderColor: 'rgba(0, 163, 255, 0.22)',
      borderRadius: 8,
      padding: isDesktop ? 14 : (isTablet ? 11 : 9),
      marginTop: isDesktop ? 10 : (isTablet ? 8 : 6),
      position: 'relative',
      shadowColor: '#000',
      shadowOpacity: 0.38,
      shadowRadius: 22,
      ...(Platform.OS === 'web' ? {
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
      } as any : {}),
    },
    transcriptProcessingOverlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      zIndex: 10,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      borderRadius: 8,
      backgroundColor: 'rgba(5, 10, 26, 0.92)',
    },
    transcriptProcessingText: {
      color: '#98CBFF',
      fontSize: isDesktop ? 11 : 9.5,
      fontWeight: '800',
      letterSpacing: 1.4,
    },
    hudCornerTopLeft: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: 18,
      height: 18,
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderColor: '#00A3FF',
    },
    hudCornerBottomRight: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 18,
      height: 18,
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderColor: '#00A3FF',
    },
    transcriptHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderColor: 'rgba(0, 163, 255, 0.16)',
      paddingBottom: 6,
      marginBottom: 6,
    },
    transcriptTitleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    transcriptTitle: {
      color: '#00A3FF',
      fontSize: isDesktop ? 11 : 9.5,
      fontWeight: '800',
      letterSpacing: 1.6,
    },
    transcriptEditBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 6,
      paddingVertical: 3,
    },
    transcriptEditText: {
      color: '#9CAFC5',
      fontSize: isDesktop ? 10 : 8.5,
      fontWeight: '800',
      letterSpacing: 1,
    },
    transcriptBody: {
      minHeight: isDesktop ? 36 : 26,
      maxHeight: isDesktop ? 58 : 42,
      overflow: 'hidden',
      ...(Platform.OS === 'web' ? {
        overflowY: 'auto',
        overflowX: 'hidden',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      } as any : {}),
    },
    transcriptBodyContent: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      flexGrow: 1,
      paddingRight: 4,
    },
    transcriptText: {
      flex: 1,
      flexShrink: 1,
      color: '#E2E8F0',
      fontSize: isDesktop ? 14 : 12.5,
      lineHeight: isDesktop ? 20 : 17,
      fontWeight: '400',
      ...(Platform.OS === 'web' ? {
        whiteSpace: 'normal',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
      } as any : {}),
    },
    transcriptTextLegacyHidden: {
      display: 'none',
    },
    transcriptFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: isTablet || isConstrainedHeight ? 4 : 7,
    },
    transcriptState: {
      color: 'rgba(148, 163, 184, 0.62)',
      fontSize: isDesktop ? 10 : 8.5,
      fontWeight: '800',
      letterSpacing: 1.6,
    },
    transcriptStateWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    sendAnswerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(0, 163, 255, 0.13)',
      borderWidth: 1,
      borderColor: 'rgba(0, 163, 255, 0.34)',
      borderRadius: 6,
      paddingHorizontal: isDesktop ? 14 : 10,
      paddingVertical: isDesktop ? 6 : 4,
    },
    sendAnswerBtnDisabled: {
      opacity: 0.45,
    },
    sendAnswerText: {
      color: '#98CBFF',
      fontSize: isDesktop ? 11 : 9.5,
      fontWeight: '900',
      letterSpacing: 1,
    },

    /* ── Right Chat Drawer ── */
    chatDrawer: {
      width: isDesktop ? 318 : (isTablet ? 268 : '100%'),
      flexShrink: 0,
      height: Platform.OS === 'web' ? (isDesktop ? 'calc(100dvh - 116px)' : 'calc(100dvh - 98px)') as any : '100%',
      maxHeight: Platform.OS === 'web' ? (isDesktop ? 'calc(100dvh - 116px)' : 'calc(100dvh - 98px)') as any : '100%',
      minHeight: 0,
      alignSelf: 'stretch',
      backgroundColor: '#07101F',
      borderLeftWidth: 0,
      borderColor: 'rgba(152, 203, 255, 0.08)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      paddingTop: isDesktop ? 10 : 6,
      paddingBottom: isDesktop ? 10 : 6,
      ...(Platform.OS === 'web' ? {
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      } as any : {}),
    },
    chatDrawerMobile: {
      width: '100%',
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      zIndex: 30,
    },
    drawerHeader: {
      paddingHorizontal: 0,
      paddingTop: 0,
      paddingBottom: isDesktop ? 12 : 8,
      borderBottomWidth: 1,
      borderColor: 'rgba(152, 203, 255, 0.12)',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    drawerTitleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    drawerTitle: {
      color: '#F1F5F9',
      fontSize: isDesktop ? 14 : 12.5,
      fontWeight: '800',
      letterSpacing: 0.6,
    },
    drawerCountText: {
      color: '#98CBFF',
      fontSize: isDesktop ? 10 : 8.5,
      fontWeight: '800',
      letterSpacing: 1,
      backgroundColor: 'rgba(0, 163, 255, 0.14)',
      borderWidth: 1,
      borderColor: 'rgba(0, 163, 255, 0.22)',
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    drawerScrollView: {
      flex: 1,
      flexBasis: 0,
      minHeight: 0,
      maxHeight: '100%',
      ...(Platform.OS === 'web' ? {
        overflowY: 'auto',
        overflowX: 'hidden',
        scrollbarColor: 'rgba(0, 163, 255, 0.62) rgba(8, 18, 38, 0.28)',
        scrollbarWidth: 'thin',
      } as any : {}),
    },
    drawerScrollContent: {
      paddingTop: isDesktop ? 14 : 10,
      paddingBottom: isDesktop ? 14 : 10,
      gap: isDesktop ? 14 : 10,
    },
    drawerBubbleRow: {
      width: '100%',
      flexDirection: 'row',
    },
    drawerBubbleRowAi: {
      justifyContent: 'flex-start',
    },
    drawerBubbleRowUser: {
      justifyContent: 'flex-end',
    },
    drawerBubble: {
      maxWidth: '94%',
      borderRadius: 7,
      padding: isDesktop ? 12 : 9,
    },
    drawerBubbleAi: {
      backgroundColor: 'rgba(20, 39, 67, 0.58)',
      borderWidth: 1,
      borderColor: 'rgba(0, 163, 255, 0.16)',
    },
    drawerBubbleUser: {
      backgroundColor: 'rgba(30, 41, 59, 0.78)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    drawerRoleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
    },
    drawerRoleRowUser: {
      justifyContent: 'flex-end',
    },
    drawerRole: {
      color: '#98CBFF',
      fontSize: isDesktop ? 10 : 8.5,
      fontWeight: '900',
      letterSpacing: 0.8,
    },
    drawerRoleUser: {
      color: '#CBD5E1',
    },
    drawerText: {
      color: '#FFFFFF',
      fontSize: isDesktop ? 12 : 11,
      lineHeight: isDesktop ? 18 : 15.5,
      marginBottom: 6,
    },
    drawerTime: {
      color: 'rgba(255, 255, 255, 0.5)',
      fontSize: isDesktop ? 10 : 8.5,
      alignSelf: 'flex-end',
    },
    drawerTypingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingTop: isDesktop ? 10 : 6,
      borderTopWidth: 1,
      borderColor: 'rgba(152, 203, 255, 0.08)',
    },
    drawerTypingDots: {
      flexDirection: 'row',
      gap: 4,
    },
    drawerTypingDotMuted: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: 'rgba(0, 163, 255, 0.35)',
    },
    drawerTypingDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: 'rgba(0, 163, 255, 0.58)',
    },
    drawerTypingDotStrong: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: '#00A3FF',
    },
    drawerTypingText: {
      color: 'rgba(148, 163, 184, 0.7)',
      fontSize: isDesktop ? 9 : 8,
      fontWeight: '800',
      letterSpacing: 1,
    },

    /* ── Footer ── */
    footerBar: {
      height: isDesktop ? 44 : 38,
      flexShrink: 0,
      borderTopWidth: 1,
      borderColor: 'rgba(152, 203, 255, 0.08)',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: isDesktop ? 40 : (isTablet ? 20 : 12),
      backgroundColor: 'rgba(5, 10, 26, 0.55)',
    },
    footerMetaGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: isDesktop ? 12 : 8,
    },
    footerDivider: {
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: 'rgba(148, 163, 184, 0.38)',
    },
    footerText: {
      color: 'rgba(148, 163, 184, 0.7)',
      fontSize: isDesktop ? 10 : 8.5,
      fontWeight: '800',
      letterSpacing: isDesktop ? 2 : 1.2,
    },

    /* ── Stage Completion / Evaluation ── */
    glassCardStage: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: isDesktop ? 40 : 24,
      maxWidth: isDesktop ? 520 : 420,
      backgroundColor: 'rgba(18, 20, 20, 0.6)',
      borderWidth: 1,
      borderColor: 'rgba(152, 203, 255, 0.25)',
      borderRadius: 20,
      ...(Platform.OS === 'web' ? {
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      } as any : {}),
    },
    stageFinishTitle: {
      color: '#F1F5F9',
      fontSize: isDesktop ? 26 : 21,
      fontWeight: '800',
      marginBottom: 10,
    },
    stageFinishSub: {
      color: '#94A3B8',
      fontSize: isDesktop ? 15 : 13,
      lineHeight: isDesktop ? 24 : 20,
      textAlign: 'center',
      marginBottom: 24,
    },
    stageExitBtn: {
      backgroundColor: '#00A3FF',
      paddingHorizontal: 28,
      paddingVertical: 12,
      borderRadius: 14,
    },
    stageExitBtnText: {
      color: '#FFFFFF',
      fontSize: isDesktop ? 15 : 13.5,
      fontWeight: '700',
    },
    stageEvalTitle: {
      color: '#98CBFF',
      fontSize: isDesktop ? 22 : 18,
      fontWeight: '800',
      marginBottom: 10,
    },
    stageEvalSub: {
      color: '#94A3B8',
      fontSize: isDesktop ? 14 : 12,
      textAlign: 'center',
      lineHeight: isDesktop ? 22 : 18,
    },
  });
}
