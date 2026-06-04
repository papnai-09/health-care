import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  Trash2,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import {
  AdminOverview,
  AdminUser,
  Appointment,
  deleteAdminUser,
  Doctor,
  getAdminOverview,
  updateAdminAppointment,
  updateAdminDoctor,
} from "@/lib/api";

type AdminTab = "doctors" | "patients" | "users" | "appointments";
type UserRoleFilter = "all" | "patient" | "doctor" | "admin";

const tabs: Array<{ id: AdminTab; label: string; icon: typeof ShieldCheck }> = [
  { id: "doctors", label: "Doctors", icon: Stethoscope },
  { id: "patients", label: "Patients", icon: UserRound },
  { id: "users", label: "Users", icon: Users },
  { id: "appointments", label: "Appointments", icon: CalendarCheck },
];

const userFilters: Array<{ id: UserRoleFilter; label: string }> = [
  { id: "all", label: "All users" },
  { id: "patient", label: "Patients" },
  { id: "doctor", label: "Doctors" },
  { id: "admin", label: "Admins" },
];

const emptyOverview: AdminOverview = {
  stats: {
    users: 0,
    patients: 0,
    doctors: 0,
    pendingDoctors: 0,
    appointments: 0,
    scheduledAppointments: 0,
  },
  users: [],
  doctors: [],
  appointments: [],
};

const roleBadgeClass = (role?: string) => {
  if (role === "admin") return "bg-primary-soft text-primary";
  if (role === "doctor") return "bg-accent-soft text-accent";
  return "bg-muted text-muted-foreground";
};

const accountRole = (user: AdminUser): UserRoleFilter => user.role ?? "patient";

const appointmentStatusMeta: Record<Appointment["status"], { label: string; badge: string; icon: string }> = {
  scheduled: {
    label: "Scheduled",
    badge: "bg-primary-soft text-primary",
    icon: "bg-primary-soft text-primary",
  },
  completed: {
    label: "Completed",
    badge: "bg-accent-soft text-accent",
    icon: "bg-accent-soft text-accent",
  },
  cancelled: {
    label: "Cancelled",
    badge: "bg-destructive/10 text-destructive",
    icon: "bg-destructive/10 text-destructive",
  },
};

const appointmentStatusRank: Record<Appointment["status"], number> = {
  scheduled: 0,
  completed: 1,
  cancelled: 2,
};

const formatDateTime = (appointment: Appointment) => {
  const parsed = new Date(`${appointment.date}T${appointment.time || "00:00"}:00`);
  if (Number.isNaN(parsed.getTime())) return `${appointment.date} ${appointment.time}`;

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
};

const appointmentSortValue = (appointment: Appointment) => {
  const scheduledAt = new Date(`${appointment.date}T${appointment.time || "00:00"}:00`).getTime();
  if (!Number.isNaN(scheduledAt)) return scheduledAt;

  const createdAt = new Date(appointment.createdAt).getTime();
  return Number.isNaN(createdAt) ? 0 : createdAt;
};

function AdminContent() {
  const [overview, setOverview] = useState<AdminOverview>(emptyOverview);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("doctors");
  const [userFilter, setUserFilter] = useState<UserRoleFilter>("all");

  const pendingDoctors = useMemo(() => overview.doctors.filter((doctor) => doctor.approved !== true), [overview.doctors]);
  const approvedDoctors = useMemo(() => overview.doctors.filter((doctor) => doctor.approved === true), [overview.doctors]);
  const patientUsers = useMemo(() => overview.users.filter((user) => accountRole(user) === "patient"), [overview.users]);
  const filteredUsers = useMemo(
    () => overview.users.filter((user) => userFilter === "all" || accountRole(user) === userFilter),
    [overview.users, userFilter],
  );
  const patientAppointmentIds = useMemo(() => new Set(overview.appointments.map((appointment) => appointment.userId)), [overview.appointments]);
  const patientCounts = useMemo(
    () => ({
      total: patientUsers.length,
      complete: patientUsers.filter((user) => user.verified).length,
      incomplete: patientUsers.filter((user) => !user.verified).length,
      booked: patientUsers.filter((user) => patientAppointmentIds.has(user.id)).length,
    }),
    [patientAppointmentIds, patientUsers],
  );
  const appointmentCounts = useMemo(
    () => ({
      total: overview.appointments.length,
      scheduled: overview.appointments.filter((appointment) => appointment.status === "scheduled").length,
      completed: overview.appointments.filter((appointment) => appointment.status === "completed").length,
      cancelled: overview.appointments.filter((appointment) => appointment.status === "cancelled").length,
    }),
    [overview.appointments],
  );
  const sortedAppointments = useMemo(
    () =>
      [...overview.appointments].sort((first, second) => {
        const statusOrder = appointmentStatusRank[first.status] - appointmentStatusRank[second.status];
        if (statusOrder !== 0) return statusOrder;
        return appointmentSortValue(first) - appointmentSortValue(second);
      }),
    [overview.appointments],
  );

  const loadOverview = async () => {
    setLoading(true);
    try {
      setOverview(await getAdminOverview());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load admin data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOverview();
  }, []);

  const patchDoctor = async (doctor: Doctor, updates: Partial<Pick<Doctor, "approved" | "available" | "profileComplete">>) => {
    setBusyId(doctor.id);
    try {
      const updated = await updateAdminDoctor(doctor.id, updates);
      setOverview((current) => ({
        ...current,
        doctors: current.doctors.map((item) => (item.id === updated.id ? updated : item)),
        stats: {
          ...current.stats,
          pendingDoctors: current.doctors.map((item) => (item.id === updated.id ? updated : item)).filter((item) => item.approved !== true).length,
        },
      }));
      toast.success("Doctor updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update doctor.");
    } finally {
      setBusyId(null);
    }
  };

  const changeAppointmentStatus = async (appointment: Appointment, status: Appointment["status"]) => {
    setBusyId(appointment.id);
    try {
      const updated = await updateAdminAppointment(appointment.id, status);
      setOverview((current) => {
        const nextAppointments = current.appointments.map((item) => (item.id === updated.id ? updated : item));
        return {
          ...current,
          appointments: nextAppointments,
          stats: {
            ...current.stats,
            scheduledAppointments: nextAppointments.filter((item) => item.status === "scheduled").length,
          },
        };
      });
      toast.success("Appointment updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update appointment.");
    } finally {
      setBusyId(null);
    }
  };

  const removeUser = async (userId: string) => {
    setBusyId(userId);
    try {
      await deleteAdminUser(userId);
      setOverview(await getAdminOverview());
      toast.success("User removed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to remove user.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardLayout>
      <section className="mb-6 rounded-lg border border-border bg-gradient-card p-6 shadow-card md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Management console</p>
            <h1 className="mt-1 text-3xl font-extrabold text-foreground md:text-4xl">Welcome, Admin</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Manage pending doctor approvals, users, and appointment operations from one secure workspace.
            </p>
          </div>
          <Button variant="soft" onClick={loadOverview} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </section>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Users", value: overview.stats.users, icon: Users, tone: "bg-primary-soft text-primary" },
          { label: "Patients", value: overview.stats.patients, icon: UserRound, tone: "bg-muted text-muted-foreground" },
          { label: "Doctors", value: overview.stats.doctors, icon: Stethoscope, tone: "bg-accent-soft text-accent" },
          { label: "Pending approvals", value: overview.stats.pendingDoctors, icon: ShieldCheck, tone: "bg-warning/10 text-warning" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="mt-1 text-2xl font-extrabold text-foreground">{loading ? "-" : stat.value}</p>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${stat.tone}`}>
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </section>

      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-4 text-sm font-bold transition-smooth ${
              activeTab === tab.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">Loading management data...</div>
      ) : (
        <>
          {activeTab === "doctors" && (
            <section className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <div className="rounded-lg border border-border bg-card p-5 shadow-card">
                <h2 className="mb-4 text-xl font-bold">Pending doctor approvals</h2>
                {pendingDoctors.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">No pending doctor profiles.</div>
                ) : (
                  <div className="space-y-3">
                    {pendingDoctors.map((doctor) => (
                      <DoctorRow key={doctor.id} doctor={doctor} busy={busyId === doctor.id} onApprove={() => patchDoctor(doctor, { approved: true, available: true, profileComplete: true })} onHide={() => patchDoctor(doctor, { approved: false, available: false })} />
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border bg-card p-5 shadow-card">
                <h2 className="mb-4 text-xl font-bold">Approved doctors</h2>
                {approvedDoctors.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">No approved doctors yet.</div>
                ) : (
                  <div className="space-y-3">
                    {approvedDoctors.map((doctor) => (
                      <DoctorRow key={doctor.id} doctor={doctor} busy={busyId === doctor.id} onApprove={() => patchDoctor(doctor, { available: true, approved: true })} onHide={() => patchDoctor(doctor, { available: false, approved: false })} />
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {activeTab === "patients" && (
            <section className="rounded-lg border border-border bg-card p-5 shadow-card">
              <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <h2 className="text-xl font-bold">Patient management</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Patient accounts and care access status</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-4 xl:min-w-[520px]">
                  {[
                    { label: "Patients", value: patientCounts.total },
                    { label: "Complete", value: patientCounts.complete },
                    { label: "Incomplete", value: patientCounts.incomplete },
                    { label: "Booked", value: patientCounts.booked },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border border-border bg-surface px-3 py-2">
                      <div className="text-lg font-extrabold text-foreground">{item.value}</div>
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {patientUsers.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">No patient accounts yet.</div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {patientUsers.map((patient) => (
                    <PatientRow
                      key={patient.id}
                      patient={patient}
                      appointmentCount={overview.appointments.filter((appointment) => appointment.userId === patient.id).length}
                      busy={busyId === patient.id}
                      onRemove={() => removeUser(patient.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === "users" && (
            <section className="rounded-lg border border-border bg-card p-5 shadow-card">
              <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-bold">User management</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Sort accounts by patient, doctor, or admin role.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {userFilters.map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setUserFilter(filter.id)}
                      className={`h-9 rounded-lg border px-3 text-xs font-bold transition-smooth ${
                        userFilter === filter.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-muted-foreground hover:border-primary/40 hover:text-primary"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-3 pr-4">User</th>
                      <th className="py-3 pr-4">Role</th>
                      <th className="py-3 pr-4">Profile status</th>
                      <th className="py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="border-b border-border/60">
                        <td className="py-4 pr-4">
                          <div className="font-bold text-foreground">{user.name}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </td>
                        <td className="py-4 pr-4">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${roleBadgeClass(user.role)}`}>{accountRole(user)}</span>
                        </td>
                        <td className="py-4 pr-4">{user.verified ? "Complete" : "Incomplete"}</td>
                        <td className="py-4 text-right">
                          <Button variant="outline" size="sm" disabled={user.role === "admin" || busyId === user.id} onClick={() => removeUser(user.id)}>
                            {busyId === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === "appointments" && (
            <section className="rounded-lg border border-border bg-card p-5 shadow-card">
              <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <h2 className="text-xl font-bold">Appointment operations</h2>
                  <p className="mt-1 text-sm text-muted-foreground">All patient bookings</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-4 xl:min-w-[520px]">
                  {[
                    { label: "Total", value: appointmentCounts.total },
                    { label: "Scheduled", value: appointmentCounts.scheduled },
                    { label: "Completed", value: appointmentCounts.completed },
                    { label: "Cancelled", value: appointmentCounts.cancelled },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border border-border bg-surface px-3 py-2">
                      <div className="text-lg font-extrabold text-foreground">{item.value}</div>
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-3">
                {overview.appointments.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">No appointments yet.</div>
                ) : (
                  sortedAppointments.map((appointment) => {
                    const statusMeta = appointmentStatusMeta[appointment.status];
                    return (
                      <div key={appointment.id} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 lg:flex-row lg:items-center">
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${statusMeta.icon}`}>
                          <CalendarCheck className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                            <div className="min-w-0">
                              <div className="truncate font-bold text-foreground">
                                {appointment.patientName ?? `Patient ${appointment.userId.slice(0, 6)}`}
                              </div>
                              <div className="mt-1 truncate text-xs text-muted-foreground">
                                {appointment.patientEmail ?? "Patient email not available"}
                              </div>
                            </div>
                            <span className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${statusMeta.badge}`}>
                              {statusMeta.label}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span className="rounded-full bg-muted px-2.5 py-1">{appointment.doctorName}</span>
                            <span className="rounded-full bg-muted px-2.5 py-1">{appointment.specialty}</span>
                            <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                              <Clock className="h-3 w-3" /> {formatDateTime(appointment)}
                            </span>
                            <span className="rounded-full bg-muted px-2.5 py-1">{appointment.type}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col gap-1">
                          <label htmlFor={`appointment-status-${appointment.id}`} className="text-xs font-bold uppercase text-muted-foreground">
                            Status
                          </label>
                          <select
                            id={`appointment-status-${appointment.id}`}
                            value={appointment.status}
                            onChange={(event) => changeAppointmentStatus(appointment, event.target.value as Appointment["status"])}
                            disabled={busyId === appointment.id}
                            className="h-10 min-w-40 rounded-lg border border-input bg-background px-3 text-sm"
                          >
                            <option value="scheduled">Scheduled</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          )}

        </>
      )}
    </DashboardLayout>
  );
}

function DoctorRow({
  doctor,
  busy,
  onApprove,
  onHide,
}: {
  doctor: Doctor;
  busy: boolean;
  onApprove: () => void;
  onHide: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-sm font-bold text-primary">
          {doctor.initials || doctor.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="font-bold text-foreground">{doctor.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{doctor.specialty} - {doctor.degree ?? "Degree not added"}</p>
              <p className="mt-1 text-xs text-muted-foreground">Reg: {doctor.registrationNumber ?? "-"} - Fee: {doctor.fee}</p>
            </div>
            <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${doctor.approved ? "bg-accent-soft text-accent" : "bg-warning/10 text-warning"}`}>
              {doctor.approved ? "Approved" : "Pending"}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="hero" size="sm" disabled={busy || doctor.approved === true} onClick={onApprove}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Approve
            </Button>
            <Button variant="outline" size="sm" disabled={busy || doctor.approved !== true} onClick={onHide}>
              <XCircle className="h-4 w-4" />
              Hide
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PatientRow({
  patient,
  appointmentCount,
  busy,
  onRemove,
}: {
  patient: AdminUser;
  appointmentCount: number;
  busy: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold text-muted-foreground">
          {patient.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <h3 className="truncate font-bold text-foreground">{patient.name}</h3>
              <p className="mt-1 truncate text-xs text-muted-foreground">{patient.email}</p>
              <p className="mt-1 text-xs text-muted-foreground">Phone: {patient.profile?.phone || "Not added"}</p>
            </div>
            <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${patient.verified ? "bg-accent-soft text-accent" : "bg-warning/10 text-warning"}`}>
              {patient.verified ? "Complete profile" : "Incomplete profile"}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              {appointmentCount} appointment{appointmentCount === 1 ? "" : "s"}
            </span>
            <Button variant="outline" size="sm" disabled={busy} onClick={onRemove}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Remove
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AdminContent />
    </ProtectedRoute>
  );
}
