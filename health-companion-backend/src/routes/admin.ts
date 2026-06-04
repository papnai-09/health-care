import express from 'express';
import { adminDb, appointmentsDb, doctorsDb, usersDb } from '../database';
import { ApiResponse, Appointment, Doctor, User } from '../types';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();
router.use(authenticateToken);

type AdminUser = Omit<User, 'passwordHash' | 'token'>;

const requireAdmin: express.RequestHandler = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required' } as ApiResponse<null>);
  }

  next();
};

router.use(requireAdmin);

const toAdminUser = (user: User): AdminUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role === 'admin' ? 'admin' : user.role === 'doctor' ? 'doctor' : 'patient',
  doctorId: user.doctorId,
  verified: user.verified ?? false,
  profile: user.profile ?? {},
});

router.get('/overview', async (_req, res) => {
  try {
    const [users, doctors, appointments] = await Promise.all([
      adminDb.getAllUsers(),
      adminDb.getAllDoctors(),
      adminDb.getAllAppointments(),
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          users: users.length,
          patients: users.filter((user) => user.role !== 'doctor' && user.role !== 'admin').length,
          doctors: doctors.length,
          pendingDoctors: doctors.filter((doctor) => doctor.approved !== true).length,
          appointments: appointments.length,
          scheduledAppointments: appointments.filter((appointment) => appointment.status === 'scheduled').length,
        },
        users: users.map(toAdminUser),
        doctors,
        appointments,
      },
    } as ApiResponse<{
      stats: Record<string, number>;
      users: AdminUser[];
      doctors: Doctor[];
      appointments: Appointment[];
    }>);
  } catch (error) {
    console.error('Admin overview error:', error);
    res.status(500).json({ success: false, error: 'Failed to load admin overview' } as ApiResponse<null>);
  }
});

router.put('/doctors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates: Partial<Doctor> = {};
    const allowedBooleanFields: Array<keyof Pick<Doctor, 'approved' | 'available' | 'profileComplete'>> = ['approved', 'available', 'profileComplete'];

    allowedBooleanFields.forEach((field) => {
      if (typeof req.body[field] === 'boolean') {
        updates[field] = req.body[field];
      }
    });

    const updated = await doctorsDb.update(id, updates);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Doctor not found' } as ApiResponse<null>);
    }

    if (updated.accountUserId && typeof updates.approved === 'boolean') {
      await usersDb.update(updated.accountUserId, { verified: updates.approved });
    }

    res.json({ success: true, data: updated, message: 'Doctor updated successfully' } as ApiResponse<Doctor>);
  } catch (error) {
    console.error('Admin doctor update error:', error);
    res.status(500).json({ success: false, error: 'Failed to update doctor' } as ApiResponse<null>);
  }
});

router.put('/appointments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const status = req.body.status;
    if (!['scheduled', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid appointment status' } as ApiResponse<null>);
    }

    const updated = await appointmentsDb.update(id, { status });
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Appointment not found' } as ApiResponse<null>);
    }

    res.json({ success: true, data: updated, message: 'Appointment updated successfully' } as ApiResponse<Appointment>);
  } catch (error) {
    console.error('Admin appointment update error:', error);
    res.status(500).json({ success: false, error: 'Failed to update appointment' } as ApiResponse<null>);
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const deleted = await adminDb.deleteUser(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'User not found or cannot be deleted' } as ApiResponse<null>);
    }

    res.json({ success: true, message: 'User deleted successfully' } as ApiResponse<null>);
  } catch (error) {
    console.error('Admin user delete error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete user' } as ApiResponse<null>);
  }
});

export { router as adminRouter };
