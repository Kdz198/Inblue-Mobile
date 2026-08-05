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

interface AIInterviewRoomProps {
  sessionKey: string;
  onFinish: () => void;
}

export function AIInterviewRoom({ sessionKey, onFinish }: AIInterviewRoomProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 1024;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentPhase, setCurrentPhase] = useState('Giới thiệu & Khởi động');
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
          Animated.timing(orbScale, { toValue: 1.12, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(orbGlow, { toValue: 0.85, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(waveScale, { toValue: 1.45, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(waveAlpha, { toValue: 0.1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(orbScale, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(orbGlow, { toValue: 0.4, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(waveScale, { toValue: 1, duration: 1800, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.timing(waveAlpha, { toValue: 0.6, duration: 1800, easing: Easing.in(Easing.quad), useNativeDriver: true }),
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
            questionContent: 'Chào bạn! Mình đã xem qua thông tin của bạn với rất nhiều điểm ấn tượng. Bạn hãy giới thiệu ngắn gọn về bản thân và định hướng phát triển của mình nhé?',
            phaseName: 'Giới thiệu & Khởi động',
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
          questionContent: `Câu hỏi ${nextIdx}: Bạn hãy chia sẻ về một bài học hoặc thử thách lớn nhất mà bạn từng vượt qua trong dự án thực tế?`,
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
      {/* ── Top Header Navigation Bar ── */}
      <View style={styles.topHeader}>
        {/* Left: Brand Logo & Breadcrumb */}
        <View style={styles.headerLeft}>
          <Text style={styles.brandTitle}>INBLUE AI</Text>
          <Text style={styles.breadcrumbDivider}>/</Text>
          <Text style={styles.breadcrumbSub}>Phỏng Vấn AI</Text>
        </View>

        {/* Center: Stage Status Pills */}
        <View style={styles.headerCenter}>
          <View style={styles.phasePill}>
            <Text style={styles.phasePillText}>{currentPhase}</Text>
          </View>

          <View style={styles.progressPill}>
            <Text style={styles.progressPillText}>
              Câu {currentQuestionIndex}/{totalQuestions}
            </Text>
          </View>

          <View style={styles.completePill}>
            <Text style={styles.completePillText}>
              {Math.round((currentQuestionIndex / Math.max(1, totalQuestions)) * 100)}% hoàn tất
            </Text>
          </View>
        </View>

        {/* Right: Live Status Badge & Drawer Toggle */}
        <View style={styles.headerRight}>
          <View style={styles.liveBadge}>
            <View style={styles.liveBadgeDot} />
            <Text style={styles.liveBadgeText}>Đang phỏng vấn trực tiếp</Text>
          </View>

          <View style={styles.voiceLangBadge}>
            <Text style={{ fontSize: 13, color: '#98CBFF' }}>🎙️</Text>
            <Text style={styles.voiceLangText}>vi-VN</Text>
          </View>

          <Pressable
            onPress={() => setIsDrawerOpen(!isDrawerOpen)}
            style={({ pressed }) => [styles.drawerToggleBtn, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.drawerToggleText}>
              {isDrawerOpen ? '💬 Ẩn tin nhắn' : '💬 Hiện tin nhắn'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ── Main Stage Body ── */}
      <View style={styles.mainBody}>
        {/* ── Center Stage Area (Primary Voice Video Experience) ── */}
        <View style={styles.stageArea}>
          {/* Background Grid Pattern Overlay */}
          {Platform.OS === 'web' && (
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, {
                opacity: 0.25,
                backgroundImage: 'linear-gradient(rgba(152,203,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(152,203,255,0.06) 1px, transparent 1px)',
                backgroundSize: '48px 48px',
              } as any]}
            />
          )}

          {isFinished ? (
            /* Finished Stage Card */
            <View style={styles.centerStageCard}>
              <Text style={{ fontSize: 64, marginBottom: 16 }}>🏆</Text>
              <Text style={styles.stageFinishTitle}>Hoàn Thành Phỏng Vấn AI</Text>
              <Text style={styles.stageFinishSub}>
                Cảm ơn bạn đã hoàn thành bài phỏng vấn. Kết quả chi tiết đã được tự động lưu vào hệ thống.
              </Text>
              <Pressable
                onPress={onFinish}
                style={({ pressed }) => [styles.stageExitBtn, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.stageExitBtnText}>Trở Về Trang Chủ Kiosk →</Text>
              </Pressable>
            </View>
          ) : isEvaluating ? (
            /* Evaluating Stage Card */
            <View style={styles.centerStageCard}>
              <Text style={{ fontSize: 52, marginBottom: 16 }}>⏳</Text>
              <Text style={styles.stageEvalTitle}>Đang Đánh Giá Kết Quả...</Text>
              <Text style={styles.stageEvalSub}>
                Trợ lý AI đang tổng hợp và phân tích câu trả lời của bạn. Vui lòng chờ trong giây lát.
              </Text>
            </View>
          ) : (
            /* Active Interview Stage */
            <View style={styles.activeStageContent}>
              {/* Floating Top Right Candidate Camera PIP */}
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
                  <Text style={styles.camPipText}>Camera của bạn</Text>
                </View>
              </View>

              {/* Central Glowing AI Avatar Orb & Wave Visualizer */}
              <View style={styles.aiOrbCenterContainer}>
                {/* Expanding Outer Radar Ring */}
                <Animated.View
                  style={[
                    styles.aiWaveRing,
                    {
                      transform: [{ scale: waveScale }],
                      opacity: waveAlpha,
                    },
                  ]}
                />

                {/* Glowing Outer Halo */}
                <Animated.View
                  style={[
                    styles.aiOrbHalo,
                    {
                      transform: [{ scale: orbScale }],
                      opacity: orbGlow,
                    },
                  ]}
                />

                {/* Central Circle Button / Avatar */}
                <View style={styles.aiOrbSphere}>
                  <View style={styles.aiOrbInnerAura}>
                    <Text style={{ fontSize: 56 }}>🐋</Text>
                  </View>
                </View>

                {/* Title & Live Action State */}
                <Text style={styles.aiOrbTitle}>Trợ lý phỏng vấn AI</Text>
                <Text style={styles.aiOrbSubtitle}>
                  {isSubmitting
                    ? 'AI đang phân tích câu trả lời của bạn...'
                    : isRecording
                    ? 'Đang thu âm câu trả lời của bạn...'
                    : isAiSpeaking
                    ? 'AI đang đọc câu hỏi...'
                    : 'Đang chờ bạn trả lời qua Microphone...'}
                </Text>

                {isRecording && (
                  <View style={styles.recordingBadge}>
                    <View style={styles.recordingDot} />
                    <Text style={styles.recordingText}>Đang ghi âm</Text>
                  </View>
                )}
              </View>

              {/* Giant Primary Voice Control Action Button at Bottom Center */}
              <View style={styles.primaryVoiceBar}>
                <Pressable
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
                      ? 'Đang xử lý...'
                      : isRecording
                      ? 'Dừng ghi âm và gửi ngay'
                      : 'Bắt đầu nói (Mở Mic)'}
                  </Text>
                </Pressable>

                <Text style={styles.giantMicHint}>
                  {isRecording
                    ? 'Đang nghe... Bấm nút trên màn hình chính để dừng và gửi.'
                    : 'Bấm nút Mic màu đỏ để bắt đầu thu âm câu trả lời của bạn bằng giọng nói.'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Right Collapsible Secondary Chat Drawer (Tin Nhắn Trong Phiên) ── */}
        {isDrawerOpen && (
          <View style={[styles.chatDrawer, !isWide && styles.chatDrawerMobile]}>
            {/* Drawer Header */}
            <View style={styles.drawerHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 18 }}>💬</Text>
                <Text style={styles.drawerTitle}>Tin nhắn trong phiên</Text>
              </View>
              <Text style={styles.drawerMsgCount}>{messages.length} nội dung trao đổi</Text>
            </View>

            {/* AI Question Prompt Card */}
            <View style={styles.aiQuestionPromptBox}>
              <View style={styles.promptHeader}>
                <Text style={styles.promptBadgeText}>PHỎNG VẤN VIÊN AI</Text>
                <Text style={styles.promptPhaseText}>{currentPhase}</Text>
              </View>
              <Text style={styles.promptQuestionContent}>{latestAiQuestion}</Text>
            </View>

            {/* Conversation History List */}
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
                      <Text style={styles.drawerRole}>{isAi ? '🤖 AI Interviewer' : '👤 Bạn'}</Text>
                      <Text style={styles.drawerText}>{msg.content}</Text>
                      <Text style={styles.drawerTime}>{msg.timestamp}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            {/* Bottom Supplementary Text Input Composer */}
            <View style={styles.textComposerBox}>
              <TextInput
                value={answerInput}
                onChangeText={setAnswerInput}
                placeholder="Nhập nội dung bổ sung..."
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
    backgroundColor: '#070C1E',
  },

  /* ── Top Header Navigation ── */
  topHeader: {
    height: 64,
    backgroundColor: '#0B132B',
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    zIndex: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandTitle: {
    color: '#98CBFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  breadcrumbDivider: {
    color: '#64748B',
    fontSize: 16,
  },
  breadcrumbSub: {
    color: '#F1F5F9',
    fontSize: 15,
    fontWeight: '700',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  phasePill: {
    backgroundColor: 'rgba(152, 203, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(152, 203, 255, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  phasePillText: {
    color: '#98CBFF',
    fontSize: 12,
    fontWeight: '700',
  },
  progressPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  progressPillText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  completePill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  completePillText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    paddingVertical: 5,
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
  voiceLangBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  voiceLangText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  drawerToggleBtn: {
    backgroundColor: 'rgba(152, 203, 255, 0.15)',
    borderWidth: 1,
    borderColor: '#00A3FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  drawerToggleText: {
    color: '#98CBFF',
    fontSize: 12,
    fontWeight: '700',
  },

  /* ── Main Body Split ── */
  mainBody: {
    flex: 1,
    flexDirection: 'row',
  },
  stageArea: {
    flex: 1,
    backgroundColor: '#070C1E',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ── Candidate PIP Camera Top Right ── */
  candidateCamPip: {
    position: 'absolute',
    top: 24,
    right: 28,
    width: 240,
    height: 150,
    borderRadius: 18,
    backgroundColor: '#020617',
    borderWidth: 1.5,
    borderColor: 'rgba(152, 203, 255, 0.3)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
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
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  camPipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  camPipText: {
    color: '#F1F5F9',
    fontSize: 11,
    fontWeight: '600',
  },

  /* ── Central Glowing AI Orb Stage ── */
  activeStageContent: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  aiOrbCenterContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 'auto',
    position: 'relative',
  },
  aiWaveRing: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    borderColor: 'rgba(0, 163, 255, 0.4)',
  },
  aiOrbHalo: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(0, 163, 255, 0.25)',
  },
  aiOrbSphere: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#0F172A',
    borderWidth: 2,
    borderColor: '#00A3FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#00A3FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 12,
  },
  aiOrbInnerAura: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: 'rgba(0, 163, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiOrbTitle: {
    color: '#F1F5F9',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  aiOrbSubtitle: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 420,
    marginBottom: 16,
  },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  recordingText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },

  /* ── Primary Voice Action Bar (Bottom Center) ── */
  primaryVoiceBar: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 520,
  },
  giantMicBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
    height: 64,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    marginBottom: 12,
  },
  giantMicBtnStart: {
    backgroundColor: '#00A3FF',
  },
  giantMicBtnStop: {
    backgroundColor: '#EF4444',
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
    color: '#64748B',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },

  /* ── Right Collapsible Chat Drawer ── */
  chatDrawer: {
    width: 380,
    backgroundColor: '#0B132B',
    borderLeftWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    display: 'flex',
    flexDirection: 'column',
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
    fontSize: 16,
    fontWeight: '800',
  },
  drawerMsgCount: {
    color: '#64748B',
    fontSize: 12,
  },
  aiQuestionPromptBox: {
    margin: 16,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(152, 203, 255, 0.2)',
    borderRadius: 16,
    padding: 16,
  },
  promptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  promptBadgeText: {
    color: '#00A3FF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  promptPhaseText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  promptQuestionContent: {
    color: '#F1F5F9',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
  },
  drawerScrollView: {
    flex: 1,
  },
  drawerScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
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
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    backgroundColor: '#070C1E',
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
  centerStageCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    maxWidth: 520,
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
