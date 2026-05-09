const router =
  require('express').Router();

const {

  createAvailability,
  getDoctorAvailability

} = require('../controllers/availabilityController');

const {

  protect

} = require('../middleware/authMiddleware');

/* CREATE */

router.post(

  '/create',

  protect,

  createAvailability
);

/* GET */

router.get(

  '/:doctorId',

  protect,

  getDoctorAvailability
);

module.exports = router;