import nodemailer from 'nodemailer';
import { config } from '../config';

const transporter = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  secure: config.SMTP_PORT === 465,
  auth: {
    user: config.SMTP_USER,
    pass: config.SMTP_PASS,
  },
});

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  await transporter.sendMail({
    from: config.SMTP_FROM,
    to,
    subject: 'Your TempleGym login code',
    html: `
      <div style="font-family:sans-serif;max-width:400px;">
        <h2>TempleGym</h2>
        <p>Your one-time login code:</p>
        <h1 style="letter-spacing:8px;color:#9D2235;">${code}</h1>
        <p style="color:#888;">Expires in ${config.OTP_EXPIRY_MINUTES} minutes.</p>
      </div>
    `,
  });
}
