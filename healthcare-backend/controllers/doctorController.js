const User =
  require('../models/User');

/* Get Doctors */

exports.getDoctors = async (req, res) => {

  try {

    const doctors =
      await User.find({

        role: 'doctor'

      }).select('-password');

    res.json(doctors);

  } catch (error) {

    console.log(error);

    res.status(500).json({

      success: false,

      message: 'Failed to fetch doctors'

    });
  }
};

/* Create Doctor */

exports.createDoctor = async (req, res) => {

  try {

    const doctor =
      await User.create({

        ...req.body,

        role: 'doctor'
      });

    res.status(201).json({

      success: true,

      doctor
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({

      success: false,

      message: 'Doctor creation failed'

    });
  }
};