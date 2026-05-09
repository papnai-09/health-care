const express =
  require('express');

const cors =
  require('cors');

const dotenv =
  require('dotenv');

const connectDB =
  require('./config/db');

const path =
  require('path');

const http =
  require('http');

const { Server } =
  require('socket.io');

dotenv.config();

connectDB();

const app =
  express();

const server =
  http.createServer(app);

/* SOCKET */

const io =
  new Server(server, {

    cors: {

      origin: '*',

      methods: [

        'GET',
        'POST'
      ]
    }
  });

/* MIDDLEWARE */

app.use(cors());

app.use(express.json());

app.use(

  '/uploads',

  express.static(

    path.join(

      __dirname,

      'uploads'
    )
  )
);

/* ROUTES */

app.use(

  '/api/auth',

  require('./routes/authRoutes')
);

app.use(

  '/api/doctors',

  require('./routes/doctorRoutes')
);

app.use(

  '/api/appointments',

  require('./routes/appointmentRoutes')
);

app.use(

  '/api/records',

  require('./routes/recordRoutes')
);

app.use(

  '/api/availability',

  require('./routes/availabilityRoutes')
);

app.use(

  '/api/doctor-dashboard',

  require(

    './routes/doctorDashboardRoutes'
  )
);

/* STATUS */

app.get(

  '/api/status',

  (req, res) => {

    res.json({

      success: true,

      message:
        'Healthcare API Running'
    });
  }
);

/* SOCKET EVENTS */

io.on(

  'connection',

  (socket) => {

    console.log(
      'User Connected'
    );

    socket.on(

      'join-room',

      (roomId) => {

        socket.join(roomId);

        socket.to(roomId).emit(

          'user-joined'
        );
      }
    );

    socket.on(

      'offer',

      (data) => {

        socket.to(

          data.roomId

        ).emit(

          'offer',

          data
        );
      }
    );

    socket.on(

      'answer',

      (data) => {

        socket.to(

          data.roomId

        ).emit(

          'answer',

          data
        );
      }
    );

    socket.on(

      'disconnect',

      () => {

        console.log(
          'User Disconnected'
        );
      }
    );
  }
);

const PORT =
  process.env.PORT || 5000;

server.listen(

  PORT,

  () => {

    console.log(

      `Server running on ${PORT}`
    );
  }
);