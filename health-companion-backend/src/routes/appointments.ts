import express from 'express';
import { appointmentsDb, doctorsDb, usersDb } from '../database';
import { ApiResponse, Appointment } from '../types';
import { authenticateToken } from '../middleware/auth';
import { queueAppointmentEmail } from '../email';

const router = express.Router();
router.use(authenticateToken);

const SLOT_INTERVAL_MINUTES = 30;

const withPatient = async (appointment: Appointment): Promise<Appointment> => {
  const patient = await usersDb.getById(appointment.userId);
  return {
    ...appointment,
    patientName: patient?.name ?? 'Patient',
    patientEmail: patient?.email,
  };
};

const toMinutes = (time: string): number | null => {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return hours * 60 + minutes;
};

const toTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const getDoctorWindow = (doctor: { availableFrom?: string; availableTo?: string }) => {
  const availableFrom = doctor.availableFrom || '09:00';
  const availableTo = doctor.availableTo || '17:00';
  const start = toMinutes(availableFrom);
  const end = toMinutes(availableTo);

  if (start === null || end === null || start >= end) {
    return null;
  }

  return { availableFrom, availableTo, start, end };
};

const buildAvailabilitySlots = async (doctorId: string, date: string, start: number, end: number) => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const appointments = await appointmentsDb.getAll();

  const slots = [];
  for (let minutes = start; minutes < end; minutes += SLOT_INTERVAL_MINUTES) {
    const time = toTime(minutes);
    const past = date < today || (date === today && minutes <= currentMinutes);
    const booked = appointments.some((appointment) => appointment.doctorId === doctorId && appointment.date === date && appointment.time === time && appointment.status === 'scheduled');
    slots.push({ time, booked, available: !past && !booked });
  }

  return slots;
};

// GET /api/appointments - Get appointments for authenticated user
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    const doctorId = req.user?.doctorId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' } as ApiResponse<null>);
    }

    const appointments =
      role === 'doctor'
        ? await Promise.all((await appointmentsDb.getAll()).filter((appointment) => appointment.doctorId === doctorId).map(withPatient))
        : await appointmentsDb.getByUserId(userId);
    const response: ApiResponse<Appointment[]> = {
      success: true,
      data: appointments
    };
    res.json(response);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to fetch appointments'
    };
    res.status(500).json(response);
  }
});

// GET /api/appointments/availability - Get doctor availability for a selected date
router.get('/availability', async (req, res) => {
  try {
    const { doctorId, date } = req.query;

    if (!doctorId || !date || typeof doctorId !== 'string' || typeof date !== 'string') {
      return res.status(400).json({ success: false, error: 'Doctor ID and date are required' } as ApiResponse<null>);
    }

    const doctor = await doctorsDb.getById(doctorId);
    if (!doctor || doctor.approved !== true || doctor.profileComplete !== true || doctor.available !== true) {
      return res.status(404).json({ success: false, error: 'Doctor is not available for booking' } as ApiResponse<null>);
    }

    const window = getDoctorWindow(doctor);
    if (!window) {
      return res.status(400).json({ success: false, error: 'Doctor availability is not configured correctly' } as ApiResponse<null>);
    }

    res.json({
      success: true,
      data: {
        doctorId,
        date,
        availableFrom: window.availableFrom,
        availableTo: window.availableTo,
        slots: await buildAvailabilitySlots(doctorId, date, window.start, window.end),
      },
    } as ApiResponse<{ doctorId: string; date: string; availableFrom: string; availableTo: string; slots: Array<{ time: string; booked: boolean; available: boolean }> }>);
  } catch (error) {
    console.error('Error fetching doctor availability:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch doctor availability' } as ApiResponse<null>);
  }
});

// GET /api/appointments/:id - Get appointment by ID
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    const doctorId = req.user?.doctorId;
    const { id } = req.params;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' } as ApiResponse<null>);
    }

    const appointment = await appointmentsDb.getById(id);
    if (!appointment || (role === 'doctor' ? appointment.doctorId !== doctorId : appointment.userId !== userId)) {
      return res.status(404).json({ success: false, error: 'Appointment not found' } as ApiResponse<null>);
    }

    const response: ApiResponse<Appointment> = {
      success: true,
      data: await withPatient(appointment)
    };
    res.json(response);
  } catch (error) {
    console.error('Error fetching appointment:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to fetch appointment'
    };
    res.status(500).json(response);
  }
});

// POST /api/appointments - Create new appointment
router.post('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    const { doctorId, date, time } = req.body;

    if (!userId || !doctorId || !date || !time) {
      return res.status(400).json({ success: false, error: 'Doctor ID, date, and time are required' } as ApiResponse<null>);
    }

    if (role === 'doctor') {
      return res.status(403).json({ success: false, error: 'Doctor accounts cannot book patient appointments' } as ApiResponse<null>);
    }

    const doctor = await doctorsDb.getById(doctorId);
    if (!doctor || doctor.approved !== true || doctor.profileComplete !== true || doctor.available !== true) {
      return res.status(400).json({ success: false, error: 'Selected doctor is not available for booking' } as ApiResponse<null>);
    }

    const window = getDoctorWindow(doctor);
    const requestedMinutes = toMinutes(time);
    if (!window || requestedMinutes === null || requestedMinutes < window.start || requestedMinutes >= window.end) {
      return res.status(400).json({ success: false, error: 'Selected time is outside doctor availability' } as ApiResponse<null>);
    }

    const slot = (await buildAvailabilitySlots(doctorId, date, window.start, window.end)).find((item) => item.time === time);
    if (!slot?.available) {
      return res.status(409).json({ success: false, error: slot?.booked ? 'This slot is already booked' : 'This slot is not available' } as ApiResponse<null>);
    }

    const newAppointment: Appointment = {
      id: Date.now().toString(),
      userId,
      doctorId,
      doctorName: doctor.name,
      specialty: doctor.specialty,
      date,
      time,
      type: 'Online',
      status: 'scheduled',
      createdAt: new Date().toISOString()
    };

    const created = await appointmentsDb.create(newAppointment);

    // Send email notification to doctor (fire-and-forget)
    try {
      const doctorProfile = await doctorsDb.getById(doctorId);
      const patient = await usersDb.getById(userId);
      let doctorEmail: string | undefined = undefined;

      if (doctorProfile?.accountUserId) {
        const doctorUser = await usersDb.getById(doctorProfile.accountUserId);
        doctorEmail = doctorUser?.email;
      }

      // Fallback: search all users if direct link is missing
      if (!doctorEmail) {
        const allUsers = await usersDb.getAll();
        const doctorUser = allUsers.find((u) => u.role === 'doctor' && u.doctorId === doctorId);
        doctorEmail = doctorUser?.email;
      }

      if (doctorEmail) {
        queueAppointmentEmail({
          to: doctorEmail,
          doctorName: doctor.name,
          patientName: patient?.name ?? 'Patient',
          date,
          time,
          specialty: doctor.specialty,
          type: 'Online',
        });
        console.log(`Appointment email queued for Dr. ${doctor.name} (${doctorEmail})`);
      } else {
        console.warn(`Could not find email for doctorId: ${doctorId}`);
      }
    } catch (emailError) {
      // Don't fail the appointment creation if email fails
      console.error('Failed to queue appointment notification email:', emailError);
    }

    const response: ApiResponse<Appointment> = {
      success: true,
      data: created,
      message: 'Appointment booked successfully'
    };
    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating appointment:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to book appointment'
    };
    res.status(500).json(response);
  }
});

// PUT /api/appointments/:id - Update appointment
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    const doctorId = req.user?.doctorId;
    const { id } = req.params;
    const updates = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' } as ApiResponse<null>);
    }

    const appointment = await appointmentsDb.getById(id);
    if (!appointment || (role === 'doctor' ? appointment.doctorId !== doctorId : appointment.userId !== userId)) {
      return res.status(404).json({ success: false, error: 'Appointment not found' } as ApiResponse<null>);
    }

    const updated = await appointmentsDb.update(id, updates);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Appointment not found' } as ApiResponse<null>);
    }

    const response: ApiResponse<Appointment> = {
      success: true,
      data: updated,
      message: 'Appointment updated successfully'
    };
    res.json(response);
  } catch (error) {
    console.error('Error updating appointment:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to update appointment'
    };
    res.status(500).json(response);
  }
});

// DELETE /api/appointments/:id - Cancel appointment
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    const doctorId = req.user?.doctorId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' } as ApiResponse<null>);
    }

    const appointment = await appointmentsDb.getById(id);
    if (!appointment || (role === 'doctor' ? appointment.doctorId !== doctorId : appointment.userId !== userId)) {
      return res.status(404).json({ success: false, error: 'Appointment not found' } as ApiResponse<null>);
    }

    const deleted = await appointmentsDb.delete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Appointment not found' } as ApiResponse<null>);
    }

    const response: ApiResponse<null> = {
      success: true,
      message: 'Appointment cancelled successfully'
    };
    res.json(response);
  } catch (error) {
    console.error('Error deleting appointment:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to cancel appointment'
    };
    res.status(500).json(response);
  }
});

export { router as appointmentsRouter };
