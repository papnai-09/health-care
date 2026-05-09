const DoctorAvailability =
  require('../models/DoctorAvailability');

const Appointment =
  require('../models/Appointment');

/* CREATE AVAILABILITY */

exports.createAvailability =
  async (req, res) => {

    try {

      const {

        date,
        slots

      } = req.body;

      /* DELETE OLD */

      await DoctorAvailability.deleteMany({

        doctor:
          req.user._id,

        date
      });

      const availability =
        await DoctorAvailability.create({

          doctor:
            req.user._id,

          date,

          slots
        });

      res.status(201).json({

        success: true,

        availability
      });

    } catch (error) {

      console.log(error);

      res.status(500).json({

        success: false,

        message:
          'Availability Creation Failed'
      });
    }
  };

/* GET AVAILABLE SLOTS */

exports.getDoctorAvailability =
  async (req, res) => {

    try {

      const {

        doctorId

      } = req.params;

      const {

        date

      } = req.query;

      const availability =
        await DoctorAvailability.findOne({

          doctor:
            doctorId,

          date
        });

      if (!availability) {

        return res.json([]);
      }

      /* GET BOOKED */

      const appointments =
        await Appointment.find({

          doctor:
            doctorId,

          appointmentDate:
            date,

          status: {

            $ne:
              'Cancelled'
          }
        });

      const bookedSlots =
        appointments.map(

          (item) =>
            item.appointmentTime
        );

      /* FILTER */

      const updatedSlots =
        availability.slots.map(

          (slot) => ({

            ...slot._doc,

            isBooked:
              bookedSlots.includes(

                slot.startTime
              )
          })
        );

      res.json(
        updatedSlots
      );

    } catch (error) {

      console.log(error);

      res.status(500).json({

        success: false,

        message:
          'Failed to fetch slots'
      });
    }
  };