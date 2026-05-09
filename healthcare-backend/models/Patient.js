const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  age: Number,
  gender: String,
  bloodGroup: String,
  allergies: [String],
  medicalHistory: [
    {
      disease: String,
      description: String,
      date: Date
    }
  ]
}, {
  timestamps: true
});

module.exports = mongoose.model('Patient', patientSchema);