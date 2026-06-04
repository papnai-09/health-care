import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, CalendarClock, CheckCircle2, ClipboardList, Search, Stethoscope, X } from "lucide-react";
import { useRouter } from "next/router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "./ThemeToggle";
import { getAdminOverview, getAppointments, getDoctor, type Appointment, type Doctor } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface Props {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  tone: "primary" | "warning" | "accent";
  icon: "profile" | "appointment" | "doctor" | "clear";
  actionLabel?: string;
  onAction?: () => void;
};

const getUserInitials = (name?: string, email?: string) => {
  const source = name?.trim() || email?.split("@")[0] || "User";
  const initials = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "U";
};

const parseAppointmentDateTime = (appointment: Appointment) => {
  const parsed = new Date(`${appointment.date}T${appointment.time || "00:00"}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatAppointmentDateTime = (appointment: Appointment) => {
  const parsed = parseAppointmentDateTime(appointment);
  if (!parsed) {
    return `${appointment.date} at ${appointment.time}`;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(parsed);
};

export const DashboardLayout = ({ children, title, subtitle }: Props) => {
  const { user } = useAuth();
  const router = useRouter();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctorProfile, setDoctorProfile] = useState<Doctor | null>(null);
  const [pendingDoctorCount, setPendingDoctorCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const notificationsRef = useRef<HTMLDivElement | null>(null);

  const initials = useMemo(() => getUserInitials(user?.name, user?.email), [user?.name, user?.email]);
  const profilePhotoUrl = user?.profile?.profilePhotoUrl?.trim();
  const isAdmin = user?.role === "admin";

  const loadNotificationData = useCallback(async () => {
    if (!user) {
      setAppointments([]);
      setDoctorProfile(null);
      setPendingDoctorCount(0);
      return;
    }

    setNotificationsLoading(true);
    try {
      if (isAdmin) {
        const overview = await getAdminOverview();
        setAppointments([]);
        setDoctorProfile(null);
        setPendingDoctorCount(overview.stats.pendingDoctors);
      } else {
        const [nextAppointments, nextDoctorProfile] = await Promise.all([
          getAppointments(),
          user.role === "doctor" && user.doctorId ? getDoctor(user.doctorId).catch(() => null) : Promise.resolve(null),
        ]);

        setAppointments(nextAppointments);
        setDoctorProfile(nextDoctorProfile);
        setPendingDoctorCount(0);
      }
    } catch {
      setAppointments([]);
      setDoctorProfile(null);
      setPendingDoctorCount(0);
    } finally {
      setNotificationsLoading(false);
    }
  }, [isAdmin, user]);

  useEffect(() => {
    void loadNotificationData();
  }, [loadNotificationData]);

  useEffect(() => {
    if (notificationsOpen) {
      void loadNotificationData();
    }
  }, [notificationsOpen, loadNotificationData]);

  useEffect(() => {
    if (!notificationsOpen) return undefined;

    const handleOutsideClick = (event: MouseEvent) => {
      if (!notificationsRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [notificationsOpen]);

  const notificationItems = useMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = [];
    const now = new Date();
    const scheduledAppointments = appointments
      .filter((appointment) => appointment.status === "scheduled")
      .map((appointment) => ({ appointment, parsed: parseAppointmentDateTime(appointment) }))
      .filter(({ parsed }) => parsed && parsed >= now)
      .sort((first, second) => first.parsed!.getTime() - second.parsed!.getTime());

    if (user?.role === "admin" && pendingDoctorCount > 0) {
      items.push({
        id: "admin-doctor-approvals",
        title: "Doctor approvals pending",
        body: `${pendingDoctorCount} doctor profile${pendingDoctorCount === 1 ? "" : "s"} need admin approval before patients can book them.`,
        tone: "warning",
        icon: "doctor",
        actionLabel: "Pending approvals",
        onAction: () => {
          setNotificationsOpen(false);
          void router.push("/admin");
        },
      });
    }

    if (!user?.verified) {
      items.push({
        id: "profile-incomplete",
        title: "Complete profile details",
        body: "Add required health and emergency details so your profile is ready for verification.",
        tone: "warning",
        icon: "profile",
        actionLabel: "Open profile",
        onAction: () => {
          setNotificationsOpen(false);
          void router.push("/profile");
        },
      });
    }

    const nextAppointment = scheduledAppointments[0]?.appointment;
    if (nextAppointment) {
      items.push({
        id: `appointment-${nextAppointment.id}`,
        title: user?.role === "doctor" ? "Upcoming consultation" : "Upcoming appointment",
        body:
          user?.role === "doctor"
            ? `${nextAppointment.patientName ?? "Patient"} - ${formatAppointmentDateTime(nextAppointment)}`
            : `${nextAppointment.doctorName} - ${formatAppointmentDateTime(nextAppointment)}`,
        tone: "primary",
        icon: "appointment",
        actionLabel: user?.role === "doctor" ? "Doctor dashboard" : "View appointments",
        onAction: () => {
          setNotificationsOpen(false);
          void router.push(user?.role === "doctor" ? "/doctor-dashboard" : "/appointments");
        },
      });
    }

    if (user?.role === "doctor" && doctorProfile && doctorProfile.approved !== true) {
      items.push({
        id: "doctor-approval",
        title: "Doctor profile pending",
        body: "Your profile will be visible to patients after admin approval.",
        tone: "warning",
        icon: "doctor",
        actionLabel: "View dashboard",
        onAction: () => {
          setNotificationsOpen(false);
          void router.push("/doctor-dashboard");
        },
      });
    }

    if (!items.length) {
      items.push({
        id: "all-clear",
        title: "No new notifications",
        body: "There are no pending profile reminders or upcoming appointments.",
        tone: "accent",
        icon: "clear",
      });
    }

    return items;
  }, [appointments, doctorProfile, pendingDoctorCount, router, user]);

  const activeNotificationCount = notificationItems.filter((item) => item.id !== "all-clear").length;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-surface">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-border bg-background/90 px-4 backdrop-blur-xl md:px-6">
            <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-3">
              <SidebarTrigger className="h-10 w-10 shrink-0 rounded-lg text-muted-foreground hover:bg-primary-soft hover:text-primary" />
              <div className="hidden max-w-md flex-1 items-center gap-2 md:flex">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Search" className="h-9 border-transparent bg-muted/50 pl-9 focus-visible:bg-background" />
                </div>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
                <ThemeToggle />
                <div className="relative" ref={notificationsRef}>
                  <button
                    type="button"
                    onClick={() => setNotificationsOpen((open) => !open)}
                    className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg ring-offset-background transition-smooth hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label="Notifications"
                    aria-expanded={notificationsOpen}
                    title="Notifications"
                  >
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    {activeNotificationCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-accent-foreground shadow-soft">
                        {activeNotificationCount > 9 ? "9+" : activeNotificationCount}
                      </span>
                    )}
                  </button>

                  {notificationsOpen && (
                    <div className="absolute right-0 top-12 z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-background shadow-2xl sm:w-96">
                      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
                        <div>
                          <h2 className="text-sm font-bold text-foreground">Notifications</h2>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {notificationsLoading ? "Checking updates..." : `${activeNotificationCount} active reminder${activeNotificationCount === 1 ? "" : "s"}`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNotificationsOpen(false)}
                          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-smooth hover:bg-muted hover:text-foreground"
                          aria-label="Close notifications"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="max-h-96 overflow-y-auto p-2">
                        {notificationItems.map((item) => (
                          <div key={item.id} className="rounded-lg p-3 transition-smooth hover:bg-muted/55">
                            <div className="flex gap-3">
                              <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                                  item.tone === "warning"
                                    ? "bg-warning/10 text-warning"
                                    : item.tone === "accent"
                                      ? "bg-accent-soft text-accent"
                                      : "bg-primary-soft text-primary"
                                }`}
                              >
                                {item.icon === "appointment" && <CalendarClock className="h-5 w-5" />}
                                {item.icon === "profile" && <ClipboardList className="h-5 w-5" />}
                                {item.icon === "doctor" && <Stethoscope className="h-5 w-5" />}
                                {item.icon === "clear" && <CheckCircle2 className="h-5 w-5" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="text-sm font-bold text-foreground">{item.title}</h3>
                                <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.body}</p>
                                {item.onAction && item.actionLabel && (
                                  <button
                                    type="button"
                                    onClick={item.onAction}
                                    className="mt-3 inline-flex cursor-pointer items-center justify-center rounded-lg bg-primary-soft px-3 py-2 text-xs font-bold text-primary transition-smooth hover:bg-primary hover:text-primary-foreground"
                                  >
                                    {item.actionLabel}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {isAdmin ? (
                  <div className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm font-bold text-muted-foreground">Admin</div>
                ) : (
                  <button
                    type="button"
                    onClick={() => void router.push("/profile")}
                    className="group relative flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-accent text-sm font-bold text-accent-foreground shadow-soft ring-offset-background transition-smooth hover:-translate-y-0.5 hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label="Open profile"
                    title="Open profile"
                  >
                    {profilePhotoUrl ? (
                      <img src={profilePhotoUrl} alt={user?.name ?? "Profile"} className="h-full w-full object-cover" />
                    ) : (
                      <span>{initials}</span>
                    )}
                  </button>
                )}
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-x-hidden p-4 md:p-6 xl:p-8">
            <div className="mx-auto w-full max-w-[1440px]">
              {(title || subtitle) && (
                <div className="mb-6 animate-fade-up md:mb-8">
                  {title && <h1 className="text-2xl font-bold text-foreground md:text-3xl">{title}</h1>}
                  {subtitle && <p className="mt-1 max-w-3xl text-muted-foreground">{subtitle}</p>}
                </div>
              )}
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
