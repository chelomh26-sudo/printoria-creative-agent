export const ACCESS_COOKIE = "printoria_access";

export async function accessToken(password: string) {
  const bytes = new TextEncoder().encode(`printoria-creative-agent:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
