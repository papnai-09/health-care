import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  HeartPulse,
  Mail,
  MapPin,
  Phone,
  Ruler,
  Save,
  ShieldCheck,
  UserRound,
  Weight,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AuthUser, UserProfile } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getDashboardPath } from "@/lib/routes";

type ProfileForm = Required<Record<keyof UserProfile, string>> & {
  name: string;
};

const emptyProfileForm: ProfileForm = {
  name: "",
  phone: "",
  dateOfBirth: "",
  gender: "",
  bloodGroup: "",
  heightCm: "",
  weightKg: "",
  address: "",
  allergies: "",
  chronicConditions: "",
  profilePhotoUrl: "",
};

const requiredFields: Array<{ key: keyof ProfileForm; label: string }> = [
  { key: "name", label: "Full name" },
  { key: "phone", label: "Phone" },
  { key: "dateOfBirth", label: "Date of birth" },
  { key: "gender", label: "Gender" },
  { key: "bloodGroup", label: "Blood group" },
];

const buildProfileForm = (user: AuthUser | null): ProfileForm => ({
  ...emptyProfileForm,
  name: user?.name ?? "",
  phone: user?.profile?.phone ?? "",
  dateOfBirth: user?.profile?.dateOfBirth ?? "",
  gender: user?.profile?.gender ?? "",
  bloodGroup: user?.profile?.bloodGroup ?? "",
  heightCm: user?.profile?.heightCm ?? "",
  weightKg: user?.profile?.weightKg ?? "",
  address: user?.profile?.address ?? "",
  allergies: user?.profile?.allergies ?? "",
  chronicConditions: user?.profile?.chronicConditions ?? "",
  profilePhotoUrl: user?.profile?.profilePhotoUrl ?? "",
});

const getInitials = (name?: string, email?: string) => {
  const source = name?.trim() || email?.split("@")[0] || "User";
  const initials = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "U";
};

const fieldClassName = "h-11 rounded-lg border-border bg-background/80 text-sm focus-visible:ring-primary";
const selectClassName =
  "flex h-11 w-full rounded-lg border border-input bg-background/80 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

const FieldIcon = ({ children }: { children: ReactNode }) => (
  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">{children}</div>
);

function ProfileContent() {
  const { user, loading, updateProfile } = useAuth();
  const [form, setForm] = useState<ProfileForm>(() => buildProfileForm(user));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(buildProfileForm(user));
  }, [user]);

  const completedRequired = useMemo(
    () => requiredFields.filter((field) => Boolean(String(form[field.key]).trim())).length,
    [form],
  );
  const completionPercent = Math.round((completedRequired / requiredFields.length) * 100);
  const missingFields = requiredFields.filter((field) => !String(form[field.key]).trim());
  const profilePhotoUrl = form.profilePhotoUrl.trim();

  if (!user) return null;

  const handleChange =
    (field: keyof ProfileForm) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);

    const { name, ...profile } = form;
    const result = await updateProfile(name, profile);
    setSaving(false);

    if (result.success) {
      toast.success("Profile saved successfully");
      return;
    }

    toast.error(result.message);
  };

  return (
    <DashboardLayout title="Account Profile" subtitle="Maintain accurate contact and clinical information for care coordination.">
      <form onSubmit={handleSubmit} className="grid items-start gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="space-y-5 xl:sticky xl:top-24">
          <section className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
            <div className="border-b border-border bg-gradient-card p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-accent text-xl font-extrabold text-accent-foreground shadow-soft">
                  {profilePhotoUrl ? (
                    <img src={profilePhotoUrl} alt={form.name || "Profile"} className="h-full w-full object-cover" />
                  ) : (
                    getInitials(form.name, user.email)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold uppercase tracking-widest text-primary">Account summary</p>
                  <h2 className="mt-1 truncate text-xl font-extrabold text-foreground" title={form.name || "Patient profile"}>
                    {form.name || "Patient profile"}
                  </h2>
                  <p className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-full bg-primary-soft px-3 py-1 text-xs font-bold capitalize text-primary">
                      {user.role}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                        completionPercent === 100 ? "bg-accent-soft text-accent" : "bg-warning/10 text-warning"
                      }`}
                    >
                      {completionPercent === 100 ? "Complete" : "Action required"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-foreground">Profile completeness</p>
                  <p className="text-xs text-muted-foreground">{completedRequired} of {requiredFields.length} mandatory fields completed</p>
                </div>
                <span className={`text-sm font-extrabold ${completionPercent === 100 ? "text-accent" : "text-warning"}`}>
                  {completionPercent}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-accent transition-smooth" style={{ width: `${completionPercent}%` }} />
              </div>
              <div className={`rounded-lg border p-3 text-sm ${completionPercent === 100 ? "border-accent/30 bg-accent-soft text-accent" : "border-warning/30 bg-warning/10 text-warning"}`}>
                <div className="flex items-start gap-2">
                  {completionPercent === 100 ? <ShieldCheck className="mt-0.5 h-4 w-4" /> : <AlertCircle className="mt-0.5 h-4 w-4" />}
                  <span>{completionPercent === 100 ? "All mandatory information has been completed." : `${missingFields.length} mandatory field${missingFields.length === 1 ? "" : "s"} pending.`}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5 shadow-soft">
            <h3 className="mb-4 text-sm font-bold text-foreground">Mandatory information</h3>
            <div className="space-y-3">
              {requiredFields.map((field) => {
                const complete = Boolean(String(form[field.key]).trim());
                return (
                  <div key={field.key} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className={`h-4 w-4 ${complete ? "text-accent" : "text-muted-foreground"}`} />
                    <span className={complete ? "text-foreground" : "text-muted-foreground"}>{field.label}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <Button asChild variant="outline" className="w-full">
            <Link href={getDashboardPath(user.role)}>
              <ArrowLeft className="h-4 w-4" />
              Return to dashboard
            </Link>
          </Button>
        </aside>

        <div className="space-y-5">
          <section className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <FieldIcon><UserRound className="h-5 w-5" /></FieldIcon>
              <div>
                <h2 className="text-lg font-bold text-foreground">Account information</h2>
                <p className="text-sm text-muted-foreground">Primary contact details used for communication and account records.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profile-name">Full name *</Label>
                <Input id="profile-name" value={form.name} onChange={handleChange("name")} className={fieldClassName} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="profile-email" value={user.email} className={`${fieldClassName} pl-9`} disabled />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-phone">Phone *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="profile-phone" value={form.phone} onChange={handleChange("phone")} className={`${fieldClassName} pl-9`} placeholder="+91 98765 43210" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-photo">Photo URL</Label>
                <div className="relative">
                  <Camera className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="profile-photo" type="url" value={form.profilePhotoUrl} onChange={handleChange("profilePhotoUrl")} className={`${fieldClassName} pl-9`} placeholder="https://..." />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <FieldIcon><HeartPulse className="h-5 w-5" /></FieldIcon>
              <div>
                <h2 className="text-lg font-bold text-foreground">Clinical profile</h2>
                <p className="text-sm text-muted-foreground">Core demographic and biometric information for consultations.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="profile-dob">Date of birth *</Label>
                <Input id="profile-dob" type="date" value={form.dateOfBirth} onChange={handleChange("dateOfBirth")} className={fieldClassName} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-gender">Gender *</Label>
                <select id="profile-gender" value={form.gender} onChange={handleChange("gender")} className={selectClassName} required>
                  <option value="">Select gender</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-blood">Blood group *</Label>
                <select id="profile-blood" value={form.bloodGroup} onChange={handleChange("bloodGroup")} className={selectClassName} required>
                  <option value="">Select blood group</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="profile-height">Height</Label>
                  <div className="relative">
                    <Ruler className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="profile-height" value={form.heightCm} onChange={handleChange("heightCm")} className={`${fieldClassName} pl-9`} inputMode="numeric" placeholder="cm" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-weight">Weight</Label>
                  <div className="relative">
                    <Weight className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="profile-weight" value={form.weightKg} onChange={handleChange("weightKg")} className={`${fieldClassName} pl-9`} inputMode="numeric" placeholder="kg" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <FieldIcon><Activity className="h-5 w-5" /></FieldIcon>
              <div>
                <h2 className="text-lg font-bold text-foreground">Medical considerations</h2>
                <p className="text-sm text-muted-foreground">Share allergies and ongoing conditions that may affect care planning.</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="profile-allergies">Allergies or foods to avoid</Label>
                <Textarea id="profile-allergies" value={form.allergies} onChange={handleChange("allergies")} className="min-h-28 rounded-lg border-border bg-background/80 text-sm focus-visible:ring-primary" placeholder="Example: peanuts, lactose, shellfish" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-conditions">Chronic conditions</Label>
                <Textarea id="profile-conditions" value={form.chronicConditions} onChange={handleChange("chronicConditions")} className="min-h-28 rounded-lg border-border bg-background/80 text-sm focus-visible:ring-primary" placeholder="Example: diabetes, asthma, hypertension" />
              </div>
            </div>
          </section>

          <div className="sticky bottom-4 z-20 rounded-lg border border-border bg-background/92 p-3 shadow-elevated backdrop-blur-xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                {completionPercent === 100 ? "All mandatory fields are complete." : `${missingFields.length} mandatory field${missingFields.length === 1 ? "" : "s"} remaining.`}
              </div>
              <Button type="submit" variant="hero" className="w-full sm:w-auto" disabled={saving || loading || !form.name.trim()}>
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save profile"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </DashboardLayout>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}
