import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AIInterviewRoom } from './src/components/AIInterviewRoom';
import {
  enterKioskApi,
  getAvailableVoicesApi,
  resolveApiAssetUrl,
  type VoiceOption,
} from './src/lib/api';

const PIN_LENGTH = 6;

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

  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#050A1A' }]} />;
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

/* ───── Main App Controller ───── */
function App() {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [screenState, setScreenState] = useState<AppScreenState>('PIN_ENTRY');
  const [pin, setPin] = useState('');
  const [aiSessionKey, setAiSessionKey] = useState('');
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState('');
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const previewAudioRef = useRef<any>(null);
  const initPulse = useRef(new Animated.Value(0)).current;
  const initSpin = useRef(new Animated.Value(0)).current;
  const initTextFade = useRef(new Animated.Value(1)).current;
  const [initStepIndex, setInitStepIndex] = useState(0);

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
    setIsVerifying(true);
    setAuthError(null);
    Keyboard.dismiss();

    try {
      const res = await enterKioskApi(targetPin);
      setAiSessionKey(res.aiSessionKey || targetPin);
      setIsVerifying(false);
      setScreenState('VOICE_SELECT');
      void loadVoices();
    } catch (err: any) {
      console.warn('Kiosk Auth Failed:', err);
      setIsVerifying(false);
      let rawErr = err.message || 'Xác thực không thành công. Vui lòng thử lại!';
      if (rawErr.toLowerCase().includes('booking not found')) {
        rawErr = 'Không tìm thấy lịch hẹn phỏng vấn cho mã PIN này!';
      }
      setAuthError(rawErr);
      setPin('');
    }
  }, [loadVoices]);

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

  const handleVoiceConfirmed = () => {
    setScreenState('AI_ROOM');
  };

  const handleVoiceSelectCancelled = () => {
    setPin('');
    setAiSessionKey('');
    setSelectedVoiceId('');
    setVoices([]);
    setAuthError(null);
    setVoiceError(null);
    setScreenState('PIN_ENTRY');
  };

  const handlePreviewVoice = useCallback((voice: VoiceOption) => {
    if (Platform.OS !== 'web') return;

    try {
      previewAudioRef.current?.pause?.();
      const audio = new Audio(resolveApiAssetUrl(voice.previewUrl));
      previewAudioRef.current = audio;
      setPreviewingVoiceId(voice.id);
      audio.onended = () => setPreviewingVoiceId(null);
      audio.onerror = () => setPreviewingVoiceId(null);
      void audio.play();
    } catch (err) {
      console.warn('Voice preview failed:', err);
      setPreviewingVoiceId(null);
    }
  }, []);

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
      Animated.timing(initSpin, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
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
    };
  }, []);

  const handleFinishAIRoom = () => {
    setPin('');
    setAiSessionKey('');
    setSelectedVoiceId('');
    setVoices([]);
    setAuthError(null);
    setVoiceError(null);
    setScreenState('PIN_ENTRY');
  };

  const safeVoices = Array.isArray(voices) ? voices : [];
  const styles = useMemo(() => createStyles(isWide), [isWide]);
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

              {/* Clock - Top Right of Right Panel */}
              <View style={styles.clockContainer}>
                <Clock />
              </View>

              {/* Center Interaction Workspace */}
              <View style={styles.rightCenter}>
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
                              onPress={() => setSelectedVoiceId(voice.id)}
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
                                  <Text style={styles.voiceName}>{voice.name}</Text>
                                  <Text style={styles.voiceMeta}>{selected ? 'Đang chọn' : 'Có thể chọn'}</Text>
                                </View>
                              </View>
                              <Text style={styles.voiceDescription}>{voice.description}</Text>
                              <View style={styles.voiceCardFooter}>
                                <View style={[styles.voiceSignal, selected && styles.voiceSignalActive]}>
                                  <View style={styles.voiceSignalBarShort} />
                                  <View style={styles.voiceSignalBarTall} />
                                  <View style={styles.voiceSignalBarMid} />
                                </View>
                                {Platform.OS === 'web' && (
                                <Pressable
                                  onPress={(event: any) => {
                                    event?.stopPropagation?.();
                                    handlePreviewVoice(voice);
                                  }}
                                  style={({ pressed }) => [styles.voicePreviewBtn, pressed && { opacity: 0.8 }]}
                                >
                                  <Text style={styles.voicePreviewText}>{previewing ? 'Đang nghe...' : 'Nghe thử'}</Text>
                                </Pressable>
                                )}
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
                  <LockOpenIcon />

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
                              delayPressIn={0}
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
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>

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

function createStyles(isWide: boolean) {
  return StyleSheet.create({
    pureDateText: {
      color: '#98cbff',
      fontSize: isWide ? 28 : 20,
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
      flex: isWide ? 0.5 : undefined,
      minHeight: isWide ? undefined : 200,
      justifyContent: 'space-between',
      padding: isWide ? 64 : 28,
      position: 'relative',
      overflow: 'hidden',
    },
    dateContainer: {
      position: 'absolute',
      top: isWide ? 64 : 20,
      right: isWide ? 56 : 24,
      zIndex: 10,
    },
    leftHeaderGroup: {
      zIndex: 1,
      alignSelf: 'flex-start',
    },
    brandLogo: {
      color: C.primary,
      fontSize: isWide ? 84 : 44,
      fontWeight: '900',
      letterSpacing: -2,
      marginBottom: 12,
    },
    heroTitle: {
      color: C.onSurface,
      fontSize: isWide ? 50 : 28,
      fontWeight: '800',
      lineHeight: isWide ? 58 : 34,
      marginBottom: 20,
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
      paddingHorizontal: 16,
      paddingVertical: 8,
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
      fontSize: 14,
      fontWeight: '600',
      letterSpacing: 0.7,
    },
    /* ── Right Panel ── */
    rightPanel: {
      flex: isWide ? 0.5 : 1,
      backgroundColor: C.bg,
      borderLeftWidth: isWide ? 1 : 0,
      borderTopWidth: isWide ? 0 : 1,
      borderColor: C.white10,
      position: 'relative',
      overflow: 'hidden',
    },
    clockContainer: {
      position: 'absolute',
      top: isWide ? 64 : 16,
      right: isWide ? 64 : 16,
      zIndex: 10,
    },
    rightCenter: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: isWide ? 48 : 20,
      paddingTop: isWide ? 80 : 60,
      paddingBottom: 24,
    },
    centerBox: {
      width: '100%',
      maxWidth: 480,
      alignItems: 'center',
    },
    voiceSelectBox: {
      width: '100%',
      maxWidth: isWide ? 720 : 430,
      alignItems: 'center',
      backgroundColor: 'rgba(5, 10, 26, 0.46)',
      borderWidth: 1,
      borderColor: 'rgba(152, 203, 255, 0.16)',
      borderRadius: 24,
      paddingHorizontal: isWide ? 34 : 20,
      paddingVertical: isWide ? 32 : 22,
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
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 2.6,
      marginBottom: 10,
    },
    voiceTitle: {
      color: C.primary,
      fontSize: isWide ? 30 : 24,
      fontWeight: '900',
      letterSpacing: 0.4,
      marginBottom: 10,
      textAlign: 'center',
    },
    voiceSubtitle: {
      color: C.onSurfaceVariant,
      fontSize: isWide ? 14 : 13,
      lineHeight: isWide ? 22 : 20,
      textAlign: 'center',
      maxWidth: 520,
      marginBottom: 22,
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
      gap: 14,
      justifyContent: 'center',
      marginBottom: 24,
    },
    voiceCard: {
      width: isWide ? '47.8%' : '100%',
      minHeight: 162,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: 'rgba(152, 203, 255, 0.16)',
      backgroundColor: 'rgba(9, 18, 36, 0.72)',
      padding: 16,
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
      marginBottom: 12,
    },
    voiceCode: {
      color: 'rgba(152, 203, 255, 0.62)',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.8,
    },
    voiceSelectedPill: {
      color: C.primary,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.2,
      borderWidth: 1,
      borderColor: 'rgba(152, 203, 255, 0.34)',
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: 'rgba(152, 203, 255, 0.1)',
    },
    voiceCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 12,
    },
    voiceAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
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
      fontSize: 19,
      fontWeight: '900',
    },
    voiceCardTitleWrap: {
      flex: 1,
    },
    voiceName: {
      color: C.onSurface,
      fontSize: 15,
      fontWeight: '900',
      marginBottom: 4,
    },
    voiceMeta: {
      color: 'rgba(152, 203, 255, 0.72)',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    voiceDescription: {
      color: C.onSurfaceVariant,
      fontSize: 12,
      lineHeight: 18,
      minHeight: 44,
      marginBottom: 14,
    },
    voiceCardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginTop: 'auto',
    },
    voiceSignal: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      opacity: 0.48,
    },
    voiceSignalActive: {
      opacity: 1,
    },
    voiceSignalBarShort: {
      width: 3,
      height: 9,
      borderRadius: 3,
      backgroundColor: C.primaryDeep,
    },
    voiceSignalBarTall: {
      width: 3,
      height: 18,
      borderRadius: 3,
      backgroundColor: C.primary,
    },
    voiceSignalBarMid: {
      width: 3,
      height: 13,
      borderRadius: 3,
      backgroundColor: C.primaryDeep,
    },
    voicePreviewBtn: {
      alignSelf: 'flex-end',
      borderWidth: 1,
      borderColor: 'rgba(152, 203, 255, 0.18)',
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
      backgroundColor: 'rgba(152, 203, 255, 0.08)',
    },
    voicePreviewText: {
      color: C.primary,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
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
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: 'rgba(148, 163, 184, 0.2)',
      backgroundColor: 'rgba(15, 23, 42, 0.45)',
    },
    voiceBackText: {
      color: C.onSurfaceVariant,
      fontSize: 13,
      fontWeight: '800',
    },
    voiceStartBtn: {
      flex: 1,
      alignItems: 'center',
      borderRadius: 999,
      paddingHorizontal: 20,
      paddingVertical: 13,
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
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 0.8,
    },

    /* ── PIN Workspace ── */
    instruction: {
      color: C.onSurfaceVariant,
      fontSize: isWide ? 18 : 15,
      fontWeight: '400',
      lineHeight: isWide ? 28 : 22,
      textAlign: 'center',
      marginBottom: 28,
    },
    pinRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: isWide ? 16 : 12,
      marginBottom: 32,
    },
    pinSlot: {
      width: isWide ? 48 : 40,
      height: isWide ? 48 : 40,
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
      maxWidth: isWide ? 520 : 350,
      alignItems: 'center',
      borderRadius: 34,
      backgroundColor: 'rgba(5, 10, 26, 0.2)',
      paddingHorizontal: isWide ? 42 : 24,
      paddingVertical: isWide ? 38 : 30,
      shadowColor: C.primaryDeep,
      shadowOpacity: 0.18,
      shadowRadius: 46,
      ...(Platform.OS === 'web' ? {
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
      } as any : {}),
    },
    initOrbWrap: {
      width: 128,
      height: 128,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 26,
    },
    initOrbPulse: {
      position: 'absolute',
      width: 104,
      height: 104,
      borderRadius: 999,
      borderWidth: 12,
      borderColor: 'rgba(0, 163, 255, 0.08)',
      backgroundColor: 'rgba(152, 203, 255, 0.04)',
    },
    initOrbSpinner: {
      position: 'absolute',
      width: 116,
      height: 116,
      borderRadius: 999,
      borderWidth: 2,
      borderColor: 'rgba(152, 203, 255, 0.08)',
      borderTopColor: C.primaryDeep,
      borderRightColor: 'rgba(152, 203, 255, 0.34)',
    },
    initOrbCore: {
      width: 82,
      height: 82,
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
      top: 18,
      right: 21,
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
      marginBottom: 18,
    },
    initMetaLine: {
      width: isWide ? 70 : 48,
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
      minHeight: isWide ? 94 : 104,
      justifyContent: 'center',
      marginBottom: 14,
    },
    initTitle: {
      color: C.onSurface,
      fontSize: isWide ? 24 : 19,
      fontWeight: '900',
      textAlign: 'center',
      letterSpacing: 0.2,
      marginBottom: 10,
    },
    initDetail: {
      color: 'rgba(190, 199, 212, 0.72)',
      fontSize: isWide ? 14 : 12,
      fontWeight: '600',
      lineHeight: isWide ? 22 : 19,
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

    /* ── Keypad ── */
    keypad: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: isWide ? 24 : 16,
      width: '100%',
      maxWidth: 360,
    },
    key: {
      width: isWide ? 100 : 88,
      height: isWide ? 80 : 64,
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
      fontSize: isWide ? 32 : 24,
      fontWeight: '700',
    },
    keyActionText: {
      fontSize: isWide ? 14 : 12,
      fontWeight: '600',
      color: C.onSurfaceVariant,
      letterSpacing: 0.7,
    },

    footerBar: {
      height: isWide ? 48 : 58,
      borderTopWidth: 1,
      borderColor: 'rgba(152, 203, 255, 0.08)',
      flexDirection: isWide ? 'row' : 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: isWide ? 0 : 6,
      paddingHorizontal: isWide ? 64 : 22,
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
      fontSize: isWide ? 11 : 9,
      fontWeight: '800',
      letterSpacing: isWide ? 2.4 : 1.5,
    },
  });
}

export default App;
