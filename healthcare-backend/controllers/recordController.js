const MedicalRecord =
  require('../models/MedicalRecord');

/* Upload Record */

exports.uploadRecord =
  async (req, res) => {

    try {

      const record =
        await MedicalRecord.create({

          patient:
            req.user._id,

          title:
            req.body.title,

          fileUrl:
            `/uploads/${req.file.filename}`,

          fileType:
            req.file.mimetype
        });

      res.status(201).json({

        success: true,

        record
      });

    } catch (error) {

      console.log(error);

      res.status(500).json({

        success: false,

        message:
          'Upload Failed'
      });
    }
  };

/* Get Records */

exports.getRecords =
  async (req, res) => {

    try {

      const records =
        await MedicalRecord.find({

          patient:
            req.user._id
        });

      res.json(records);

    } catch (error) {

      console.log(error);

      res.status(500).json({

        success: false,

        message:
          'Failed to fetch records'
      });
    }
  };