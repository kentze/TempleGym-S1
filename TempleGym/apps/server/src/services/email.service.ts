import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { config } from '../config';

const ses = new SESv2Client({
  region: config.AWS_REGION,
  credentials: {
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  },
});

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  await ses.send(new SendEmailCommand({
    FromEmailAddress: config.EMAIL_FROM,
    Destination: { ToAddresses: [to] },
    Content: {
      Simple: {
        Subject: { Data: 'Your TempleGym login code' },
        Body: {
          Html: {
            Data: `
              <div style="font-family:sans-serif;max-width:400px;">
                <h2>TempleGym</h2>
                <p>Your one-time login code:</p>
                <h1 style="letter-spacing:8px;color:#9D2235;">${code}</h1>
                <p style="color:#888;">Expires in ${config.OTP_EXPIRY_MINUTES} minutes.</p>
              </div>
            `,
          },
        },
      },
    },
  }));
}
