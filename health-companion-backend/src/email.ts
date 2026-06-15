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
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': String(process.env.BREVO_API_KEY),
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
