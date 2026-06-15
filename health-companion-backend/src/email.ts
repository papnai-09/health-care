import nodemailer from 'nodemailer';

const hasSmtpConfig = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

export const canSendEmail = () => hasSmtpConfig();

let cachedTransporter: nodemailer.Transporter | null = null;

const getTransporter = () => {
  if (!hasSmtpConfig()) {
    return null;
  }

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  return cachedTransporter;
};

export const sendOtpEmail = async ({ to, name, otp }: { to: string; name: string; otp: string }): Promise<void> => {
  if (!hasSmtpConfig()) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] Verification OTP for ${to}: ${otp}`);
      return;
    }

    throw new Error('Email service is not configured. Add SMTP settings in backend .env.');
  }

  const transporter = getTransporter();
  if (!transporter) {
    throw new Error('Email service is not configured. Add SMTP settings in backend .env.');
  }

  await transporter.sendMail({
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
    console.error(`Background OTP email failed for ${to}:`, error);
  });
};
