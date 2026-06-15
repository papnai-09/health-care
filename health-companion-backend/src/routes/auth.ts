import express from 'express';
import rateLimit from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import { doctorsDb, pendingRegistrationsDb, usersDb, hashPassword } from '../database';
import { canSendEmail, queueOtpEmail } from '../email';
import { ApiResponse, User, UserProfile } from '../types';
import { AUTH_COOKIE_NAME, authenticateToken } from '../middleware/auth';
import { isValidEmailFormat, validateEmailForSignup } from '../utils/emailVerification';

const router = express.Router();

const verificationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many verification attempts. Please try again later.' },
});

const otpAttemptRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many OTP attempts. Please try again later.' },
});
type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: 'patient' | 'doctor' | 'admin';
  doctorId?: string;
  verified?: boolean;
  emailVerified?: boolean;
  profile?: UserProfile;
};

type RegisterResponse = {
  email: string;
  verificationRequired: true;
};

const getInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'DR';

const toPublicUser = (user: User): PublicUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role === 'admin' ? 'admin' : user.role === 'doctor' ? 'doctor' : 'patient',
  doctorId: user.role === 'doctor' ? user.doctorId : undefined,
  verified: user.verified ?? false,
  emailVerified: user.emailVerified ?? user.role === 'admin',
  profile: user.profile ?? {},
});

const cleanText = (value: unknown, maxLength = 160): string => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return '';
  }

  return String(value).trim().slice(0, maxLength);
};

const normalizeProfile = (currentProfile: UserProfile = {}, incomingProfile: Partial<UserProfile> = {}): UserProfile => {
  const getField = (field: keyof UserProfile, maxLength = 160) =>
    cleanText(Object.prototype.hasOwnProperty.call(incomingProfile, field) ? incomingProfile[field] : currentProfile[field], maxLength);

  return {
    phone: getField('phone', 32),
    dateOfBirth: getField('dateOfBirth', 24),
    gender: getField('gender', 40),
    bloodGroup: getField('bloodGroup', 8),
    heightCm: getField('heightCm', 8),
    weightKg: getField('weightKg', 8),
    address: getField('address', 240),
    emergencyContactName: getField('emergencyContactName', 120),
    emergencyContactPhone: getField('emergencyContactPhone', 32),
    allergies: getField('allergies', 320),
    chronicConditions: getField('chronicConditions', 320),
    profilePhotoUrl: getField('profilePhotoUrl', 600),
  };
};

const isProfileVerified = (name: string, profile: UserProfile): boolean => {
  const requiredFields = [name, profile.phone, profile.dateOfBirth, profile.gender, profile.bloodGroup, profile.emergencyContactPhone];
  return requiredFields.every((field) => Boolean(String(field ?? '').trim()));
};

const isProduction = process.env.NODE_ENV === 'production';

const cookieOptions = {
  httpOnly: true,
  sameSite: isProduction ? 'none' as const : 'lax' as const,
  secure: isProduction,
  maxAge: 1000 * 60 * 60 * 24 * 30,
  path: '/',
};

const setSessionCookie = (res: express.Response, token: string) => {
  res.cookie(AUTH_COOKIE_NAME, token, cookieOptions);
};

const clearSessionCookie = (res: express.Response) => {
  res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
};

const createOtp = () => String(Math.floor(100000 + Math.random() * 900000));

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' } as ApiResponse<null>);
  }

    const response: ApiResponse<{ user: PublicUser }> = {
      success: true,
      data: { user },
  };

  res.json(response);
});

// PUT /api/auth/profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' } as ApiResponse<null>);
    }

    const existingUser = await usersDb.getById(req.user.id);
    if (!existingUser) {
      return res.status(404).json({ success: false, error: 'User not found' } as ApiResponse<null>);
    }

    const nextName = cleanText(req.body.name ?? existingUser.name, 100);
    if (!nextName) {
      return res.status(400).json({ success: false, error: 'Full name is required' } as ApiResponse<null>);
    }

    const nextProfile = normalizeProfile(existingUser.profile, req.body.profile ?? {});
    const updatedUser = await usersDb.update(existingUser.id, {
      name: nextName,
      profile: nextProfile,
      verified: isProfileVerified(nextName, nextProfile),
    });

    if (!updatedUser) {
      return res.status(500).json({ success: false, error: 'Failed to update profile' } as ApiResponse<null>);
    }

    const response: ApiResponse<{ user: PublicUser }> = {
      success: true,
      data: { user: toPublicUser(updatedUser) },
      message: 'Profile updated successfully',
    };

    res.json(response);
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ success: false, error: 'Failed to update profile' } as ApiResponse<null>);
  }
});

// POST /api/auth/register
router.post('/register', verificationRateLimit, async (req, res) => {
  try {
    const { name, email, password, role = 'patient', doctorProfile = {} } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required' } as ApiResponse<null>);
    }

    if (!['patient', 'doctor'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Account type must be patient or doctor' } as ApiResponse<null>);
    }

    if (role === 'doctor') {
      const requiredFields = ['specialty', 'degree', 'registrationNumber', 'experience', 'fee', 'availableFrom', 'availableTo'];
      const missingField = requiredFields.find((field) => !String(doctorProfile[field] ?? '').trim());
      if (missingField) {
        return res.status(400).json({ success: false, error: 'Doctor specialty, degree, registration number, experience, fee, and availability are required' } as ApiResponse<null>);
      }
    }

    if (!canSendEmail() && process.env.NODE_ENV === 'production') {
      return res.status(500).json({
        success: false,
        error: 'Email service is not configured. Add SMTP settings in backend .env.',
      } as ApiResponse<null>);
    }

    const validation = await validateEmailForSignup(email);
    if (!validation.ok) {
      return res.status(validation.status).json({ success: false, error: validation.error } as ApiResponse<null>);
    }

    const existingUser = await usersDb.getByEmail(validation.email);
    if (existingUser) {
      return res.status(409).json({ success: false, error: 'Email already in use' } as ApiResponse<null>);
    }

    const normalizedEmail = validation.email;
    const otp = createOtp();

    await pendingRegistrationsDb.createOrUpdate({
      name: name.trim(),
      email: normalizedEmail,
      password: password.trim(),
      role,
      doctorProfile,
      otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    queueOtpEmail({ to: normalizedEmail, name: name.trim(), otp });

    const response: ApiResponse<RegisterResponse> = {
      success: true,
      data: {
        email: normalizedEmail,
        verificationRequired: true,
      },
      message: 'OTP is on its way. Check your inbox and verify to create your account.',
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Registration error:', error);
    if (error instanceof Error && error.message.includes('Email service is not configured')) {
      return res.status(500).json({ success: false, error: error.message } as ApiResponse<null>);
    }
    res.status(500).json({ success: false, error: 'Failed to register user' } as ApiResponse<null>);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' } as ApiResponse<null>);
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!isValidEmailFormat(normalizedEmail)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' } as ApiResponse<null>);
    }

    const existingUser = await usersDb.getByEmail(normalizedEmail);
    if (!existingUser || existingUser.passwordHash !== hashPassword(password.trim())) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' } as ApiResponse<null>);
    }

    if (existingUser.emailVerified === false && existingUser.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Email is not verified. Please create your account again and complete OTP verification.' } as ApiResponse<null>);
    }

    const token = await usersDb.updateToken(existingUser.id);
    if (!token) {
      return res.status(500).json({ success: false, error: 'Failed to generate session token' } as ApiResponse<null>);
    }

    setSessionCookie(res, token);

    const response: ApiResponse<{ user: PublicUser }> = {
      success: true,
      data: { user: toPublicUser(existingUser) },
      message: 'Login successful',
    };

    res.json(response);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Failed to login user' } as ApiResponse<null>);
  }
});

// POST /api/auth/verify-email
router.post('/verify-email', otpAttemptRateLimit, async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, error: 'Email and OTP are required' } as ApiResponse<null>);
    }

    const pending = await pendingRegistrationsDb.verifyOtp(String(email).trim().toLowerCase(), String(otp).trim());
    if (!pending) {
      return res.status(400).json({ success: false, error: 'Invalid or expired OTP' } as ApiResponse<null>);
    }

    const existingUser = await usersDb.getByEmail(pending.email);
    if (existingUser) {
      await pendingRegistrationsDb.deleteByEmail(pending.email);
      return res.status(409).json({ success: false, error: 'Email already in use' } as ApiResponse<null>);
    }

    let verifiedUser = await usersDb.create({
      name: pending.name,
      email: pending.email,
      password: `already-hashed:${pending.passwordHash}`,
      role: pending.role,
    });

    verifiedUser = (await usersDb.update(verifiedUser.id, {
      passwordHash: pending.passwordHash,
      emailVerified: true,
    })) ?? { ...verifiedUser, passwordHash: pending.passwordHash, emailVerified: true };

    if (pending.role === 'doctor') {
      const doctorProfile = pending.doctorProfile ?? {};
      const pendingProfile = await doctorsDb.create({
        id: Date.now().toString(),
        name: pending.name.startsWith('Dr.') ? pending.name : `Dr. ${pending.name}`,
        specialty: String(doctorProfile.specialty ?? '').trim(),
        degree: String(doctorProfile.degree ?? '').trim(),
        registrationNumber: String(doctorProfile.registrationNumber ?? '').trim(),
        clinicName: String(doctorProfile.clinicName ?? '').trim() || 'Pending clinic details',
        availableFrom: String(doctorProfile.availableFrom ?? '09:00').trim(),
        availableTo: String(doctorProfile.availableTo ?? '17:00').trim(),
        rating: 0,
        experience: String(doctorProfile.experience ?? '').trim(),
        fee: String(doctorProfile.fee ?? '').trim(),
        initials: getInitials(pending.name),
        color: 'from-primary to-accent',
        available: false,
        approved: false,
        profileComplete: true,
        accountUserId: verifiedUser.id,
      });

      verifiedUser = (await usersDb.update(verifiedUser.id, { doctorId: pendingProfile.id })) ?? { ...verifiedUser, doctorId: pendingProfile.id };
    }

    await pendingRegistrationsDb.deleteByEmail(pending.email);
    const token = await usersDb.updateToken(verifiedUser.id);
    if (!token) {
      return res.status(500).json({ success: false, error: 'Failed to generate session token' } as ApiResponse<null>);
    }

    verifiedUser = (await usersDb.getById(verifiedUser.id)) ?? { ...verifiedUser, token };
    setSessionCookie(res, token);
    res.json({
      success: true,
      data: { user: toPublicUser(verifiedUser) },
      message: 'Email verified and account created successfully',
    } as ApiResponse<{ user: PublicUser }>);
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify email' } as ApiResponse<null>);
  }
});

// POST /api/auth/resend-otp
router.post('/resend-otp', verificationRateLimit, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' } as ApiResponse<null>);
    }

    if (!canSendEmail() && process.env.NODE_ENV === 'production') {
      return res.status(500).json({
        success: false,
        error: 'Email service is not configured. Add SMTP settings in backend .env.',
      } as ApiResponse<null>);
    }

    const validation = await validateEmailForSignup(email);
    if (!validation.ok) {
      return res.status(validation.status).json({ success: false, error: validation.error } as ApiResponse<null>);
    }

    const normalizedEmail = validation.email;
    const existingUser = await usersDb.getByEmail(normalizedEmail);
    if (existingUser) {
      return res.status(409).json({ success: false, error: 'This account is already created. Please login.' } as ApiResponse<null>);
    }

    const otp = createOtp();
    const pending = await pendingRegistrationsDb.refreshOtp(normalizedEmail, otp, new Date(Date.now() + 10 * 60 * 1000));
    if (!pending) {
      return res.status(404).json({ success: false, error: 'No pending signup found for this email. Please create account again.' } as ApiResponse<null>);
    }

    queueOtpEmail({ to: pending.email, name: pending.name, otp });

    res.json({
      success: true,
      message: 'OTP is on its way. Check your inbox.',
    } as ApiResponse<null>);
  } catch (error) {
    console.error('Resend OTP error:', error);
    if (error instanceof Error && error.message.includes('Email service is not configured')) {
      return res.status(500).json({ success: false, error: error.message } as ApiResponse<null>);
    }
    res.status(500).json({ success: false, error: 'Failed to resend OTP' } as ApiResponse<null>);
  }
});

// POST /api/auth/google
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ success: false, error: 'Google credential is required' } as ApiResponse<null>);
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ success: false, error: 'Google login is not configured' } as ApiResponse<null>);
    }

    const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload?.email?.toLowerCase();

    if (!email || payload?.email_verified !== true) {
      return res.status(401).json({ success: false, error: 'Google email is not verified' } as ApiResponse<null>);
    }

    let user = await usersDb.getByEmail(email);
    if (!user) {
      user = await usersDb.createOAuthUser({
        name: payload?.name ?? email.split('@')[0],
        email,
      });
    } else if (!user.emailVerified) {
      user = await usersDb.update(user.id, { emailVerified: true, verified: true }) ?? user;
    }

    const token = await usersDb.updateToken(user.id);
    if (!token) {
      return res.status(500).json({ success: false, error: 'Failed to generate session token' } as ApiResponse<null>);
    }

    const refreshedUser = (await usersDb.getById(user.id)) ?? { ...user, token };
    setSessionCookie(res, token);
    res.json({
      success: true,
      data: { user: toPublicUser(refreshedUser) },
      message: 'Google login successful',
    } as ApiResponse<{ user: PublicUser }>);
  } catch (error) {
    console.error('Google login error:', error);
    res.status(401).json({ success: false, error: 'Google login failed' } as ApiResponse<null>);
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ success: true, message: 'Logged out successfully' } as ApiResponse<null>);
});

export { router as authRouter };
