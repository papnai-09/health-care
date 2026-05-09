const mongoose =
  require('mongoose');

const appointmentSchema =
  new mongoose.Schema({

    patient: {

      type:
        mongoose.Schema.Types.ObjectId,

      ref: 'User',

      required: true
    },

    doctor: {

      type:
        mongoose.Schema.Types.ObjectId,

      ref: 'User',

      required: true
    },

    appointmentDate: {

      type: String,

      required: true
    },

    appointmentTime: {

      type: String,

      required: true
    },

    symptoms: {

      type: String
    },

    status: {

      type: String,

      enum: [

        'Pending',
        'Confirmed',
        'Completed'

      ],

      default: 'Pending'
    }

  }, {

    timestamps: true
  });

module.exports =
  mongoose.model(
    'Appointment',
    appointmentSchema
  );