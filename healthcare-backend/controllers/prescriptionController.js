const Prescription = require('../models/Prescription');

exports.createPrescription = async (req, res) => {
  try {
    const prescription = await Prescription.create(req.body);

    res.status(201).json(prescription);
  } catch (error) {
    res.status(500).json(error);
  }
};