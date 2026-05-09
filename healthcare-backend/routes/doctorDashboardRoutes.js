const router =
  require('express').Router();

const {

  getDoctorDashboard,
  getPatientDetails,
  updateDoctorProfile

} = require(

  '../controllers/doctorDashboardController'
);

const {

  protect

} = require(

  '../middleware/authMiddleware'
);

/* DASHBOARD */

router.get(

  '/',

  protect,

  getDoctorDashboard
);

/* PATIENT DETAILS */

router.get(

  '/patient/:patientId',

  protect,

  getPatientDetails
);

/* PROFILE */

router.post(

  '/profile',

  protect,

  updateDoctorProfile
);

module.exports =
  router;