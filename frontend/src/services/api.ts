import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach bearer access token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('vertexlearn_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: silent token refresh on 401
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/register')) {
        return Promise.reject(error);
      }

      const refreshToken = localStorage.getItem('vertexlearn_refresh_token');
      if (!refreshToken) {
        localStorage.removeItem('vertexlearn_token');
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(`${API_BASE}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token, refresh_token } = res.data;
        localStorage.setItem('vertexlearn_token', access_token);
        if (refresh_token) {
          localStorage.setItem('vertexlearn_refresh_token', refresh_token);
        }

        api.defaults.headers.common.Authorization = `Bearer ${access_token}`;
        processQueue(null, access_token);

        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.removeItem('vertexlearn_token');
        localStorage.removeItem('vertexlearn_refresh_token');
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export const auth = {
  login: (data: any) => api.post('/auth/login', data),
  register: (data: any) => api.post('/auth/register', data),
  refresh: (refreshToken: string) => api.post('/auth/refresh', { refresh_token: refreshToken }),
  me: () => api.get('/auth/me'),
};

export const coursesApi = {
  getAll: (params?: { q?: string; category?: string; difficulty?: string }) =>
    api.get('/courses', { params }),
  getById: (id: string) => api.get(`/courses/${id}`),
  enroll: (id: string) => api.post(`/courses/${id}/enroll`),
  create: (data: any) => api.post('/courses', data),
};

export const lecturesApi = {
  updateProgress: (id: string, data: { watched_seconds: number; completed: boolean }) =>
    api.post(`/lectures/${id}/progress`, data),
  getSummary: (id: string, regenerate: boolean = false) =>
    api.get(`/lectures/${id}/summary${regenerate ? '?regenerate=true' : ''}`),
  generateSummary: (id: string) =>
    api.post(`/lectures/${id}/summary`, { regenerate: true }),
};

export const quizzesApi = {
  getByCourse: (courseId: string) => api.get(`/courses/${courseId}/quizzes`),
  getById: (id: string) => api.get(`/quizzes/${id}`),
  submit: (id: string, data: { answers: Array<{ question_id: string; selected_option_ids: string[]; text_answer?: string }> }) =>
    api.post(`/quizzes/${id}/submit`, data),
};

export const usersApi = {
  getProgress: () => api.get('/users/me/progress'),
  getQuizResults: () => api.get('/users/me/quiz-results'),
  getMastery: () => api.get('/users/me/mastery'),
};

export const aiApi = {
  chat: (data: { course_id: string; question: string; mode?: string }) =>
    api.post('/ai/chat', data),
  getHistory: (courseId: string) =>
    api.get(`/ai/chat/history?course_id=${encodeURIComponent(courseId)}`),
  clearHistory: (courseId: string) =>
    api.delete(`/ai/chat/history?course_id=${encodeURIComponent(courseId)}`),
  summarize: (data: { text: string }) => api.post('/ai/summarize', data),
  generateQuiz: (data: { course_id?: string; lecture_id?: string; number_of_questions?: number; title?: string; text?: string }) =>
    api.post('/ai/generate-quiz', data),
  flashcards: (data: { text: string }) => api.post('/ai/flashcards', data),
  studyPlan: (data: { text: string }) => api.post('/ai/study-plan', data),
};

export const flashcardsApi = {
  getAll: (params?: { course_id?: string; lecture_id?: string; status?: string }) =>
    api.get('/flashcards', { params }),
  generate: (data: { course_id?: string; lecture_id?: string; count?: number; text?: string }) =>
    api.post('/ai/generate-flashcards', data),
  review: (id: string, status: 'known' | 'difficult') =>
    api.post(`/flashcards/${id}/review`, { status }),
};

export const learningApi = {
  getProfile: () => api.get('/learning/profile'),
};

export const studyPlansApi = {
  get: (courseId?: string) =>
    api.get(`/study-plans${courseId ? `?course_id=${encodeURIComponent(courseId)}` : ''}`),
  generate: (data: { course_id: string; target_date?: string; hours_per_day?: number }) =>
    api.post('/ai/study-plan', data),
  toggleTask: (planId: string, taskId: string, completed: boolean) =>
    api.patch(`/study-plans/${planId}/tasks/${taskId}`, { completed }),
};



