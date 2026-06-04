import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight, CalendarCheck, ClipboardList, Clock, MessageCircle, Stethoscope, Users, Video } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Appointment, getAppointments } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const quickActions = [
  { href: "/appointments", icon: CalendarCheck, title: "Open schedule", desc: "Review upcoming consultations and join patient calls." },
  { href: "/records", icon: ClipboardList, title: "Clinical records", desc: "Review patient notes, prescriptions, and report history." },
  { href: "/chatbot", icon: MessageCircle, title: "AI care support", desc: "Use AI support while preparing patient guidance." },
];

const formatPatient = (appointment: Appointment) => appointment.patientName ?? `Patient ${appointment.userId.slice(0, 6)}`;

function DoctorDashboardContent() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSchedule = async () => {
      try {
        setAppointments(await getAppointments());
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load doctor schedule.");
      } finally {
        setLoading(false);
      }
    };

    loadSchedule();
  }, []);

  const scheduled = appointments.filter((appointment) => appointment.status === "scheduled");
  const completed = appointments.filter((appointment) => appointment.status === "completed");
  const uniquePatients = new Set(appointments.map((appointment) => appointment.userId)).size;
  const upcoming = useMemo(() => scheduled.slice(0, 5), [scheduled]);

  if (!user) return null;

  return (
    <DashboardLayout>
      <section className="mb-8 rounded-lg border border-border bg-gradient-card p-6 shadow-card md:p-8 animate-fade-up">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary">Doctor workspace</p>
            <h1 className="mt-1 text-3xl font-extrabold text-foreground md:text-4xl">Good morning, Dr. {user.name}</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Review your consultation schedule, patient queue, and clinical work from one dedicated doctor dashboard.
            </p>
          </div>
          <Button asChild size="lg" variant="hero" className="shrink-0">
            <Link href="/appointments">
              View Schedule <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="mb-8 grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: CalendarCheck, label: "Scheduled", value: scheduled.length, tone: "bg-primary-soft text-primary" },
          { icon: Users, label: "Patients", value: uniquePatients, tone: "bg-accent-soft text-accent" },
          { icon: ClipboardList, label: "Completed", value: completed.length, tone: "bg-secondary text-secondary-foreground" },
          { icon: Activity, label: "Online visits", value: appointments.length, tone: "bg-warning/10 text-warning" },
        ].map((stat) => (
          <div key={stat.label} className="flex h-full flex-col rounded-lg border border-border bg-card p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${stat.tone}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <span className="text-2xl font-extrabold text-foreground">{loading ? "-" : stat.value}</span>
            </div>
            <div className="text-sm font-semibold text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </section>

      <section className="mb-8 grid items-stretch gap-5 md:grid-cols-3">
        {quickActions.map((action) => (
          <Link
            key={action.title}
            href={action.href}
            className="group flex h-full flex-col rounded-lg border border-border bg-card p-6 shadow-card transition-smooth hover:-translate-y-0.5 hover:border-primary/40"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary-soft">
              <action.icon className="h-6 w-6 text-primary" />
            </div>
            <h3 className="mb-1 text-lg font-bold">{action.title}</h3>
            <p className="mb-4 flex-1 text-sm leading-6 text-muted-foreground">{action.desc}</p>
            <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-primary">
              Open <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </section>

      <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="min-w-0 rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">Consultation schedule</h2>
              <p className="text-sm text-muted-foreground">Upcoming patient appointments assigned to the clinical team.</p>
            </div>
            <Button asChild variant="soft" size="sm">
              <Link href="/appointments">Full schedule</Link>
            </Button>
          </div>

          {loading ? (
            <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">Loading schedule...</div>
          ) : upcoming.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">No scheduled consultations yet.</div>
          ) : (
            <div className="space-y-3">
              {upcoming.map((appointment) => (
                <div key={appointment.id} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
                    <Video className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{formatPatient(appointment)}</div>
                    <div className="text-xs text-muted-foreground">{appointment.specialty} with {appointment.doctorName}</div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><CalendarCheck className="h-3 w-3" /> {appointment.date}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {appointment.time}</span>
                      <span className="flex items-center gap-1"><Stethoscope className="h-3 w-3" /> {appointment.type}</span>
                    </div>
                  </div>
                  <Button variant="hero" size="sm">Join</Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="h-fit rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
          <h2 className="mb-4 text-xl font-bold">Patient queue</h2>
          <div className="space-y-3">
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading queue...</div>
            ) : upcoming.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-surface p-5 text-sm text-muted-foreground">Queue is clear.</div>
            ) : (
              upcoming.slice(0, 4).map((appointment) => (
                <div key={`${appointment.id}-queue`} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-xs font-bold text-accent">
                    {formatPatient(appointment).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{formatPatient(appointment)}</div>
                    <div className="text-xs text-muted-foreground">{appointment.time} - {appointment.status}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </section>
    </DashboardLayout>
  );
}

export default function DoctorDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={["doctor"]}>
      <DoctorDashboardContent />
    </ProtectedRoute>
  );
}
