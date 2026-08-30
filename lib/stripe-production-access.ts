type StripeCheckoutAccessInput = {
  email: string;
  secretKey: string | undefined;
  vercelEnv: string | undefined;
  allowedEmails: string | undefined;
};

function getAllowedEmails(value: string | undefined): Set<string> {
  return new Set(
    (value || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isStripeTestModeSecret(secretKey: string | undefined): boolean {
  const normalized = secretKey?.trim();
  return Boolean(
    normalized?.startsWith("sk_test_") || normalized?.startsWith("rk_test_")
  );
}

export function canCreateStripeCheckout({
  email,
  secretKey,
  vercelEnv,
  allowedEmails,
}: StripeCheckoutAccessInput): boolean {
  if (vercelEnv !== "production" || !isStripeTestModeSecret(secretKey)) {
    return true;
  }

  return getAllowedEmails(allowedEmails).has(email.trim().toLowerCase());
}

export function shouldIgnoreStripeTestWebhook(params: {
  livemode: boolean;
  vercelEnv: string | undefined;
}): boolean {
  return params.vercelEnv === "production" && !params.livemode;
}

export function canFinalizeStripeCheckout(params: {
  email: string;
  livemode: boolean;
  vercelEnv: string | undefined;
  allowedEmails: string | undefined;
}): boolean {
  if (params.vercelEnv !== "production" || params.livemode) return true;
  return getAllowedEmails(params.allowedEmails).has(
    params.email.trim().toLowerCase()
  );
}
