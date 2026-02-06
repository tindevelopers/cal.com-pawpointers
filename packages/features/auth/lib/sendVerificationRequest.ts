import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import type { SendVerificationRequestParams } from "next-auth/providers/email";
import type { TransportOptions } from "nodemailer";
import nodemailer from "nodemailer";
import path from "node:path";

import { APP_NAME, WEBAPP_URL } from "@calcom/lib/constants";
import { serverConfig } from "@calcom/lib/serverConfig";

const transporter = nodemailer.createTransport<TransportOptions>({
  ...(serverConfig.transport as TransportOptions),
} as TransportOptions);

const sendVerificationRequest = async ({
  identifier,
  url,
}: Pick<SendVerificationRequestParams, "identifier" | "url">) => {
  const emailsDir = path.resolve(process.cwd(), "..", "..", "packages/emails", "templates");
  const originalUrl = new URL(url);
  const webappUrl = new URL(process.env.NEXTAUTH_URL || WEBAPP_URL);
  if (originalUrl.origin !== webappUrl.origin) {
    url = url.replace(originalUrl.origin, webappUrl.origin);
  }
  const emailFile = readFileSync(path.join(emailsDir, "confirm-email.html"), {
    encoding: "utf8",
  });
  const emailTemplate = Handlebars.compile(emailFile);

  const from = `${process.env.EMAIL_FROM}` || APP_NAME;
  const subject = `Your sign-in link for ${APP_NAME}`;
  const html = emailTemplate({
    base_url: WEBAPP_URL,
    signin_url: url,
    email: identifier,
  });

  // Prefer Resend HTTP API when available (Railway SMTP egress can time out).
  if (process.env.RESEND_API_KEY) {
    const RESEND_API_TIMEOUT_MS = 30_000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RESEND_API_TIMEOUT_MS);
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from,
          to: [identifier],
          subject,
          html,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Resend API sendVerificationRequest failed: ${res.status} ${res.statusText} ${body}`);
      }
      return;
    } finally {
      clearTimeout(timeout);
    }
  }

  // Fallback to nodemailer transport.
  transporter.sendMail({ from, to: identifier, subject, html });
};

export default sendVerificationRequest;
