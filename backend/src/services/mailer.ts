import crypto from 'crypto';
import nodemailer from 'nodemailer';

interface DispatchedEmail {
  id: string;
  to: string;
  masked_to: string;
  subject: string;
  code: string;
  sent_at: string;
  expires_at: string;
  delivered_via: 'smtp' | 'console_dev_transport';
}

// In-memory buffer of recent dispatched emails for local development inspection
const devMailbox: DispatchedEmail[] = [];

/**
 * Mask an email address for privacy and security display
 * e.g. "sravyareddyg5@gmail.com" -> "s***5@gmail.com"
 * e.g. "student@vertexlearn.local" -> "s***t@vertexlearn.local"
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return 'your email';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}*@${domain}`;
  }
  const first = local[0];
  const last = local[local.length - 1];
  return `${first}${'*'.repeat(Math.min(local.length - 2, 4))}${last}@${domain}`;
}

/**
 * Cryptographically secure 6-digit OTP generator (100000 - 999999)
 */
export function generateSecureOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Hash OTP with SHA-256 and server secret salt
 */
export function hashOtp(otp: string, salt: string = process.env.JWT_SECRET || 'vertexlearn_secret'): string {
  return crypto
    .createHash('sha256')
    .update(`${otp.trim()}:${salt}`)
    .digest('hex');
}

/**
 * Timing-safe comparison of OTP hashes to prevent side-channel timing attacks
 */
export function verifyOtpHash(inputOtp: string, storedHash: string, salt: string = process.env.JWT_SECRET || 'vertexlearn_secret'): boolean {
  if (!inputOtp || !storedHash) return false;
  const inputHash = hashOtp(inputOtp, salt);
  try {
    const a = Buffer.from(inputHash, 'utf8');
    const b = Buffer.from(storedHash, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Dispatches the OTP email via real SMTP if configured, or via secure dev transport
 */
export async function sendOtpEmail(
  to: string,
  otp: string,
  purpose: 'login' | 'register' | 'recovery' = 'login'
): Promise<{ success: boolean; delivered_via: 'smtp' | 'console_dev_transport'; message_id?: string }> {
  const masked = maskEmail(to);
  const now = new Date();
  const expires = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes

  const subject = `🔐 Your VertexLearn AI Verification Code: ${otp}`;
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
        .card { max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 16px rgba(0,0,0,0.05); }
        .header { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; }
        .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; background: #eff6ff; color: #2563eb; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
        .code-box { background: #f1f5f9; border: 2px dashed #94a3b8; border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0; }
        .code { font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 10px; color: #1e293b; }
        .notice { font-size: 12px; color: #64748b; margin-top: 16px; line-height: 1.5; }
        .footer { font-size: 11px; color: #94a3b8; text-align: center; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <span class="badge">VertexLearn AI Security</span>
        </div>
        <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 800;">Two-Factor Verification Code</h2>
        <p style="font-size: 14px; color: #475569; margin: 0;">
          Use the 6-digit security code below to complete your authentication for <b>${masked}</b>.
        </p>

        <div class="code-box">
          <div class="code">${otp}</div>
        </div>

        <p class="notice">
          ⏱️ <b>Expires in 5 minutes.</b><br/>
          🔒 <b>Security Notice:</b> Never share this code with anyone. VertexLearn AI staff will never ask for your verification code.
        </p>

        <div class="footer">
          VertexLearn AI • Autonomous Intelligent Learning Ecosystem
        </div>
      </div>
    </body>
    </html>
  `;

  let deliveredVia: 'smtp' | 'console_dev_transport' = 'console_dev_transport';
  let messageId: string | undefined;

  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpHost = process.env.SMTP_HOST || (smtpUser?.includes('@gmail.com') ? 'smtp.gmail.com' : undefined);
  const smtpPort = Number(process.env.SMTP_PORT) || 587;

  // 1. If SMTP credentials are provided, attempt real email transmission
  if (smtpUser && smtpPass && smtpHost) {
    try {
      const isGmail = smtpHost.includes('gmail.com');
      const transportConfig: any = isGmail
        ? {
            service: 'gmail',
            auth: {
              user: smtpUser,
              pass: smtpPass,
            },
          }
        : {
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: {
              user: smtpUser,
              pass: smtpPass,
            },
            tls: {
              rejectUnauthorized: false,
            },
          };

      const transporter = nodemailer.createTransport(transportConfig);

      const defaultSender = smtpUser.includes('@')
        ? `"VertexLearn AI Security" <${smtpUser}>`
        : '"VertexLearn AI Security" <noreply@vertexlearn.ai>';

      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || defaultSender,
        to,
        subject,
        text: `Your VertexLearn AI verification code is: ${otp}\n\nThis code expires in 5 minutes.\nDo not share this code with anyone.`,
        html: htmlContent,
      });

      deliveredVia = 'smtp';
      messageId = info.messageId;
      console.log(`[EMAIL DISPATCH: LIVE SMTP SUCCESS] Dispatched to ${to} (Message ID: ${info.messageId})`);
    } catch (err: any) {
      console.warn(`[EMAIL DISPATCH: LIVE SMTP FAILED] Error transmitting to ${to}: ${err.message}. Falling back to dev transport.`);
    }
  }

  // 2. Output high-visibility terminal log (standard practice for local development/staging)
  console.log(`
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔐 [VERTEXLEARN AI SECURITY] TWO-FACTOR AUTHENTICATION CODE DISPATCHED      │
├─────────────────────────────────────────────────────────────────────────────┤
│ Recipient:    ${to.padEnd(61)} │
│ Masked Hint:  ${masked.padEnd(61)} │
│ Security OTP: ${otp.padEnd(61)} │
│ Purpose:      ${purpose.padEnd(61)} │
│ Expiration:   5 Minutes (Expires at ${expires.toLocaleTimeString().padEnd(39)}) │
│ Delivery:     ${deliveredVia.padEnd(61)} │
└─────────────────────────────────────────────────────────────────────────────┘
`);

  // 3. Record in local dev mailbox buffer
  const mailEntry: DispatchedEmail = {
    id: `mail-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    to,
    masked_to: masked,
    subject,
    code: otp,
    sent_at: now.toISOString(),
    expires_at: expires.toISOString(),
    delivered_via: deliveredVia,
  };

  devMailbox.unshift(mailEntry);
  if (devMailbox.length > 50) devMailbox.pop();

  return { success: true, delivered_via: deliveredVia, message_id: messageId };
}

/**
 * Retrieve recent dispatched emails for local development inspection
 */
export function getDevMailbox(email?: string): DispatchedEmail[] {
  if (!email) return [...devMailbox];
  const target = email.toLowerCase().trim();
  return devMailbox.filter((m) => m.to.toLowerCase() === target);
}

/**
 * Test and configure live SMTP credentials at runtime
 */
export async function testAndConfigureSmtp(params: {
  host?: string;
  port?: number;
  user: string;
  pass: string;
  secure?: boolean;
}): Promise<{ success: boolean; message: string; messageId?: string }> {
  const { host, port, user, pass, secure } = params;
  const isGmail = (host && host.includes('gmail.com')) || user.includes('@gmail.com');
  const resolvedHost = host || (isGmail ? 'smtp.gmail.com' : 'localhost');
  const resolvedPort = port || (isGmail ? 465 : 587);

  const transportConfig: any = isGmail
    ? {
        service: 'gmail',
        auth: {
          user,
          pass,
        },
      }
    : {
        host: resolvedHost,
        port: resolvedPort,
        secure: secure ?? resolvedPort === 465,
        auth: {
          user,
          pass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      };

  const transporter = nodemailer.createTransport(transportConfig);

  // 1. Verify credentials with SMTP server
  await transporter.verify();

  // 2. Transmit confirmation test email to the user
  const info = await transporter.sendMail({
    from: `"VertexLearn AI Security" <${user}>`,
    to: user,
    subject: '✅ VertexLearn AI: Live SMTP Connected Successfully!',
    text: `Congratulations!\n\nYour live email delivery has been connected to VertexLearn AI.\nTwo-factor authentication verification codes will now be sent directly to your inbox.\n\nTime: ${new Date().toUTCString()}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; padding: 24px;">
        <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; padding: 28px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <div style="display: inline-block; padding: 4px 10px; border-radius: 6px; background: #f0fdf4; color: #16a34a; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 12px;">
            Live SMTP Verified
          </div>
          <h2 style="margin: 0 0 10px 0; color: #0f172a; font-size: 20px;">✅ Connection Successful!</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.5; margin: 0 0 16px 0;">
            Your live email provider has been authenticated. Future two-factor authentication codes will arrive directly in your inbox at <b>${user}</b>.
          </p>
          <div style="background: #f1f5f9; padding: 12px; border-radius: 8px; font-size: 12px; color: #64748b;">
            Connected Service: <b>${isGmail ? 'Gmail Service' : resolvedHost}</b><br/>
            Authenticated Account: <b>${user}</b>
          </div>
        </div>
      </div>
    `,
  });

  // 3. Persist to current runtime environment
  process.env.SMTP_HOST = isGmail ? 'smtp.gmail.com' : resolvedHost;
  process.env.SMTP_PORT = String(resolvedPort);
  process.env.SMTP_USER = user;
  process.env.SMTP_PASS = pass;
  process.env.SMTP_FROM = `"VertexLearn AI Security" <${user}>`;
  process.env.SMTP_SECURE = String(secure ?? resolvedPort === 465);

  console.log(`[SMTP CONFIGURATION SUCCESS] Successfully authenticated ${user} via ${isGmail ? 'Gmail' : resolvedHost}`);

  return {
    success: true,
    message: `SMTP verified! A confirmation test email was sent to ${user}.`,
    messageId: info.messageId,
  };
}

