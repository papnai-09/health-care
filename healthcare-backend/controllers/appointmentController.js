const Appointment =
  require('../models/Appointment');

/* BOOK */

exports.bookAppointment =
  async (req, res) => {

    try {

      const {

        doctorId,
        appointmentDate,
        appointmentTime,
        symptoms

      } = req.body;

      /* COLLISION CHECK */

      const existingAppointment =
        await Appointment.findOne({

          doctor:
            doctorId,

          appointmentDate,

          appointmentTime,

          status: {

            $ne:
              'Cancelled'
          }
        });

      if (

        existingAppointment

      ) {

        return res.status(400).json({

          success: false,

          message:
            'This slot is already booked'
        });
      }

      const appointment =
        await Appointment.create({

          patient:
            req.user._id,

          doctor:
            doctorId,

          appointmentDate,

          appointmentTime,

          symptoms,

          status:
            'Pending'
        });

      res.status(201).json({

        success: true,

        appointment
      });

    } catch (error) {

      console.log(error);

      res.status(500).json({

        success: false,

        message:
          'Booking Failed'
      });
    }
  };

/* GET */

exports.getAppointments =
  async (req, res) => {

    try {

      let appointments;

      if (

        req.user.role ===
        'doctor'

      ) {

        appointments =
          await Appointment.find({

            doctor:
              req.user._id
          })

          .populate(

            'patient',

            'name email'
          );

      } else {

        appointments =
          await Appointment.find({

            patient:
              req.user._id
          })

          .populate(

            'doctor',

            'name specialization'
          );
      }

      res.json(
        appointments
      );

    } catch (error) {

      console.log(error);

      res.status(500).json({

        success: false,

        message:
          'Failed to fetch appointments'
      });
    }
  };

/* UPDATE STATUS */

exports.updateAppointmentStatus =
  async (req, res) => {

    try {

      const appointment =
        await Appointment.findByIdAndUpdate(

          req.params.id,

          {

            status:
              req.body.status
          },

          { new: true }
        );

      res.json({

        success: true,

        appointment
      });

    } catch (error) {

      console.log(error);

      res.status(500).json({

        success: false,

        message:
          'Status Update Failed'
      });
    }
  };