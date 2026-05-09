const mongoose =
  require('mongoose');

const doctorProfileSchema =
  new mongoose.Schema({

    doctor: {

      type:
        mongoose.Schema.Types.ObjectId,

      ref: 'User',

      required: true
    },

    specialization: {

      type: String,

      required: true
    },

    experience: {

      type: Number,

      required: true
    },

    consultationFee: {

      type: Number,

      required: true
    },

    about: {

      type: String
    },

    workingHours: {

      start: String,

      end: String
    },

    slotDuration: {

      type: Number,

      default: 30
    },

    isAvailable: {

      type: Boolean,

      default: true
    }

  }, {

    timestamps: true
  });

module.exports =
  mongoose.model(

    'DoctorProfile',

    doctorProfileSchema
  );