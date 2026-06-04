import { Request, Response, NextFunction } from 'express';
import { usersDb } from '../database';
import { UserProfile } from '../types';

const AUTH_COOKIE_NAME = 'medicare_session';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        email: string;
        role: 'patient' | 'doctor' | 'admin';
        doctorId?: string;
        verified?: boolean;
        emailVerified?: boolean;
        profile?: UserProfile;
      };
    }
  }
}

const getCookieValue = (cookieHeader: string | undefined, name: string): string | null => {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map((cookie) => cookie.trim());
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
};

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = headerToken ?? getCookieValue(req.headers.cookie, AUTH_COOKIE_NAME);

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authorization token missing' });
  }

  try {
    const user = await usersDb.getByToken(token);

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role === 'admin' ? 'admin' : user.role === 'doctor' ? 'doctor' : 'patient',
      doctorId: user.doctorId,
      verified: user.verified ?? false,
      emailVerified: user.emailVerified ?? user.role === 'admin',
      profile: user.profile ?? {},
    };
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ success: false, error: 'Authentication failed' });
  }
};

export { AUTH_COOKIE_NAME };
