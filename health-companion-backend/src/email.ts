import nodemailer from 'nodemailer';

const hasSmtpConfig = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const hasResendConfig = () => Boolean(process.env.RESEND_API_KEY);
const hasBrevoConfig = () => Boolean(process.env.BREVO_API_KEY);

// Render and many cloud hosts block or time out SMTP (ports 587/465).
// Use Brevo/Resend HTTP APIs in production; keep SMTP for local dev only.
const useSmtpDelivery = () => {
  if (!hasSmtpConfig()) return false;
  if (process.env.EMAIL_USE_SMTP === 'true') return true;
  if (process.env.EMAIL_USE_SMTP === 'false') return false;
  return process.env.NODE_ENV !== 'production';
};

export const canSendEmail = () => hasBrevoConfig() || hasResendConfig() || useSmtpDelivery();

const getSenderEmail = () =>
  process.env.EMAIL_FROM ??
  process.env.SMTP_FROM ??
  process.env.SMTP_USER ??
  'onboarding@resend.dev';

const getSenderName = () => process.env.EMAIL_FROM_NAME ?? 'MediCare AI';

const buildOtpContent = ({ name, otp }: { name: string; otp: string }) => ({
  subject: 'Verify your MediCare AI account',
  text: `Hi ${name}, your MediCare AI verification OTP is ${otp}. It expires in 10 minutes.`,
  html: [
    `<p>Hi ${name},</p>`,
    '<p>Your MediCare AI verification OTP is:</p>',
    `<p style="font-size:24px;font-weight:700;letter-spacing:4px">${otp}</p>`,
    '<p>This OTP expires in 10 minutes. If you did not create this account, ignore this email.</p>',
  ].join(''),
});

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
  if (hasBrevoConfig()) {
    console.log(`Email ready via Brevo API. Sender: ${getSenderName()} <${getSenderEmail()}>`);
    return;
  }

  if (hasResendConfig()) {
    console.log(`Email ready via Resend API. Sender: ${getSenderName()} <${getSenderEmail()}>`);
    return;
  }

  if (useSmtpDelivery()) {
    const port = smtpPort();
    const secure = smtpSecure();
    console.log(`Email ready via SMTP: ${process.env.SMTP_HOST}:${port} secure=${secure} user=${process.env.SMTP_USER}`);
    return;
  }

  if (hasSmtpConfig() && process.env.NODE_ENV === 'production') {
    console.warn(
      'SMTP is configured but disabled on production. Create a Brevo API key (xkeysib-...) and set BREVO_API_KEY on Render.',
    );
    return;
  }

  console.warn('Email is not configured. OTP emails will only log in development.');
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

const sendViaBrevo = async ({
  to,
  name,
  subject,
  text,
  html,
}: {
  to: string;
  name: string;
  subject: string;
  text: string;
  html: string;
}) => {
  const apiKey = String(process.env.BREVO_API_KEY).trim();
  
  // Debug logging
  if (!apiKey) {
    console.error('BREVO_API_KEY is not set or empty');
  } else {
    console.debug(`Brevo API key format check: starts with 'xkeysib-'? ${apiKey.startsWith('xkeysib-')}, length: ${apiKey.length}`);
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: getSenderName(), email: getSenderEmail() },
      to: [{ email: to, name }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Brevo failed (${response.status}): ${body}`);
  }
};

const sendViaResend = async ({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) => {
  const fromAddress = getSenderEmail();
  const from = fromAddress.includes('<') ? fromAddress : `${getSenderName()} <${fromAddress}>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend failed (${response.status}): ${body}`);
  }
};

const sendWithRetry = async (mailOptions: nodemailer.SendMailOptions, attempts = 3) => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const transporter = getTransporter();
      if (!transporter) {
        throw new Error('Email service is not configured. Add BREVO_API_KEY, RESEND_API_KEY, or SMTP settings.');
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
  if (!canSendEmail() && process.env.NODE_ENV === 'production') {
    throw new Error(
      'Email is not configured for production. Add BREVO_API_KEY (xkeysib-...) on Render. SMTP keys (xsmtpsib-...) do not work on cloud hosts.',
    );
  }

  if (!canSendEmail()) {
    console.log(`[DEV] Verification OTP for ${to}: ${otp}`);
    return;
  }

  const { subject, text, html } = buildOtpContent({ name, otp });

  if (hasBrevoConfig()) {
    await sendViaBrevo({ to, name, subject, text, html });
    return;
  }

  if (hasResendConfig()) {
    await sendViaResend({ to, subject, text, html });
    return;
  }

  if (useSmtpDelivery()) {
    await sendWithRetry({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to,
      subject,
      text,
      html,
    });
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEV] Verification OTP for ${to}: ${otp}`);
    return;
  }

  throw new Error(
    'Email is not configured for production. Add BREVO_API_KEY (xkeysib-...) on Render. SMTP keys (xsmtpsib-...) do not work on cloud hosts.',
  );
};

export const queueOtpEmail = ({ to, name, otp }: { to: string; name: string; otp: string }) => {
  void sendOtpEmail({ to, name, otp }).catch((error) => {
    const provider = hasBrevoConfig()
      ? 'Brevo API'
      : hasResendConfig()
        ? 'Resend'
        : useSmtpDelivery()
          ? `SMTP ${process.env.SMTP_HOST}:${smtpPort()}`
          : 'email provider';
    console.error(`Background OTP email failed for ${to} via ${provider}:`, error);
  });
};

// --- Appointment Notification Email ---

const buildAppointmentNotificationContent = ({
  doctorName,
  patientName,
  date,
  time,
  specialty,
  type,
}: {
  doctorName: string;
  patientName: string;
  date: string;
  time: string;
  specialty: string;
  type: string;
}) => {
  // Calculate end time (30-minute slot)
  const [hours, minutes] = time.split(':').map(Number);
  const endDate = new Date(2026, 0, 1, hours, minutes + 30);
  const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

  const formatTimeDisplay = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHour = h % 12 || 12;
    return `${displayHour}:${String(m).padStart(2, '0')} ${period}`;
  };

  const formattedDate = new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const timeSlot = `${formatTimeDisplay(time)} - ${formatTimeDisplay(endTime)}`;

  return {
    subject: `New Appointment Booked — ${patientName} on ${formattedDate}`,
    text: `Hi Dr. ${doctorName},\n\nA new appointment has been booked.\n\nPatient: ${patientName}\nDate: ${formattedDate}\nTime Slot: ${timeSlot}\nSpecialty: ${specialty}\nType: ${type}\n\nPlease make sure to join the video call during the scheduled time slot.\n\nRegards,\nMediCare AI`,
    html: [
      `<div style="font-family:'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:12px">`,
      `<div style="background:linear-gradient(135deg,#0ea5e9,#6366f1);border-radius:12px 12px 0 0;padding:24px;text-align:center">`,
      `<h1 style="color:#fff;margin:0;font-size:22px">📅 New Appointment Booked</h1>`,
      `</div>`,
      `<div style="background:#fff;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:0">`,
      `<p style="margin:0 0 16px;color:#334155;font-size:15px">Hi Dr. ${doctorName},</p>`,
      `<p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.6">A new appointment has been booked with you. Here are the details:</p>`,
      `<table style="width:100%;border-collapse:collapse;margin:0 0 20px">`,
      `<tr><td style="padding:10px 12px;background:#f1f5f9;border-radius:8px 0 0 0;font-weight:600;color:#334155;font-size:13px;width:120px">Patient</td><td style="padding:10px 12px;background:#f1f5f9;border-radius:0 8px 0 0;color:#475569;font-size:14px">${patientName}</td></tr>`,
      `<tr><td style="padding:10px 12px;font-weight:600;color:#334155;font-size:13px">Date</td><td style="padding:10px 12px;color:#475569;font-size:14px">${formattedDate}</td></tr>`,
      `<tr><td style="padding:10px 12px;background:#f1f5f9;font-weight:600;color:#334155;font-size:13px">Time Slot</td><td style="padding:10px 12px;background:#f1f5f9;color:#0ea5e9;font-size:14px;font-weight:700">${timeSlot}</td></tr>`,
      `<tr><td style="padding:10px 12px;font-weight:600;color:#334155;font-size:13px">Specialty</td><td style="padding:10px 12px;color:#475569;font-size:14px">${specialty}</td></tr>`,
      `<tr><td style="padding:10px 12px;background:#f1f5f9;border-radius:0 0 0 8px;font-weight:600;color:#334155;font-size:13px">Type</td><td style="padding:10px 12px;background:#f1f5f9;border-radius:0 0 8px 0;color:#475569;font-size:14px">${type}</td></tr>`,
      `</table>`,
      `<div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:12px 16px;border-radius:0 8px 8px 0;margin:0 0 20px">`,
      `<p style="margin:0;color:#1e40af;font-size:13px;line-height:1.5">⏰ <strong>Important:</strong> The video call is only accessible during the scheduled time slot. Please join on time.</p>`,
      `</div>`,
      `<p style="margin:0;color:#64748b;font-size:12px;text-align:center">— MediCare AI</p>`,
      `</div>`,
      `</div>`,
    ].join(''),
  };
};

export const sendAppointmentNotificationEmail = async ({
  to,
  doctorName,
  patientName,
  date,
  time,
  specialty,
  type,
}: {
  to: string;
  doctorName: string;
  patientName: string;
  date: string;
  time: string;
  specialty: string;
  type: string;
}): Promise<void> => {
  if (!canSendEmail()) {
    console.log(`[DEV] Appointment notification for Dr. ${doctorName} (${to}): Patient ${patientName} booked on ${date} at ${time}`);
    return;
  }

  const { subject, text, html } = buildAppointmentNotificationContent({
    doctorName,
    patientName,
    date,
    time,
    specialty,
    type,
  });

  if (hasBrevoConfig()) {
    await sendViaBrevo({ to, name: doctorName, subject, text, html });
    return;
  }

  if (hasResendConfig()) {
    await sendViaResend({ to, subject, text, html });
    return;
  }

  if (useSmtpDelivery()) {
    await sendWithRetry({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to,
      subject,
      text,
      html,
    });
    return;
  }

  console.log(`[DEV] Appointment notification for Dr. ${doctorName} (${to}): Patient ${patientName} booked on ${date} at ${time}`);
};

export const queueAppointmentEmail = (params: {
  to: string;
  doctorName: string;
  patientName: string;
  date: string;
  time: string;
  specialty: string;
  type: string;
}) => {
  void sendAppointmentNotificationEmail(params).catch((error) => {
    const provider = hasBrevoConfig()
      ? 'Brevo API'
      : hasResendConfig()
        ? 'Resend'
        : useSmtpDelivery()
          ? `SMTP ${process.env.SMTP_HOST}:${smtpPort()}`
          : 'email provider';
    console.error(`Background appointment email failed for ${params.to} via ${provider}:`, error);
  });
};

