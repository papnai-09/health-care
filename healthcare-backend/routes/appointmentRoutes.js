const router =
  require('express').Router();

const {

  bookAppointment,
  getAppointments,
  updateAppointmentStatus

} = require(

  '../controllers/appointmentController'
);

const {

  protect

} = require(

  '../middleware/authMiddleware'
);

/* BOOK APPOINTMENT */

router.post(

  '/book',

  protect,

  bookAppointment
);

/* GET APPOINTMENTS */

router.get(

  '/',

  protect,

  getAppointments
);

/* UPDATE STATUS */

router.put(

  '/:id/status',

  protect,

  updateAppointmentStatus
);

module.exports =
  router;