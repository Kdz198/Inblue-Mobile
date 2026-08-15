import createClient from 'openapi-fetch';

export const BASE_URL = 'https://api.kdz.asia';
// export const BASE_URL = 'http://localhost:8080';

export const SYSTEM_TIMEOUT_MS = 3 * 60 * 1000; // 3 Minutes overall timeout for AI processing

export interface KioskEnterDtoResponse {
  aiSessionKey: string;
  durationMinutes?: number;
}

export interface Kiosk {
  id: number;
  name: string;
  location?: string;
  active?: boolean;
  isActive?: boolean;
  createdAt?: string;
}

export interface StaffTokenPayload {
  email?: string;
  sub?: string;
  roles?: string[];
  name?: string;
  avatarUrl?: string;
  iat?: number;
  exp?: number;
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

export interface VoiceOption {
  id: string;
  name: string;
  description: string;
  previewUrl: string;
}

export function resolveApiAssetUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

function normalizeVoiceOptions(payload: unknown): VoiceOption[] {
  if (Array.isArray(payload)) return payload as VoiceOption[];

  if (payload && typeof payload === 'object') {
    const data = payload as {
      voices?: unknown;
      data?: unknown;
      result?: unknown;
      content?: unknown;
    };

    if (Array.isArray(data.voices)) return data.voices as VoiceOption[];
    if (Array.isArray(data.data)) return data.data as VoiceOption[];
    if (Array.isArray(data.result)) return data.result as VoiceOption[];
    if (Array.isArray(data.content)) return data.content as VoiceOption[];
  }

  return [];
}

// Fetch helper for Kiosk API endpoints
export async function enterKioskApi(sessionKey: string, kioskId: number): Promise<KioskEnterDtoResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SYSTEM_TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}/api/kiosk/enter/${encodeURIComponent(sessionKey)}?kioskId=${encodeURIComponent(String(kioskId))}`, {
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

export async function loginStaffApi(email: string, password: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SYSTEM_TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error('Thông tin đăng nhập không chính xác.');
    }

    return (await response.text()).trim();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Đăng nhập quá thời gian. Vui lòng thử lại!');
    }
    if (err.message === 'Thông tin đăng nhập không chính xác.') {
      throw err;
    }
    throw new Error('Thông tin đăng nhập không chính xác.');
  }
}

export async function getAllKiosksApi(token: string): Promise<Kiosk[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SYSTEM_TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}/api/kiosks`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Tải danh sách kiosk thất bại (${response.status})`);
    }

    const data = await response.json();
    if (Array.isArray(data)) return data as Kiosk[];
    if (data && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)) {
      return (data as { data: Kiosk[] }).data;
    }
    return [];
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Tải danh sách kiosk quá thời gian. Vui lòng thử lại!');
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
        answer: answerText,
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

export async function timeoutInterviewApi(sessionKey: string): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SYSTEM_TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}/api/v1/interview/timeout/${encodeURIComponent(sessionKey)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Báo hết giờ phỏng vấn thất bại (${response.status})`);
    }

    return await response.json().catch(() => null);
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Báo hết giờ phỏng vấn quá thời gian.');
    }
    throw err;
  }
}

export async function generateTtsAudioApi(text: string, voiceId?: string): Promise<Blob> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SYSTEM_TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}/api/v1/interview/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, voiceId }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      const detail = errorBody.trim().slice(0, 300);
      console.warn(`TTS API returned status ${response.status}`, detail || '(empty response body)');
      throw new Error(`Tạo giọng đọc AI thất bại (${response.status})${detail ? `: ${detail}` : ''}`);
    }

    return await response.blob();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Tạo giọng đọc AI quá thời gian (Timeout 3 phút). Vui lòng thử lại!');
    }
    throw err;
  }
}

export async function getAvailableVoicesApi(): Promise<VoiceOption[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SYSTEM_TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}/api/v1/interview/voices`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Tải danh sách giọng đọc AI thất bại (${response.status})`);
    }

    return normalizeVoiceOptions(await response.json());
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Tải danh sách giọng đọc AI quá thời gian. Vui lòng thử lại!');
    }
    throw err;
  }
}
