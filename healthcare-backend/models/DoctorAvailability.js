const mongoose =
  require('mongoose');

const availabilitySchema =
  new mongoose.Schema({

    doctor: {

      type:
        mongoose.Schema.Types.ObjectId,

      ref: 'User',

      required: true
    },

    date: {

      type: String,

      required: true
    },

    slots: [

      {

        startTime: String,

        endTime: String,

        isBooked: {

          type: Boolean,

          default: false
        }
      }

    ]

  }, {

    timestamps: true
  });

module.exports =
  mongoose.model(

    'DoctorAvailability',

    availabilitySchema
  );