import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Building2, CalendarCheck, Clock, GraduationCap, MapPin, Search, Stethoscope, Video } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Appointment, createAppointment, Doctor, DoctorAvailabilitySlot, getAppointments, getDoctorAvailability, getDoctors } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const today = new Date().toISOString().split("T")[0];

const formatTime = (time?: string) => {
  if (!time) return "Not configured";
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return time;

  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2026, 0, 1, hours, minutes));
};

const doctorAvailabilityText = (doctor?: Doctor) => {
  if (!doctor?.availableFrom || !doctor?.availableTo) return "Availability not configured";
  return `${formatTime(doctor.availableFrom)} - ${formatTime(doctor.availableTo)}`;
};

const appointmentDateTime = (appointment: Appointment) => new Date(`${appointment.date}T${appointment.time || "00:00"}:00`);

function groupDoctors(doctors: Doctor[]) {
  return doctors.reduce<Record<string, Doctor[]>>((groups, doctor) => {
    const key = doctor.specialty || "General";
    groups[key] = [...(groups[key] ?? []), doctor].sort((first, second) => first.name.localeCompare(second.name));
    return groups;
  }, {});
}

function AppointmentsContent() {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [availabilitySlots, setAvailabilitySlots] = useState<DoctorAvailabilitySlot[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        if (user.role !== "doctor") {
          const doctorList = await getDoctors();
          setDoctors(doctorList);
          setSelectedDoc((current) => current ?? doctorList[0]?.id ?? null);
        }
        setAppointments(await getAppointments());
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load appointments.");
      }
    };

    fetchData();
  }, [user]);

  const selectedDoctor = useMemo(() => doctors.find((doctor) => doctor.id === selectedDoc), [doctors, selectedDoc]);

  const filteredDoctors = useMemo(() => {
    const query = search.trim().toLowerCase();
    const visibleDoctors = [...doctors].sort((first, second) => {
      const specialtyOrder = first.specialty.localeCompare(second.specialty);
      return specialtyOrder === 0 ? first.name.localeCompare(second.name) : specialtyOrder;
    });

    if (!query) return visibleDoctors;

    return visibleDoctors.filter((doctor) =>
      [doctor.name, doctor.specialty, doctor.clinicName, doctor.degree].some((value) => value?.toLowerCase().includes(query)),
    );
  }, [doctors, search]);

  const groupedDoctors = useMemo(() => groupDoctors(filteredDoctors), [filteredDoctors]);

  useEffect(() => {
    if (!selectedDoc || !date || user?.role === "doctor") return;

    const fetchAvailability = async () => {
      setLoadingAvailability(true);
      try {
        const availability = await getDoctorAvailability(selectedDoc, date);
        setAvailabilitySlots(availability.slots);
        const firstAvailable = availability.slots.find((slot) => slot.available);
        setTime((current) => {
          const currentSlot = availability.slots.find((slot) => slot.time === current);
          return currentSlot?.available ? current : firstAvailable?.time ?? "";
        });
      } catch (error) {
        setAvailabilitySlots([]);
        setTime("");
        toast.error(error instanceof Error ? error.message : "Unable to load doctor availability.");
      } finally {
        setLoadingAvailability(false);
      }
    };

    fetchAvailability();
  }, [date, selectedDoc, user?.role]);

  const book = async () => {
    if (!user || !selectedDoc || !time) return;
    setLoading(true);
    try {
      const appointment = await createAppointment(selectedDoc, date, time);
      setAppointments((current) => [appointment, ...current]);
      setAvailabilitySlots((current) => current.map((slot) => (slot.time === time ? { ...slot, booked: true, available: false } : slot)));
      setTime("");
      toast.success(`Appointment booked with ${appointment.doctorName}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Booking failed.");
    } finally {
      setLoading(false);
    }
  };

  if (user?.role === "doctor") {
    return (
      <DashboardLayout title="Schedule" subtitle="Review patient consultations and upcoming video visits.">
        <section>
          <h2 className="mb-4 text-xl font-bold">Patient appointments</h2>
          {appointments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-muted-foreground">No patient appointments yet.</div>
          ) : (
            <div className="grid gap-4">
              {appointments.map((appointment) => (
                <div key={appointment.id} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-card sm:flex-row sm:items-center">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
                    <Video className="h-6 w-6 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{appointment.patientName ?? `Patient ${appointment.userId.slice(0, 6)}`}</div>
                    <div className="text-xs text-muted-foreground">{appointment.specialty} with {appointment.doctorName}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><CalendarCheck className="h-3 w-3" /> {appointment.date}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {appointment.time}</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Online</span>
                    </div>
                  </div>
                  <Button variant="hero" size="sm">Join</Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Appointments" subtitle="Book a consultation with approved doctors only.">
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,430px)]">
        <section className="min-w-0 rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
          <div className="grid gap-4">
            <div className="min-w-0">
              <h2 className="text-xl font-bold">Approved doctors</h2>
              <p className="mt-1 text-sm text-muted-foreground">Category-wise approved profiles</p>
            </div>
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search doctor or category"
                className="h-11 rounded-lg pl-10"
              />
            </div>
          </div>

          {filteredDoctors.length === 0 ? (
            <div className="mt-5 flex min-h-[320px] items-center justify-center rounded-lg border border-dashed border-border bg-surface p-6 text-center sm:p-8">
              <div className="mx-auto max-w-md">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-primary-soft">
                  <Stethoscope className="h-7 w-7 text-primary" />
                </div>
                <div className="font-bold">No approved doctors available</div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Doctors will appear here after a real doctor profile is added and approved by admin.</p>
              </div>
            </div>
          ) : (
            <div className="mt-5 space-y-5">
              {Object.entries(groupedDoctors).map(([specialty, specialtyDoctors]) => (
                <div key={specialty} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" />
                    <h3 className="whitespace-nowrap text-sm font-bold text-primary">{specialty}</h3>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <div className="grid gap-3">
                    {specialtyDoctors.map((doctor) => {
                      const active = selectedDoc === doctor.id;
                      return (
                        <button
                          key={doctor.id}
                          onClick={() => setSelectedDoc(doctor.id)}
                          aria-pressed={active}
                          className={`w-full cursor-pointer rounded-lg border bg-background p-4 text-left shadow-soft transition-smooth hover:-translate-y-0.5 sm:p-5 ${
                            active ? "border-primary ring-2 ring-primary/10" : "border-border hover:border-primary/40"
                          }`}
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-lg font-bold text-primary">
                              {doctor.initials}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <div className="truncate text-lg font-bold">{doctor.name}</div>
                                  <div className="text-sm text-muted-foreground">{doctor.degree || "Degree not added"}</div>
                                </div>
                                <div className="w-fit rounded-lg bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">{doctor.fee}</div>
                              </div>
                              <div className="mt-3 grid gap-2 text-xs text-muted-foreground lg:grid-cols-3">
                                <span className="flex min-w-0 items-center gap-1.5"><Building2 className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{doctor.clinicName || "Hospital not added"}</span></span>
                                <span className="flex min-w-0 items-center gap-1.5"><Clock className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{doctorAvailabilityText(doctor)}</span></span>
                                <span className="flex min-w-0 items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{doctor.experience} exp</span></span>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="h-fit rounded-lg border border-border bg-card p-5 shadow-card sm:p-6 xl:sticky xl:top-24">
          {!selectedDoctor ? (
            <div className="grid gap-4">
              <div className="min-w-0">
                <h2 className="text-xl font-bold">Doctor details</h2>
                <p className="mt-1 text-sm text-muted-foreground">Select a profile to view slots</p>
              </div>
              <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-dashed border-border bg-surface p-6 text-center sm:p-8">
                <div className="mx-auto max-w-xs">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-primary-soft">
                    <Stethoscope className="h-7 w-7 text-primary" />
                  </div>
                  <div className="mt-4 font-bold">Select a doctor</div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">Doctor details and available slots will appear here.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-lg font-bold text-primary">
                    {selectedDoctor.initials}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold">{selectedDoctor.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{selectedDoctor.specialty}</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 text-sm">
                  <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3">
                    <Building2 className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <div className="font-semibold">Hospital / Clinic</div>
                      <div className="text-muted-foreground">{selectedDoctor.clinicName || "Not added"}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3">
                    <GraduationCap className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <div className="font-semibold">Qualification</div>
                      <div className="text-muted-foreground">{selectedDoctor.degree || "Not added"}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3">
                    <Clock className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <div className="font-semibold">Availability</div>
                      <div className="text-muted-foreground">{doctorAvailabilityText(selectedDoctor)}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-5 border-t border-border pt-5">
                <h3 className="text-lg font-bold">Schedule</h3>
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input id="date" type="date" min={today} value={date} onChange={(event) => setDate(event.target.value)} className="h-11 rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Label>Available slots</Label>
                  {loadingAvailability ? (
                    <div className="rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">Checking doctor availability...</div>
                  ) : availabilitySlots.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border bg-surface p-4 text-sm text-muted-foreground">No slots configured for this doctor.</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
                      {availabilitySlots.map((slot) => (
                        <button
                          key={slot.time}
                          type="button"
                          onClick={() => slot.available && setTime(slot.time)}
                          disabled={!slot.available}
                          className={`h-12 rounded-lg border text-sm font-semibold transition-smooth ${
                            time === slot.time
                              ? "border-primary bg-primary text-primary-foreground"
                              : slot.available
                                ? "cursor-pointer border-border bg-background hover:border-primary/40 hover:bg-primary-soft hover:text-primary"
                                : "cursor-not-allowed border-border bg-muted text-muted-foreground opacity-60"
                          }`}
                        >
                          {slot.time}
                          {slot.booked && <span className="ml-1 text-[10px]">Booked</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button variant="hero" size="lg" className="w-full" onClick={book} disabled={!selectedDoc || !time || loading}>
                  <CalendarCheck className="h-4 w-4" /> {loading ? "Booking..." : "Book Appointment"}
                </Button>
              </div>
            </div>
          )}
        </aside>
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-bold">Upcoming appointments</h2>
        {appointments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-muted-foreground">No appointments yet. Book one above.</div>
        ) : (
          <div className="grid gap-4">
            {appointments.map((appointment) => (
              <div key={appointment.id} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-card sm:flex-row sm:items-center sm:p-5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
                  <Video className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{appointment.doctorName}</div>
                  <div className="text-xs text-muted-foreground">{appointment.specialty}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><CalendarCheck className="h-3 w-3" /> {appointment.date}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {appointment.time}</span>
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {appointment.type}</span>
                  </div>
                </div>
                <Button variant="soft" size="sm">Join</Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </DashboardLayout>
  );
}

export default function AppointmentsPage() {
  return (
    <ProtectedRoute>
      <AppointmentsContent />
    </ProtectedRoute>
  );
}
