const Appointment =
  require('../models/Appointment');

const MedicalRecord =
  require('../models/MedicalRecord');

const DoctorProfile =
  require('../models/DoctorProfile');

/* DASHBOARD */

exports.getDoctorDashboard =
  async (req, res) => {

    try {

      const appointments =
        await Appointment.find({

          doctor:
            req.user._id

        })

        .populate(

          'patient',

          'name email'
        )

        .sort({

          createdAt: -1
        });

      const totalPatients =
        appointments.length;

      const todayAppointments =
        appointments.filter(

          (item) =>

            item.appointmentDate ===
            new Date()
              .toISOString()
              .split('T')[0]
        );

      const profile =
        await DoctorProfile.findOne({

          doctor:
            req.user._id
        });

      res.json({

        success: true,

        appointments,

        totalPatients,

        todayAppointments,

        profile
      });

    } catch (error) {

      console.log(error);

      res.status(500).json({

        success: false,

        message:
          'Dashboard Fetch Failed'
      });
    }
  };

/* PATIENT DETAILS */

exports.getPatientDetails =
  async (req, res) => {

    try {

      const appointments =
        await Appointment.find({

          patient:
            req.params.patientId
        })

        .populate(

          'patient',

          'name email'
        );

      const records =
        await MedicalRecord.find({

          patient:
            req.params.patientId
        });

      res.json({

        success: true,

        appointments,

        records
      });

    } catch (error) {

      console.log(error);

      res.status(500).json({

        success: false,

        message:
          'Patient Fetch Failed'
      });
    }
  };

/* UPDATE PROFILE */

exports.updateDoctorProfile =
  async (req, res) => {

    try {

      const existingProfile =
        await DoctorProfile.findOne({

          doctor:
            req.user._id
        });

      if (

        existingProfile

      ) {

        const updatedProfile =
          await DoctorProfile.findOneAndUpdate(

            {

              doctor:
                req.user._id
            },

            req.body,

            {

              new: true
            }
          );

        return res.json({

          success: true,

          profile:
            updatedProfile
        });
      }

      const profile =
        await DoctorProfile.create({

          doctor:
            req.user._id,

          ...req.body
        });

      res.status(201).json({

        success: true,

        profile
      });

    } catch (error) {

      console.log(error);

      res.status(500).json({

        success: false,

        message:
          'Profile Update Failed'
      });
    }
  };