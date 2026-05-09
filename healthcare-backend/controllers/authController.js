const bcrypt =
  require('bcryptjs');

const jwt =
  require('jsonwebtoken');

const User =
  require('../models/User');

const generateToken = (id) => {

  return jwt.sign(

    { id },

    process.env.JWT_SECRET,

    {
      expiresIn: '30d'
    }

  );
};

exports.register = async (req, res) => {

  try {

    const {

      name,
      email,
      password,
      role,
      specialization

    } = req.body;

    const existingUser =
      await User.findOne({ email });

    if (existingUser) {

      return res.status(400).json({

        success: false,

        message: 'User already exists'

      });
    }

    const hashedPassword =
      await bcrypt.hash(password, 10);

    const user =
      await User.create({

        name,

        email,

        password: hashedPassword,

        role,

        specialization
      });

    res.status(201).json({

      success: true,

      token:
        generateToken(user._id),

      user: {

        id: user._id,

        name: user.name,

        email: user.email,

        role: user.role
      }

    });

  } catch (error) {

    console.log(error);

    res.status(500).json({

      success: false,

      message: 'Registration Failed'

    });
  }
};

exports.login = async (req, res) => {

  try {

    const {

      email,
      password

    } = req.body;

    const user =
      await User.findOne({ email });

    if (!user) {

      return res.status(400).json({

        success: false,

        message: 'Invalid Credentials'

      });
    }

    const isMatch =
      await bcrypt.compare(

        password,

        user.password
      );

    if (!isMatch) {

      return res.status(400).json({

        success: false,

        message: 'Invalid Credentials'

      });
    }

    res.json({

      success: true,

      token:
        generateToken(user._id),

      user: {

        id: user._id,

        name: user.name,

        email: user.email,

        role: user.role
      }

    });

  } catch (error) {

    console.log(error);

    res.status(500).json({

      success: false,

      message: 'Login Failed'

    });
  }
};

exports.getMe = async (req, res) => {

  try {

    const user =
      await User.findById(req.user.id)
      .select('-password');

    res.json({

      success: true,

      user
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({

      success: false,

      message: 'Server Error'

    });
  }
};