import express from 'express';
import { doctorsDb } from '../database';
import { ApiResponse, Doctor } from '../types';

const router = express.Router();

// GET /api/doctors - Get all doctors
router.get('/', async (req, res) => {
  try {
    const doctors = (await doctorsDb.getAll())
      .filter((doctor) => doctor.approved === true && doctor.profileComplete === true && doctor.available === true)
      .sort((first, second) => {
        const specialtyOrder = first.specialty.localeCompare(second.specialty);
        return specialtyOrder === 0 ? first.name.localeCompare(second.name) : specialtyOrder;
      });
    const response: ApiResponse<Doctor[]> = {
      success: true,
      data: doctors
    };
    res.json(response);
  } catch (error) {
    console.error('Error fetching doctors:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to fetch doctors'
    };
    res.status(500).json(response);
  }
});

// GET /api/doctors/:id - Get doctor by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = await doctorsDb.getById(id);

    if (!doctor) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Doctor not found'
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<Doctor> = {
      success: true,
      data: doctor
    };
    res.json(response);
  } catch (error) {
    console.error('Error fetching doctor:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to fetch doctor'
    };
    res.status(500).json(response);
  }
});

// POST /api/doctors - Create new doctor (admin only)
router.post('/', async (req, res) => {
  try {
    const doctorData: Omit<Doctor, 'id'> = req.body;

    // Basic validation
    if (!doctorData.name || !doctorData.specialty) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Name and specialty are required'
      };
      return res.status(400).json(response);
    }

    const newDoctor: Doctor = {
      id: Date.now().toString(),
      ...doctorData,
      approved: doctorData.approved ?? true,
      profileComplete: doctorData.profileComplete ?? true,
      available: doctorData.available ?? true,
    };

    const created = await doctorsDb.create(newDoctor);
    const response: ApiResponse<Doctor> = {
      success: true,
      data: created,
      message: 'Doctor created successfully'
    };
    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating doctor:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to create doctor'
    };
    res.status(500).json(response);
  }
});

// PUT /api/doctors/:id - Update doctor
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updated = await doctorsDb.update(id, updates);
    if (!updated) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Doctor not found'
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<Doctor> = {
      success: true,
      data: updated,
      message: 'Doctor updated successfully'
    };
    res.json(response);
  } catch (error) {
    console.error('Error updating doctor:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to update doctor'
    };
    res.status(500).json(response);
  }
});

// DELETE /api/doctors/:id - Delete doctor
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await doctorsDb.delete(id);

    if (!deleted) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Doctor not found'
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<null> = {
      success: true,
      message: 'Doctor deleted successfully'
    };
    res.json(response);
  } catch (error) {
    console.error('Error deleting doctor:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to delete doctor'
    };
    res.status(500).json(response);
  }
});

export { router as doctorsRouter };
