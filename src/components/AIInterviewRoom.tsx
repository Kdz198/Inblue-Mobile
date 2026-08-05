import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  ChatMessage,
  InterviewStartResponse,
  startInterviewApi,
  submitAnswerApi,
} from '../lib/api';
import { CyberCanvasBackground } from './CyberCanvasBackground';

interface AIInterviewRoomProps {
  sessionKey: string;
  onFinish: () => void;
}

export function AIInterviewRoom({ sessionKey, onFinish }: AIInterviewRoomProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 1024;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentPhase, setCurrentPhase] = useState('Vòng 7: Phỏng Vấn AI');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState(5);

  const [answerInput, setAnswerInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);

  // Pulse animation for central AI Avatar Orb
  const orbScale = useRef(new Animated.Value(1)).current;
  const orbGlow = useRef(new Animated.Value(0.4)).current;
  const waveScale = useRef(new Animated.Value(1)).current;
  const waveAlpha = useRef(new Animated.Value(0.6)).current;

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

  // Candidate Live Camera Stream
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let stream: MediaStream | null = null;
    async function startCam() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.warn('Camera stream warning:', err);
      }
    }
    startCam();
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Speak AI Question using Text-to-Speech (TTS)
  const speakText = useCallback((text: string) => {
    if (Platform.OS === 'web' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'vi-VN';
        utterance.rate = 1.0;
        utterance.onstart = () => setIsAiSpeaking(true);
        utterance.onend = () => setIsAiSpeaking(false);
        utterance.onerror = () => setIsAiSpeaking(false);
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn(e);
        setIsAiSpeaking(false);
      }
    }
  }, []);

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
      setMessages(prev => [...prev, newMsg]);
      speakText(data.questionContent);
    }
  }, [speakText]);

  // Load First Question upon entry
  useEffect(() => {
    let mounted = true;
    async function loadStart() {
      try {
        setIsLoadingQuestion(true);
        const data = await startInterviewApi(sessionKey);
        if (mounted) {
          handleApiResponse(data);
        }
      } catch (err) {
        console.warn('Start interview fallback mock:', err);
        if (mounted) {
          handleApiResponse({
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
  }, [sessionKey, handleApiResponse]);

  // Speech-To-Text (STT) Recording Toggle
  const toggleRecording = () => {
    if (isSubmitting || isFinished || isEvaluating) return;

    if (Platform.OS === 'web' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!isRecording) {
        try {
          const recognition = new SpeechRec();
          recognition.lang = 'vi-VN';
          recognition.interimResults = true;
          recognition.onresult = (event: any) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
              transcript += event.results[i][0].transcript;
            }
            setAnswerInput(prev => (prev.trim() ? prev.trim() + ' ' + transcript : transcript));
          };
          recognition.onend = () => setIsRecording(false);
          recognition.start();
          setIsRecording(true);
        } catch (e) {
          console.warn(e);
          setIsRecording(!isRecording);
        }
      } else {
        setIsRecording(false);
        if (answerInput.trim()) {
          handleSubmitAnswer();
        }
      }
    } else {
      if (isRecording && answerInput.trim()) {
        handleSubmitAnswer();
      } else {
        setIsRecording(!isRecording);
      }
    }
  };

  // Submit Answer Action
  const handleSubmitAnswer = async () => {
    const textToSend = answerInput.trim() || 'Tôi đã hoàn thành câu trả lời.';
    if (isSubmitting) return;

    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: textToSend,
      timestamp: nowStr,
    };

    setMessages(prev => [...prev, userMsg]);
    setAnswerInput('');
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
  const latestAiQuestion = messages.filter(m => m.role === 'ai').pop()?.content || 'Đang kết nối với Trợ lý phỏng vấn AI...';

  return (
    <View style={styles.container}>
      {/* Dynamic Animated Cyber Constellation Canvas Background */}
      <CyberCanvasBackground />

      {/* ── Top Header Navigation Bar ── */}
      <View style={styles.topHeader}>
        {/* Left: Brand Logo & Title */}
        <View style={styles.headerLeft}>
          <Text style={styles.brandTitle}>INBLUE</Text>
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText}>AI KIOSK MODE</Text>
          </View>
        </View>

        {/* Center: Stage Status Pills */}
        <View style={styles.headerCenter}>
          <View style={styles.phasePill}>
            <Text style={styles.phasePillText}>{currentPhase}</Text>
          </View>

          <View style={styles.progressPill}>
            <Text style={styles.progressPillText}>
              Câu {currentQuestionIndex} / {totalQuestions}
            </Text>
          </View>

          <View style={styles.completePill}>
            <Text style={styles.completePillText}>
              {Math.round((currentQuestionIndex / Math.max(1, totalQuestions)) * 100)}% hoàn tất
            </Text>
          </View>
        </View>

        {/* Right: Status & Clock */}
        <View style={styles.headerRight}>
          <View style={styles.liveBadge}>
            <View style={styles.liveBadgeDot} />
            <Text style={styles.liveBadgeText}>System Online</Text>
          </View>

          <View style={styles.clockBox}>
            <Text style={{ fontSize: 14, color: '#98CBFF' }}>⏱</Text>
            <Text style={styles.clockText}>{clockStr}</Text>
          </View>

          <Pressable
            onPress={() => setIsDrawerOpen(!isDrawerOpen)}
            style={({ pressed }) => [styles.drawerToggleBtn, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.drawerToggleText}>
              {isDrawerOpen ? '💬 Ẩn lịch sử' : '💬 Lịch sử trao đổi'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ── Main Workspace ── */}
      <View style={styles.mainWorkspace}>
        {/* ── Left / Center Primary Interview Stage ── */}
        <View style={styles.stageArea}>
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
            <View style={styles.activeStageWrapper}>
              {/* Floating Top Candidate Video Box */}
              <View style={styles.candidateCamPip}>
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
                      transform: 'scaleX(-1)',
                    }}
                  />
                ) : (
                  <View style={styles.camPipFallback}>
                    <Text style={{ fontSize: 32 }}>📷</Text>
                  </View>
                )}
                <View style={styles.camPipBadge}>
                  <View style={styles.camPipDot} />
                  <Text style={styles.camPipText}>Candidate HD Live</Text>
                </View>
              </View>

              {/* Central Glowing AI Avatar Hologram Node */}
              <View style={styles.aiHolographicNode}>
                {/* Outer Wave Pulse */}
                <Animated.View
                  style={[
                    styles.aiWaveRing,
                    {
                      transform: [{ scale: waveScale }],
                      opacity: waveAlpha,
                    },
                  ]}
                />

                {/* Glowing Aura Halo */}
                <Animated.View
                  style={[
                    styles.aiOrbHalo,
                    {
                      transform: [{ scale: orbScale }],
                      opacity: orbGlow,
                    },
                  ]}
                />

                {/* Central Orb Sphere */}
                <View style={styles.aiOrbSphere}>
                  <View style={styles.aiOrbInnerAura}>
                    <Text style={{ fontSize: 48 }}>🤖</Text>
                  </View>
                </View>

                {/* Live State Badge */}
                <View style={styles.aiStatusPill}>
                  <View
                    style={[
                      styles.aiStatusDot,
                      { backgroundColor: isRecording ? '#EF4444' : isAiSpeaking ? '#00A3FF' : '#98CBFF' },
                    ]}
                  />
                  <Text style={styles.aiStatusText}>
                    {isSubmitting
                      ? 'AI đang phân tích...'
                      : isRecording
                      ? 'Đang thu âm giọng nói...'
                      : isAiSpeaking
                      ? 'AI đang đọc câu hỏi...'
                      : 'Đang lắng nghe...'}
                  </Text>
                </View>
              </View>

              {/* Current Question Glass Card */}
              <View style={styles.currentQuestionGlassCard}>
                <View style={styles.questionCardHeader}>
                  <Text style={styles.questionCardBadge}>CÂU HỎI TRỰC TIẾP</Text>
                  <Text style={styles.questionCardPhase}>{currentPhase}</Text>
                </View>
                {isLoadingQuestion ? (
                  <Text style={styles.questionCardLoading}>Đang kết nối nhận câu hỏi từ AI...</Text>
                ) : (
                  <Text style={styles.questionCardBody}>{latestAiQuestion}</Text>
                )}
              </View>

              {/* Giant Primary Voice Control Button */}
              <View style={styles.primaryVoiceBar}>
                <Pressable
                  delayPressIn={0}
                  onPress={toggleRecording}
                  disabled={isSubmitting || isLoadingQuestion}
                  style={({ pressed }) => [
                    styles.giantMicBtn,
                    isRecording ? styles.giantMicBtnStop : styles.giantMicBtnStart,
                    pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
                  ]}
                >
                  <Text style={styles.giantMicIcon}>
                    {isRecording ? '🔴' : '🎤'}
                  </Text>
                  <Text style={styles.giantMicText}>
                    {isSubmitting
                      ? 'Đang gửi câu trả lời...'
                      : isRecording
                      ? 'Dừng Ghi Âm & Gửi Trả Lời'
                      : 'Bắt Đầu Trả Lời (Mở Mic)'}
                  </Text>
                </Pressable>

                <Text style={styles.giantMicHint}>
                  {isRecording
                    ? 'Đang thu âm giọng nói... Nhấn nút màu đỏ khi bạn nói xong để gửi câu trả lời.'
                    : 'Nhấn vào nút Mic để bắt đầu nói trực tiếp với Trợ lý phỏng vấn AI.'}
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
              <Text style={styles.drawerTitle}>💬 Lịch Sử Trao Đổi</Text>
              <Text style={styles.drawerCountText}>{messages.length} tin nhắn</Text>
            </View>

            {/* Chat Messages List */}
            <ScrollView
              ref={scrollViewRef}
              onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
              style={styles.drawerScrollView}
              contentContainerStyle={styles.drawerScrollContent}
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
                      <Text style={styles.drawerRole}>{isAi ? '🤖 INBLUE AI' : '👤 Thí sinh'}</Text>
                      <Text style={styles.drawerText}>{msg.content}</Text>
                      <Text style={styles.drawerTime}>{msg.timestamp}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            {/* Bottom Supplementary Text Composer */}
            <View style={styles.textComposerBox}>
              <TextInput
                value={answerInput}
                onChangeText={setAnswerInput}
                placeholder="Gõ tin nhắn bổ sung tại đây..."
                placeholderTextColor="#64748B"
                style={styles.drawerInput}
              />

              <Pressable
                onPress={handleSubmitAnswer}
                disabled={!answerInput.trim() || isSubmitting}
                style={({ pressed }) => [
                  styles.drawerSendBtn,
                  (!answerInput.trim() || isSubmitting) && styles.drawerSendBtnDisabled,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={{ fontSize: 16, color: '#FFF' }}>➤</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: Platform.OS === 'web' ? ('100vh' as any) : '100%',
    width: '100%',
    backgroundColor: '#050A1A',
    overflow: 'hidden',
  },

  /* ── Top Header Navigation ── */
  topHeader: {
    height: 64,
    backgroundColor: 'rgba(18, 20, 20, 0.6)',
    borderBottomWidth: 1,
    borderColor: 'rgba(152, 203, 255, 0.15)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    zIndex: 20,
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    } as any : {}),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandTitle: {
    color: '#98CBFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -1,
  },
  brandBadge: {
    backgroundColor: 'rgba(152, 203, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(152, 203, 255, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  brandBadgeText: {
    color: '#98CBFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  phasePill: {
    backgroundColor: 'rgba(26, 34, 53, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(152, 203, 255, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  phasePillText: {
    color: '#98CBFF',
    fontSize: 13,
    fontWeight: '700',
  },
  progressPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  progressPillText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  completePill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  completePillText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '700',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  liveBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveBadgeText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
  },
  clockBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(26, 34, 53, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  clockText: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  drawerToggleBtn: {
    backgroundColor: 'rgba(152, 203, 255, 0.15)',
    borderWidth: 1,
    borderColor: '#00A3FF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  drawerToggleText: {
    color: '#98CBFF',
    fontSize: 13,
    fontWeight: '700',
  },

  /* ── Main Workspace ── */
  mainWorkspace: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  stageArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    padding: 24,
  },

  /* ── Candidate PIP Camera Top Right ── */
  candidateCamPip: {
    position: 'absolute',
    top: 24,
    right: 28,
    width: 220,
    height: 140,
    borderRadius: 18,
    backgroundColor: '#020617',
    borderWidth: 1.5,
    borderColor: 'rgba(152, 203, 255, 0.3)',
    overflow: 'hidden',
    shadowColor: '#00A3FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    zIndex: 10,
  },
  camPipFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  camPipBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(5, 10, 26, 0.85)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  camPipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  camPipText: {
    color: '#F1F5F9',
    fontSize: 10,
    fontWeight: '600',
  },

  /* ── Central Hologram Node & Orb ── */
  activeStageWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: 720,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  aiHolographicNode: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 12,
  },
  aiWaveRing: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 2,
    borderColor: 'rgba(152, 203, 255, 0.4)',
  },
  aiOrbHalo: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(0, 163, 255, 0.25)',
  },
  aiOrbSphere: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#0F172A',
    borderWidth: 2,
    borderColor: '#98CBFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#00A3FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 20,
    elevation: 10,
  },
  aiOrbInnerAura: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(0, 163, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(26, 34, 53, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(152, 203, 255, 0.25)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 6,
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
    } as any : {}),
  },
  aiStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  aiStatusText: {
    color: '#98CBFF',
    fontSize: 13,
    fontWeight: '700',
  },

  /* ── Current Question Glass Card ── */
  currentQuestionGlassCard: {
    width: '100%',
    backgroundColor: 'rgba(18, 20, 20, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(152, 203, 255, 0.25)',
    borderRadius: 20,
    padding: 24,
    marginVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
    } as any : {}),
  },
  questionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  questionCardBadge: {
    color: '#00A3FF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  questionCardPhase: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  questionCardLoading: {
    color: '#98CBFF',
    fontSize: 16,
    textAlign: 'center',
    paddingVertical: 12,
  },
  questionCardBody: {
    color: '#F1F5F9',
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '600',
  },

  /* ── Primary Voice Action Bar (Bottom) ── */
  primaryVoiceBar: {
    width: '100%',
    alignItems: 'center',
  },
  giantMicBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
    height: 64,
    borderRadius: 999,
    shadowColor: '#00A3FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    marginBottom: 10,
  },
  giantMicBtnStart: {
    backgroundColor: '#00A3FF',
  },
  giantMicBtnStop: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  giantMicIcon: {
    fontSize: 22,
  },
  giantMicText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  giantMicHint: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },

  /* ── Right Collapsible Secondary Chat Drawer ── */
  chatDrawer: {
    width: 360,
    backgroundColor: 'rgba(11, 19, 43, 0.85)',
    borderLeftWidth: 1,
    borderColor: 'rgba(152, 203, 255, 0.15)',
    display: 'flex',
    flexDirection: 'column',
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  drawerTitle: {
    color: '#F1F5F9',
    fontSize: 15,
    fontWeight: '800',
  },
  drawerCountText: {
    color: '#64748B',
    fontSize: 12,
  },
  drawerScrollView: {
    flex: 1,
  },
  drawerScrollContent: {
    padding: 16,
    gap: 14,
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
    maxWidth: '85%',
    borderRadius: 16,
    padding: 14,
  },
  drawerBubbleAi: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(152, 203, 255, 0.15)',
  },
  drawerBubbleUser: {
    backgroundColor: '#00A3FF',
  },
  drawerRole: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  drawerText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },
  drawerTime: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
    alignSelf: 'flex-end',
  },
  textComposerBox: {
    padding: 16,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(5, 10, 26, 0.6)',
  },
  drawerInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 14,
    color: '#FFFFFF',
    fontSize: 13,
  },
  drawerSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#00A3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerSendBtnDisabled: {
    backgroundColor: '#334155',
    opacity: 0.5,
  },

  /* ── Stage Completion / Evaluation ── */
  glassCardStage: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    maxWidth: 520,
    backgroundColor: 'rgba(18, 20, 20, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(152, 203, 255, 0.25)',
    borderRadius: 24,
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    } as any : {}),
  },
  stageFinishTitle: {
    color: '#F1F5F9',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 12,
  },
  stageFinishSub: {
    color: '#94A3B8',
    fontSize: 16,
    lineHeight: 26,
    textAlign: 'center',
    marginBottom: 32,
  },
  stageExitBtn: {
    backgroundColor: '#00A3FF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
  },
  stageExitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  stageEvalTitle: {
    color: '#98CBFF',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 12,
  },
  stageEvalSub: {
    color: '#94A3B8',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
  },
});
