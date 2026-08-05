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
  const isWide = width >= 768;

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

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);

  // Pulse animation for AI Avatar Orb
  const orbScale = useRef(new Animated.Value(1)).current;
  const orbGlow = useRef(new Animated.Value(0.4)).current;

  // Real-time clock
  const [clockStr, setClockStr] = useState('');

  useEffect(() => {
    function updateClock() {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      setClockStr(`${h}:${m}`);
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // AI Orb Pulsing Animation Loop
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(orbScale, { toValue: 1.15, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(orbGlow, { toValue: 0.8, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(orbScale, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(orbGlow, { toValue: 0.4, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [orbScale, orbGlow]);

  // Candidate Live Camera Stream in PIP corner
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
        console.warn('PIP Camera permission info:', err);
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
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn(e);
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
        // Fallback mock question if backend API is not live
        if (mounted) {
          handleApiResponse({
            questionContent: 'Chào bạn! Hãy giới thiệu bản thân và nêu ngắn gọn dự án nổi bật nhất mà bạn từng thực hiện trong chuyên ngành Software Engineering.',
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
            setAnswerInput(prev => (prev.trim() ? prev + ' ' + transcript : transcript));
          };
          recognition.onend = () => setIsRecording(false);
          recognition.start();
          setIsRecording(true);
        } catch (e) {
          console.warn(e);
        }
      } else {
        setIsRecording(false);
      }
    } else {
      setIsRecording(!isRecording);
    }
  };

  // Submit Answer Action
  const handleSubmitAnswer = async () => {
    const textToSend = answerInput.trim();
    if (!textToSend || isSubmitting) return;

    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: textToSend,
      timestamp: nowStr,
    };

    setMessages(prev => [...prev, userMsg]);
    setAnswerInput('');
    setIsSubmitting(true);

    try {
      const data = await submitAnswerApi(sessionKey, textToSend);
      handleApiResponse(data);
    } catch (err) {
      console.warn('Submit answer fallback mock:', err);
      // Fallback mock response if backend is offline
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
          questionContent: `Câu hỏi ${nextIdx}: Bạn đã giải quyết thử thách kỹ thuật khó khăn nhất trong dự án đó như thế nào?`,
          phaseName: currentPhase,
          currentQuestionIndex: nextIdx,
          totalQuestionsInPhase: totalQuestions,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* ── Header Bar ── */}
      <View style={styles.header}>
        {/* Left: Phase Title & Question Badge */}
        <View style={styles.headerLeft}>
          <Text style={styles.phaseTitle}>{currentPhase}</Text>
          <View style={styles.questionBadge}>
            <Text style={styles.questionBadgeText}>
              Câu {currentQuestionIndex} / {totalQuestions}
            </Text>
          </View>
        </View>

        {/* Right: Clock */}
        <View style={styles.clockBadge}>
          <Text style={{ fontSize: 16, color: '#98CBFF' }}>⏱</Text>
          <Text style={styles.clockText}>{clockStr}</Text>
        </View>
      </View>

      {/* ── Main Workspace ── */}
      <View style={styles.workspace}>
        {/* AI Avatar & Voice Visualizer Panel (Left/Top) */}
        <View style={[styles.aiPanel, isWide && { width: 340 }]}>
          <Animated.View
            style={[
              styles.aiOrbOuter,
              {
                transform: [{ scale: orbScale }],
                opacity: orbGlow,
              },
            ]}
          />
          <View style={styles.aiOrbInner}>
            <Text style={{ fontSize: 44 }}>🤖</Text>
          </View>
          <Text style={styles.aiName}>INBLUE AI Interviewer</Text>
          <View style={styles.aiLiveStatus}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Voice Active</Text>
          </View>

          {/* Candidate PIP Camera Box */}
          <View style={styles.pipCamBox}>
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
                  borderRadius: 14,
                  transform: 'scaleX(-1)',
                }}
              />
            ) : (
              <View style={styles.pipCamFallback}>
                <Text style={{ color: '#98CBFF', fontSize: 12 }}>📹 Camera</Text>
              </View>
            )}
            <Text style={styles.pipLabel}>Thí sinh (Kiosk)</Text>
          </View>
        </View>

        {/* Right: Conversation Chat Stream & Controls */}
        <View style={styles.chatPanel}>
          {isFinished ? (
            /* Finished Card */
            <View style={styles.finishCard}>
              <Text style={{ fontSize: 54, marginBottom: 12 }}>🎉</Text>
              <Text style={styles.finishTitle}>Hoàn Thành Phỏng Vấn AI</Text>
              <Text style={styles.finishSub}>
                Cảm ơn bạn đã hoàn thành bài phỏng vấn tại Kiosk. Hệ thống đang tiến hành chấm điểm và lưu kết quả.
              </Text>
              <Pressable
                onPress={onFinish}
                style={({ pressed }) => [styles.exitBtn, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.exitBtnText}>Trở Về Màn Hình Chính →</Text>
              </Pressable>
            </View>
          ) : isEvaluating ? (
            /* Evaluating Indicator */
            <View style={styles.evalCard}>
              <Text style={{ fontSize: 44, marginBottom: 16 }}>⏳</Text>
              <Text style={styles.evalTitle}>Đang Đánh Giá Kết Quả...</Text>
              <Text style={styles.evalSub}>AI đang tổng hợp câu trả lời của bạn. Vui lòng chờ trong giây lát.</Text>
            </View>
          ) : (
            /* Q&A Chat Stream */
            <>
              <ScrollView
                ref={scrollViewRef}
                onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
                style={styles.chatScrollView}
                contentContainerStyle={styles.chatContent}
              >
                {isLoadingQuestion ? (
                  <Text style={styles.loadingText}>Đang tải câu hỏi từ hệ thống AI...</Text>
                ) : (
                  messages.map(msg => {
                    const isAi = msg.role === 'ai';
                    return (
                      <View
                        key={msg.id}
                        style={[
                          styles.bubbleRow,
                          isAi ? styles.bubbleRowAi : styles.bubbleRowUser,
                        ]}
                      >
                        <View
                          style={[
                            styles.bubble,
                            isAi ? styles.bubbleAi : styles.bubbleUser,
                          ]}
                        >
                          <Text style={styles.bubbleRole}>{isAi ? '🤖 INBLUE AI' : '👤 Thí sinh'}</Text>
                          <Text style={styles.bubbleText}>{msg.content}</Text>
                          <Text style={styles.bubbleTime}>{msg.timestamp}</Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>

              {/* Action Controls Bar */}
              <View style={styles.controlsBar}>
                <Pressable
                  onPress={toggleRecording}
                  style={({ pressed }) => [
                    styles.micBtn,
                    isRecording && styles.micBtnActive,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.micIcon}>{isRecording ? '🔴' : '🎤'}</Text>
                  <Text style={styles.micText}>{isRecording ? 'Đang thu âm...' : 'Bấm để nói'}</Text>
                </Pressable>

                <TextInput
                  value={answerInput}
                  onChangeText={setAnswerInput}
                  placeholder="Hoặc nhập câu trả lời của bạn tại đây..."
                  placeholderTextColor="#64748B"
                  style={styles.textInput}
                />

                <Pressable
                  onPress={handleSubmitAnswer}
                  disabled={!answerInput.trim() || isSubmitting}
                  style={({ pressed }) => [
                    styles.sendBtn,
                    (!answerInput.trim() || isSubmitting) && styles.sendBtnDisabled,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.sendBtnText}>Gửi →</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050A1A',
  },
  header: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: '#0B132B',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  phaseTitle: {
    color: '#F1F5F9',
    fontSize: 20,
    fontWeight: '800',
  },
  questionBadge: {
    backgroundColor: 'rgba(0, 163, 255, 0.15)',
    borderWidth: 1,
    borderColor: '#00A3FF',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  questionBadgeText: {
    color: '#98CBFF',
    fontSize: 13,
    fontWeight: '700',
  },
  clockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(26, 34, 53, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  clockText: {
    color: '#F1F5F9',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  workspace: {
    flex: 1,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
  },
  aiPanel: {
    backgroundColor: '#0A1128',
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    position: 'relative',
  },
  aiOrbOuter: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(0, 163, 255, 0.3)',
    top: 60,
  },
  aiOrbInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#00A3FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    zIndex: 1,
  },
  aiName: {
    color: '#F1F5F9',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    zIndex: 1,
  },
  aiLiveStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 168, 89, 0.15)',
    borderWidth: 1,
    borderColor: '#00A859',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 32,
    zIndex: 1,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00A859',
  },
  liveText: {
    color: '#00A859',
    fontSize: 12,
    fontWeight: '700',
  },
  pipCamBox: {
    width: 180,
    height: 120,
    borderRadius: 14,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: 'rgba(152, 203, 255, 0.25)',
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipCamFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipLabel: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  chatPanel: {
    flex: 1,
    backgroundColor: '#050A1A',
  },
  chatScrollView: {
    flex: 1,
  },
  chatContent: {
    padding: 24,
    gap: 20,
  },
  loadingText: {
    color: '#98CBFF',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  bubbleRow: {
    width: '100%',
    flexDirection: 'row',
  },
  bubbleRowAi: {
    justifyContent: 'flex-start',
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 20,
    padding: 18,
  },
  bubbleAi: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  bubbleUser: {
    backgroundColor: '#00A3FF',
  },
  bubbleRole: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  bubbleText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 8,
  },
  bubbleTime: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    alignSelf: 'flex-end',
  },
  controlsBar: {
    height: 80,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: '#0B132B',
  },
  micBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(152, 203, 255, 0.15)',
    borderWidth: 1,
    borderColor: '#98CBFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  micBtnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#EF4444',
  },
  micIcon: {
    fontSize: 16,
  },
  micText: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '700',
  },
  textInput: {
    flex: 1,
    height: 48,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    paddingHorizontal: 16,
    color: '#FFFFFF',
    fontSize: 15,
  },
  sendBtn: {
    backgroundColor: '#00A3FF',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 14,
  },
  sendBtnDisabled: {
    backgroundColor: '#334155',
    opacity: 0.5,
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  finishCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  finishTitle: {
    color: '#F1F5F9',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 12,
  },
  finishSub: {
    color: '#94A3B8',
    fontSize: 16,
    lineHeight: 26,
    textAlign: 'center',
    maxWidth: 480,
    marginBottom: 32,
  },
  exitBtn: {
    backgroundColor: '#00A3FF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
  },
  exitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  evalCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  evalTitle: {
    color: '#98CBFF',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 12,
  },
  evalSub: {
    color: '#94A3B8',
    fontSize: 15,
    textAlign: 'center',
    maxWidth: 420,
  },
});
