import createClient from 'openapi-fetch';

export const BASE_URL = 'http://localhost:8080';

export interface KioskEnterDtoResponse {
  aiSessionKey: string;
}

export interface InterviewStartResponse {
  questionContent?: string;
  phaseName?: string;
  currentQuestionIndex?: number;
  totalQuestionsInPhase?: number;
  questionType?: string;
  finished?: boolean;
}

export interface InterviewSubmitResponse {
  questionContent?: string;
  phaseName?: string;
  currentQuestionIndex?: number;
  totalQuestionsInPhase?: number;
  questionType?: string;
  finished?: boolean;
}

export interface ChatMessage {
  id: number;
  role: 'ai' | 'user';
  content: string;
  timestamp: string;
  meta?: {
    phaseName?: string;
    questionIndex?: number;
    totalQuestions?: number;
    questionType?: string;
  };
}

// Fetch helper for Kiosk API endpoints
export async function enterKioskApi(sessionKey: string): Promise<KioskEnterDtoResponse> {
  const response = await fetch(`${BASE_URL}/api/kiosk/enter/${encodeURIComponent(sessionKey)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Xác thực mã PIN thất bại (${response.status})`);
  }

  return response.json();
}

export async function startInterviewApi(sessionKey: string): Promise<InterviewStartResponse> {
  const response = await fetch(`${BASE_URL}/api/v1/interview/start/${encodeURIComponent(sessionKey)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Khởi tạo phiên phỏng vấn thất bại (${response.status})`);
  }

  return response.json();
}

export async function submitAnswerApi(sessionKey: string, answerText: string): Promise<InterviewSubmitResponse> {
  const response = await fetch(`${BASE_URL}/api/v1/interview/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionKey,
      answerText,
    }),
  });

  if (!response.ok) {
    throw new Error(`Gửi câu trả lời thất bại (${response.status})`);
  }

  return response.json();
}
