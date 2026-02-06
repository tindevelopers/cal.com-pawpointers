import { decodeHTML } from "entities";
import { z } from "zod";

import dayjs from "@calcom/dayjs";
import { FeaturesRepository } from "@calcom/features/flags/features.repository";
import isSmsCalEmail from "@calcom/lib/isSmsCalEmail";
import { serverConfig } from "@calcom/lib/serverConfig";
import { getServerErrorFromUnknown } from "@calcom/lib/server/getServerErrorFromUnknown";
import { setTestEmail } from "@calcom/lib/testEmails";
import { prisma } from "@calcom/prisma";

import { sanitizeDisplayName } from "../lib/sanitizeDisplayName";

export default class BaseEmail {
  name = "";

  protected getTimezone() {
    return "";
  }

  protected getLocale(): string {
    return "";
  }

  protected getFormattedRecipientTime({ time, format }: { time: string; format: string }) {
    return dayjs(time).tz(this.getTimezone()).locale(this.getLocale()).format(format);
  }

  protected async getNodeMailerPayload(): Promise<Record<string, unknown>> {
    return {};
  }
  public async sendEmail() {
    const featuresRepository = new FeaturesRepository(prisma);
    const emailsDisabled = await featuresRepository.checkIfFeatureIsEnabledGlobally("emails");
    /** If email kill switch exists and is active, we prevent emails being sent. */
    if (emailsDisabled) {
      console.warn("Skipped Sending Email due to active Kill Switch");
      return new Promise((r) => r("Skipped Sending Email due to active Kill Switch"));
    }

    if (process.env.INTEGRATION_TEST_MODE === "true") {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      //@ts-expect-error
      setTestEmail(await this.getNodeMailerPayload());
      console.log(
        "Skipped Sending Email as process.env.NEXT_PUBLIC_UNIT_TESTS is set. Emails are available in globalThis.testEmails"
      );
      return new Promise((r) => r("Skipped sendEmail for Unit Tests"));
    }

    const payload = await this.getNodeMailerPayload();

    const from = "from" in payload ? (payload.from as string) : "";
    const to = "to" in payload ? (payload.to as string) : "";

    if (isSmsCalEmail(to)) {
      console.log(`Skipped Sending Email to faux email: ${to}`);
      return new Promise((r) => r(`Skipped Sending Email to faux email: ${to}`));
    }

    const sanitizedFrom = sanitizeDisplayName(from);
    const sanitizedTo = sanitizeDisplayName(to);

    const parseSubject = z.string().safeParse(payload?.subject);
    const payloadWithUnEscapedSubject = {
      headers: this.getMailerOptions().headers,
      ...payload,
      ...{
        from: sanitizedFrom,
        to: sanitizedTo,
      },
      ...(parseSubject.success && { subject: decodeHTML(parseSubject.data) }),
    };

    /**
     * Prefer Resend HTTP API when RESEND_API_KEY is set.
     *
     * Runtime evidence: Railway egress is timing out on SMTP (ETIMEDOUT) even when using Resend SMTP,
     * so sending via HTTPS (443) is significantly more reliable.
     */
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
            from: "from" in payloadWithUnEscapedSubject ? payloadWithUnEscapedSubject.from : undefined,
            to: "to" in payloadWithUnEscapedSubject ? [payloadWithUnEscapedSubject.to] : undefined,
            subject: "subject" in payloadWithUnEscapedSubject ? payloadWithUnEscapedSubject.subject : undefined,
            html: "html" in payloadWithUnEscapedSubject ? payloadWithUnEscapedSubject.html : undefined,
            text: "text" in payloadWithUnEscapedSubject ? payloadWithUnEscapedSubject.text : undefined,
          }),
        });

        const json = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
        if (!res.ok) {
          const message = json?.message || `${res.status} ${res.statusText}`;
          const err = new Error(`Resend API send failed: ${message}`);
          this.printNodeMailerError(err);
          throw err;
        }

        console.log("[email] Resend API send ok", `id=${json?.id ?? "(unknown)"}`, `name=${this.name}`);
        return new Promise((resolve) => resolve("send mail via resend api"));
      } finally {
        clearTimeout(timeout);
      }
    }

    const { createTransport } = await import("nodemailer");
    const SEND_EMAIL_TIMEOUT_MS = 30_000;

    const sendPromise = new Promise<unknown>((resolve, reject) =>
      createTransport(this.getMailerOptions().transport).sendMail(
        payloadWithUnEscapedSubject,
        (_err, info) => {
          if (_err) {
            const err = getServerErrorFromUnknown(_err);
            this.printNodeMailerError(err);
            reject(err);
          } else {
            resolve(info);
          }
        }
      )
    );

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Email send timed out after ${SEND_EMAIL_TIMEOUT_MS}ms`)),
        SEND_EMAIL_TIMEOUT_MS
      )
    );

    await Promise.race([sendPromise, timeoutPromise]).catch((e) => {
      console.error(
        "[email] sendEmail failed",
        `from: ${"from" in payloadWithUnEscapedSubject ? payloadWithUnEscapedSubject.from : ""}`,
        `subject: ${"subject" in payloadWithUnEscapedSubject ? payloadWithUnEscapedSubject.subject : ""}`,
        e
      );
      throw e;
    });
    return new Promise((resolve) => resolve("send mail async"));
  }
  protected getMailerOptions() {
    return {
      transport: serverConfig.transport,
      from: serverConfig.from,
      headers: serverConfig.headers,
    };
  }
  protected printNodeMailerError(error: Error): void {
    /** Don't clog the logs with unsent emails in E2E */
    if (process.env.NEXT_PUBLIC_IS_E2E) return;
    console.error(`${this.name}_ERROR`, error);
  }
}
