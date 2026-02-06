import { defaultResponderForAppDir } from "app/api/defaultResponderForAppDir";
import { parseRequestData } from "app/api/parseRequestData";
import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authenticator } from "otplib";
import qrcode from "qrcode";

import { ErrorCode } from "@calcom/features/auth/lib/ErrorCode";
import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { verifyPassword } from "@calcom/features/auth/lib/verifyPassword";
import { checkRateLimitAndThrowError } from "@calcom/lib/checkRateLimitAndThrowError";
import { symmetricEncrypt } from "@calcom/lib/crypto";
import prisma from "@calcom/prisma";
import { IdentityProvider } from "@calcom/prisma/enums";

import { buildLegacyRequest } from "@lib/buildLegacyCtx";

async function postHandler(req: NextRequest) {
  // #region agent log
  console.error("[2FA_SETUP] Handler entry", { hasEncryptionKey: !!process.env.CALENDSO_ENCRYPTION_KEY });
  // #endregion
  const body = await parseRequestData(req);
  // #region agent log
  console.error("[2FA_SETUP] Request parsed", { hasPassword: !!body.password, passwordLength: body.password?.length });
  // #endregion
  const session = await getServerSession({ req: buildLegacyRequest(await headers(), await cookies()) });

  if (!session) {
    // #region agent log
    console.error("[2FA_SETUP] No session found");
    // #endregion
    return NextResponse.json({ error: ErrorCode.InternalServerError, message: "Not authenticated" }, { status: 401 });
  }

  if (!session.user?.id) {
    // #region agent log
    console.error("[2FA_SETUP] Session missing user id", { hasSession: !!session, hasUser: !!session.user });
    // #endregion
    console.error("Session is missing a user id.");
    return NextResponse.json({ error: ErrorCode.InternalServerError }, { status: 500 });
  }

  // #region agent log
  console.error("[2FA_SETUP] Before rate limit", { userId: session.user.id });
  // #endregion
  try {
    await checkRateLimitAndThrowError({
      rateLimitingType: "core",
      identifier: `api:totp-setup:${session.user.id}`,
    });
  } catch (rateLimitError) {
    // #region agent log
    console.error("[2FA_SETUP] Rate limit error", { error: rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError) });
    // #endregion
    throw rateLimitError;
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { password: true } });

  if (!user) {
    // #region agent log
    console.error("[2FA_SETUP] User not found", { userId: session.user.id });
    // #endregion
    console.error(`Session references user that no longer exists.`);
    return NextResponse.json({ error: ErrorCode.InternalServerError, message: "Not authenticated" }, { status: 401 });
  }

  // #region agent log
  console.error("[2FA_SETUP] User found", { identityProvider: user.identityProvider, hasPassword: !!user.password?.hash, twoFactorEnabled: user.twoFactorEnabled });
  // #endregion

  if (user.identityProvider !== IdentityProvider.CAL && !user.password?.hash) {
    // #region agent log
    console.error("[2FA_SETUP] Third party identity provider", { identityProvider: user.identityProvider, hasPassword: !!user.password?.hash });
    // #endregion
    return NextResponse.json({ error: ErrorCode.ThirdPartyIdentityProviderEnabled }, { status: 400 });
  }

  if (!user.password?.hash) {
    // #region agent log
    console.error("[2FA_SETUP] User missing password", { identityProvider: user.identityProvider });
    // #endregion
    return NextResponse.json({ error: ErrorCode.UserMissingPassword }, { status: 400 });
  }

  if (user.twoFactorEnabled) {
    // #region agent log
    console.error("[2FA_SETUP] 2FA already enabled");
    // #endregion
    return NextResponse.json({ error: ErrorCode.TwoFactorAlreadyEnabled }, { status: 400 });
  }

  if (!process.env.CALENDSO_ENCRYPTION_KEY) {
    // #region agent log
    console.error("[2FA_SETUP] Missing encryption key");
    // #endregion
    console.error("Missing encryption key; cannot proceed with two factor setup.");
    return NextResponse.json({ error: ErrorCode.InternalServerError }, { status: 500 });
  }

  // #region agent log
  console.error("[2FA_SETUP] Before password verification", { hasPasswordHash: !!user.password.hash });
  // #endregion
  const isCorrectPassword = await verifyPassword(body.password, user.password.hash);
  // #region agent log
  console.error("[2FA_SETUP] Password verification", { isCorrectPassword });
  // #endregion
  if (!isCorrectPassword) {
    return NextResponse.json({ error: ErrorCode.IncorrectPassword }, { status: 400 });
  }

  // This generates a secret 32 characters in length. Do not modify the number of
  // bytes without updating the sanity checks in the enable and login endpoints.
  const secret = authenticator.generateSecret(20);

  // Generate backup codes with 10 character length
  const backupCodes = Array.from(Array(10), () => crypto.randomBytes(5).toString("hex"));

  await prisma.user.update({
    where: {
      id: session.user.id,
    },
    data: {
      backupCodes: symmetricEncrypt(JSON.stringify(backupCodes), process.env.CALENDSO_ENCRYPTION_KEY),
      twoFactorEnabled: false,
      twoFactorSecret: symmetricEncrypt(secret, process.env.CALENDSO_ENCRYPTION_KEY),
    },
  });

  const name = user.email || user.username || user.id.toString();
  const keyUri = authenticator.keyuri(name, "Cal", secret);
  const dataUri = await qrcode.toDataURL(keyUri);

  // #region agent log
  console.error("[2FA_SETUP] Success", { hasSecret: !!secret, hasDataUri: !!dataUri, backupCodesCount: backupCodes.length });
  // #endregion
  return NextResponse.json({ secret, keyUri, dataUri, backupCodes });
}

export const POST = defaultResponderForAppDir(postHandler);
