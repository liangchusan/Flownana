export function getTestAuthCreditAmount(env: {
  NODE_ENV?: string;
  TEST_AUTH_CREDITS?: string;
}): number {
  return Number(
    env.TEST_AUTH_CREDITS ?? (env.NODE_ENV === "development" ? "1000" : "0")
  );
}

export function isServerTestAuthEnabled(env: {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  ENABLE_TEST_AUTH?: string;
}): boolean {
  const isProductionDeployment = env.VERCEL_ENV === "production";
  return (
    !isProductionDeployment &&
    (env.NODE_ENV !== "production" || env.ENABLE_TEST_AUTH === "true")
  );
}
