const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type AccountRole = "patient" | "doctor" | "admin";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: AccountRole;
  doctorId?: string;
  verified?: boolean;
  emailVerified?: boolean;
  profile?: UserProfile;
}

export interface RegisterVerification {
  email: string;
  verificationRequired: true;
}

export interface UserProfile {
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  heightCm?: string;
  weightKg?: string;
  allergies?: string;
  chronicConditions?: string;
  profilePhotoUrl?: string;
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  degree?: string;
  registrationNumber?: string;
  clinicName?: string;
  availableFrom?: string;
  availableTo?: string;
  rating: number;
  experience: string;
  fee: string;
  initials: string;
  color?: string;
  available?: boolean;
  approved?: boolean;
  profileComplete?: boolean;
  accountUserId?: string;
}

export interface DoctorSignupProfile {
  specialty: string;
  degree: string;
  registrationNumber: string;
  experience: string;
  fee: string;
  clinicName: string;
  availableFrom: string;
  availableTo: string;
}

export interface Appointment {
  id: string;
  userId: string;
  patientName?: string;
  patientEmail?: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  date: string;
  time: string;
  type: string;
  status: "scheduled" | "completed" | "cancelled";
  createdAt: string;
}

export interface HealthRecord {
  id: string;
  userId: string;
  title: string;
  description: string;
  date: string;
  type: string;
  aiSummary?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  fileUrl?: string;
  createdAt: string;
}

export interface UploadedRecordFile {
  name: string;
  type: string;
  size: number;
  base64: string;
  extractedText?: string;
}

export interface CreateRecordInput {
  title: string;
  description: string;
  date: string;
  type: string;
  file?: UploadedRecordFile;
}

export interface ChatMessage {
  id: string;
  userId: string;
  role: "user" | "ai";
  text: string;
  timestamp: string;
}

export interface DietPlanInput {
  condition: string;
  allergies: string;
  excludedFoods: string;
  calorieTarget: string;
  bodyGoal: string;
  activityLevel: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role?: AccountRole;
  doctorId?: string;
  verified?: boolean;
  profile?: UserProfile;
}

export interface AdminOverview {
  stats: {
    users: number;
    patients: number;
    doctors: number;
    pendingDoctors: number;
    appointments: number;
    scheduledAppointments: number;
  };
  users: AdminUser[];
  doctors: Doctor[];
  appointments: Appointment[];
}

const TOKEN_KEY = "medicare_token";

const getHeaders = (extra?: Record<string, string>) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Add token from localStorage to Authorization header
  if (typeof window !== "undefined") {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  // Merge with extra headers (extra headers can override)
  if (extra) {
    Object.assign(headers, extra);
  }

  return headers;
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const request = async <T>(path: string, options: RequestInit = {}) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: getHeaders(options.headers as Record<string, string> | undefined),
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(json?.error || json?.message || "Request failed", response.status);
  }

  return (json?.data ?? json) as T;
};

const setToken = (token: string) => {
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, token);
  }
};

export const clearToken = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
  }
};

export const getStoredToken = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem(TOKEN_KEY);
  }
  return null;
};

export const login = async (email: string, password: string) => {
  const result = await request<{ user: AuthUser; token: string }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (result.token) {
    setToken(result.token);
  }
  return result;
};

export const register = async (name: string, email: string, password: string, role: AccountRole, doctorProfile?: DoctorSignupProfile) => {
  return request<RegisterVerification>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password, role, doctorProfile }),
  });
};

export const verifyEmailOtp = async (email: string, otp: string) => {
  const result = await request<{ user: AuthUser; token: string }>("/api/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ email, otp }),
  });
  if (result.token) {
    setToken(result.token);
  }
  return result;
};

export const resendEmailOtp = async (email: string) => {
  return request<null>("/api/auth/resend-otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
};

export const loginWithGoogle = async (credential: string) => {
  const result = await request<{ user: AuthUser; token: string }>("/api/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });
  if (result.token) {
    setToken(result.token);
  }
  return result;
};

export const getCurrentUser = async () => {
  return request<{ user: AuthUser }>("/api/auth/me");
};

export const updateProfile = async (name: string, profile: UserProfile) => {
  return request<{ user: AuthUser }>("/api/auth/profile", {
    method: "PUT",
    body: JSON.stringify({ name, profile }),
  });
};

export const logout = async () => {
  clearToken();
  return request<null>("/api/auth/logout", {
    method: "POST",
  });
};

export const getDoctors = async () => {
  return request<Doctor[]>("/api/doctors");
};

export const getDoctor = async (doctorId: string) => {
  return request<Doctor>(`/api/doctors/${encodeURIComponent(doctorId)}`);
};

export const getAppointments = async () => {
  return request<Appointment[]>("/api/appointments");
};

export const createAppointment = async (doctorId: string, date: string, time: string) => {
  return request<Appointment>("/api/appointments", {
    method: "POST",
    body: JSON.stringify({ doctorId, date, time }),
  });
};

export const getRecords = async () => {
  return request<HealthRecord[]>("/api/records");
};

export const getRecordFileDownloadUrl = (fileUrl: string) => `${BASE_URL}${fileUrl}`;

export const createRecord = async (input: CreateRecordInput) => {
  return request<HealthRecord>("/api/records", {
    method: "POST",
    body: JSON.stringify(input),
  });
};

export const getChatHistory = async () => {
  return request<ChatMessage[]>("/api/chatbot");
};

export const chatAssistant = async (message: string, history?: Array<{ role: "user" | "ai"; text: string }>) => {
  return request<{ reply: string }>("/api/chatbot", {
    method: "POST",
    body: JSON.stringify({ message, history }),
  });
};

export const clearChatHistory = async () => {
  return request<null>("/api/chatbot", {
    method: "DELETE",
  });
};

export const generateDietPlan = async (input: DietPlanInput) => {
  return request<{ plan: string }>("/api/diet-plan", {
    method: "POST",
    body: JSON.stringify(input),
  });
};

export const getAdminOverview = async () => {
  return request<AdminOverview>("/api/admin/overview");
};

export const updateAdminDoctor = async (doctorId: string, updates: Partial<Pick<Doctor, "approved" | "available" | "profileComplete">>) => {
  return request<Doctor>(`/api/admin/doctors/${encodeURIComponent(doctorId)}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
};

export const updateAdminAppointment = async (appointmentId: string, status: Appointment["status"]) => {
  return request<Appointment>(`/api/admin/appointments/${encodeURIComponent(appointmentId)}`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
};

export const deleteAdminUser = async (userId: string) => {
  return request<null>(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
};

export interface DoctorAvailabilitySlot {
  time: string;
  booked: boolean;
  available: boolean;
}

export const getDoctorAvailability = async (doctorId: string, date: string) => {
  return request<{ doctorId: string; date: string; availableFrom: string; availableTo: string; slots: DoctorAvailabilitySlot[] }>(
    `/api/appointments/availability?doctorId=${encodeURIComponent(doctorId)}&date=${encodeURIComponent(date)}`,
  );
};
