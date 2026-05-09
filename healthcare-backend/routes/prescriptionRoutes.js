const router = require('express').Router();
const { createPrescription } = require('../controllers/prescriptionController');

router.post('/', createPrescription);

module.exports = router;