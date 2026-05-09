const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  medicines: [String],
  notes: String
}, {
  timestamps: true
});

module.exports = mongoose.model('Prescription', prescriptionSchema);