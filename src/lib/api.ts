import createClient from 'openapi-fetch';

export const BASE_URL = 'https://api.kdz.asia';
export const SYSTEM_TIMEOUT_MS = 3 * 60 * 1000; // 3 Minutes overall timeout for AI processing

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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SYSTEM_TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}/api/kiosk/enter/${encodeURIComponent(sessionKey)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMsg = 'Mã PIN không đúng hoặc chưa tới giờ phỏng vấn (±15 phút). Vui lòng thử lại!';
      try {
        const errJson = await response.json();
        if (errJson.error) {
          errorMsg = errJson.error;
        } else if (errJson.message) {
          errorMsg = errJson.message;
        }
      } catch (e) {
        /* fallback */
      }
      throw new Error(errorMsg);
    }

    return await response.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Kết nối máy chủ quá thời gian (Timeout 3 phút). Vui lòng thử lại!');
    }
    throw err;
  }
}

export async function startInterviewApi(sessionKey: string): Promise<InterviewStartResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SYSTEM_TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}/api/v1/interview/start/${encodeURIComponent(sessionKey)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Khởi tạo phiên phỏng vấn thất bại (${response.status})`);
    }

    return await response.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('AI phản hồi quá thời gian (Timeout 3 phút). Vui lòng thử lại!');
    }
    throw err;
  }
}

export async function submitAnswerApi(sessionKey: string, answerText: string): Promise<InterviewSubmitResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SYSTEM_TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}/api/v1/interview/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionKey,
        answerText,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Gửi câu trả lời thất bại (${response.status})`);
    }

    return await response.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('AI xử lý câu trả lời quá thời gian (Timeout 3 phút). Vui lòng thử lại!');
    }
    throw err;
  }
}
