"use client";

import { useFlagMap } from "@calcom/features/flags/context/provider";
import { APP_NAME } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import useEmailVerifyCheck from "@calcom/trpc/react/hooks/useEmailVerifyCheck";
import { Button } from "@calcom/ui/components/button";
import { EmptyScreen } from "@calcom/ui/components/empty-screen";
import { showToast } from "@calcom/ui/components/toast";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import posthog from "posthog-js";
import { useEffect } from "react";

const EmailClientIcon = ({ name }: { name: string }) => {
  const icons: Record<string, JSX.Element> = {
    Gmail: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="52 42 88 66" className="h-4 w-4" aria-hidden>
        <path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6" />
        <path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15" />
        <path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2" />
        <path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92" />
        <path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2" />
      </svg>
    ),
    Outlook: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-4 w-4" aria-hidden>
        <path fill="#0078D4" d="M6 8v32h18v-6h-12V8h-6z" />
        <path fill="#28A8EA" d="M24 8v8h12v24h12V8H24z" />
        <path fill="#143157" d="M36 16v8h8v-8h-8z" />
      </svg>
    ),
    Yahoo: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-4 w-4" aria-hidden>
        <polygon
          fill="#5e35b1"
          points="4.2,14.9 11.6,14.9 16.2,26.7 21,14.9 28.3,14.9 17.1,42 9.5,42 12.6,35"
        />
        <circle cx="29.3" cy="30.5" r="4.7" fill="#5e35b1" />
      </svg>
    ),
    Proton: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="h-4 w-4" aria-hidden>
        <path fill="#6D4AFF" d="M16 2L2 12v14h12V18h4v8h12V12L16 2z" />
      </svg>
    ),
  };
  return icons[name] ?? null;
};

const EMAIL_CLIENTS = [
  {
    name: "Gmail",
    href: "https://mail.google.com/mail/u/0/#search/%22api%2Fauth%2Fverify-email%22",
  },
  {
    name: "Outlook",
    href: "https://outlook.live.com/mail/0/",
  },
  {
    name: "Yahoo",
    href: "https://mail.yahoo.com/d/search?p=Cal.com",
  },
  {
    name: "Proton",
    href: "https://mail.proton.me",
  },
] as const;

const RESEND_EMAIL_TIMEOUT_MS = 35_000;

function VerifyEmailPage() {
  const { data } = useEmailVerifyCheck();
  const { data: session } = useSession();
  const router = useRouter();
  const { t, isLocaleReady } = useLocale();
  const mutation = trpc.viewer.auth.resendVerifyEmail.useMutation();
  const flags = useFlagMap();

  const handleResendEmail = () => {
    posthog.capture("verify_email_resend_clicked");
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(t("request_timed_out_try_again"))), RESEND_EMAIL_TIMEOUT_MS)
    );
    Promise.race([mutation.mutateAsync(), timeoutPromise])
      .then((data) => {
        if (data && !data.skipped) {
          showToast(t("send_email"), "success");
        }
      })
      .catch((err) => {
        mutation.reset();
        showToast(err?.message || t("unexpected_error_try_again"), "error");
      });
  };

  useEffect(() => {
    if (data?.isVerified) {
      posthog.capture("verify_email_already_verified", {
        onboarding_v3_enabled: flags["onboarding-v3"],
      });
      const gettingStartedPath = flags["onboarding-v3"] ? "/onboarding/getting-started" : "/getting-started";
      router.replace(gettingStartedPath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.isVerified, flags]);
  if (!isLocaleReady) {
    return null;
  }
  return (
    <div className="h-screen w-full ">
      <div className="flex h-full w-full flex-col items-center justify-center">
        <div className="max-w-3xl">
          <EmptyScreen
            border
            dashedBorder={false}
            Icon="mail-open"
            headline={t("check_your_email")}
            description={t("verify_email_page_body", { email: session?.user?.email, appName: APP_NAME })}
            className="bg-default"
            buttonRaw={
              <>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  {EMAIL_CLIENTS.map(({ name, href }) => (
                    <Button
                      key={name}
                      color="secondary"
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer">
                      <span className="me-1 inline-flex shrink-0">
                        <EmailClientIcon name={name} />
                      </span>{" "}
                      {name}
                    </Button>
                  ))}
                </div>
                <Button color="minimal" loading={mutation.isPending} onClick={handleResendEmail}>
                  {t("resend_email")}
                </Button>
              </>
            }
          />
        </div>
      </div>
    </div>
  );
}

export default VerifyEmailPage;
