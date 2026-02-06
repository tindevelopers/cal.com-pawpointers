import type SendmailTransport from "nodemailer/lib/sendmail-transport";
import type SMTPConnection from "nodemailer/lib/smtp-connection";

import { isENVDev } from "@calcom/lib/env";

import { getAdditionalEmailHeaders } from "./getAdditionalEmailHeaders";

function detectTransport(): SendmailTransport.Options | SMTPConnection.Options | string {
  if (process.env.RESEND_API_KEY) {
    /**
     * Resend SMTP supports both 465 (implicit TLS) and 587 (STARTTLS).
     * Some hosts block outbound 465 which results in ETIMEDOUT. Prefer 587.
     */
    const transport: SMTPConnection.Options = {
      host: "smtp.resend.com",
      port: 587,
      secure: false,
      auth: {
        user: "resend",
        pass: process.env.RESEND_API_KEY,
      },
      requireTLS: true,
      // Make timeouts explicit so failures are visible quickly.
      connectionTimeout: 30_000,
      greetingTimeout: 30_000,
      socketTimeout: 30_000,
    };
    const from = process.env.EMAIL_FROM;
    const name = process.env.EMAIL_FROM_NAME;
    if (!from) {
      console.error("[email] RESEND_API_KEY set but EMAIL_FROM is missing - emails will fail");
    }
    console.log("[email] Using Resend SMTP", `from=${from || "(missing)"}`, `name=${name || "(missing)"}`);
    return transport;
  }

  if (process.env.EMAIL_SERVER) {
    console.log("[email] Using EMAIL_SERVER");
    return process.env.EMAIL_SERVER;
  }

  if (process.env.EMAIL_SERVER_HOST) {
    console.log("[email] Using EMAIL_SERVER_HOST", process.env.EMAIL_SERVER_HOST);
    const port = parseInt(process.env.EMAIL_SERVER_PORT || "");
    const auth =
      process.env.EMAIL_SERVER_USER && process.env.EMAIL_SERVER_PASSWORD
        ? {
            user: process.env.EMAIL_SERVER_USER,
            pass: process.env.EMAIL_SERVER_PASSWORD,
          }
        : undefined;

    const transport = {
      host: process.env.EMAIL_SERVER_HOST,
      port,
      auth,
      secure: port === 465,
      tls: {
        rejectUnauthorized: !isENVDev,
      },
    };

    return transport;
  }

  console.warn(
    "[email] No RESEND_API_KEY, EMAIL_SERVER, or EMAIL_SERVER_HOST set. Falling back to sendmail (likely to fail)."
  );
  return {
    sendmail: true,
    newline: "unix",
    path: "/usr/sbin/sendmail",
  };
}

export const serverConfig = {
  transport: detectTransport(),
  from: process.env.EMAIL_FROM,
  headers: getAdditionalEmailHeaders()[process.env.EMAIL_SERVER_HOST || ""] || undefined,
};
