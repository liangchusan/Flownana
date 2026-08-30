export function getKieApiKey(): string | null {
  const apiKey = process.env.KIE_API_KEY?.trim();
  return apiKey || null;
}
