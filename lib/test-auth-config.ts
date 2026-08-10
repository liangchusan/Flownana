export function getTestAuthCreditAmount(env: {
  NODE_ENV?: string;
  TEST_AUTH_CREDITS?: string;
}): number {
  return Number(
    env.TEST_AUTH_CREDITS ?? (env.NODE_ENV === "development" ? "1000" : "0")
  );
}
