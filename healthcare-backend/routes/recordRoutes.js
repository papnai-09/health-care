const router =
  require('express').Router();

const {

  uploadRecord,
  getRecords

} = require('../controllers/recordController');

const {

  protect

} = require('../middleware/authMiddleware');

const upload =
  require('../middleware/uploadMiddleware');

/* Upload Record */

router.post(

  '/upload',

  protect,

  upload.single('file'),

  uploadRecord
);

/* Get Records */

router.get(
  '/',
  protect,
  getRecords
);

module.exports = router;