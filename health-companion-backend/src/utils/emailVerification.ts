import validator from 'validator';

type EmailValidationResult =
  | { ok: true; email: string; domain: string }
  | { ok: false; status: number; error: string };

const disposableDomains = new Set([
  '10minutemail.com',
  'guerrillamail.com',
  'mailinator.com',
  'tempmail.com',
  'temp-mail.org',
  'yopmail.com',
  'throwawaymail.com',
  'sharklasers.com',
]);

const normalizeDisposableList = () =>
  String(process.env.DISPOSABLE_EMAIL_DOMAINS ?? '')
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);

export const validateEmailForSignup = async (rawEmail: unknown): Promise<EmailValidationResult> => {
  const email = String(rawEmail ?? '').trim().toLowerCase();

  if (!isValidEmailFormat(email)) {
    return { ok: false, status: 400, error: 'Invalid email format' };
  }

  const domain = email.split('@')[1];
  const blockedDomains = new Set([...disposableDomains, ...normalizeDisposableList()]);
  if (blockedDomains.has(domain)) {
    return { ok: false, status: 400, error: 'Disposable or temporary emails are not allowed' };
  }

  // OTP delivery is the real verification step. Format + disposable checks are enough here.
  return { ok: true, email, domain };
};

export const isValidEmailFormat = (email: string) =>
  validator.isEmail(String(email ?? '').trim().toLowerCase(), {
    allow_utf8_local_part: false,
    require_tld: true,
  });
