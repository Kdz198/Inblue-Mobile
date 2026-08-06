import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
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
  startInterviewApi,
  submitAnswerApi,
} from '../lib/api';
import { CyberCanvasBackground } from './CyberCanvasBackground';

interface AIInterviewRoomProps {
  sessionKey: string;
  onFinish: () => void;
}

const iconStroke = '#98CBFF';

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

export function AIInterviewRoom({ sessionKey, onFinish }: AIInterviewRoomProps) {
  const { width, height } = useWindowDimensions();
  const isWide = width >= 1024;
  const isKioskCompact = height <= 820;

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

        {/* Right: Status & Clock */}
        <View style={styles.headerRight}>
          <View style={styles.liveBadge}>
            <View style={styles.liveBadgeDot} />
            <Text style={styles.liveBadgeText}>System Online</Text>
          </View>

          <View style={styles.clockBox}>
            <LineIcon name="clock" size={15} />
            <Text style={styles.clockText}>{clockStr}</Text>
          </View>

          <Pressable
            onPress={() => setIsDrawerOpen(!isDrawerOpen)}
            style={({ pressed }) => [styles.drawerToggleBtn, pressed && { opacity: 0.8 }]}
          >
            <LineIcon name={isDrawerOpen ? 'hide' : 'history'} size={15} color="#CBD5E1" />
            <Text style={styles.drawerToggleText}>{isDrawerOpen ? 'Ẩn lịch sử' : 'Lịch sử trao đổi'}</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Main Workspace ── */}
      <View style={styles.mainWorkspace}>
        {/* ── Left / Center Primary Interview Stage ── */}
        <View style={[styles.stageArea, isKioskCompact && styles.stageAreaCompact]}>
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
                <View style={styles.currentQuestionGlassCard}>
                  <View style={styles.questionCardHeader}>
                    <View style={styles.questionCardBadgeWrap}>
                      <View style={styles.questionCardRule} />
                      <LineIcon name="question" size={14} color="#00A3FF" />
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

                <View style={[styles.aiHolographicNode, isKioskCompact && styles.aiHolographicNodeCompact]}>
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
                      <LineIcon name="bot" size={62} color="#98CBFF" />
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

              <View style={[styles.voiceInteractionHub, isKioskCompact && styles.voiceInteractionHubCompact]}>
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
                    <LineIcon name={isRecording ? 'stop' : 'mic'} size={22} />
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
                <LineIcon name="history" size={16} />
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
                        <LineIcon name={isAi ? 'ai' : 'user'} size={11} color={isAi ? '#98CBFF' : '#CBD5E1'} />
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
        <Text style={styles.footerText}>FPT UNIVERSITY  •  CAPSTONE PROJECT FALL 2024</Text>
        <Text style={styles.footerText}>POWERED BY INBLUE PLATFORM</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    height: 64,
    backgroundColor: 'rgba(5, 10, 26, 0.64)',
    borderBottomWidth: 0,
    borderColor: 'rgba(152, 203, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 48,
    zIndex: 20,
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    } as any : {}),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  brandTitle: {
    color: '#98CBFF',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0,
  },
  brandBadge: {
    backgroundColor: 'rgba(152, 203, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(152, 203, 255, 0.22)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  brandBadgeText: {
    color: '#98CBFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 999,
    paddingHorizontal: 13,
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
    fontSize: 10,
    fontWeight: '600',
  },
  clockBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(26, 34, 53, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 5,
  },
  clockText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  drawerToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    borderWidth: 1,
    borderColor: 'rgba(152, 203, 255, 0.13)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  drawerToggleText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },

  /* ── Main Workspace ── */
  mainWorkspace: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'hidden',
    paddingHorizontal: 48,
    gap: 32,
  },
  stageArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    paddingHorizontal: 0,
    paddingTop: 6,
    paddingBottom: 6,
    backgroundColor: 'rgba(2, 8, 23, 0.1)',
  },
  stageAreaCompact: {
    paddingTop: 0,
    paddingBottom: 4,
  },

  /* ── Central Hologram Node & Orb ── */
  activeStageWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: 640,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 0,
  },
  activeStageWrapperCompact: {
    maxWidth: 610,
  },
  interviewFocusStack: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  interviewFocusStackCompact: {
    marginBottom: 6,
  },
  aiHolographicNode: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 258,
    height: 258,
    marginTop: 6,
  },
  aiHolographicNodeCompact: {
    width: 230,
    height: 230,
  },
  aiWaveRing: {
    position: 'absolute',
    width: 238,
    height: 238,
    borderRadius: 119,
    borderWidth: 1,
    borderColor: 'rgba(0, 163, 255, 0.36)',
  },
  aiOrbHalo: {
    position: 'absolute',
    width: 178,
    height: 178,
    borderRadius: 89,
    backgroundColor: 'rgba(0, 163, 255, 0.18)',
  },
  aiOrbSphere: {
    width: 156,
    height: 156,
    borderRadius: 78,
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
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: 'rgba(0, 163, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiStatusPill: {
    position: 'absolute',
    bottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(10, 21, 43, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(0, 163, 255, 0.34)',
    borderRadius: 999,
    paddingHorizontal: 15,
    paddingVertical: 7,
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
    fontSize: 11,
    fontWeight: '700',
  },

  /* ── Current Question Glass Card ── */
  currentQuestionGlassCard: {
    width: '100%',
    maxWidth: 590,
    backgroundColor: 'rgba(26, 34, 53, 0.64)',
    borderWidth: 1,
    borderColor: 'rgba(0, 163, 255, 0.36)',
    borderRadius: 10,
    paddingHorizontal: 28,
    paddingTop: 18,
    paddingBottom: 19,
    marginBottom: 16,
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
    gap: 12,
    marginBottom: 11,
    width: '100%',
  },
  questionCardBadge: {
    color: '#00A3FF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.4,
  },
  questionCardPhase: {
    color: '#94A3B8',
    fontSize: 10,
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
  questionCardLoading: {
    color: '#98CBFF',
    fontSize: 16,
    textAlign: 'center',
    paddingVertical: 12,
  },
  questionCardBody: {
    color: '#F1F5F9',
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '600',
    letterSpacing: 0,
    textAlign: 'center',
  },
  questionBubbleTail: {
    position: 'absolute',
    bottom: -9,
    width: 18,
    height: 18,
    backgroundColor: 'rgba(26, 34, 53, 0.64)',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0, 163, 255, 0.34)',
    transform: [{ rotate: '45deg' }],
  },

  giantMicHint: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },

  /* ── Right Collapsible Secondary Chat Drawer ── */
  voiceInteractionHub: {
    width: '100%',
    alignItems: 'center',
    gap: 11,
  },
  voiceInteractionHubCompact: {
    gap: 8,
  },
  micControlWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  micOrbButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  micVisualizer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 29,
    marginTop: 7,
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
    height: 11,
    opacity: 0.5,
  },
  micBarTwo: {
    height: 18,
    opacity: 0.72,
  },
  micBarThree: {
    height: 25,
    opacity: 1,
  },
  liveTranscriptHud: {
    width: '100%',
    maxWidth: 590,
    minHeight: 118,
    backgroundColor: 'rgba(5, 10, 26, 0.68)',
    borderWidth: 1,
    borderColor: 'rgba(0, 163, 255, 0.22)',
    borderRadius: 8,
    padding: 14,
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
    width: 24,
    height: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: '#00A3FF',
  },
  hudCornerBottomRight: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 24,
    height: 24,
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
    paddingBottom: 8,
    marginBottom: 9,
  },
  transcriptTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  transcriptTitle: {
    color: '#00A3FF',
    fontSize: 10,
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
  transcriptBody: {
    minHeight: 43,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  transcriptText: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '400',
  },
  transcriptCursor: {
    width: 5,
    height: 18,
    marginTop: 2,
    marginLeft: 4,
    backgroundColor: '#00A3FF',
    borderRadius: 2,
  },
  transcriptFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 9,
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
    borderRadius: 7,
    paddingHorizontal: 15,
    paddingVertical: 8,
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
  chatDrawer: {
    width: 252,
    backgroundColor: 'rgba(5, 10, 26, 0.18)',
    borderLeftWidth: 0,
    borderColor: 'rgba(152, 203, 255, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    paddingTop: 10,
    paddingBottom: 8,
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
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(152, 203, 255, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  drawerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  drawerTitle: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  drawerCountText: {
    color: '#98CBFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    backgroundColor: 'rgba(0, 163, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(0, 163, 255, 0.22)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  drawerScrollView: {
    flex: 1,
  },
  drawerScrollContent: {
    paddingTop: 16,
    paddingBottom: 16,
    gap: 16,
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
    maxWidth: '92%',
    borderRadius: 7,
    padding: 11,
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
    marginBottom: 7,
  },
  drawerRoleRowUser: {
    justifyContent: 'flex-end',
  },
  drawerRole: {
    color: '#98CBFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  drawerRoleUser: {
    color: '#CBD5E1',
  },
  drawerText: {
    color: '#FFFFFF',
    fontSize: 10,
    lineHeight: 16,
    marginBottom: 7,
  },
  drawerTime: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 9,
    alignSelf: 'flex-end',
  },
  drawerTypingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: 'rgba(152, 203, 255, 0.08)',
  },
  drawerTypingDots: {
    flexDirection: 'row',
    gap: 5,
  },
  drawerTypingDotMuted: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(0, 163, 255, 0.35)',
  },
  drawerTypingDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(0, 163, 255, 0.58)',
  },
  drawerTypingDotStrong: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#00A3FF',
  },
  drawerTypingText: {
    color: 'rgba(148, 163, 184, 0.7)',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  footerBar: {
    height: 30,
    borderTopWidth: 1,
    borderColor: 'rgba(152, 203, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 48,
    backgroundColor: 'rgba(5, 10, 26, 0.42)',
  },
  footerText: {
    color: 'rgba(148, 163, 184, 0.48)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
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
