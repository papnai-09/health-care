import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ArrowRight, Lock, Mail, Stethoscope, User } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/AuthLayout";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserRole, useAuth } from "@/lib/auth";
import { getDashboardPath } from "@/lib/routes";

const accountTypes: Array<{ value: UserRole; label: string; description: string; icon: typeof User }> = [
  {
    value: "patient",
    label: "Patient",
    description: "Book appointments, use AI guidance, and manage health records.",
    icon: User,
  },
  {
    value: "doctor",
    label: "Doctor",
    description: "Create a clinician account for consultations and patient care.",
    icon: Stethoscope,
  },
];

export default function Register() {
  const router = useRouter();
  const { signUp, verifyOtp, resendOtp, googleSignIn, user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<UserRole>("patient");
  const [doctorProfile, setDoctorProfile] = useState({
    specialty: "",
    degree: "",
    registrationNumber: "",
    experience: "",
    fee: "",
    clinicName: "",
    availableFrom: "09:00",
    availableTo: "17:00",
  });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(getDashboardPath(user.role));
    }
  }, [authLoading, router, user]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (
      role === "doctor" &&
      (!doctorProfile.specialty.trim() ||
        !doctorProfile.degree.trim() ||
        !doctorProfile.registrationNumber.trim() ||
        !doctorProfile.experience.trim() ||
        !doctorProfile.fee.trim() ||
        !doctorProfile.availableFrom.trim() ||
        !doctorProfile.availableTo.trim())
    ) {
      toast.error("Please complete doctor specialty, degree, registration number, experience, fee, and availability.");
      return;
    }

    setLoading(true);
    const result = await signUp(name, email, password, role, role === "doctor" ? doctorProfile : undefined);
    setLoading(false);

    if (!result.success) {
      toast.error(result.message);
      return;
    }

    toast.success(result.message);
    if (result.verification) {
      setPendingEmail(result.verification.email);
      return;
    }
  };

  const handleVerifyOtp = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const result = await verifyOtp(pendingEmail, otp);
    setLoading(false);

    if (!result.success) {
      toast.error(result.message);
      return;
    }

    toast.success(result.message);
    router.push(getDashboardPath(result.user?.role));
  };

  const handleResendOtp = async () => {
    setLoading(true);
    const result = await resendOtp(pendingEmail);
    setLoading(false);

    if (!result.success) {
      toast.error(result.message);
      return;
    }

    toast.success(result.message);
  };

  const handleGoogleCredential = useCallback(
    async (credential: string) => {
      setLoading(true);
      const result = await googleSignIn(credential);
      setLoading(false);

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      router.push(getDashboardPath(result.user?.role));
    },
    [googleSignIn, router],
  );

  if (pendingEmail) {
    return (
      <AuthLayout title="Verify your email" subtitle={`Enter the OTP sent to ${pendingEmail}.`}>
        <form onSubmit={handleVerifyOtp} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="otp">Email OTP</Label>
            <Input
              id="otp"
              required
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Enter 6 digit OTP"
              className="h-12 rounded-lg text-center text-lg font-bold tracking-[0.35em]"
            />
          </div>
          <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading || otp.length !== 6}>
            {loading ? "Verifying..." : "Verify email"}
          </Button>
          <Button type="button" variant="outline" size="lg" className="w-full" disabled={loading} onClick={handleResendOtp}>
            Resend OTP
          </Button>
          <button type="button" className="w-full text-center text-sm font-semibold text-primary hover:underline" onClick={() => setPendingEmail("")}>
            Change account details
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your account" subtitle="Choose your account type and continue to MediCare AI.">
      <form onSubmit={handleSubmit} className="space-y-5">
        <GoogleAuthButton onCredential={handleGoogleCredential} disabled={loading} />
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-semibold uppercase text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <div className="space-y-3">
          <Label>Account type</Label>
          <div className="grid items-stretch gap-3 sm:grid-cols-2">
            {accountTypes.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setRole(type.value)}
                aria-pressed={role === type.value}
                className={`flex h-full flex-col rounded-lg border bg-card p-4 text-left shadow-soft transition-smooth hover:-translate-y-0.5 hover:border-primary/45 ${
                  role === type.value ? "border-primary ring-2 ring-primary/15" : "border-border"
                }`}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft">
                    <type.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span
                    className={`h-4 w-4 rounded-full border ${
                      role === type.value ? "border-primary bg-primary shadow-[inset_0_0_0_3px_hsl(var(--card))]" : "border-border"
                    }`}
                  />
                </div>
                <div className="font-bold text-foreground">{type.label}</div>
                <p className="mt-1 flex-1 text-xs leading-5 text-muted-foreground">{type.description}</p>
              </button>
            ))}
          </div>
        </div>
        {role === "doctor" && (
          <div className="space-y-4 rounded-lg border border-primary/20 bg-card p-4 shadow-soft sm:p-5">
            <div>
              <h2 className="text-sm font-bold text-foreground">Doctor profile details</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                These details will be reviewed by admin before patients can see your profile.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="specialty">Specialization / Specification</Label>
                <Input
                  id="specialty"
                  required={role === "doctor"}
                  value={doctorProfile.specialty}
                  onChange={(event) => setDoctorProfile({ ...doctorProfile, specialty: event.target.value })}
                  placeholder="Cardiologist"
                  className="h-11 rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="degree">Degree / Qualification</Label>
                <Input
                  id="degree"
                  required={role === "doctor"}
                  value={doctorProfile.degree}
                  onChange={(event) => setDoctorProfile({ ...doctorProfile, degree: event.target.value })}
                  placeholder="MBBS, MD"
                  className="h-11 rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="registration">Medical registration no.</Label>
                <Input
                  id="registration"
                  required={role === "doctor"}
                  value={doctorProfile.registrationNumber}
                  onChange={(event) => setDoctorProfile({ ...doctorProfile, registrationNumber: event.target.value })}
                  placeholder="MCI/SMC registration number"
                  className="h-11 rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="experience">Experience</Label>
                <Input
                  id="experience"
                  required={role === "doctor"}
                  value={doctorProfile.experience}
                  onChange={(event) => setDoctorProfile({ ...doctorProfile, experience: event.target.value })}
                  placeholder="8 years"
                  className="h-11 rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fee">Consultation fee</Label>
                <Input
                  id="fee"
                  required={role === "doctor"}
                  value={doctorProfile.fee}
                  onChange={(event) => setDoctorProfile({ ...doctorProfile, fee: event.target.value })}
                  placeholder="Rs. 500"
                  className="h-11 rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinic">Clinic / Hospital</Label>
                <Input
                  id="clinic"
                  value={doctorProfile.clinicName}
                  onChange={(event) => setDoctorProfile({ ...doctorProfile, clinicName: event.target.value })}
                  placeholder="City Care Clinic"
                  className="h-11 rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="available-from">Available from</Label>
                <Input
                  id="available-from"
                  type="time"
                  required={role === "doctor"}
                  value={doctorProfile.availableFrom}
                  onChange={(event) => setDoctorProfile({ ...doctorProfile, availableFrom: event.target.value })}
                  className="h-11 rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="available-to">Available to</Label>
                <Input
                  id="available-to"
                  type="time"
                  required={role === "doctor"}
                  value={doctorProfile.availableTo}
                  onChange={(event) => setDoctorProfile({ ...doctorProfile, availableTo: event.target.value })}
                  className="h-11 rounded-lg"
                />
              </div>
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary-soft p-3 text-xs leading-5 text-primary">
              Your doctor profile will stay hidden from patients until an admin approves it.
            </div>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Anita Sharma" className="h-12 rounded-lg pl-10" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="h-12 rounded-lg pl-10" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="password" type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" className="h-12 rounded-lg pl-10" />
          </div>
        </div>
        <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
          {loading ? "Creating account..." : <>Create account <ArrowRight className="h-4 w-4" /></>}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          By signing up you agree to the Terms and Privacy Policy.
        </p>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account? <Link href="/login" className="font-semibold text-primary hover:underline">Sign in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
