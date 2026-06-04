import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarCheck, CalendarX, Dumbbell, FileHeart, Loader2, MessageCircle, Utensils } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Appointment, DietPlanInput, generateDietPlan, getAppointments } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const quickActions = [
  { to: "/chatbot", icon: MessageCircle, title: "Start AI Chat", desc: "Describe symptoms and get instant guidance." },
  { to: "/appointments", icon: CalendarCheck, title: "Book Appointment", desc: "Choose a doctor and time that works for you." },
  { to: "/records", icon: FileHeart, title: "View Records", desc: "Keep reports, notes, and prescriptions organized." },
];

const defaultDietInput: DietPlanInput = {
  condition: "",
  allergies: "",
  excludedFoods: "",
  calorieTarget: "",
  bodyGoal: "Maintain healthy weight",
  activityLevel: "Light activity",
};

const appointmentDateTime = (appointment: Appointment) => new Date(`${appointment.date}T${appointment.time || "00:00"}:00`);

const formatAppointmentDate = (appointment: Appointment) => {
  const date = appointmentDateTime(appointment);
  if (Number.isNaN(date.getTime())) return appointment.date;

  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
};

const formatAppointmentTime = (appointment: Appointment) => {
  const date = appointmentDateTime(appointment);
  if (Number.isNaN(date.getTime())) return appointment.time;

  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

function DashboardContent() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [dietInput, setDietInput] = useState<DietPlanInput>(defaultDietInput);
  const [dietPlan, setDietPlan] = useState("");
  const [generatingPlan, setGeneratingPlan] = useState(false);

  useEffect(() => {
    if (!user) return;

    const loadAppointments = async () => {
      setAppointmentsLoading(true);
      try {
        setAppointments(await getAppointments());
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load next appointment.");
      } finally {
        setAppointmentsLoading(false);
      }
    };

    loadAppointments();
  }, [user]);

  const nextAppointment = useMemo(() => {
    const now = new Date().getTime();

    return appointments
      .filter((appointment) => appointment.status === "scheduled")
      .filter((appointment) => {
        const time = appointmentDateTime(appointment).getTime();
        return Number.isFinite(time) && time >= now;
      })
      .sort((a, b) => appointmentDateTime(a).getTime() - appointmentDateTime(b).getTime())[0];
  }, [appointments]);

  if (!user) return null;

  const updateDietInput = (key: keyof DietPlanInput, value: string) => {
    setDietInput((current) => ({ ...current, [key]: value }));
  };

  const submitDietPlan = async (event: FormEvent) => {
    event.preventDefault();

    if (!dietInput.condition.trim()) {
      toast.error("Please add the disease or health concern first.");
      return;
    }

    setGeneratingPlan(true);
    try {
      const response = await generateDietPlan(dietInput);
      setDietPlan(response.plan);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to generate diet plan.");
    } finally {
      setGeneratingPlan(false);
    }
  };

  return (
    <DashboardLayout>
      <section className="mb-8 rounded-lg border border-border bg-gradient-card p-6 shadow-card md:p-8 animate-fade-up">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary">Care workspace</p>
            <h1 className="mt-1 text-3xl font-extrabold text-foreground md:text-4xl">Good morning, {user.name}</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Build a diet and movement plan, start a symptom check, or schedule a consultation with a verified doctor.
            </p>
          </div>
          <Button asChild size="lg" variant="hero" className="shrink-0">
            <Link href="/chatbot">
              Talk to AI <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Quick actions</h2>
        </div>
        <div className="grid items-stretch gap-5 md:grid-cols-3">
          {quickActions.map((action) => (
            <Link key={action.title} href={action.to} className="group flex h-full flex-col rounded-lg border border-border bg-card p-6 shadow-card transition-smooth hover:-translate-y-0.5 hover:border-primary/40">
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
        </div>
      </section>

      <section className="grid items-start gap-5 lg:grid-cols-3">
        <div className="min-w-0 rounded-lg border border-border bg-card p-5 shadow-card sm:p-6 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Diet and movement plan</h2>
              <p className="mt-1 text-xs text-muted-foreground">Disease-aware meals, calories, yoga and exercise</p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
              <Utensils className="h-5 w-5 text-accent" />
            </div>
          </div>

          <form onSubmit={submitDietPlan} className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="condition">Disease / health concern</Label>
              <Textarea
                id="condition"
                value={dietInput.condition}
                onChange={(event) => updateDietInput("condition", event.target.value)}
                placeholder="Example: diabetes, thyroid, fever recovery, acidity, high BP"
                className="min-h-20 rounded-lg"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="allergies">Food allergies</Label>
                <Input
                  id="allergies"
                  value={dietInput.allergies}
                  onChange={(event) => updateDietInput("allergies", event.target.value)}
                  placeholder="Example: peanuts, milk, gluten"
                  className="h-11 rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="excludedFoods">Do not add</Label>
                <Input
                  id="excludedFoods"
                  value={dietInput.excludedFoods}
                  onChange={(event) => updateDietInput("excludedFoods", event.target.value)}
                  placeholder="Example: eggs, onion, rice"
                  className="h-11 rounded-lg"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="calorieTarget">Calories</Label>
                <Input
                  id="calorieTarget"
                  value={dietInput.calorieTarget}
                  onChange={(event) => updateDietInput("calorieTarget", event.target.value)}
                  placeholder="Example: 1800 kcal"
                  className="h-11 rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bodyGoal">Body goal</Label>
                <select
                  id="bodyGoal"
                  value={dietInput.bodyGoal}
                  onChange={(event) => updateDietInput("bodyGoal", event.target.value)}
                  className="h-11 w-full cursor-pointer rounded-lg border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option>Maintain healthy weight</option>
                  <option>Weight loss / motapa kam karna</option>
                  <option>Weight gain / patlepan improve karna</option>
                  <option>Muscle gain</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="activityLevel">Activity</Label>
                <select
                  id="activityLevel"
                  value={dietInput.activityLevel}
                  onChange={(event) => updateDietInput("activityLevel", event.target.value)}
                  className="h-11 w-full cursor-pointer rounded-lg border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option>Low activity</option>
                  <option>Light activity</option>
                  <option>Moderate activity</option>
                  <option>High activity</option>
                </select>
              </div>
            </div>

            <Button type="submit" variant="hero" className="w-full sm:w-fit" disabled={generatingPlan}>
              {generatingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Dumbbell className="h-4 w-4" />}
              {generatingPlan ? "Generating..." : "Generate plan"}
            </Button>
          </form>

          {dietPlan && (
            <div className="mt-5 rounded-lg border border-border bg-surface p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
                <Dumbbell className="h-4 w-4 text-primary" />
                Personalized plan
              </div>
              <div className="whitespace-pre-line text-sm leading-7 text-muted-foreground">{dietPlan}</div>
            </div>
          )}
        </div>

        <div className="h-fit rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
          <h2 className="mb-4 text-xl font-bold">Next appointment</h2>
          {appointmentsLoading ? (
            <div className="rounded-lg border border-border bg-surface p-5 text-sm text-muted-foreground">Checking appointments...</div>
          ) : nextAppointment ? (
            <div className="rounded-lg border border-primary/20 bg-primary-soft p-5">
              <div className="text-xs font-semibold text-primary">
                {formatAppointmentDate(nextAppointment)}, {formatAppointmentTime(nextAppointment)}
              </div>
              <div className="mt-1 text-lg font-bold">{nextAppointment.doctorName}</div>
              <div className="text-sm text-muted-foreground">
                {nextAppointment.specialty}, {nextAppointment.type}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-surface p-5 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-primary-soft">
                <CalendarX className="h-5 w-5 text-primary" />
              </div>
              <div className="font-bold">No upcoming appointment</div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Book a consultation when you need one.</p>
            </div>
          )}
          <Button asChild variant="soft" className="mt-4 w-full">
            <Link href="/appointments">{nextAppointment ? "Manage appointments" : "Book appointment"}</Link>
          </Button>
        </div>
      </section>
    </DashboardLayout>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute allowedRoles={["patient"]}>
      <DashboardContent />
    </ProtectedRoute>
  );
}
