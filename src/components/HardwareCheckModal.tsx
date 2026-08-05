import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

interface HardwareCheckModalProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function HardwareCheckModal({ visible, onConfirm, onCancel }: HardwareCheckModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [isPlayingTestSound, setIsPlayingTestSound] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [micActive, setMicActive] = useState(false);

  // Pulse animation for test audio indicator
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Initialize WebRTC Camera Stream & Audio Analyzer on Web
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;

    let mediaStream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let animFrameId: number;

    async function setupHardware() {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setCameraActive(true);
        setMicActive(true);

        // Setup Audio Analyser for mic volume level meter
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          audioContext = new AudioCtx();
          const source = audioContext.createMediaStreamSource(mediaStream);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          function updateMicLevel() {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
            animFrameId = requestAnimationFrame(updateMicLevel);
          }
          updateMicLevel();
        }
      } catch (err) {
        console.warn('Hardware permission warning:', err);
        setCameraActive(false);
        setMicActive(false);
      }
    }

    setupHardware();

    return () => {
      if (animFrameId) cancelAnimationFrame(animFrameId);
      if (audioContext) audioContext.close();
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [visible]);

  // Test Speaker Sound Playback
  const handleTestSound = () => {
    setIsPlayingTestSound(true);
    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.2, duration: 200, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    if (Platform.OS === 'web') {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, ctx.currentTime); // A4 note
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.6);
        }
      } catch (e) {
        console.warn(e);
      }
    }
    setTimeout(() => setIsPlayingTestSound(false), 800);
  };

  if (!visible) return null;

  return (
    <Modal animationType="fade" transparent visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.dialogCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Text style={{ fontSize: 24 }}>🎥</Text>
            </View>
            <View>
              <Text style={styles.title}>Kiểm Tra Thiết Bị Kiosk</Text>
              <Text style={styles.subtitle}>
                Vui lòng kiểm tra Camera, Micro & Loa trước khi bắt đầu phỏng vấn.
              </Text>
            </View>
          </View>

          {/* Body Content */}
          <View style={styles.bodyRow}>
            {/* Left: Camera Live Preview */}
            <View style={styles.cameraBox}>
              {Platform.OS === 'web' ? (
                <video
                  ref={videoRef as any}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: 16,
                    transform: 'scaleX(-1)', // Mirror preview
                  }}
                />
              ) : (
                <View style={styles.camFallback}>
                  <Text style={{ fontSize: 36, marginBottom: 8 }}>📷</Text>
                  <Text style={{ color: '#98cbff', fontSize: 13 }}>Camera Preview Ready</Text>
                </View>
              )}
              <View style={styles.camBadge}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: cameraActive ? '#00A859' : '#F37021' },
                  ]}
                />
                <Text style={styles.camBadgeText}>
                  {cameraActive ? 'Camera HD Active' : 'Camera Ready'}
                </Text>
              </View>
            </View>

            {/* Right: Audio & Microphone Diagnostic Controls */}
            <View style={styles.diagControls}>
              {/* Mic Test */}
              <View style={styles.diagCard}>
                <View style={styles.diagHeader}>
                  <Text style={styles.diagTitle}>🎤 Microphone (Thu Âm)</Text>
                  <Text style={{ color: micActive ? '#00A859' : '#98cbff', fontSize: 12, fontWeight: '700' }}>
                    {micActive ? 'Hoạt động' : 'Sẵn sàng'}
                  </Text>
                </View>
                {/* Meter Bar */}
                <View style={styles.meterTrack}>
                  <View
                    style={[
                      styles.meterFill,
                      { width: `${Math.max(10, micLevel)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.diagHint}>Nói thử để kiểm tra vạch sóng âm</Text>
              </View>

              {/* Speaker Test */}
              <View style={styles.diagCard}>
                <View style={styles.diagHeader}>
                  <Text style={styles.diagTitle}>🔊 Loa Phát Âm Thanh</Text>
                  <Pressable
                    onPress={handleTestSound}
                    style={({ pressed }) => [styles.testSoundBtn, pressed && { opacity: 0.8 }]}
                  >
                    <Text style={styles.testSoundText}>
                      {isPlayingTestSound ? '🔊 Đang phát...' : '🎵 Thử âm thanh'}
                    </Text>
                  </Pressable>
                </View>
                <Text style={styles.diagHint}>Nhấn nút để nghe tiếng chuông thử</Text>
              </View>
            </View>
          </View>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.cancelBtnText}>Hủy bỏ</Text>
            </Pressable>

            <Pressable
              onPress={onConfirm}
              style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
            >
              <Text style={styles.startBtnText}>Bắt Đầu Phỏng Vấn AI →</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 26, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
    } as any : {}),
  },
  dialogCard: {
    width: '100%',
    maxWidth: 720,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(152, 203, 255, 0.25)',
    borderRadius: 24,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 28,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(152, 203, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(152, 203, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#F1F5F9',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  bodyRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 20,
    marginBottom: 32,
  },
  cameraBox: {
    flex: 1,
    height: 220,
    borderRadius: 16,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  camFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  camBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  camBadgeText: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '600',
  },
  diagControls: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 16,
  },
  diagCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 16,
  },
  diagHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  diagTitle: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '700',
  },
  meterTrack: {
    width: '100%',
    height: 10,
    backgroundColor: '#020617',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 6,
  },
  meterFill: {
    height: '100%',
    backgroundColor: '#00A3FF',
    borderRadius: 5,
  },
  diagHint: {
    color: '#94A3B8',
    fontSize: 12,
  },
  testSoundBtn: {
    backgroundColor: 'rgba(0, 163, 255, 0.2)',
    borderWidth: 1,
    borderColor: '#00A3FF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  testSoundText: {
    color: '#98CBFF',
    fontSize: 12,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 16,
  },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
  },
  cancelBtnText: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '600',
  },
  startBtn: {
    backgroundColor: '#00A3FF',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#00A3FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  startBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
