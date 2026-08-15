import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AIInterviewRoom } from './src/components/AIInterviewRoom';
import { CyberCanvasBackground as NativeCyberCanvasBackground } from './src/components/CyberCanvasBackground';
import {
  enterKioskApi,
  getAvailableVoicesApi,
  getAllKiosksApi,
  loginStaffApi,
  resolveApiAssetUrl,
  type Kiosk,
  type VoiceOption,
} from './src/lib/api';
import { playAudioUri, type AudioPlayerHandle } from './src/lib/audioPlayer';

const PIN_LENGTH = 6;
const WEB_KIOSK_STORAGE_KEY = 'inblue.currentKiosk';

const KIOSK_INIT_STATES = [
  {
    title: 'Preparing interview room',
    detail: 'Đang chuẩn bị không gian phỏng vấn AI cho phiên làm việc của bạn.',
  },
  {
    title: 'Syncing candidate session',
    detail: 'Đồng bộ lịch hẹn, mã kiosk và cấu hình phỏng vấn cá nhân.',
  },
  {
    title: 'Configuring voice channel',
    detail: 'Thiết lập kênh âm thanh để AI có thể trao đổi trực tiếp.',
  },
  {
    title: 'Finalizing AI workspace',
    detail: 'Hoàn tất môi trường riêng tư trước khi bắt đầu buổi phỏng vấn.',
  },
];

type AppScreenState = 'PIN_ENTRY' | 'VOICE_SELECT' | 'AI_ROOM';
type KioskSettingsMode = 'LOGIN' | 'SELECT';

const C = {
  bg: '#050A1A',
  surface: '#121414',
  primary: '#98cbff',
  primaryDeep: '#00a3ff',
  onSurface: '#e2e2e2',
  onSurfaceVariant: '#bec7d4',
  white10: 'rgba(255,255,255,0.1)',
  white03: 'rgba(255,255,255,0.03)',
  glassBg: 'rgba(26,34,53,0.4)',
  slotBg: 'rgba(26,34,53,0.6)',
  slotBorder: 'rgba(152,203,255,0.2)',
  slotActiveBorder: '#98cbff',
  slotActiveGlow: 'rgba(152,203,255,0.4)',
  slotFilledBg: '#98cbff',
  slotFilledGlow: 'rgba(152,203,255,0.6)',
  keyBg: 'rgba(26,34,53,0.4)',
  keyPressBg: 'rgba(152,203,255,0.2)',
};

/* ───── Ultra-Clean Cyber Constellation Canvas Background ───── */
function CyberCanvasBackground() {
  const canvasRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !canvasRef.current) return;
    const canvas: any = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.clientWidth || 800);
    let height = (canvas.height = canvas.clientHeight || 600);

    const particleCount = 40;
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      radius: Math.random() * 2 + 1,
      alpha: Math.random() * 0.6 + 0.3,
    }));

    let t = 0;
    let animId: number;

    function render() {
      if (!canvas || !ctx) return;
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        width = canvas.width = canvas.clientWidth || 800;
        height = canvas.height = canvas.clientHeight || 600;
      }

      t += 0.008;

      ctx.fillStyle = '#050A1A';
      ctx.fillRect(0, 0, width, height);

      // Soft glowing ambient orbs
      const orb1X = width * (0.35 + 0.2 * Math.sin(t * 0.5));
      const orb1Y = height * (0.35 + 0.2 * Math.cos(t * 0.3));
      const g1 = ctx.createRadialGradient(orb1X, orb1Y, 0, orb1X, orb1Y, width * 0.55);
      g1.addColorStop(0, 'rgba(0, 163, 255, 0.2)');
      g1.addColorStop(1, 'rgba(5, 10, 26, 0)');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, width, height);

      const orb2X = width * (0.75 - 0.2 * Math.cos(t * 0.4));
      const orb2Y = height * (0.65 - 0.2 * Math.sin(t * 0.6));
      const g2 = ctx.createRadialGradient(orb2X, orb2Y, 0, orb2X, orb2Y, width * 0.45);
      g2.addColorStop(0, 'rgba(99, 102, 241, 0.16)');
      g2.addColorStop(1, 'rgba(5, 10, 26, 0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, width, height);

      // Constellation lines
      for (let i = 0; i < particleCount; i++) {
        for (let j = i + 1; j < particleCount; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 140) {
            const lineAlpha = (1 - dist / 140) * 0.2;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(152, 203, 255, ${lineAlpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      // Particles
      for (let p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(152, 203, 255, ${p.alpha})`;
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    }

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  if (Platform.OS === 'web') {
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <canvas
          ref={canvasRef as any}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,10,26,0.3)' }]} />
      </View>
    );
  }

  return <NativeCyberCanvasBackground />;
}

/* ───── Lock Open Icon Component ───── */
function LockOpenIcon() {
  if (Platform.OS === 'web') {
    return (
      <View style={{ marginBottom: 16 }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#98cbff" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
        </svg>
      </View>
    );
  }
  return <Text style={{ fontSize: 44, marginBottom: 16 }}>🔓</Text>;
}

/* ───── Real-Time Clock Widget (Right Panel) ───── */
function RobotLineIcon({ size = 38, color = '#98cbff' }: { size?: number; color?: string }) {
  if (Platform.OS !== 'web') {
    return <Text style={{ color, fontSize: Math.max(16, size * 0.46), fontWeight: '900' }}>🤖</Text>;
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="8" width="14" height="10" rx="4" />
      <path d="M12 8V4.5" />
      <path d="M8.5 4.5h7" />
      <path d="M8.5 13h.01" />
      <path d="M15.5 13h.01" />
      <path d="M10 16h4" />
      <path d="M5 12H3" />
      <path d="M21 12h-2" />
    </svg>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return (
    <View style={s.glassBadgeBox}>
      {Platform.OS === 'web' ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#98cbff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      ) : (
        <Text style={s.glassBadgeIcon}>⏱</Text>
      )}
      <Text style={s.glassBadgeText}>{h}:{m}</Text>
    </View>
  );
}

/* ───── Real-Time Date Text (Left Panel Top Right) ───── */
function RealTimeDateWidget({ styles }: { styles: any }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();

  return (
    <Text style={styles.pureDateText}>
      {dd}-{mm}-{yyyy}
    </Text>
  );
}

function decodeJwtPayload(token: string): any {
  const payload = token.split('.')[1];
  if (!payload) return null;

  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  let buffer = 0;
  let bits = 0;

  for (let i = 0; i < base64.length; i += 1) {
    const value = chars.indexOf(base64[i]);
    if (value < 0 || value === 64) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }

  try {
    return JSON.parse(decodeURIComponent(output.split('').map(char => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`).join('')));
  } catch {
    try {
      return JSON.parse(output);
    } catch {
      return null;
    }
  }
}

function isStaffToken(token: string): boolean {
  const payload = decodeJwtPayload(token);
  return Array.isArray(payload?.roles) && payload.roles.includes('ROLE_STAFF');
}

/* ───── Main App Controller ───── */
function App() {
  const { width, height } = useWindowDimensions();
  const isWide = width >= 768;
  const isTablet = width >= 768 && width < 1200;
  const isDesktop = width >= 1200;
  const isShort = height < 800;

  const [screenState, setScreenState] = useState<AppScreenState>('PIN_ENTRY');
  const [pin, setPin] = useState('');
  const [aiSessionKey, setAiSessionKey] = useState('');
  const [interviewDurationMinutes, setInterviewDurationMinutes] = useState(0);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState('');
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [selectedKiosk, setSelectedKiosk] = useState<Kiosk | null>(null);
  const [isKioskSettingsOpen, setIsKioskSettingsOpen] = useState(false);
  const [kioskSettingsMode, setKioskSettingsMode] = useState<KioskSettingsMode>('LOGIN');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffToken, setStaffToken] = useState('');
  const [kiosks, setKiosks] = useState<Kiosk[]>([]);
  const [kioskSettingsError, setKioskSettingsError] = useState<string | null>(null);
  const [kioskSuccessMessage, setKioskSuccessMessage] = useState<string | null>(null);
  const [isKioskSettingsLoading, setIsKioskSettingsLoading] = useState(false);
  const previewAudioRef = useRef<any>(null);
  const previewWaveFrameRef = useRef<number | null>(null);
  const previewAudioContextRef = useRef<any>(null);
  const previewAudioSourceRef = useRef<any>(null);
  const voicePreviewWaveLevels = useRef([0.3, 0.55, 0.82, 0.55, 0.3].map(level => new Animated.Value(level))).current;
  const initPulse = useRef(new Animated.Value(0)).current;
  const initSpin = useRef(new Animated.Value(0)).current;
  const initTextFade = useRef(new Animated.Value(1)).current;
  const [initStepIndex, setInitStepIndex] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    try {
      const saved = window.localStorage.getItem(WEB_KIOSK_STORAGE_KEY);
      if (saved) {
        setSelectedKiosk(JSON.parse(saved));
      }
    } catch (error) {
      console.warn('Unable to load saved kiosk config:', error);
    }
  }, []);

  const loadVoices = useCallback(async () => {
    setIsLoadingVoices(true);
    setVoiceError(null);

    try {
      const voiceList = await getAvailableVoicesApi();
      setVoices(voiceList);
      setSelectedVoiceId(prev => prev || voiceList[0]?.id || '');
    } catch (err: any) {
      console.warn('Load voices failed:', err);
      setVoiceError(err.message || 'Không tải được danh sách giọng đọc AI.');
    } finally {
      setIsLoadingVoices(false);
    }
  }, []);

  // Imperative PIN submit handler directly called upon 6-digit entry
  const handlePinSubmit = useCallback(async (targetPin: string) => {
    if (!selectedKiosk?.id) {
      setAuthError('Vui lòng cấu hình kiosk trước khi nhập mã PIN.');
      setPin('');
      return;
    }

    setIsVerifying(true);
    setAuthError(null);
    Keyboard.dismiss();

    try {
      const res = await enterKioskApi(targetPin, selectedKiosk.id);
      setAiSessionKey(res.aiSessionKey || targetPin);
      setInterviewDurationMinutes(Number(res.durationMinutes) || 0);
      setIsVerifying(false);
      setScreenState('VOICE_SELECT');
      void loadVoices();
    } catch (err: any) {
      console.warn('Kiosk Auth Failed:', err);
      setIsVerifying(false);
      let rawErr = err.message || 'Xác thực không thành công. Vui lòng thử lại!';
      if (rawErr.toLowerCase().includes('booking not found')) {
        rawErr = 'Không tìm thấy lịch hẹn phỏng vấn cho mã PIN này!';
      } else if (rawErr.toLowerCase().includes('booking has been cancelled')) {
        rawErr = 'Lịch hẹn phỏng vấn này đã bị hủy.';
      } else if (rawErr.toLowerCase().includes('not for the specified kiosk')) {
        rawErr = 'Mã PIN này không thuộc kiosk đang được cấu hình.';
      } else if (rawErr.toLowerCase().includes('within 15 minutes of your scheduled start time')) {
        const scheduledTime = rawErr.match(/\(([^)]+)\)/)?.[1];
        rawErr = scheduledTime
          ? `Bạn chỉ có thể vào kiosk trong vòng 15 phút trước hoặc sau giờ hẹn (${scheduledTime}).`
          : 'Bạn chỉ có thể vào kiosk trong vòng 15 phút trước hoặc sau giờ hẹn.';
      }
      setAuthError(rawErr);
      setPin('');
    }
  }, [loadVoices, selectedKiosk]);

  const pressKey = useCallback((val: string) => {
    if (isVerifying || screenState !== 'PIN_ENTRY') return;
    setAuthError(null);

    let nextPin = pin;
    if (val === 'AC') { setPin(''); return; }
    if (val === 'DEL') { setPin(p => p.slice(0, -1)); return; }
    
    if (pin.length < PIN_LENGTH) {
      nextPin = pin + val;
      setPin(nextPin);
      if (nextPin.length === PIN_LENGTH) {
        handlePinSubmit(nextPin);
      }
    }
  }, [isVerifying, screenState, pin, handlePinSubmit]);

  const openKioskSettings = useCallback(() => {
    setIsKioskSettingsOpen(true);
    setKioskSettingsError(null);
    setKioskSuccessMessage(null);
    setKioskSettingsMode('LOGIN');
    setStaffToken('');
    setKiosks([]);
    setStaffPassword('');
  }, []);

  const closeKioskSettings = useCallback(() => {
    setIsKioskSettingsOpen(false);
    setKioskSettingsError(null);
    setKioskSuccessMessage(null);
    setIsKioskSettingsLoading(false);
    setKioskSettingsMode('LOGIN');
    setStaffToken('');
    setKiosks([]);
    setStaffPassword('');
  }, []);

  const handleStaffLogin = useCallback(async () => {
    if (!staffEmail.trim() || !staffPassword.trim()) {
      setKioskSettingsError('Vui lòng nhập tài khoản và mật khẩu nhân viên.');
      return;
    }

    setIsKioskSettingsLoading(true);
    setKioskSettingsError(null);
    setKioskSuccessMessage(null);

    try {
      const token = await loginStaffApi(staffEmail.trim(), staffPassword);
      if (!isStaffToken(token)) {
        throw new Error('Tài khoản này không có quyền STAFF.');
      }

      const kioskList = await getAllKiosksApi(token);
      setStaffToken(token);
      setKiosks(kioskList.filter(kiosk => kiosk.isActive !== false && kiosk.active !== false));
      setKioskSettingsMode('SELECT');
      setStaffPassword('');
    } catch (error: any) {
      setKioskSettingsError(error.message || 'Đăng nhập hoặc tải kiosk thất bại.');
    } finally {
      setIsKioskSettingsLoading(false);
    }
  }, [staffEmail, staffPassword]);

  const handleSelectKiosk = useCallback((kiosk: Kiosk) => {
    setIsKioskSettingsLoading(true);
    setKioskSettingsError(null);
    setKioskSuccessMessage(null);
    setSelectedKiosk(kiosk);
    setAuthError(null);

    if (Platform.OS === 'web') {
      try {
        window.localStorage.setItem(WEB_KIOSK_STORAGE_KEY, JSON.stringify(kiosk));
      } catch (error) {
        console.warn('Unable to save kiosk config:', error);
      }
    }

    setKioskSuccessMessage(`Đã cấu hình thành công ${kiosk.name}.`);
    setStaffToken('');
    setKiosks([]);
    setStaffPassword('');

    setTimeout(() => {
      setIsKioskSettingsLoading(false);
      setIsKioskSettingsOpen(false);
      setKioskSettingsMode('LOGIN');
      setKioskSuccessMessage(null);
    }, 900);
  }, []);

  const handleVoiceConfirmed = () => {
    setScreenState('AI_ROOM');
  };

  const handleVoiceSelectCancelled = () => {
    setPin('');
    setAiSessionKey('');
    setInterviewDurationMinutes(0);
    setSelectedVoiceId('');
    setVoices([]);
    setAuthError(null);
    setVoiceError(null);
    setScreenState('PIN_ENTRY');
  };

  const resetPreviewWave = useCallback(() => {
    if (previewWaveFrameRef.current != null && Platform.OS === 'web') {
      cancelAnimationFrame(previewWaveFrameRef.current);
      previewWaveFrameRef.current = null;
    }

    voicePreviewWaveLevels.forEach((level, index) => {
      level.setValue([0.3, 0.55, 0.82, 0.55, 0.3][index]);
    });
  }, [voicePreviewWaveLevels]);

  const startPreviewWaveFromAudio = useCallback((audio: HTMLAudioElement) => {
    if (Platform.OS !== 'web') return;

    resetPreviewWave();

    try {
      const AudioContextCtor = (window as any).AudioContext || (window as any).webkitAudioContext;
      const stream = (audio as any).captureStream?.() || (audio as any).mozCaptureStream?.();
      if (!AudioContextCtor || !stream) {
        const drawFallback = () => {
          const t = audio.currentTime || 0;
          voicePreviewWaveLevels.forEach((level, index) => {
            const energy = 0.42 + Math.abs(Math.sin(t * 5.8 + index * 0.72)) * 0.74;
            level.setValue(energy);
          });
          previewWaveFrameRef.current = requestAnimationFrame(drawFallback);
        };
        drawFallback();
        return;
      }

      const audioContext = previewAudioContextRef.current || new AudioContextCtor();
      previewAudioContextRef.current = audioContext;
      void audioContext.resume?.();

      previewAudioSourceRef.current?.disconnect?.();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.76;
      source.connect(analyser);
      previewAudioSourceRef.current = source;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const draw = () => {
        analyser.getByteFrequencyData(data);
        let frameTotal = 0;
        for (let i = 0; i < data.length; i += 1) frameTotal += data[i];
        const frameEnergy = frameTotal / Math.max(1, data.length) / 255;
        const t = audio.currentTime || 0;

        voicePreviewWaveLevels.forEach((level, index) => {
          const start = Math.floor((index / voicePreviewWaveLevels.length) * data.length);
          const end = Math.max(start + 1, Math.floor(((index + 1) / voicePreviewWaveLevels.length) * data.length));
          let total = 0;
          for (let i = start; i < end; i += 1) total += data[i];
          const analysedEnergy = total / Math.max(1, end - start) / 255;
          const fallbackEnergy = 0.34 + Math.abs(Math.sin(t * 6.2 + index * 0.84)) * 0.86;
          const energy = frameEnergy > 0.015 ? 0.24 + analysedEnergy * 1.5 : fallbackEnergy;
          level.setValue(energy);
        });

        previewWaveFrameRef.current = requestAnimationFrame(draw);
      };

      draw();
    } catch (err) {
      console.warn('Voice preview wave unavailable:', err);
      resetPreviewWave();
    }
  }, [resetPreviewWave, voicePreviewWaveLevels]);

  const previewPlayerRef = useRef<AudioPlayerHandle | null>(null);

  const handlePreviewVoice = useCallback(async (voice: VoiceOption) => {
    setSelectedVoiceId(voice.id);

    // Stop any existing playback
    if (previewPlayerRef.current) {
      previewPlayerRef.current.stop();
      previewPlayerRef.current = null;
    }

    if (previewingVoiceId === voice.id) {
      setPreviewingVoiceId(null);
      resetPreviewWave();
      return;
    }

    const audioUrl = resolveApiAssetUrl(voice.previewUrl);
    setPreviewingVoiceId(voice.id);

    try {
      const handle = await playAudioUri(audioUrl, {
        onStart: () => {
          // If on web, start wave
          if (Platform.OS === 'web') {
            const drawFallback = () => {
              const t = Date.now() / 300;
              voicePreviewWaveLevels.forEach((level, index) => {
                const energy = 0.38 + Math.abs(Math.sin(t * 2.2 + index * 0.72)) * 0.58;
                level.setValue(energy);
              });
              previewWaveFrameRef.current = requestAnimationFrame(drawFallback);
            };
            drawFallback();
          }
        },
        onEnd: () => {
          previewPlayerRef.current = null;
          setPreviewingVoiceId(null);
          resetPreviewWave();
        },
        onError: (err) => {
          console.warn('Voice preview playback failed:', err);
          previewPlayerRef.current = null;
          setPreviewingVoiceId(null);
          resetPreviewWave();
        },
      });
      previewPlayerRef.current = handle;
    } catch (err) {
      console.warn('Voice preview failed:', err);
      previewPlayerRef.current = null;
      setPreviewingVoiceId(null);
      resetPreviewWave();
    }
  }, [previewingVoiceId, resetPreviewWave, voicePreviewWaveLevels]);

  useEffect(() => {
    if (!isVerifying) {
      setInitStepIndex(0);
      initPulse.stopAnimation();
      initSpin.stopAnimation();
      initPulse.setValue(0);
      initSpin.setValue(0);
      initTextFade.stopAnimation();
      initTextFade.setValue(1);
      return;
    }

    const stepTimer = setInterval(() => {
      Animated.sequence([
        Animated.timing(initTextFade, {
          toValue: 0,
          duration: 520,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(initTextFade, {
          toValue: 1,
          duration: 680,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      setTimeout(() => {
        setInitStepIndex(prev => (prev + 1) % KIOSK_INIT_STATES.length);
      }, 520);
    }, 2850);

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(initPulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(initPulse, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const spinLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(initSpin, {
          toValue: 1,
          duration: 2400,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(initSpin, {
          toValue: 0,
          duration: 0,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
    );

    pulseLoop.start();
    spinLoop.start();

    return () => {
      clearInterval(stepTimer);
      pulseLoop.stop();
      spinLoop.stop();
    };
  }, [initPulse, initSpin, initTextFade, isVerifying]);

  useEffect(() => {
    return () => {
      previewAudioRef.current?.pause?.();
      previewAudioRef.current = null;
      previewAudioSourceRef.current?.disconnect?.();
      resetPreviewWave();
    };
  }, [resetPreviewWave]);

  const handleFinishAIRoom = () => {
    setPin('');
    setAiSessionKey('');
    setInterviewDurationMinutes(0);
    setSelectedVoiceId('');
    setVoices([]);
    setAuthError(null);
    setVoiceError(null);
    setScreenState('PIN_ENTRY');
  };

  const safeVoices = Array.isArray(voices) ? voices : [];
  const styles = useMemo(
    () => createStyles({ width, height, isWide, isTablet, isDesktop, isShort }),
    [width, height, isWide, isTablet, isDesktop, isShort]
  );
  const activeInitState = KIOSK_INIT_STATES[initStepIndex % KIOSK_INIT_STATES.length];
  const initPulseScale = initPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1.08],
  });
  const initPulseOpacity = initPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.28, 0.62],
  });
  const initTextTranslateY = initTextFade.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 0],
  });
  const initSpinRotate = initSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Render Full Screen AI Room when in AI_ROOM state
  if (screenState === 'AI_ROOM') {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#050A1A" />
        <AIInterviewRoom
          sessionKey={aiSessionKey}
          durationMinutes={interviewDurationMinutes}
          initialVoiceId={selectedVoiceId}
          voices={safeVoices}
          onVoiceChange={setSelectedVoiceId}
          onFinish={handleFinishAIRoom}
        />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <SafeAreaView style={styles.screen}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex1}
        >
          <View style={styles.layout}>
            {/* ── Left Panel: Context & Identity ── */}
            <View style={styles.leftPanel}>
              <CyberCanvasBackground />

              {/* Real-time Date Widget at Top Right of Left Panel */}
              {isWide && (
                <View style={styles.dateContainer}>
                  <RealTimeDateWidget styles={styles} />
                </View>
              )}

              {/* Header Title Group */}
              <View style={styles.leftHeaderGroup}>
                <Text style={styles.brandLogo}>INBLUE</Text>
                <Text style={styles.heroTitle}>Phỏng Vấn{'\n'}AI Tại Kiosk</Text>
                <View style={styles.statusPill}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusLabel}>System Online</Text>
                </View>
              </View>

            </View>

            {/* ── Right Panel: Interaction Workspace ── */}
            <View style={styles.rightPanel}>
              {/* Subtle Grid Decoration */}
              {Platform.OS === 'web' && (
                <View
                  pointerEvents="none"
                  style={[StyleSheet.absoluteFill, {
                    opacity: 0.5,
                    backgroundImage: `linear-gradient(${C.white03} 1px, transparent 1px), linear-gradient(90deg, ${C.white03} 1px, transparent 1px)`,
                    backgroundSize: '40px 40px',
                  } as any]}
                />
              )}

              {screenState !== 'VOICE_SELECT' && (
                <View style={styles.topControlRow}>
                  <Clock />
                  {screenState === 'PIN_ENTRY' && !isVerifying && (
                    <Pressable
                      onPress={openKioskSettings}
                      style={({ pressed }) => [styles.kioskGearBtn, pressed && { opacity: 0.75, transform: [{ scale: 0.96 }] }]}
                    >
                      <Text style={styles.kioskGearIcon}>⚙</Text>
                    </Pressable>
                  )}
                </View>
              )}

              {/* Center Interaction Workspace */}
              <ScrollView
                style={styles.rightScroll}
                contentContainerStyle={styles.rightCenter}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                bounces={false}
              >
                {screenState === 'VOICE_SELECT' ? (
                  <View style={styles.voiceSelectBox}>
                    <Text style={styles.voiceEyebrow}>AI VOICE PROFILE</Text>
                    <Text style={styles.voiceTitle}>Chọn giọng nói phỏng vấn</Text>
                    <Text style={styles.voiceSubtitle}>
                      Hãy chọn chất giọng bạn muốn nghe trong suốt buổi phỏng vấn. Bạn vẫn có thể đổi lại khi đang phỏng vấn.
                    </Text>

                    {isLoadingVoices ? (
                      <Text style={styles.verifyingText}>Đang tải danh sách giọng đọc AI...</Text>
                    ) : voiceError ? (
                      <View style={styles.voiceErrorBox}>
                        <Text style={styles.errorText}>{voiceError}</Text>
                        <Pressable
                          onPress={loadVoices}
                          style={({ pressed }) => [styles.voiceRetryBtn, pressed && { opacity: 0.85 }]}
                        >
                          <Text style={styles.voiceRetryText}>Tải lại danh sách</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View style={styles.voiceGrid}>
                        {safeVoices.map((voice, index) => {
                          const selected = selectedVoiceId === voice.id;
                          const previewing = previewingVoiceId === voice.id;
                          const voiceCode = `V${String(index + 1).padStart(2, '0')}`;

                          return (
                            <Pressable
                              key={voice.id}
                              onPress={() => handlePreviewVoice(voice)}
                              style={({ pressed }) => [
                                styles.voiceCard,
                                selected && styles.voiceCardSelected,
                                pressed && { transform: [{ scale: 0.985 }], opacity: 0.92 },
                              ]}
                            >
                              <View style={styles.voiceCardTopLine}>
                                <Text style={styles.voiceCode}>{voiceCode}</Text>
                                {selected && <Text style={styles.voiceSelectedPill}>ACTIVE</Text>}
                              </View>
                              <View style={styles.voiceCardHeader}>
                                <View style={[styles.voiceAvatar, selected && styles.voiceAvatarSelected]}>
                                  <Text style={styles.voiceAvatarText}>{voice.name.slice(0, 1).toUpperCase()}</Text>
                                </View>
                                <View style={styles.voiceCardTitleWrap}>
                                  <Text style={styles.voiceName} numberOfLines={1} ellipsizeMode="tail">{voice.name}</Text>
                                  <Text style={styles.voiceMeta}>{selected ? 'Đang chọn' : 'Có thể chọn'}</Text>
                                </View>
                              </View>
                              <Text style={styles.voiceDescription} numberOfLines={2} ellipsizeMode="tail">{voice.description}</Text>
                              <View style={styles.voiceCardFooter}>
                                <View style={[styles.voiceSignal, selected && styles.voiceSignalActive, previewing && styles.voiceSignalPlaying]}>
                                  {voicePreviewWaveLevels.map((level, barIndex) => (
                                    <Animated.View
                                      key={barIndex}
                                      style={[
                                        styles.voiceSignalBar,
                                        barIndex % 2 === 0 && styles.voiceSignalBarSoft,
                                        {
                                          transform: [{ scaleY: previewing ? level : 1 }],
                                        },
                                      ]}
                                    />
                                  ))}
                                </View>
                                <Text style={[styles.voiceTapHint, previewing && styles.voiceTapHintActive]}>
                                  {previewing ? 'Đang phát mẫu giọng' : 'Chạm để chọn'}
                                </Text>
                              </View>
                            </Pressable>
                          );
                        })}
                      </View>
                    )}

                    <View style={styles.voiceActionRow}>
                      <Pressable
                        onPress={handleVoiceSelectCancelled}
                        style={({ pressed }) => [styles.voiceBackBtn, pressed && { opacity: 0.85 }]}
                      >
                        <Text style={styles.voiceBackText}>Quay lại</Text>
                      </Pressable>
                      <Pressable
                        onPress={handleVoiceConfirmed}
                        disabled={!selectedVoiceId || isLoadingVoices}
                        style={({ pressed }) => [
                          styles.voiceStartBtn,
                          (!selectedVoiceId || isLoadingVoices) && styles.voiceStartBtnDisabled,
                          pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                        ]}
                      >
                        <Text style={styles.voiceStartText}>Bắt đầu phỏng vấn</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View style={styles.centerBox}>
                  {/* Material Lock Open Icon */}
                  {!isVerifying && <LockOpenIcon />}

                  {isVerifying ? (
                    <View style={styles.initLoaderBox}>
                      <View style={styles.initOrbWrap}>
                        <Animated.View
                          style={[
                            styles.initOrbPulse,
                            {
                              opacity: initPulseOpacity,
                              transform: [{ scale: initPulseScale }],
                            },
                          ]}
                        />
                        <Animated.View
                          style={[
                            styles.initOrbSpinner,
                            {
                              transform: [{ rotate: initSpinRotate }],
                            },
                          ]}
                        />
                        <View style={styles.initOrbCore}>
                          <View style={styles.initOrbDot} />
                          <RobotLineIcon size={40} color="#98CBFF" />
                        </View>
                      </View>

                      <View style={styles.initColdStartMeta}>
                        <View style={styles.initMetaLine} />
                        <Text style={styles.initMetaText}>COLD START</Text>
                        <View style={styles.initMetaLine} />
                      </View>

                      <Animated.View
                        style={[
                          styles.initTextBlock,
                          {
                            opacity: initTextFade,
                            transform: [{ translateY: initTextTranslateY }],
                          },
                        ]}
                      >
                        <Text style={styles.initTitle}>{activeInitState.title}</Text>
                        <Text style={styles.initDetail}>{activeInitState.detail}</Text>
                      </Animated.View>

                      <Text style={styles.initFootnote}>INBLUE AI KIOSK · PLEASE STAND BY</Text>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.instruction}>
                        Nhập mã PIN 6 số từ lịch hẹn của bạn để bắt đầu.
                      </Text>

                      <Text style={styles.currentKioskText}>
                        {selectedKiosk
                          ? `Kiosk hiện tại: ${selectedKiosk.name}${selectedKiosk.location ? ` · ${selectedKiosk.location}` : ''}`
                          : 'Chưa cấu hình kiosk cho màn hình này'}
                      </Text>

                      {/* 6 Circular PIN Slots */}
                      <View style={styles.pinRow}>
                        {Array.from({ length: PIN_LENGTH }).map((_, idx) => {
                          const filled = idx < pin.length;
                          return (
                            <View
                              key={idx}
                              style={[
                                styles.pinSlot,
                                filled && styles.pinSlotFilled,
                                !!authError && styles.pinSlotError,
                              ]}
                            />
                          );
                        })}
                      </View>

                      {authError && (
                        <Text style={styles.errorText}>{authError}</Text>
                      )}

                      {/* On-Screen Glass Touch Numpad Keypad (0ms Instant Touch Response) */}
                      <View style={styles.keypad}>
                        {['1','2','3','4','5','6','7','8','9','AC','0','DEL'].map(k => {
                          const isAction = k === 'AC' || k === 'DEL';
                          return (
                            <Pressable
                              key={k}
                              onPress={() => pressKey(k)}
                              style={({ pressed }) => [
                                styles.key,
                                pressed && styles.keyPressed,
                              ]}
                            >
                              {k === 'DEL' && Platform.OS === 'web' ? (
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#bec7d4" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path>
                                  <line x1="18" y1="9" x2="12" y2="15"></line>
                                  <line x1="12" y1="9" x2="18" y2="15"></line>
                                </svg>
                              ) : (
                                <Text style={[styles.keyText, isAction && styles.keyActionText]}>
                                  {k === 'DEL' ? '⌫' : k}
                                </Text>
                              )}
                            </Pressable>
                          );
                        })}
                      </View>
                    </>
                  )}
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>

        {isKioskSettingsOpen && (
          <View style={styles.kioskModalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeKioskSettings} />
            <View style={styles.kioskModal}>
              <View style={styles.kioskModalHeader}>
                <View>
                  <Text style={styles.kioskModalEyebrow}>KIOSK SETTINGS</Text>
                  <Text style={styles.kioskModalTitle}>
                    {kioskSettingsMode === 'LOGIN' ? 'Đăng nhập nhân viên' : 'Chọn màn hình kiosk'}
                  </Text>
                </View>
                <Pressable onPress={closeKioskSettings} style={styles.kioskModalCloseBtn}>
                  <Text style={styles.kioskModalCloseText}>×</Text>
                </Pressable>
              </View>

              {kioskSettingsMode === 'LOGIN' ? (
                <View style={styles.kioskLoginForm}>
                  <TextInput
                    value={staffEmail}
                    onChangeText={setStaffEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="Email nhân viên"
                    placeholderTextColor="rgba(190, 199, 212, 0.52)"
                    style={styles.kioskInput}
                  />
                  <TextInput
                    value={staffPassword}
                    onChangeText={setStaffPassword}
                    secureTextEntry
                    placeholder="Mật khẩu"
                    placeholderTextColor="rgba(190, 199, 212, 0.52)"
                    style={styles.kioskInput}
                  />
                  {kioskSettingsError && <Text style={styles.kioskSettingsError}>{kioskSettingsError}</Text>}
                  <Pressable
                    onPress={handleStaffLogin}
                    disabled={isKioskSettingsLoading}
                    style={({ pressed }) => [
                      styles.kioskPrimaryBtn,
                      isKioskSettingsLoading && styles.kioskPrimaryBtnDisabled,
                      pressed && { opacity: 0.88 },
                    ]}
                  >
                    <Text style={styles.kioskPrimaryBtnText}>
                      {isKioskSettingsLoading ? 'Đang xác thực...' : 'Đăng nhập'}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.kioskSelectWrap}>
                  {isKioskSettingsLoading || kioskSuccessMessage ? (
                    <View style={styles.kioskSavingBox}>
                      {kioskSuccessMessage ? (
                        <View style={styles.kioskSuccessMark}>
                          <Text style={styles.kioskSuccessMarkText}>✓</Text>
                        </View>
                      ) : (
                        <ActivityIndicator size="large" color={C.primary} />
                      )}
                      <Text style={styles.kioskSavingTitle}>
                        {kioskSuccessMessage ? 'Cấu hình thành công' : 'Đang lưu cấu hình...'}
                      </Text>
                      <Text style={styles.kioskSavingText}>
                        {kioskSuccessMessage || 'Vui lòng chờ trong giây lát.'}
                      </Text>
                    </View>
                  ) : (
                    <>
                      {kioskSettingsError && <Text style={styles.kioskSettingsError}>{kioskSettingsError}</Text>}
                      <ScrollView style={styles.kioskList} contentContainerStyle={styles.kioskListContent}>
                        {kiosks.length === 0 ? (
                          <Text style={styles.kioskEmptyText}>Không có kiosk đang hoạt động.</Text>
                        ) : kiosks.map(kiosk => {
                          const selected = selectedKiosk?.id === kiosk.id;
                          return (
                            <Pressable
                              key={kiosk.id}
                              onPress={() => handleSelectKiosk(kiosk)}
                              style={({ pressed }) => [
                                styles.kioskOption,
                                selected && styles.kioskOptionSelected,
                                pressed && { opacity: 0.88 },
                              ]}
                            >
                              <View style={styles.kioskOptionTop}>
                                <Text style={styles.kioskOptionName}>{kiosk.name}</Text>
                                <Text style={styles.kioskOptionId}>#{kiosk.id}</Text>
                              </View>
                              <Text style={styles.kioskOptionLocation}>{kiosk.location || 'Chưa có vị trí'}</Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </>
                  )}
                </View>
              )}
            </View>
          </View>
        )}

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
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

/* ───── Shared Styles ───── */
const s = StyleSheet.create({
  glassBadgeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.glassBg,
    borderWidth: 1,
    borderColor: C.white10,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    } as any : {}),
  },
  glassBadgeIcon: {
    fontSize: 18,
    color: C.primary,
  },
  glassBadgeText: {
    color: C.onSurface,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1.5,
  },
});

interface ResponsiveParams {
  width: number;
  height: number;
  isWide: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isShort: boolean;
}

function createStyles({ width, height, isWide, isTablet, isDesktop, isShort }: ResponsiveParams) {
  return StyleSheet.create({
    pureDateText: {
      color: '#98cbff',
      fontSize: isDesktop ? 28 : (isTablet ? 20 : 16),
      fontWeight: '800',
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      letterSpacing: 2,
    },
    flex1: { flex: 1 },
    screen: {
      flex: 1,
      backgroundColor: C.bg,
      minHeight: Platform.OS === 'web' ? ('100vh' as any) : undefined,
    },
    layout: {
      flex: 1,
      flexDirection: isWide ? 'row' : 'column',
    },

    /* ── Left Panel ── */
    leftPanel: {
      flex: isDesktop ? 0.44 : (isTablet ? 0.36 : undefined),
      minHeight: isWide ? undefined : 180,
      justifyContent: 'space-between',
      padding: isDesktop ? 56 : (isTablet ? 32 : 24),
      position: 'relative',
      overflow: 'hidden',
    },
    dateContainer: {
      position: 'absolute',
      top: isDesktop ? 56 : 24,
      right: isDesktop ? 48 : 20,
      zIndex: 10,
    },
    leftHeaderGroup: {
      zIndex: 1,
      alignSelf: 'flex-start',
    },
    brandLogo: {
      color: C.primary,
      fontSize: isDesktop ? 76 : (isTablet ? 48 : 36),
      fontWeight: '900',
      letterSpacing: -1.5,
      marginBottom: isTablet ? 8 : 12,
    },
    heroTitle: {
      color: C.onSurface,
      fontSize: isDesktop ? 44 : (isTablet ? 30 : 24),
      fontWeight: '800',
      lineHeight: isDesktop ? 52 : (isTablet ? 38 : 30),
      marginBottom: isTablet ? 14 : 20,
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(26,28,28,0.4)',
      borderWidth: 1,
      borderColor: C.white10,
      borderRadius: 999,
      paddingHorizontal: isTablet ? 12 : 16,
      paddingVertical: isTablet ? 6 : 8,
      ...(Platform.OS === 'web' ? {
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      } as any : {}),
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: C.primary,
    },
    statusLabel: {
      color: C.primary,
      fontSize: isTablet ? 12 : 14,
      fontWeight: '600',
      letterSpacing: 0.7,
    },

    /* ── Right Panel ── */
    rightPanel: {
      flex: isDesktop ? 0.56 : (isTablet ? 0.64 : 1),
      backgroundColor: C.bg,
      borderLeftWidth: isWide ? 1 : 0,
      borderTopWidth: isWide ? 0 : 1,
      borderColor: C.white10,
      position: 'relative',
      overflow: 'hidden',
    },
    rightScroll: {
      flex: 1,
      width: '100%',
    },
    topControlRow: {
      position: 'absolute',
      top: isDesktop ? 48 : (isTablet ? 20 : 14),
      right: isDesktop ? 48 : (isTablet ? 20 : 14),
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      zIndex: 10,
    },
    kioskGearBtn: {
      width: isDesktop ? 44 : 40,
      height: isDesktop ? 44 : 40,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(26, 34, 53, 0.52)',
      borderWidth: 1,
      borderColor: 'rgba(152, 203, 255, 0.2)',
      shadowColor: C.primaryDeep,
      shadowOpacity: 0.24,
      shadowRadius: 18,
    },
    kioskGearIcon: {
      color: C.primary,
      fontSize: isDesktop ? 22 : 19,
      fontWeight: '900',
      lineHeight: isDesktop ? 24 : 21,
    },
    rightCenter: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: isDesktop ? 36 : (isTablet ? 20 : 16),
      paddingTop: isDesktop ? 48 : (isTablet ? 24 : 20),
      paddingBottom: isDesktop ? 32 : (isTablet ? 20 : 16),
    },
    centerBox: {
      width: '100%',
      maxWidth: 480,
      alignItems: 'center',
    },
    voiceSelectBox: {
      width: '100%',
      maxWidth: isDesktop ? 760 : (isTablet ? 640 : 430),
      alignItems: 'center',
      backgroundColor: 'rgba(5, 10, 26, 0.46)',
      borderWidth: 1,
      borderColor: 'rgba(152, 203, 255, 0.16)',
      borderRadius: 20,
      paddingHorizontal: isDesktop ? 28 : (isTablet ? 18 : 16),
      paddingVertical: isDesktop ? 22 : (isTablet ? 16 : 14),
      shadowColor: C.primaryDeep,
      shadowOpacity: 0.18,
      shadowRadius: 34,
      ...(Platform.OS === 'web' ? {
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      } as any : {}),
    },
    voiceEyebrow: {
      color: C.primaryDeep,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 2.2,
      marginBottom: 6,
    },
    voiceTitle: {
      color: C.primary,
      fontSize: isDesktop ? 26 : (isTablet ? 21 : 18),
      fontWeight: '900',
      letterSpacing: 0.3,
      marginBottom: 6,
      textAlign: 'center',
    },
    voiceSubtitle: {
      color: C.onSurfaceVariant,
      fontSize: isDesktop ? 13 : (isTablet ? 12 : 11),
      lineHeight: isDesktop ? 19 : (isTablet ? 17 : 16),
      textAlign: 'center',
      maxWidth: isDesktop ? 520 : 460,
      marginBottom: isShort ? 12 : 16,
    },
    voiceErrorBox: {
      width: '100%',
      alignItems: 'center',
      paddingVertical: 12,
    },
    voiceRetryBtn: {
      borderWidth: 1,
      borderColor: 'rgba(0, 163, 255, 0.34)',
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 9,
      backgroundColor: 'rgba(0, 163, 255, 0.12)',
    },
    voiceRetryText: {
      color: C.primary,
      fontSize: 12,
      fontWeight: '800',
    },
    voiceGrid: {
      width: '100%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: isDesktop ? 12 : 8,
      columnGap: isDesktop ? 12 : 8,
      marginBottom: isShort ? 14 : 18,
    },
    voiceCard: {
      width: isWide ? '48.5%' : '100%',
      minHeight: isDesktop ? 148 : (isTablet ? 126 : 120),
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(152, 203, 255, 0.16)',
      backgroundColor: 'rgba(9, 18, 36, 0.72)',
      padding: isDesktop ? 14 : (isTablet ? 11 : 10),
      overflow: 'hidden',
    },
    voiceCardSelected: {
      borderColor: 'rgba(0, 163, 255, 0.76)',
      backgroundColor: 'rgba(0, 163, 255, 0.14)',
      shadowColor: C.primaryDeep,
      shadowOpacity: 0.28,
      shadowRadius: 22,
    },
    voiceCardTopLine: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: isDesktop ? 8 : 5,
    },
    voiceCode: {
      color: 'rgba(152, 203, 255, 0.62)',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.4,
    },
    voiceSelectedPill: {
      color: C.primary,
      fontSize: 8.5,
      fontWeight: '900',
      letterSpacing: 1,
      borderWidth: 1,
      borderColor: 'rgba(152, 203, 255, 0.34)',
      borderRadius: 999,
      paddingHorizontal: 7,
      paddingVertical: 2,
      backgroundColor: 'rgba(152, 203, 255, 0.1)',
    },
    voiceCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: isDesktop ? 10 : 8,
      marginBottom: isDesktop ? 8 : 5,
    },
    voiceAvatar: {
      width: isDesktop ? 42 : 36,
      height: isDesktop ? 42 : 36,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(152, 203, 255, 0.18)',
      backgroundColor: 'rgba(0, 163, 255, 0.1)',
      shadowColor: C.primaryDeep,
      shadowOpacity: 0.22,
      shadowRadius: 16,
    },
    voiceAvatarSelected: {
      borderColor: C.primary,
      backgroundColor: 'rgba(152, 203, 255, 0.2)',
    },
    voiceAvatarText: {
      color: C.primary,
      fontSize: isDesktop ? 16 : 14,
      fontWeight: '900',
    },
    voiceCardTitleWrap: {
      flex: 1,
      minWidth: 0,
    },
    voiceName: {
      color: C.onSurface,
      fontSize: isDesktop ? 14 : 12.5,
      fontWeight: '800',
      marginBottom: 2,
    },
    voiceMeta: {
      color: 'rgba(152, 203, 255, 0.72)',
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    voiceDescription: {
      color: C.onSurfaceVariant,
      fontSize: isDesktop ? 11.5 : 10.5,
      lineHeight: isDesktop ? 16 : 14.5,
      minHeight: isDesktop ? 32 : 28,
      marginBottom: isDesktop ? 8 : 5,
    },
    voiceCardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginTop: 'auto',
    },
    voiceSignal: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 20,
      gap: 3,
      opacity: 0.48,
    },
    voiceSignalActive: {
      opacity: 1,
    },
    voiceSignalPlaying: {
      opacity: 1,
    },
    voiceSignalBar: {
      width: 3,
      height: 12,
      borderRadius: 2,
      backgroundColor: C.primary,
      shadowColor: C.primaryDeep,
      shadowOpacity: 0.34,
      shadowRadius: 8,
    },
    voiceSignalBarSoft: {
      height: 8,
      backgroundColor: C.primaryDeep,
    },
    voiceTapHint: {
      color: 'rgba(152, 203, 255, 0.62)',
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    voiceTapHintActive: {
      color: C.primary,
    },
    voiceActionRow: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    voiceBackBtn: {
      borderRadius: 999,
      paddingHorizontal: isDesktop ? 18 : 14,
      paddingVertical: isDesktop ? 11 : 9,
      borderWidth: 1,
      borderColor: 'rgba(148, 163, 184, 0.2)',
      backgroundColor: 'rgba(15, 23, 42, 0.45)',
    },
    voiceBackText: {
      color: C.onSurfaceVariant,
      fontSize: isDesktop ? 13 : 12,
      fontWeight: '800',
    },
    voiceStartBtn: {
      flex: 1,
      alignItems: 'center',
      borderRadius: 999,
      paddingHorizontal: isDesktop ? 20 : 16,
      paddingVertical: isDesktop ? 12 : 10,
      backgroundColor: C.primaryDeep,
      shadowColor: C.primaryDeep,
      shadowOpacity: 0.38,
      shadowRadius: 18,
    },
    voiceStartBtnDisabled: {
      opacity: 0.42,
    },
    voiceStartText: {
      color: '#FFFFFF',
      fontSize: isDesktop ? 13 : 12,
      fontWeight: '900',
      letterSpacing: 0.6,
    },

    /* ── PIN Workspace ── */
    instruction: {
      color: C.onSurfaceVariant,
      fontSize: isDesktop ? 18 : (isTablet ? 15 : 14),
      fontWeight: '400',
      lineHeight: isDesktop ? 28 : (isTablet ? 22 : 20),
      textAlign: 'center',
      marginBottom: 10,
    },
    currentKioskText: {
      color: 'rgba(152, 203, 255, 0.74)',
      fontSize: isDesktop ? 12 : 10.5,
      fontWeight: '800',
      textAlign: 'center',
      marginBottom: isTablet ? 18 : 28,
      letterSpacing: 0.4,
    },
    pinRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: isDesktop ? 16 : 10,
      marginBottom: isTablet ? 20 : 32,
    },
    pinSlot: {
      width: isDesktop ? 48 : (isTablet ? 40 : 36),
      height: isDesktop ? 48 : (isTablet ? 40 : 36),
      borderRadius: 999,
      backgroundColor: C.slotBg,
      borderWidth: 1.5,
      borderColor: C.slotBorder,
    },
    pinSlotFilled: {
      backgroundColor: C.slotFilledBg,
      borderColor: C.slotFilledBg,
      shadowColor: C.slotFilledBg,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 16,
      elevation: 8,
    },
    pinSlotError: {
      borderColor: '#EF4444',
      backgroundColor: 'rgba(239, 68, 68, 0.2)',
    },
    verifyingText: {
      color: C.primary,
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 24,
    },
    initLoaderBox: {
      width: '100%',
      maxWidth: isDesktop ? 520 : (isTablet ? 440 : 350),
      alignItems: 'center',
      borderRadius: 34,
      backgroundColor: 'rgba(5, 10, 26, 0.2)',
      paddingHorizontal: isDesktop ? 42 : 24,
      paddingVertical: isDesktop ? 38 : 26,
      shadowColor: C.primaryDeep,
      shadowOpacity: 0.18,
      shadowRadius: 46,
      ...(Platform.OS === 'web' ? {
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
      } as any : {}),
    },
    initOrbWrap: {
      width: isTablet ? 104 : 128,
      height: isTablet ? 104 : 128,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: isTablet ? 18 : 26,
    },
    initOrbPulse: {
      position: 'absolute',
      width: isTablet ? 86 : 104,
      height: isTablet ? 86 : 104,
      borderRadius: 999,
      borderWidth: 12,
      borderColor: 'rgba(0, 163, 255, 0.08)',
      backgroundColor: 'rgba(152, 203, 255, 0.04)',
    },
    initOrbSpinner: {
      position: 'absolute',
      width: isTablet ? 96 : 116,
      height: isTablet ? 96 : 116,
      borderRadius: 999,
      borderWidth: 2,
      borderColor: 'rgba(152, 203, 255, 0.08)',
      borderTopColor: C.primaryDeep,
      borderRightColor: 'rgba(152, 203, 255, 0.34)',
    },
    initOrbCore: {
      width: isTablet ? 68 : 82,
      height: isTablet ? 68 : 82,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(152, 203, 255, 0.28)',
      backgroundColor: 'rgba(8, 20, 40, 0.78)',
      shadowColor: C.primaryDeep,
      shadowOpacity: 0.24,
      shadowRadius: 32,
    },
    initOrbDot: {
      position: 'absolute',
      top: isTablet ? 14 : 18,
      right: isTablet ? 16 : 21,
      width: 6,
      height: 6,
      borderRadius: 999,
      backgroundColor: C.primaryDeep,
      shadowColor: C.primaryDeep,
      shadowOpacity: 0.55,
      shadowRadius: 8,
    },
    initOrbText: {
      color: C.primary,
      fontSize: 21,
      fontWeight: '900',
      letterSpacing: 1.4,
    },
    initColdStartMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: isTablet ? 12 : 18,
    },
    initMetaLine: {
      width: isDesktop ? 70 : 44,
      height: 1,
      backgroundColor: 'rgba(0, 163, 255, 0.26)',
    },
    initMetaText: {
      color: 'rgba(152, 203, 255, 0.66)',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 2.4,
      textTransform: 'uppercase',
    },
    initTextBlock: {
      width: '100%',
      alignItems: 'center',
      minHeight: isDesktop ? 94 : (isTablet ? 76 : 84),
      justifyContent: 'center',
      marginBottom: 14,
    },
    initTitle: {
      color: C.onSurface,
      fontSize: isDesktop ? 24 : (isTablet ? 18 : 17),
      fontWeight: '900',
      textAlign: 'center',
      letterSpacing: 0.2,
      marginBottom: 6,
    },
    initDetail: {
      color: 'rgba(190, 199, 212, 0.72)',
      fontSize: isDesktop ? 14 : (isTablet ? 12 : 11),
      fontWeight: '600',
      lineHeight: isDesktop ? 22 : (isTablet ? 18 : 16),
      textAlign: 'center',
      maxWidth: 420,
    },
    initFootnote: {
      color: 'rgba(152, 203, 255, 0.36)',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 2,
    },
    errorText: {
      color: '#EF4444',
      fontSize: 14,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 24,
      paddingHorizontal: 16,
    },
    kioskModalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 100,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: isDesktop ? 36 : 18,
      backgroundColor: 'rgba(5, 10, 26, 0.62)',
    },
    kioskModal: {
      width: '100%',
      maxWidth: 460,
      maxHeight: '82%',
      borderRadius: 16,
      backgroundColor: 'rgba(8, 17, 32, 0.94)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(152, 203, 255, 0.13)',
      padding: isDesktop ? 22 : 18,
      shadowColor: C.primaryDeep,
      shadowOpacity: 0.14,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      ...(Platform.OS === 'web' ? {
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
      } as any : {}),
    },
    kioskModalHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 18,
    },
    kioskModalEyebrow: {
      color: C.primaryDeep,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 2,
      marginBottom: 5,
    },
    kioskModalTitle: {
      color: C.onSurface,
      fontSize: isDesktop ? 20 : 18,
      fontWeight: '900',
    },
    kioskModalCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.035)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(190, 199, 212, 0.12)',
    },
    kioskModalCloseText: {
      color: C.onSurfaceVariant,
      fontSize: 24,
      lineHeight: 26,
      fontWeight: '500',
    },
    kioskLoginForm: {
      gap: 12,
    },
    kioskInput: {
      width: '100%',
      minHeight: 48,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(152, 203, 255, 0.12)',
      backgroundColor: 'rgba(5, 10, 26, 0.42)',
      color: C.onSurface,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      fontWeight: '600',
      ...(Platform.OS === 'web' ? {
        outlineStyle: 'none',
      } as any : {}),
    },
    kioskSettingsError: {
      color: '#FCA5A5',
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 18,
    },
    kioskPrimaryBtn: {
      minHeight: 46,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.primaryDeep,
      marginTop: 4,
    },
    kioskPrimaryBtnDisabled: {
      opacity: 0.52,
    },
    kioskPrimaryBtnText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 0.8,
    },
    kioskSelectWrap: {
      minHeight: 160,
    },
    kioskSavingBox: {
      minHeight: 180,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 22,
      gap: 8,
    },
    kioskSuccessMark: {
      width: 34,
      height: 34,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(152, 203, 255, 0.28)',
      backgroundColor: 'rgba(0, 163, 255, 0.12)',
    },
    kioskSuccessMarkText: {
      color: C.primary,
      fontSize: 20,
      fontWeight: '900',
    },
    kioskSavingTitle: {
      color: C.onSurface,
      fontSize: 16,
      fontWeight: '900',
      marginTop: 8,
    },
    kioskSavingText: {
      color: 'rgba(190, 199, 212, 0.72)',
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'center',
    },
    kioskList: {
      maxHeight: isDesktop ? 360 : 300,
    },
    kioskListContent: {
      gap: 10,
      paddingBottom: 2,
    },
    kioskEmptyText: {
      color: C.onSurfaceVariant,
      fontSize: 13,
      fontWeight: '700',
      textAlign: 'center',
      paddingVertical: 24,
    },
    kioskOption: {
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(152, 203, 255, 0.11)',
      backgroundColor: 'rgba(15, 23, 42, 0.48)',
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    kioskOptionSelected: {
      borderColor: 'rgba(152, 203, 255, 0.28)',
      backgroundColor: 'rgba(0, 163, 255, 0.1)',
    },
    kioskOptionTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 4,
    },
    kioskOptionName: {
      flex: 1,
      color: C.onSurface,
      fontSize: 14,
      fontWeight: '900',
    },
    kioskOptionId: {
      color: C.primary,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.8,
    },
    kioskOptionLocation: {
      color: 'rgba(190, 199, 212, 0.72)',
      fontSize: 12,
      fontWeight: '700',
    },

    /* ── Keypad ── */
    keypad: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: isDesktop ? 24 : (isTablet ? 14 : 12),
      width: '100%',
      maxWidth: isDesktop ? 360 : 320,
    },
    key: {
      width: isDesktop ? 100 : (isTablet ? 84 : 76),
      height: isDesktop ? 80 : (isTablet ? 62 : 56),
      borderRadius: 16,
      backgroundColor: C.keyBg,
      borderWidth: 1,
      borderColor: C.white10,
      alignItems: 'center',
      justifyContent: 'center',
      ...(Platform.OS === 'web' ? {
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      } as any : {}),
    },
    keyPressed: {
      backgroundColor: C.keyPressBg,
      borderColor: C.primary,
      transform: [{ scale: 0.95 }],
    },
    keyText: {
      color: C.onSurface,
      fontSize: isDesktop ? 32 : (isTablet ? 24 : 20),
      fontWeight: '700',
    },
    keyActionText: {
      fontSize: isDesktop ? 14 : 12,
      fontWeight: '600',
      color: C.onSurfaceVariant,
      letterSpacing: 0.7,
    },

    footerBar: {
      height: isDesktop ? 48 : (isTablet ? 42 : 58),
      borderTopWidth: 1,
      borderColor: 'rgba(152, 203, 255, 0.08)',
      flexDirection: isWide ? 'row' : 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: isWide ? 0 : 6,
      paddingHorizontal: isDesktop ? 64 : (isTablet ? 32 : 22),
      paddingVertical: isWide ? 0 : 9,
      backgroundColor: 'rgba(5, 10, 26, 0.55)',
    },
    footerMetaGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: isWide ? 13 : 9,
    },
    footerDivider: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: 'rgba(148, 163, 184, 0.38)',
    },
    footerText: {
      color: 'rgba(148, 163, 184, 0.7)',
      fontSize: isDesktop ? 11 : 9,
      fontWeight: '800',
      letterSpacing: isDesktop ? 2.4 : 1.5,
    },
  });
}

export default App;
