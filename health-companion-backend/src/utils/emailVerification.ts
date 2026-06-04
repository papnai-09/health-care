import dns from 'dns/promises';
import net from 'net';
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

const smtpTimeoutMs = () => Number(process.env.SMTP_VERIFY_TIMEOUT_MS ?? 8000);
const requireMailboxVerification = () => process.env.REQUIRE_SMTP_MAILBOX_CHECK === 'true';

const readUntil = (socket: net.Socket, expected: RegExp): Promise<string> =>
  new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('SMTP verification timed out'));
    }, smtpTimeoutMs());

    const cleanup = () => {
      clearTimeout(timer);
      socket.off('data', onData);
      socket.off('error', onError);
    };

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      if (expected.test(buffer)) {
        cleanup();
        resolve(buffer);
      }
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    socket.on('data', onData);
    socket.on('error', onError);
  });

const writeLine = (socket: net.Socket, line: string) => {
  socket.write(`${line}\r\n`);
};

const connectSmtp = (host: string, port = 25): Promise<net.Socket> =>
  new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port, timeout: smtpTimeoutMs() }, () => resolve(socket));
    socket.once('timeout', () => {
      socket.destroy();
      reject(new Error('SMTP socket timed out'));
    });
    socket.once('error', reject);
  });

const verifyMailboxWithSmtp = async (email: string, mxHost: string): Promise<boolean | null> => {
  // SMTP mailbox checks are optional because many providers block or tarp it RCPT probes.
  if (process.env.ENABLE_SMTP_MAILBOX_CHECK !== 'true') {
    return null;
  }

  let socket: net.Socket | null = null;
  try {
    socket = await connectSmtp(mxHost);
    await readUntil(socket, /^220/m);

    writeLine(socket, `EHLO ${process.env.SMTP_VERIFY_HELO_DOMAIN ?? 'localhost'}`);
    await readUntil(socket, /^250[\s-]/m);

    writeLine(socket, `MAIL FROM:<${process.env.SMTP_VERIFY_FROM ?? 'verify@example.com'}>`);
    await readUntil(socket, /^250/m);

    writeLine(socket, `RCPT TO:<${email}>`);
    const rcptResponse = await readUntil(socket, /^(250|251|450|451|452|550|551|552|553|554)/m);
    writeLine(socket, 'QUIT');

    if (/^(250|251)/m.test(rcptResponse)) return true;
    if (/^(550|551|552|553|554)/m.test(rcptResponse)) return false;
    return null;
  } catch (error) {
    console.warn(`SMTP mailbox verification skipped for ${email}:`, error);
    return null;
  } finally {
    socket?.destroy();
  }
};

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

  let mxRecords: Array<{ exchange: string; priority: number }>;
  try {
    mxRecords = await dns.resolveMx(domain);
  } catch {
    return { ok: false, status: 400, error: 'Domain does not exist' };
  }

  if (!mxRecords.length) {
    return { ok: false, status: 400, error: 'Domain does not exist' };
  }

  const [bestMx] = mxRecords.sort((first, second) => first.priority - second.priority);
  const mailboxExists = await verifyMailboxWithSmtp(email, bestMx.exchange);
  if (mailboxExists === false) {
    return { ok: false, status: 400, error: 'Email does not exist' };
  }

  if (requireMailboxVerification() && mailboxExists !== true) {
    return { ok: false, status: 400, error: 'Email does not exist or cannot be verified. Please use a real email address.' };
  }

  return { ok: true, email, domain };
};

export const isValidEmailFormat = (email: string) =>
  validator.isEmail(String(email ?? '').trim().toLowerCase(), {
    allow_utf8_local_part: false,
    require_tld: true,
  });
