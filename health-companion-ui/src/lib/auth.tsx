import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import * as api from "@/lib/api";

export type UserRole = api.AccountRole;
export type User = api.AuthUser;

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; message: string; user?: User }>;
  signUp: (name: string, email: string, password: string, role: UserRole, doctorProfile?: api.DoctorSignupProfile) => Promise<{ success: boolean; message: string; verification?: api.RegisterVerification }>;
  verifyOtp: (email: string, otp: string) => Promise<{ success: boolean; message: string; user?: User }>;
  resendOtp: (email: string) => Promise<{ success: boolean; message: string }>;
  googleSignIn: (credential: string) => Promise<{ success: boolean; message: string; user?: User }>;
  updateProfile: (name: string, profile: api.UserProfile) => Promise<{ success: boolean; message: string; user?: User }>;
  signOut: () => void;
}

const normalizeUser = (user: User): User => ({
  ...user,
  role: user.role === "admin" ? "admin" : user.role === "doctor" ? "doctor" : "patient",
});

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const response = await api.getCurrentUser();
        setUser(normalizeUser(response.user));
      } catch {
        setUser(null);
      } finally {
        setInitializing(false);
      }
    };

    loadSession();
  }, []);

  const signIn = async (email: string, password: string) => {
    setBusy(true);
    try {
      const response = await api.login(email, password);
      const nextUser = normalizeUser(response.user);
      setUser(nextUser);
      setBusy(false);
      return { success: true, message: "Signed in successfully.", user: nextUser };
    } catch (error) {
      setBusy(false);
      return { success: false, message: error instanceof Error ? error.message : "Login failed." };
    }
  };

  const signUp = async (name: string, email: string, password: string, role: UserRole, doctorProfile?: api.DoctorSignupProfile) => {
    setBusy(true);
    try {
      const response = await api.register(name, email, password, role, doctorProfile);
      setBusy(false);
      return { success: true, message: "Account created. OTP is on its way — check your inbox.", verification: response };
    } catch (error) {
      setBusy(false);
      return { success: false, message: error instanceof Error ? error.message : "Registration failed." };
    }
  };

  const verifyOtp = async (email: string, otp: string) => {
    setBusy(true);
    try {
      const response = await api.verifyEmailOtp(email, otp);
      const nextUser = normalizeUser(response.user);
      setUser(nextUser);
      setBusy(false);
      return { success: true, message: "Email verified successfully.", user: nextUser };
    } catch (error) {
      setBusy(false);
      return { success: false, message: error instanceof Error ? error.message : "OTP verification failed." };
    }
  };

  const resendOtp = async (email: string) => {
    setBusy(true);
    try {
      const response = await api.resendEmailOtp(email);
      setBusy(false);
      return { success: true, message: "OTP sent to your email." };
    } catch (error) {
      setBusy(false);
      return { success: false, message: error instanceof Error ? error.message : "Unable to resend OTP." };
    }
  };

  const googleSignIn = async (credential: string) => {
    setBusy(true);
    try {
      const response = await api.loginWithGoogle(credential);
      const nextUser = normalizeUser(response.user);
      setUser(nextUser);
      setBusy(false);
      return { success: true, message: "Google login successful.", user: nextUser };
    } catch (error) {
      setBusy(false);
      return { success: false, message: error instanceof Error ? error.message : "Google login failed." };
    }
  };

  const updateProfile = async (name: string, profile: api.UserProfile) => {
    setBusy(true);
    try {
      const response = await api.updateProfile(name, profile);
      const nextUser = normalizeUser(response.user);
      setUser(nextUser);
      setBusy(false);
      return { success: true, message: "Profile updated successfully.", user: nextUser };
    } catch (error) {
      setBusy(false);
      return { success: false, message: error instanceof Error ? error.message : "Profile update failed." };
    }
  };

  const signOut = () => {
    void api.logout().catch(() => undefined);
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, loading: initializing || busy, signIn, signUp, verifyOtp, resendOtp, googleSignIn, updateProfile, signOut }),
    [user, initializing, busy]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
