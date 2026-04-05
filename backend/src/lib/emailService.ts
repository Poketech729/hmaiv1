/**
 * Email Service - Sends OTP and verification emails
 * Supports Sendgrid, Nodemailer, etc.
 */

export type EmailProvider = "sendgrid" | "nodemailer" | "mock";

const emailProvider = (process.env.EMAIL_PROVIDER || "mock") as EmailProvider;

// ─── SendGrid Configuration ────────────────────────────────────────────────────

async function sendWithSendgrid(
  to: string,
  subject: string,
  htmlContent: string
): Promise<void> {
  try {
    const sgMail = await import("@sendgrid/mail");
    const mail = sgMail.default;

    mail.setApiKey(process.env.SENDGRID_API_KEY!);

    await mail.send({
      to,
      from: process.env.SENDGRID_FROM_EMAIL! || "noreply@hmai.health",
      subject,
      html: htmlContent,
    });

    console.log(`Email sent to ${to}`);
  } catch (error) {
    throw new Error(`SendGrid error: ${error}`);
  }
}

// ─── Nodemailer Configuration ──────────────────────────────────────────────────

async function sendWithNodemailer(
  to: string,
  subject: string,
  htmlContent: string
): Promise<void> {
  try {
    const nodemailerModule = await import("nodemailer");
    const nodemailer = (nodemailerModule.default ?? nodemailerModule) as {
      createTransport: (config: Record<string, unknown>) => {
        verify: () => Promise<void>;
        sendMail: (payload: Record<string, unknown>) => Promise<void>;
      };
    };

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    await transporter.verify();

    await transporter.sendMail({
      from: process.env.SMTP_FROM_EMAIL || "noreply@hmai.health",
      to,
      subject,
      html: htmlContent,
    });

    console.log(`Email sent to ${to}`);
  } catch (error) {
    throw new Error(`Nodemailer error: ${error}`);
  }
}

// ─── OTP Email Templates ──────────────────────────────────────────────────────

function getOTPEmailTemplate(otp: string, appName: string = "HMAI"): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: white; padding: 30px; text-align: center; }
          .otp-box { background-color: #f0f0f0; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .otp-code { font-size: 32px; font-weight: bold; color: #4CAF50; letter-spacing: 5px; }
          .footer { background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 5px 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${appName} Verification</h1>
          </div>
          <div class="content">
            <p>Your one-time verification code is:</p>
            <div class="otp-box">
              <div class="otp-code">${otp}</div>
            </div>
            <p style="color: #666; font-size: 14px;">
              This code will expire in 10 minutes.
              <br/>Do not share this code with anyone.
            </p>
          </div>
          <div class="footer">
            <p>${appName} - Healthcare Management & AI</p>
            <p>If you didn't request this code, please ignore this email.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

// ─── Public Email Functions ───────────────────────────────────────────────────

/**
 * Send OTP via email
 * @param email - Email address
 * @param otp - One-time password
 */
export async function sendOTPEmail(email: string, otp: string): Promise<void> {
  const subject = `${otp} is your ${process.env.APP_NAME || "HMAI"} verification code`;
  const htmlContent = getOTPEmailTemplate(otp);

  try {
    switch (emailProvider) {
      case "sendgrid":
        await sendWithSendgrid(email, subject, htmlContent);
        break;

      case "nodemailer":
        await sendWithNodemailer(email, subject, htmlContent);
        break;

      case "mock":
        console.log(`[MOCK EMAIL] To: ${email}`);
        console.log(`Subject: ${subject}`);
        console.log(`OTP: ${otp}`);
        break;

      default:
        throw new Error(`Unknown email provider: ${emailProvider}`);
    }
  } catch (error) {
    console.error(`Failed to send OTP email to ${email}:`, error);
    throw error;
  }
}

/**
 * Send generic email (utility)
 */
export async function sendEmail(
  to: string,
  subject: string,
  htmlContent: string
): Promise<void> {
  try {
    switch (emailProvider) {
      case "sendgrid":
        await sendWithSendgrid(to, subject, htmlContent);
        break;

      case "nodemailer":
        await sendWithNodemailer(to, subject, htmlContent);
        break;

      case "mock":
        console.log(`[MOCK EMAIL] To: ${to}`);
        console.log(`Subject: ${subject}`);
        break;

      default:
        throw new Error(`Unknown email provider: ${emailProvider}`);
    }
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
    throw error;
  }
}
