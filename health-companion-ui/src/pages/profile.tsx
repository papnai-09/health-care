import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  HeartPulse,
  Mail,
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

const fieldClassName =
  "h-11 w-full rounded-lg border border-input bg-background/80 text-sm transition-all duration-300 hover:border-muted-foreground/30 focus:border-primary focus:ring-2 focus:ring-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";
const selectClassName =
  "flex h-11 w-full rounded-lg border border-input bg-background/80 px-3 py-2 text-sm transition-all duration-300 hover:border-muted-foreground/30 focus:border-primary focus:ring-2 focus:ring-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

const FieldIcon = ({ children }: { children: ReactNode }) => (
  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">{children}</div>
);

type ProfileTab = "account" | "clinical" | "medical";

const fieldTabMap: Record<keyof ProfileForm, ProfileTab> = {
  name: "account",
  phone: "account",
  dateOfBirth: "clinical",
  gender: "clinical",
  bloodGroup: "clinical",
  profilePhotoUrl: "account",
  heightCm: "clinical",
  weightKg: "clinical",
  allergies: "medical",
  chronicConditions: "medical",
};

const fieldIdMap: Record<keyof ProfileForm, string> = {
  name: "profile-name",
  phone: "profile-phone",
  dateOfBirth: "profile-dob",
  gender: "profile-gender",
  bloodGroup: "profile-blood",
  profilePhotoUrl: "profile-photo",
  heightCm: "profile-height",
  weightKg: "profile-weight",
  allergies: "profile-allergies",
  chronicConditions: "profile-conditions",
};

function ProfileContent() {
  const { user, loading, updateProfile } = useAuth();
  const [form, setForm] = useState<ProfileForm>(() => buildProfileForm(user));
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>("account");

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

  const handleChecklistClick = (fieldKey: keyof ProfileForm) => {
    const tab = fieldTabMap[fieldKey];
    const elementId = fieldIdMap[fieldKey];

    if (tab) {
      setActiveTab(tab);
      setTimeout(() => {
        const el = document.getElementById(elementId);
        if (el) {
          el.focus();
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    }
  };

  const accountIncomplete = useMemo(
    () => requiredFields.filter((f) => fieldTabMap[f.key] === "account" && !String(form[f.key]).trim()).length,
    [form],
  );

  const clinicalIncomplete = useMemo(
    () => requiredFields.filter((f) => fieldTabMap[f.key] === "clinical" && !String(form[f.key]).trim()).length,
    [form],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Programmatic validation to check all tabs
    const missing: Array<keyof ProfileForm> = [];
    requiredFields.forEach((field) => {
      if (!String(form[field.key]).trim()) {
        missing.push(field.key);
      }
    });

    if (missing.length > 0) {
      const firstMissing = missing[0];
      const fieldLabel = requiredFields.find((f) => f.key === firstMissing)?.label || firstMissing;
      toast.error(`Please complete all required fields. Missing: ${fieldLabel}`);
      handleChecklistClick(firstMissing);
      return;
    }

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
      <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-6">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all duration-300 hover:shadow-lg">
          {/* Card Header (Summary) */}
          <div className="border-b border-border bg-gradient-to-r from-card to-background/50 p-6 sm:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-accent text-2xl font-extrabold text-accent-foreground shadow-soft transition-transform duration-300 group-hover:scale-105">
                    {profilePhotoUrl ? (
                      <img src={profilePhotoUrl} alt={form.name || "Profile"} className="h-full w-full object-cover" />
                    ) : (
                      getInitials(form.name, user.email)
                    )}
                  </div>
                  {/* Subtle decorative ring */}
                  <div className="absolute inset-0 rounded-2xl border-2 border-primary/10 group-hover:border-primary/30 transition-colors duration-300 pointer-events-none" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-xs font-bold uppercase tracking-widest text-primary">Patient account</p>
                  <h2 className="break-words text-2xl font-extrabold text-foreground leading-tight">
                    {form.name || "Patient profile"}
                  </h2>
                  <p className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4 shrink-0" />
                    <span className="break-all text-foreground/80">{user.email}</span>
                  </p>
                  <div className="pt-1 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-bold capitalize text-primary">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {user.role}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        completionPercent === 100 ? "bg-accent-soft text-accent" : "bg-warning/10 text-warning"
                      }`}
                    >
                      {completionPercent === 100 ? "Complete profile" : "Incomplete profile"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress and Checklist inside Header */}
              <div className="w-full space-y-3 rounded-2xl border border-border/85 bg-background/40 p-5 md:w-80 backdrop-blur-sm shadow-sm">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-bold text-foreground">Profile completeness</span>
                  <span className={`font-extrabold ${completionPercent === 100 ? "text-accent" : "text-warning"}`}>
                    {completionPercent}%
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted/60">
                  <div className="h-full rounded-full bg-gradient-to-r from-warning to-accent transition-all duration-500 ease-out" style={{ width: `${completionPercent}%` }} />
                </div>
                <div className="flex flex-col gap-1.5 pt-1">
                  {requiredFields.map((field) => {
                    const complete = Boolean(String(form[field.key]).trim());
                    return (
                      <button
                        key={field.key}
                        type="button"
                        onClick={() => handleChecklistClick(field.key)}
                        className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:translate-x-0.5 transition-all duration-200 text-left group"
                      >
                        <CheckCircle2 className={`h-4 w-4 shrink-0 transition-colors duration-200 ${complete ? "text-accent" : "text-muted-foreground/40 group-hover:text-warning"}`} />
                        <span className={`${complete ? "text-foreground/80 font-semibold" : "text-muted-foreground/60 underline decoration-dotted decoration-muted-foreground/40"}`}>
                          {field.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Subheader / Tabs Selection */}
          <div className="flex border-b border-border bg-muted/10 px-4 sm:px-6 overflow-x-auto scrollbar-none gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("account")}
              className={`flex items-center gap-2 py-4 px-3 border-b-2 font-bold text-sm transition-all duration-300 whitespace-nowrap ${
                activeTab === "account"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserRound className="h-4 w-4" />
              Account details
              {accountIncomplete > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-warning/15 text-[10px] font-bold text-warning animate-pulse">
                  {accountIncomplete}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("clinical")}
              className={`flex items-center gap-2 py-4 px-3 border-b-2 font-bold text-sm transition-all duration-300 whitespace-nowrap ${
                activeTab === "clinical"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <HeartPulse className="h-4 w-4" />
              Clinical profile
              {clinicalIncomplete > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-warning/15 text-[10px] font-bold text-warning animate-pulse">
                  {clinicalIncomplete}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("medical")}
              className={`flex items-center gap-2 py-4 px-3 border-b-2 font-bold text-sm transition-all duration-300 whitespace-nowrap ${
                activeTab === "medical"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Activity className="h-4 w-4" />
              Medical considerations
            </button>
          </div>

          {/* Card Body */}
          <div className="p-6 sm:p-8 min-h-[300px]">
            {/* Tab 1: Account Information */}
            {activeTab === "account" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-3">
                  <FieldIcon><UserRound className="h-5 w-5" /></FieldIcon>
                  <div>
                    <h3 className="text-lg font-extrabold text-foreground">Account Information</h3>
                    <p className="text-sm text-muted-foreground font-medium">Primary contact details for communication and account records.</p>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="profile-name" className="text-sm font-semibold text-foreground/80">Full Name *</Label>
                    <Input id="profile-name" value={form.name} onChange={handleChange("name")} className={fieldClassName} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-email" className="text-sm font-semibold text-foreground/80">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                      <Input id="profile-email" value={user.email} className={`${fieldClassName} pl-9 bg-muted/40 cursor-not-allowed`} disabled />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-phone" className="text-sm font-semibold text-foreground/80">Phone *</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                      <Input id="profile-phone" value={form.phone} onChange={handleChange("phone")} className={`${fieldClassName} pl-9`} placeholder="+91 98765 43210" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-photo" className="text-sm font-semibold text-foreground/80">Photo URL</Label>
                    <div className="relative">
                      <Camera className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                      <Input id="profile-photo" type="url" value={form.profilePhotoUrl} onChange={handleChange("profilePhotoUrl")} className={`${fieldClassName} pl-9`} placeholder="https://example.com/photo.jpg" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Clinical Profile */}
            {activeTab === "clinical" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-3">
                  <FieldIcon><HeartPulse className="h-5 w-5" /></FieldIcon>
                  <div>
                    <h3 className="text-lg font-extrabold text-foreground">Clinical Profile</h3>
                    <p className="text-sm text-muted-foreground font-medium">Core demographic and biometric information for consultations.</p>
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-6">
                  <div className="space-y-2 sm:col-span-2 lg:col-span-2">
                    <Label htmlFor="profile-dob" className="text-sm font-semibold text-foreground/80">Date of Birth *</Label>
                    <Input id="profile-dob" type="date" value={form.dateOfBirth} onChange={handleChange("dateOfBirth")} className={fieldClassName} />
                  </div>
                  <div className="space-y-2 sm:col-span-1">
                    <Label htmlFor="profile-gender" className="text-sm font-semibold text-foreground/80">Gender *</Label>
                    <select id="profile-gender" value={form.gender} onChange={handleChange("gender")} className={selectClassName}>
                      <option value="">Select</option>
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                      <option value="Other">Other</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  </div>
                  <div className="space-y-2 sm:col-span-1">
                    <Label htmlFor="profile-blood" className="text-sm font-semibold text-foreground/80">Blood Group *</Label>
                    <select id="profile-blood" value={form.bloodGroup} onChange={handleChange("bloodGroup")} className={selectClassName}>
                      <option value="">Select</option>
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
                  <div className="space-y-2 sm:col-span-1">
                    <Label htmlFor="profile-height" className="text-sm font-semibold text-foreground/80">Height (cm)</Label>
                    <div className="relative">
                      <Ruler className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                      <Input id="profile-height" value={form.heightCm} onChange={handleChange("heightCm")} className={`${fieldClassName} pl-9`} inputMode="numeric" placeholder="170" />
                    </div>
                  </div>
                  <div className="space-y-2 sm:col-span-1">
                    <Label htmlFor="profile-weight" className="text-sm font-semibold text-foreground/80">Weight (kg)</Label>
                    <div className="relative">
                      <Weight className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                      <Input id="profile-weight" value={form.weightKg} onChange={handleChange("weightKg")} className={`${fieldClassName} pl-9`} inputMode="numeric" placeholder="70" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Medical Considerations */}
            {activeTab === "medical" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-3">
                  <FieldIcon><Activity className="h-5 w-5" /></FieldIcon>
                  <div>
                    <h3 className="text-lg font-extrabold text-foreground">Medical Considerations</h3>
                    <p className="text-sm text-muted-foreground font-medium">Document allergies and chronic conditions that may impact your care.</p>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="profile-allergies" className="text-sm font-semibold text-foreground/80">Allergies or Foods to Avoid</Label>
                    <Textarea id="profile-allergies" value={form.allergies} onChange={handleChange("allergies")} className="min-h-[120px] rounded-lg border-input bg-background/80 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-300" placeholder="e.g., peanuts, lactose, shellfish" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-conditions" className="text-sm font-semibold text-foreground/80">Chronic Conditions</Label>
                    <Textarea id="profile-conditions" value={form.chronicConditions} onChange={handleChange("chronicConditions")} className="min-h-[120px] rounded-lg border-input bg-background/80 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-300" placeholder="e.g., diabetes, asthma, hypertension" />
                  </div>
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="mt-8 flex flex-col gap-4 border-t border-border/80 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-bold text-muted-foreground">
                {completionPercent === 100 ? (
                  <span className="text-accent flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> All mandatory fields completed
                  </span>
                ) : (
                  <span className="text-warning flex items-center gap-1.5 animate-pulse">
                    <AlertCircle className="h-4 w-4" /> {missingFields.length} field{missingFields.length === 1 ? "" : "s"} pending completion
                  </span>
                )}
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:w-auto w-full">
                <Button asChild variant="outline" className="w-full sm:w-auto font-bold transition-all duration-200 active:scale-[0.98]">
                  <Link href={getDashboardPath(user.role)}>
                    <ArrowLeft className="h-4 w-4" />
                    Return to dashboard
                  </Link>
                </Button>
                <Button type="submit" variant="hero" className="w-full sm:w-auto font-bold transition-all duration-200 hover:shadow-md active:scale-[0.98]" disabled={saving || loading || !form.name.trim()}>
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : "Save Profile"}
                </Button>
              </div>
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
