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
import { HardwareCheckModal } from './src/components/HardwareCheckModal';
import { enterKioskApi } from './src/lib/api';

const PIN_LENGTH = 6;

type AppScreenState = 'PIN_ENTRY' | 'HARDWARE_CHECK' | 'AI_ROOM';

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
  const [isVerifying, setIsVerifying] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Imperative PIN submit handler directly called upon 6-digit entry
  const handlePinSubmit = useCallback(async (targetPin: string) => {
    setIsVerifying(true);
    setAuthError(null);
    Keyboard.dismiss();

    try {
      const res = await enterKioskApi(targetPin);
      setAiSessionKey(res.aiSessionKey || targetPin);
      setIsVerifying(false);
      setScreenState('HARDWARE_CHECK');
    } catch (err: any) {
      console.warn('Kiosk Auth Failed:', err);
      setIsVerifying(false);
      let rawErr = err.message || 'Xác thực không thành công. Vui lòng thử lại!';
      if (rawErr.toLowerCase().includes('booking not found')) {
        rawErr = 'Không tìm thấy lịch hẹn phỏng vấn cho mã PIN này. Vui lòng kiểm tra lại!';
      }
      setAuthError(rawErr);
      setPin('');
    }
  }, []);

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

  const handleHardwareConfirmed = () => {
    setScreenState('AI_ROOM');
  };

  const handleHardwareCancelled = () => {
    setPin('');
    setAuthError(null);
    setScreenState('PIN_ENTRY');
  };

  const handleFinishAIRoom = () => {
    setPin('');
    setAiSessionKey('');
    setAuthError(null);
    setScreenState('PIN_ENTRY');
  };

  const styles = useMemo(() => createStyles(isWide), [isWide]);

  // Render Full Screen AI Room when in AI_ROOM state
  if (screenState === 'AI_ROOM') {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#050A1A" />
        <AIInterviewRoom sessionKey={aiSessionKey} onFinish={handleFinishAIRoom} />
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

              {/* Clean Minimalist Credits Line */}
              {isWide && (
                <Text style={styles.creditsText}>
                  CAPSTONE PROJECT • FPT UNIVERSITY HCM • SOFTWARE ENGINEERING • GVHD: LÂM HỮU KHÁNH PHƯƠNG
                </Text>
              )}
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

              {/* Center PIN Workspace */}
              <View style={styles.rightCenter}>
                <View style={styles.centerBox}>
                  {/* Material Lock Open Icon */}
                  <LockOpenIcon />

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

                  {/* Verifying Spinner / Error Label */}
                  {isVerifying && (
                    <Text style={styles.verifyingText}>Đang kết nối xác thực Kiosk...</Text>
                  )}
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
                </View>
              </View>
            </View>
          </View>

          {/* Hardware Check Dialog Modal */}
          <HardwareCheckModal
            visible={screenState === 'HARDWARE_CHECK'}
            onConfirm={handleHardwareConfirmed}
            onCancel={handleHardwareCancelled}
          />
        </KeyboardAvoidingView>

        {/* Mobile Credits */}
        {!isWide && (
          <Text style={styles.mobileCredits}>
            CAPSTONE PROJECT • FPT UNIVERSITY HCM • SE • GVHD: LÂM HỮU KHÁNH PHƯƠNG
          </Text>
        )}
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
    creditsText: {
      color: 'rgba(190, 199, 212, 0.85)',
      fontSize: isWide ? 14 : 12,
      fontWeight: '800',
      letterSpacing: 1.5,
      zIndex: 1,
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

    /* ── Mobile Credits ── */
    mobileCredits: {
      color: 'rgba(190,199,212,0.4)',
      fontSize: 10,
      fontWeight: '500',
      letterSpacing: 1.5,
      textAlign: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
  });
}

export default App;
