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
                      borderRadius: 10,
                      transform: 'scaleX(-1)',
                    }}
                  />
                ) : (
                  <View style={styles.camPipFallback}>
                    <Text style={{ fontSize: 28 }}>📷</Text>
                  </View>
                )}
                <View style={styles.camPipBadge}>
                  <View style={styles.camPipDot} />
                  <Text style={styles.camPipText}>Candidate HD Live</Text>
                </View>
              </View>

              <View style={styles.interviewFocusStack}>
                <View style={styles.currentQuestionGlassCard}>
                  <View style={styles.questionCardHeader}>
                    <View style={styles.questionCardBadgeWrap}>
                      <View style={styles.questionCardRule} />
                      <Text style={styles.questionCardIcon}>◉</Text>
                      <Text style={styles.questionCardBadge}>CÂU HỎI HIỆN TẠI</Text>
                      <View style={styles.questionCardRule} />
                    </View>
                    <Text style={styles.questionCardPhase}>Q{String(currentQuestionIndex).padStart(2, '0')} / {String(totalQuestions).padStart(2, '0')}</Text>
                  </View>
                  {isLoadingQuestion ? (
                    <Text style={styles.questionCardLoading}>Đang kết nối nhận câu hỏi từ AI...</Text>
                  ) : (
                    <Text style={styles.questionCardBody}>{latestAiQuestion}</Text>
                  )}
                  <View style={styles.questionBubbleTail} />
                </View>

                <View style={styles.aiHolographicNode}>
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
                      <Text style={styles.aiOrbFace}>🤖</Text>
                    </View>
                  </View>

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
              </View>

              <View style={styles.voiceInteractionHub}>
                <View style={styles.micControlWrap}>
                  <Pressable
                    onPress={toggleRecording}
                    disabled={isSubmitting || isLoadingQuestion}
                    style={({ pressed }) => [
                      styles.micOrbButton,
                      isRecording ? styles.micOrbButtonStop : styles.micOrbButtonStart,
                      pressed && { opacity: 0.9, transform: [{ scale: 0.96 }] },
                    ]}
                  >
                    <Text style={styles.micOrbIcon}>{isRecording ? '■' : '🎤'}</Text>
                  </Pressable>
                  <View style={styles.micVisualizer}>
                    <View style={[styles.micBar, styles.micBarOne]} />
                    <View style={[styles.micBar, styles.micBarTwo]} />
                    <View style={[styles.micBar, styles.micBarThree]} />
                    <View style={[styles.micBar, styles.micBarTwo]} />
                    <View style={[styles.micBar, styles.micBarOne]} />
                  </View>
                </View>

                <View style={styles.liveTranscriptHud}>
                  <View style={styles.hudCornerTopLeft} />
                  <View style={styles.hudCornerBottomRight} />
                  <View style={styles.transcriptHeader}>
                    <View style={styles.transcriptTitleWrap}>
                      <Text style={styles.transcriptIcon}>▤</Text>
                      <Text style={styles.transcriptTitle}>BẢN DỊCH TRỰC TIẾP</Text>
                    </View>
                    <Pressable
                      onPress={() => setIsDrawerOpen(true)}
                      style={({ pressed }) => [styles.transcriptEditBtn, pressed && { opacity: 0.75 }]}
                    >
                      <Text style={styles.transcriptEditText}>CHỈNH SỬA</Text>
                      <Text style={styles.transcriptEditIcon}>✎</Text>
                    </Pressable>
                  </View>
                  <View style={styles.transcriptBody}>
                    <Text style={styles.transcriptText}>
                      {answerInput.trim()
                        ? `"${answerInput.trim()}"`
                        : isRecording
                        ? '"Đang lắng nghe câu trả lời của bạn..."'
                        : '"Nhấn mic để bắt đầu trả lời bằng giọng nói."'}
                    </Text>
                    {isRecording && <View style={styles.transcriptCursor} />}
                  </View>
                  <View style={styles.transcriptFooter}>
                    <Text style={styles.transcriptState}>{isRecording ? 'LISTENING...' : 'VOICE READY'}</Text>
                    <Pressable
                      onPress={handleSubmitAnswer}
                      disabled={!answerInput.trim() || isSubmitting}
                      style={({ pressed }) => [
                        styles.sendAnswerBtn,
                        (!answerInput.trim() || isSubmitting) && styles.sendAnswerBtnDisabled,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text style={styles.sendAnswerText}>GỬI PHẢN HỒI</Text>
                      <Text style={styles.sendAnswerIcon}>➤</Text>
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
    height: 72,
    backgroundColor: 'rgba(7, 14, 30, 0.88)',
    borderBottomWidth: 1,
    borderColor: 'rgba(152, 203, 255, 0.15)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
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
    letterSpacing: 0,
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
    paddingHorizontal: 64,
    paddingVertical: 40,
    backgroundColor: 'rgba(2, 8, 23, 0.1)',
  },

  /* ── Candidate PIP Camera Top Right ── */
  candidateCamPip: {
    position: 'absolute',
    top: 30,
    right: 34,
    width: 168,
    height: 104,
    borderRadius: 10,
    backgroundColor: '#020617',
    borderWidth: 1.5,
    borderColor: 'rgba(152, 203, 255, 0.26)',
    overflow: 'hidden',
    shadowColor: '#00A3FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
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
    maxWidth: 820,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  interviewFocusStack: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  aiHolographicNode: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 360,
    height: 360,
    marginTop: 8,
  },
  aiWaveRing: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    borderWidth: 1,
    borderColor: 'rgba(0, 163, 255, 0.36)',
  },
  aiOrbHalo: {
    position: 'absolute',
    width: 244,
    height: 244,
    borderRadius: 122,
    backgroundColor: 'rgba(0, 163, 255, 0.18)',
  },
  aiOrbSphere: {
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: '#0F172A',
    borderWidth: 2,
    borderColor: '#98CBFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00A3FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 34,
    elevation: 10,
  },
  aiOrbInnerAura: {
    width: 138,
    height: 138,
    borderRadius: 69,
    backgroundColor: 'rgba(0, 163, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiOrbFace: {
    fontSize: 76,
  },
  aiStatusPill: {
    position: 'absolute',
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(10, 21, 43, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(0, 163, 255, 0.34)',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 22,
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
    width: '88%',
    maxWidth: 680,
    backgroundColor: 'rgba(26, 34, 53, 0.64)',
    borderWidth: 1,
    borderColor: 'rgba(0, 163, 255, 0.36)',
    borderRadius: 16,
    paddingHorizontal: 30,
    paddingTop: 24,
    paddingBottom: 24,
    marginBottom: 20,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#00A3FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 34,
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
    } as any : {}),
  },
  questionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 14,
    width: '100%',
  },
  questionCardBadge: {
    color: '#00A3FF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.4,
  },
  questionCardPhase: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    position: 'absolute',
    right: 0,
  },
  questionCardBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  questionCardRule: {
    width: 34,
    height: 1,
    backgroundColor: 'rgba(0, 163, 255, 0.32)',
  },
  questionCardIcon: {
    color: '#00A3FF',
    fontSize: 14,
    lineHeight: 14,
  },
  questionCardLoading: {
    color: '#98CBFF',
    fontSize: 16,
    textAlign: 'center',
    paddingVertical: 12,
  },
  questionCardBody: {
    color: '#F1F5F9',
    fontSize: 20,
    lineHeight: 31,
    fontWeight: '600',
    letterSpacing: 0,
    textAlign: 'center',
  },
  questionBubbleTail: {
    position: 'absolute',
    bottom: -11,
    width: 22,
    height: 22,
    backgroundColor: 'rgba(26, 34, 53, 0.64)',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0, 163, 255, 0.34)',
    transform: [{ rotate: '45deg' }],
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
    height: 68,
    borderRadius: 18,
    shadowColor: '#00A3FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    marginBottom: 10,
  },
  giantMicBtnStart: {
    backgroundColor: '#079CEB',
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
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  giantMicHint: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  voicePrivacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  voicePrivacyDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  voicePrivacyText: {
    color: '#607B99',
    fontSize: 10,
    fontWeight: '600',
  },

  /* ── Right Collapsible Secondary Chat Drawer ── */
  voiceInteractionHub: {
    width: '100%',
    alignItems: 'center',
    gap: 20,
  },
  micControlWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  micOrbButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 163, 255, 0.42)',
    shadowColor: '#00A3FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.34,
    shadowRadius: 30,
  },
  micOrbButtonStart: {
    backgroundColor: 'rgba(0, 163, 255, 0.14)',
  },
  micOrbButtonStop: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderColor: 'rgba(239, 68, 68, 0.55)',
    shadowColor: '#EF4444',
  },
  micOrbIcon: {
    color: '#98CBFF',
    fontSize: 26,
    fontWeight: '900',
  },
  micVisualizer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 44,
    marginTop: 12,
  },
  micBar: {
    width: 4,
    borderRadius: 4,
    backgroundColor: '#00A3FF',
    shadowColor: '#00A3FF',
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  micBarOne: {
    height: 16,
    opacity: 0.5,
  },
  micBarTwo: {
    height: 28,
    opacity: 0.72,
  },
  micBarThree: {
    height: 40,
    opacity: 1,
  },
  liveTranscriptHud: {
    width: '100%',
    maxWidth: 760,
    minHeight: 156,
    backgroundColor: 'rgba(5, 10, 26, 0.68)',
    borderWidth: 1,
    borderColor: 'rgba(0, 163, 255, 0.22)',
    borderRadius: 12,
    padding: 18,
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.38,
    shadowRadius: 26,
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
    } as any : {}),
  },
  hudCornerTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 34,
    height: 34,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: '#00A3FF',
  },
  hudCornerBottomRight: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 34,
    height: 34,
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
    paddingBottom: 10,
    marginBottom: 12,
  },
  transcriptTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  transcriptIcon: {
    color: '#00A3FF',
    fontSize: 14,
  },
  transcriptTitle: {
    color: '#00A3FF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  transcriptEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  transcriptEditText: {
    color: '#9CAFC5',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  transcriptEditIcon: {
    color: '#9CAFC5',
    fontSize: 13,
  },
  transcriptBody: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  transcriptText: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 17,
    lineHeight: 27,
    fontWeight: '400',
  },
  transcriptCursor: {
    width: 5,
    height: 22,
    marginTop: 2,
    marginLeft: 4,
    backgroundColor: '#00A3FF',
    borderRadius: 2,
  },
  transcriptFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  transcriptState: {
    color: 'rgba(148, 163, 184, 0.62)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  sendAnswerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 163, 255, 0.13)',
    borderWidth: 1,
    borderColor: 'rgba(0, 163, 255, 0.34)',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  sendAnswerBtnDisabled: {
    opacity: 0.45,
  },
  sendAnswerText: {
    color: '#98CBFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  sendAnswerIcon: {
    color: '#98CBFF',
    fontSize: 13,
  },
  chatDrawer: {
    width: 328,
    backgroundColor: 'rgba(7, 16, 34, 0.94)',
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
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  drawerTitle: {
    color: '#F1F5F9',
    fontSize: 14,
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
    backgroundColor: 'rgba(20, 39, 67, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(152, 203, 255, 0.15)',
  },
  drawerBubbleUser: {
    backgroundColor: '#087FBF',
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
