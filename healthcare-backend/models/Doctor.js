const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  specialization: {
    type: String,
    required: true
  },

  experience: Number,

  qualification: String,

  availability: [String],

  isOnline: {
    type: Boolean,
    default: false
  },

  location: {
    lat: Number,
    lng: Number
  }

}, {
  timestamps: true
});

module.exports = mongoose.model('Doctor', doctorSchema);