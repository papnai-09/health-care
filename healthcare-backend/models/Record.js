const mongoose = require('mongoose');

const recordSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  fileUrl: {
    type: String,
    required: true
  },

  fileType: {
    type: String
  },

  description: {
    type: String
  }

}, {
  timestamps: true
});

module.exports = mongoose.model('Record', recordSchema);