import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { doctorsRouter } from './routes/doctors';
import { appointmentsRouter } from './routes/appointments';
import { recordsRouter } from './routes/records';
import { chatbotRouter } from './routes/chatbot';
import { dietPlanRouter } from './routes/dietPlan';
import { authRouter } from './routes/auth';
import { adminRouter } from './routes/admin';
import { ensureDatabase, getDatabaseStatus } from './database';
import { logEmailConfig } from './email';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';
const apiRateLimitMax = Number(process.env.API_RATE_LIMIT_MAX ?? (isProduction ? 300 : 1000));
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
].filter(Boolean) as string[];

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number.isFinite(apiRateLimitMax) && apiRateLimitMax > 0 ? apiRateLimitMax : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please wait for a few minutes and try again.',
    });
  },
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', async (req, res) => {
  const database = await getDatabaseStatus();
  res.json({ status: database.connected ? 'OK' : 'ERROR', timestamp: new Date().toISOString(), database });
});

app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/doctors', doctorsRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/records', recordsRouter);
app.use('/api/chatbot', chatbotRouter);
app.use('/api/diet-plan', dietPlanRouter);

app.use('*', (req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Something went wrong!' });
});

ensureDatabase()
  .then(() => {
    logEmailConfig();
    app.listen(PORT, () => {
      console.log(`Health Companion API server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  })
  .catch((error) => {
    console.error('Failed to connect database:', error);
    process.exit(1);
  });
