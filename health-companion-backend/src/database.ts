import { randomUUID, createHmac } from 'crypto';
import mongoose, { Schema } from 'mongoose';
import { Doctor, Appointment, HealthRecord, ChatMessage, PendingRegistration, User } from './types';

const collectionOptions = {
  versionKey: false,
  strict: false,
} as const;

const doctorSchema = new Schema<Doctor>(
  {
    id: { type: String, required: true, unique: true },
  },
  collectionOptions,
);

const appointmentSchema = new Schema<Appointment>(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    doctorId: { type: String, required: true, index: true },
  },
  collectionOptions,
);

const recordSchema = new Schema<HealthRecord>(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
  },
  collectionOptions,
);

const chatMessageSchema = new Schema<ChatMessage>(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
  },
  collectionOptions,
);

const userSchema = new Schema<User>(
  {
    id: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, index: true },
    token: { type: String, index: true },
  },
  collectionOptions,
);

const pendingRegistrationSchema = new Schema<PendingRegistration>(
  {
    id: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, index: true },
  },
  collectionOptions,
);

const DoctorModel = mongoose.model<Doctor>('Doctor', doctorSchema, 'doctors');
const AppointmentModel = mongoose.model<Appointment>('Appointment', appointmentSchema, 'appointments');
const RecordModel = mongoose.model<HealthRecord>('HealthRecord', recordSchema, 'records');
const ChatMessageModel = mongoose.model<ChatMessage>('ChatMessage', chatMessageSchema, 'chat');
const UserModel = mongoose.model<User>('User', userSchema, 'users');
const PendingRegistrationModel = mongoose.model<PendingRegistration>('PendingRegistration', pendingRegistrationSchema, 'pending_registrations');

let connectionPromise: Promise<typeof mongoose> | null = null;

const toPlain = <T>(value: unknown): T => {
  const plain = value && typeof value === 'object' && 'toObject' in value ? (value as { toObject: () => unknown }).toObject() : value;
  return plain as T;
};

export const connectDatabase = async (): Promise<void> => {
  const mongoUri = process.env.MONGODB_URI;
  const databaseName = process.env.MONGODB_DB_NAME ?? 'health-companion';

  if (!mongoUri) {
    throw new Error('MONGODB_URI is missing. Add it to health-companion-backend/.env');
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(mongoUri, {
      dbName: databaseName,
      serverSelectionTimeoutMS: 10000,
    });
  }

  await connectionPromise;
};

export const ensureDatabase = async (): Promise<void> => {
  await connectDatabase();
  await ensureAdminUser();
};

const ensureAdminUser = async (): Promise<void> => {
  const email = (process.env.ADMIN_EMAIL ?? 'admin@medicare.local').toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? 'Admin@123';
  const existingAdmin = await UserModel.findOne({ email }).lean<User | null>();

  if (existingAdmin) {
    if (existingAdmin.role !== 'admin' || existingAdmin.emailVerified !== true) {
      await UserModel.updateOne({ id: existingAdmin.id }, { role: 'admin', verified: true, emailVerified: true });
    }
    return;
  }

  await UserModel.create({
    id: randomUUID(),
    name: process.env.ADMIN_NAME ?? 'Admin',
    email,
    role: 'admin',
    verified: true,
    emailVerified: true,
    profile: {},
    passwordHash: hashPassword(password),
    token: randomUUID(),
  } satisfies User);
};

export const getDatabaseStatus = async () => {
  await ensureDatabase();
  const databaseName = process.env.MONGODB_DB_NAME ?? 'health-companion';

  const [doctors, appointments, records, chat, users] = await Promise.all([
    DoctorModel.estimatedDocumentCount(),
    AppointmentModel.estimatedDocumentCount(),
    RecordModel.estimatedDocumentCount(),
    ChatMessageModel.estimatedDocumentCount(),
    UserModel.estimatedDocumentCount(),
  ]);

  return {
    connected: mongoose.connection.readyState === 1,
    type: 'mongodb',
    database: mongoose.connection.name || databaseName,
    host: mongoose.connection.host,
    collections: [
      { name: 'doctors', records: doctors },
      { name: 'appointments', records: appointments },
      { name: 'records', records },
      { name: 'chat', records: chat },
      { name: 'users', records: users },
    ],
  };
};

export const doctorsDb = {
  getAll: async (): Promise<Doctor[]> => DoctorModel.find().lean<Doctor[]>(),
  getById: async (id: string): Promise<Doctor | null> => DoctorModel.findOne({ id }).lean<Doctor | null>(),
  create: async (doctor: Doctor): Promise<Doctor> => toPlain<Doctor>(await DoctorModel.create(doctor)),
  update: async (id: string, updates: Partial<Doctor>): Promise<Doctor | null> =>
    DoctorModel.findOneAndUpdate({ id }, updates, { new: true }).lean<Doctor | null>(),
  delete: async (id: string): Promise<boolean> => {
    const result = await DoctorModel.deleteOne({ id });
    return result.deletedCount > 0;
  },
};

export const appointmentsDb = {
  getAll: async (): Promise<Appointment[]> => AppointmentModel.find().lean<Appointment[]>(),
  getByUserId: async (userId: string): Promise<Appointment[]> => AppointmentModel.find({ userId }).lean<Appointment[]>(),
  getById: async (id: string): Promise<Appointment | null> => AppointmentModel.findOne({ id }).lean<Appointment | null>(),
  create: async (appointment: Appointment): Promise<Appointment> => toPlain<Appointment>(await AppointmentModel.create(appointment)),
  update: async (id: string, updates: Partial<Appointment>): Promise<Appointment | null> =>
    AppointmentModel.findOneAndUpdate({ id }, updates, { new: true }).lean<Appointment | null>(),
  delete: async (id: string): Promise<boolean> => {
    const result = await AppointmentModel.deleteOne({ id });
    return result.deletedCount > 0;
  },
};

export const recordsDb = {
  getAll: async (): Promise<HealthRecord[]> => RecordModel.find().lean<HealthRecord[]>(),
  getByUserId: async (userId: string): Promise<HealthRecord[]> => RecordModel.find({ userId }).lean<HealthRecord[]>(),
  getById: async (id: string): Promise<HealthRecord | null> => RecordModel.findOne({ id }).lean<HealthRecord | null>(),
  create: async (record: HealthRecord): Promise<HealthRecord> => toPlain<HealthRecord>(await RecordModel.create(record)),
  update: async (id: string, updates: Partial<HealthRecord>): Promise<HealthRecord | null> =>
    RecordModel.findOneAndUpdate({ id }, updates, { new: true }).lean<HealthRecord | null>(),
  delete: async (id: string): Promise<boolean> => {
    const result = await RecordModel.deleteOne({ id });
    return result.deletedCount > 0;
  },
};

export const chatDb = {
  getByUserId: async (userId: string): Promise<ChatMessage[]> => ChatMessageModel.find({ userId }).lean<ChatMessage[]>(),
  addMessage: async (message: ChatMessage): Promise<ChatMessage> => toPlain<ChatMessage>(await ChatMessageModel.create(message)),
  clearUserChat: async (userId: string): Promise<boolean> => {
    await ChatMessageModel.deleteMany({ userId });
    return true;
  },
};

const hashPassword = (password: string): string => {
  const secret = process.env.PASSWORD_SALT ?? 'health-companion-salt';
  return createHmac('sha256', secret).update(password).digest('hex');
};

export const usersDb = {
  getAll: async (): Promise<User[]> => UserModel.find().lean<User[]>(),
  getByEmail: async (email: string): Promise<User | null> => UserModel.findOne({ email: email.toLowerCase() }).lean<User | null>(),
  getById: async (id: string): Promise<User | null> => UserModel.findOne({ id }).lean<User | null>(),
  getByToken: async (token: string): Promise<User | null> => UserModel.findOne({ token }).lean<User | null>(),
  create: async (user: { name: string; email: string; password: string; role: 'patient' | 'doctor'; doctorId?: string }): Promise<User> => {
    const newUser: User = {
      id: randomUUID(),
      name: user.name,
      email: user.email.toLowerCase(),
      role: user.role,
      doctorId: user.role === 'doctor' ? user.doctorId : undefined,
      verified: false,
      emailVerified: false,
      profile: {},
      passwordHash: hashPassword(user.password),
      token: randomUUID(),
    };

    return toPlain<User>(await UserModel.create(newUser));
  },
  updateToken: async (userId: string): Promise<string | null> => {
    const token = randomUUID();
    const user = await UserModel.findOneAndUpdate({ id: userId }, { token }, { new: true }).lean<User | null>();
    return user?.token ?? null;
  },
  update: async (userId: string, updates: Partial<User>): Promise<User | null> =>
    UserModel.findOneAndUpdate({ id: userId }, updates, { new: true }).lean<User | null>(),
  createOAuthUser: async (user: { name: string; email: string; role?: 'patient' | 'doctor' | 'admin' }): Promise<User> => {
    const newUser: User = {
      id: randomUUID(),
      name: user.name,
      email: user.email.toLowerCase(),
      role: user.role ?? 'patient',
      verified: true,
      emailVerified: true,
      profile: {},
      passwordHash: '',
      token: randomUUID(),
    };

    return toPlain<User>(await UserModel.create(newUser));
  },
  delete: async (userId: string): Promise<boolean> => {
    const result = await UserModel.deleteOne({ id: userId, role: { $ne: 'admin' } });
    return result.deletedCount > 0;
  },
};

export const pendingRegistrationsDb = {
  createOrUpdate: async (input: {
    name: string;
    email: string;
    password: string;
    role: 'patient' | 'doctor';
    doctorProfile?: Record<string, unknown>;
    otp: string;
    expiresAt: Date;
  }): Promise<PendingRegistration> => {
    const pending: PendingRegistration = {
      id: randomUUID(),
      name: input.name,
      email: input.email.toLowerCase(),
      role: input.role,
      passwordHash: hashPassword(input.password),
      doctorProfile: input.role === 'doctor' ? input.doctorProfile ?? {} : undefined,
      otpHash: hashPassword(input.otp),
      otpExpiresAt: input.expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
    };

    return PendingRegistrationModel.findOneAndUpdate(
      { email: pending.email },
      pending,
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean<PendingRegistration>();
  },
  refreshOtp: async (email: string, otp: string, expiresAt: Date): Promise<PendingRegistration | null> =>
    PendingRegistrationModel.findOneAndUpdate(
      { email: email.toLowerCase() },
      { otpHash: hashPassword(otp), otpExpiresAt: expiresAt.toISOString() },
      { new: true },
    ).lean<PendingRegistration | null>(),
  verifyOtp: async (email: string, otp: string): Promise<PendingRegistration | null> => {
    const pending = await PendingRegistrationModel.findOne({ email: email.toLowerCase() }).lean<PendingRegistration | null>();
    if (!pending) return null;

    const expiresAt = new Date(pending.otpExpiresAt).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;
    if (pending.otpHash !== hashPassword(otp)) return null;

    return pending;
  },
  deleteByEmail: async (email: string): Promise<void> => {
    await PendingRegistrationModel.deleteOne({ email: email.toLowerCase() });
  },
};

export const adminDb = {
  getAllUsers: async (): Promise<User[]> => UserModel.find().sort({ role: 1, name: 1 }).lean<User[]>(),
  getAllDoctors: async (): Promise<Doctor[]> => DoctorModel.find().sort({ approved: 1, name: 1 }).lean<Doctor[]>(),
  getAllAppointments: async (): Promise<Appointment[]> => AppointmentModel.find().sort({ date: -1, time: -1 }).lean<Appointment[]>(),
  deleteUser: async (userId: string): Promise<boolean> => {
    const user = await UserModel.findOne({ id: userId }).lean<User | null>();
    if (!user || user.role === 'admin') return false;

    await Promise.all([
      UserModel.deleteOne({ id: userId }),
      AppointmentModel.deleteMany({ userId }),
      RecordModel.deleteMany({ userId }),
      ChatMessageModel.deleteMany({ userId }),
      user.doctorId ? DoctorModel.deleteOne({ id: user.doctorId }) : Promise.resolve(),
    ]);
    return true;
  },
};

export { hashPassword };
