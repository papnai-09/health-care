import Image from "next/image";
import Link from "next/link";
import { Activity, ArrowRight, Bot, CalendarCheck, ClipboardList, FileHeart, ShieldCheck, Stethoscope, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { User, useAuth } from "@/lib/auth";
import { getDashboardPath } from "@/lib/routes";
import heroImg from "@/assets/hero-health.jpg";

const features = [
  {
    icon: Bot,
    title: "AI Symptom Guidance",
    desc: "A calm assistant that asks relevant questions and guides users toward next steps.",
    href: "/chatbot",
  },
  {
    icon: CalendarCheck,
    title: "Doctor Appointments",
    desc: "Pick a verified doctor, select a slot, and keep upcoming consultations visible.",
    href: "/appointments",
  },
  {
    icon: FileHeart,
    title: "Health Records",
    desc: "Store consultations, reports, vaccinations, and prescriptions in one place.",
    href: "/records",
  },
];

const stats = [
  { value: "24/7", label: "Assistant access" },
  { value: "Admin", label: "Approved doctors" },
  { value: "3 min", label: "Average booking" },
  { value: "Secure", label: "Personal records" },
];

const steps = [
  { n: "01", title: "Describe symptoms", desc: "Share what you feel, duration, and severity in plain language." },
  { n: "02", title: "Review guidance", desc: "Get simple triage, home-care pointers, and safety reminders." },
  { n: "03", title: "Book care", desc: "Choose a doctor and save the consultation in your health timeline." },
];

const roleHome = {
  admin: {
    eyebrow: "Admin home",
    title: "Management workspace is ready",
    desc: "Manage pending approvals, user activity, and appointment operations from the admin console.",
    primary: "Open Admin Console",
    secondary: "Pending Approvals",
    secondaryHref: "/admin",
    stats: [
      { value: "Secure", label: "Admin access" },
      { value: "Live", label: "Pending approval" },
      { value: "Managed", label: "Users" },
      { value: "Ready", label: "Operations" },
    ],
    actions: [
      { href: "/admin", icon: ShieldCheck, title: "Pending approvals", desc: "Review pending doctor profiles and approve them for patient booking." },
      { href: "/admin", icon: Users, title: "Manage users", desc: "Review registered users and remove invalid accounts when needed." },
      { href: "/admin", icon: CalendarCheck, title: "Monitor appointments", desc: "Track appointment status and update operational records." },
    ],
  },
  patient: {
    eyebrow: "Patient home",
    title: "Your care hub is ready",
    desc: "Continue your symptom checks, upcoming appointments, and personal health records without signing in again.",
    primary: "Open Patient Dashboard",
    secondary: "Start AI Chat",
    secondaryHref: "/chatbot",
    stats: [
      { value: "Active", label: "Session saved" },
      { value: "24/7", label: "AI guidance" },
      { value: "Private", label: "Your records" },
      { value: "Ready", label: "Care access" },
    ],
    actions: [
      { href: "/chatbot", icon: Bot, title: "Continue AI guidance", desc: "Ask health questions and keep your chat history linked to this account." },
      { href: "/appointments", icon: CalendarCheck, title: "Manage appointments", desc: "Book or review consultations with available doctors." },
      { href: "/records", icon: FileHeart, title: "Open health records", desc: "View reports, prescriptions, vaccinations, and consultation notes." },
    ],
  },
  doctor: {
    eyebrow: "Doctor home",
    title: "Your clinical workspace is ready",
    desc: "Continue consultations, review patient activity, and keep care work organized under your doctor account.",
    primary: "Open Doctor Dashboard",
    secondary: "View Schedule",
    secondaryHref: "/appointments",
    stats: [
      { value: "Active", label: "Session saved" },
      { value: "Today", label: "Schedule view" },
      { value: "Secure", label: "Clinical access" },
      { value: "Online", label: "Care tools" },
    ],
    actions: [
      { href: "/appointments", icon: Users, title: "Review consultations", desc: "Check upcoming appointments and patient booking details." },
      { href: "/records", icon: ClipboardList, title: "Clinical records", desc: "Keep consultation notes and care documents organized." },
      { href: "/chatbot", icon: Stethoscope, title: "AI care support", desc: "Use assistant support while preparing patient guidance." },
    ],
  },
};

function LoggedInHome({ user }: { user: User }) {
  const config = roleHome[user.role === "admin" ? "admin" : user.role === "doctor" ? "doctor" : "patient"];
  const dashboardPath = getDashboardPath(user.role);
  const isAdmin = user.role === "admin";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="border-b border-border bg-gradient-card py-16 md:py-20">
        <div className="container">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div className="animate-fade-up">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary">
                <Activity className="h-3.5 w-3.5" />
                {config.eyebrow}
              </div>
              <h1 className="max-w-3xl text-4xl font-extrabold leading-tight text-foreground md:text-6xl">
                {config.title}, {user.name}
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">{config.desc}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild variant="hero" size="xl">
                  <Link href={dashboardPath}>
                    {config.primary} <ArrowRight className="h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="xl">
                  <Link href={config.secondaryHref}>{config.secondary}</Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-3 rounded-lg border border-border bg-card p-5 shadow-card">
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-soft text-lg font-extrabold text-primary">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-bold text-foreground">{user.name}</div>
                  <div className="text-xs capitalize text-muted-foreground">{user.role} account</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {config.stats.map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-border bg-surface p-4">
                    <div className="text-lg font-extrabold text-primary">{stat.value}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {!isAdmin && (
        <section className="py-14 md:py-16">
          <div className="container">
            <div className="mb-8 max-w-2xl">
              <p className="mb-2 text-sm font-semibold text-primary">Quick access</p>
              <h2 className="text-3xl font-bold md:text-4xl">Continue from your saved session</h2>
            </div>
            <div className="grid items-stretch gap-5 md:grid-cols-3">
              {config.actions.map((action) => (
                <Link
                  key={action.title}
                  href={action.href}
                  className="group flex h-full flex-col rounded-lg border border-border bg-card p-6 shadow-card transition-smooth hover:-translate-y-1 hover:border-primary/45 hover:shadow-elevated"
                >
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-primary-soft">
                    <action.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h3 className="text-lg font-bold">{action.title}</h3>
                    <ArrowRight className="h-4 w-4 text-primary opacity-0 transition-smooth group-hover:translate-x-1 group-hover:opacity-100" />
                  </div>
                  <p className="flex-1 text-sm leading-6 text-muted-foreground">{action.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}

function GuestHome() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="relative overflow-hidden border-b border-border bg-surface">
        <Image
          src={heroImg}
          alt="Doctor consulting a patient through telehealth"
          fill
          priority
          className="object-cover object-center opacity-20"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/92 to-background/55" />
        <div className="container relative py-20 md:py-24">
          <div className="max-w-3xl animate-fade-up">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              Built for accessible rural healthcare
            </div>
            <h1 className="text-4xl font-extrabold leading-tight text-foreground md:text-6xl">MediCare AI</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
              A professional health companion for symptom guidance, doctor appointments, and personal medical records.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="hero" size="xl">
                <Link href="/register">
                  Create Account <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="xl">
                <Link href="/login">Login</Link>
              </Button>
            </div>
            <div className="mt-10 grid max-w-2xl grid-cols-2 items-stretch gap-3 md:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="h-full rounded-lg border border-border bg-card/85 p-4 shadow-soft backdrop-blur">
                  <div className="text-xl font-extrabold text-primary">{stat.value}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-16 md:py-20">
        <div className="container">
          <div className="mb-10 max-w-2xl">
            <p className="mb-2 text-sm font-semibold text-primary">Features</p>
            <h2 className="text-3xl font-bold md:text-4xl">Core care workflows in one clean interface</h2>
          </div>
          <div className="grid items-stretch gap-5 md:grid-cols-3">
            {features.map((feature) => (
              <Link
                key={feature.title}
                href={feature.href}
                className="group flex h-full flex-col rounded-lg border border-border bg-card p-6 shadow-card transition-smooth hover:-translate-y-1 hover:border-primary/45 hover:shadow-elevated"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-primary-soft">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold">{feature.title}</h3>
                  <ArrowRight className="h-4 w-4 text-primary opacity-0 transition-smooth group-hover:translate-x-1 group-hover:opacity-100" />
                </div>
                <p className="flex-1 text-sm leading-6 text-muted-foreground">{feature.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="border-y border-border bg-surface py-16 md:py-20">
        <div className="container">
          <div className="mb-10 max-w-2xl">
            <p className="mb-2 text-sm font-semibold text-primary">How it works</p>
            <h2 className="text-3xl font-bold md:text-4xl">From first symptom to follow-up record</h2>
          </div>
          <div className="grid items-stretch gap-5 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.n} className="h-full rounded-lg border border-border bg-card p-6 shadow-soft">
                <div className="mb-4 text-sm font-bold text-accent">{step.n}</div>
                <h3 className="mb-2 text-lg font-bold">{step.title}</h3>
                <p className="text-sm leading-6 text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container flex min-h-[70vh] items-center justify-center">
          <div className="rounded-lg border border-border bg-card px-5 py-4 text-sm text-muted-foreground shadow-soft">
            Preparing your saved session...
          </div>
        </div>
      </div>
    );
  }

  return user ? <LoggedInHome user={user} /> : <GuestHome />;
}
