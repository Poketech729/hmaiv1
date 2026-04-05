/**
 * Message Service - Sends SMS/OTP messages to users
 * Supports multiple providers (Twilio, AWS SNS, etc.)
 */

export type MessageProvider = "twilio" | "aws-sns" | "mock";

const messageProvider = (process.env.MESSAGE_PROVIDER || "twilio") as MessageProvider;

// ─── Twilio Configuration ─────────────────────────────────────────────────────

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

let twilioClient: any = null;

async function initTwilio(): Promise<void> {
  if (twilioClient) return;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error(
      "Twilio credentials missing. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER"
    );
  }

  // Dynamically import Twilio SDK
  try {
    const twilio = await import("twilio");
    twilioClient = twilio.default(accountSid, authToken);
  } catch {
    throw new Error("Twilio SDK not installed. Run: npm install twilio");
  }
}

// ─── AWS SNS Configuration ────────────────────────────────────────────────────

async function sendWithAwsSNS(phoneNumber: string, message: string): Promise<void> {
  try {
    const AWS = await import("aws-sdk");
    const sns = new AWS.default.SNS({
      region: process.env.AWS_REGION || "us-east-1",
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });

    await sns.publish({
      Message: message,
      PhoneNumber: phoneNumber,
    }).promise();
  } catch (error) {
    throw new Error(`AWS SNS error: ${error}`);
  }
}

// ─── Send Message Implementation ───────────────────────────────────────────────

/**
 * Send SMS message with OTP
 * @param phoneNumber - Phone number in international format (e.g., +91XXXXXXXXXX)
 * @param otp - One-time password to send
 */
export async function sendOTP(phoneNumber: string, otp: string): Promise<void> {
  const message = `Your HMAI verification code is: ${otp}. It expires in 10 minutes.`;

  try {
    switch (messageProvider) {
      case "twilio":
        await sendWithTwilio(phoneNumber, message);
        break;

      case "aws-sns":
        await sendWithAwsSNS(phoneNumber, message);
        break;

      case "mock":
        console.log(`[MOCK SMS] To: ${phoneNumber}, Message: ${message}`);
        break;

      default:
        throw new Error(`Unknown message provider: ${messageProvider}`);
    }

    console.log(`OTP sent successfully to ${phoneNumber}`);
  } catch (error) {
    console.error(`Failed to send OTP to ${phoneNumber}:`, error);
    throw error;
  }
}

/**
 * Send OTP with Twilio
 */
async function sendWithTwilio(phoneNumber: string, message: string): Promise<void> {
  await initTwilio();

  if (!twilioClient) {
    throw new Error("Twilio client not initialized");
  }

  const fromNumber = process.env.TWILIO_FROM_NUMBER!;

  try {
    await twilioClient.messages.create({
      body: message,
      from: fromNumber,
      to: phoneNumber,
    });
  } catch (error) {
    throw new Error(`Twilio SMS error: ${error}`);
  }
}

/**
 * Send generic SMS message (optional utility)
 */
export async function sendMessage(phoneNumber: string, message: string): Promise<void> {
  try {
    switch (messageProvider) {
      case "twilio":
        await sendWithTwilio(phoneNumber, message);
        break;

      case "aws-sns":
        await sendWithAwsSNS(phoneNumber, message);
        break;

      case "mock":
        console.log(`[MOCK SMS] To: ${phoneNumber}, Message: ${message}`);
        break;

      default:
        throw new Error(`Unknown message provider: ${messageProvider}`);
    }
  } catch (error) {
    console.error(`Failed to send message to ${phoneNumber}:`, error);
    throw error;
  }
}
