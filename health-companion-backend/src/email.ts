import nodemailer from 'nodemailer';

const hasSmtpConfig = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

export const canSendEmail = () => hasSmtpConfig();

export const sendOtpEmail = async ({ to, name, otp }: { to: string; name: string; otp: string }): Promise<void> => {
  if (!hasSmtpConfig()) {
    throw new Error('Email service is not configured. Add SMTP settings in backend .env.');
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

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
