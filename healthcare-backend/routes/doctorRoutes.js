const router =
  require('express').Router();

const {

  getDoctors,
  createDoctor

} = require('../controllers/doctorController');

const {

  protect,
  authorize

} = require('../middleware/authMiddleware');

/* Get All Doctors */

router.get(
  '/',
  getDoctors
);

/* Create Doctor */

router.post(
  '/create',
  protect,
  authorize('doctor'),
  createDoctor
);

module.exports = router;