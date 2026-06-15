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
  color: string;
  available: boolean;
  approved?: boolean;
  profileComplete?: boolean;
  accountUserId?: string;
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
  status: 'scheduled' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface HealthRecord {
  id: string;
  userId: string;
  title: string;
  description: string;
  date: string;
  type: 'consultation' | 'lab-report' | 'vaccination' | 'prescription';
  aiSummary?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  filePath?: string;
  fileUrl?: string;
  fileDataBase64?: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  role: 'user' | 'ai';
  text: string;
  timestamp: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role?: 'patient' | 'doctor' | 'admin';
  doctorId?: string;
  verified?: boolean;
  emailVerified?: boolean;
  otpHash?: string;
  otpExpiresAt?: string;
  profile?: UserProfile;
  passwordHash: string;
  token?: string;
}

export interface PendingRegistration {
  id: string;
  name: string;
  email: string;
  role: 'patient' | 'doctor';
  passwordHash: string;
  doctorProfile?: Record<string, unknown>;
  otpHash: string;
  otpExpiresAt: string;
  createdAt: string;
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

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
