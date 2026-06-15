import nodemailer from 'nodemailer';

const hasSmtpConfig = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

export const canSendEmail = () => hasSmtpConfig();

const smtpPort = () => Number(process.env.SMTP_PORT ?? 587);

const smtpSecure = () => {
  if (process.env.SMTP_SECURE === 'true') return true;
  if (process.env.SMTP_SECURE === 'false') return false;
  return smtpPort() === 465;
};

const buildTransportOptions = () => {
  const port = smtpPort();
  const secure = smtpSecure();

  return {
    host: process.env.SMTP_HOST,
    port,
    secure,
    requireTLS: !secure && port === 587,
    connectionTimeout: 30_000,
    greetingTimeout: 30_000,
    socketTimeout: 45_000,
    tls: {
      minVersion: 'TLSv1.2',
    },
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    // Cloud hosts often fail SMTP over IPv6.
    family: 4,
  };
};

let cachedTransporter: nodemailer.Transporter | null = null;

const resetTransporter = () => {
  cachedTransporter?.close();
  cachedTransporter = null;
};

const getTransporter = () => {
  if (!hasSmtpConfig()) {
    return null;
  }

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport(buildTransportOptions() as nodemailer.TransportOptions);
  }

  return cachedTransporter;
};

export const logEmailConfig = () => {
  if (!hasSmtpConfig()) {
    console.warn('SMTP is not configured. OTP emails will only log in development.');
    return;
  }

  const port = smtpPort();
  const secure = smtpSecure();
  console.log(`SMTP ready: ${process.env.SMTP_HOST}:${port} secure=${secure} user=${process.env.SMTP_USER}`);
};

const isRetryableSmtpError = (error: unknown) => {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('connection closed') ||
    message.includes('greeting never received')
  );
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const sendWithRetry = async (mailOptions: nodemailer.SendMailOptions, attempts = 3) => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const transporter = getTransporter();
      if (!transporter) {
        throw new Error('Email service is not configured. Add SMTP settings in backend .env.');
      }

      await transporter.sendMail(mailOptions);
      return;
    } catch (error) {
      lastError = error;
      resetTransporter();

      if (attempt >= attempts || !isRetryableSmtpError(error)) {
        throw error;
      }

      console.warn(`SMTP send attempt ${attempt} failed, retrying...`, error instanceof Error ? error.message : error);
      await wait(attempt * 2_000);
    }
  }

  throw lastError;
};

export const sendOtpEmail = async ({ to, name, otp }: { to: string; name: string; otp: string }): Promise<void> => {
  if (!hasSmtpConfig()) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] Verification OTP for ${to}: ${otp}`);
      return;
    }

    throw new Error('Email service is not configured. Add SMTP settings in backend .env.');
  }

  await sendWithRetry({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to,
    subject: 'Verify your MediCare AI account',
    text: `Hi ${name}, your MediCare AI verification OTP is ${otp}. It expires in 10 minutes.`,
    html: [
      `<p>Hi ${name},</p>`,
      '<p>Your MediCare AI verification OTP is:</p>',
      `<p style="font-size:24px;font-weight:700;letter-spacing:4px">${otp}</p>`,
      '<p>This OTP expires in 10 minutes. If you did not create this account, ignore this email.</p>',
    ].join(''),
  });
};

export const queueOtpEmail = ({ to, name, otp }: { to: string; name: string; otp: string }) => {
  void sendOtpEmail({ to, name, otp }).catch((error) => {
    const port = smtpPort();
    console.error(`Background OTP email failed for ${to} via ${process.env.SMTP_HOST}:${port}:`, error);
  });
};
