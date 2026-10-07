const ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLATFORMS = new Set(["darwin", "win32", "linux", "ios", "web"]);

export function validateReport(input) {
  const invalid = () => {
    throw new Error(
      "Please enter a title and describe the issue (10–3000 characters).",
    );
  };
  if (!input || typeof input !== "object" || !ID.test(input.id)) invalid();
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const description =
    typeof input.description === "string" ? input.description.trim() : "";
  const contact = typeof input.contact === "string" ? input.contact.trim() : "";
  if (
    title.length < 3 ||
    title.length > 120 ||
    description.length < 10 ||
    description.length > 3000 ||
    contact.length > 160
  )
    invalid();
  const report = { id: input.id, title, description, contact };
  if (input.diagnostics && typeof input.diagnostics === "object") {
    const d = input.diagnostics;
    report.diagnostics = {
      platform: PLATFORMS.has(d.platform) ? d.platform : "web",
      version: String(d.version || "unknown").slice(0, 32),
      syncState: String(d.syncState || "unknown").slice(0, 32),
      syncErrorCode: String(d.syncErrorCode || "").slice(0, 64),
      language: String(d.language || "en").slice(0, 8),
    };
  }
  return report;
}

export function telegramText(report) {
  const d = report.diagnostics;
  return [
    "Stepler issue report",
    `ID: ${report.id}`,
    "",
    report.title,
    report.description,
    report.contact ? `\nContact: ${report.contact}` : "",
    d
      ? `\nPlatform: ${d.platform}\nVersion: ${d.version}\nSync: ${d.syncState}${d.syncErrorCode ? ` (${d.syncErrorCode})` : ""}\nLanguage: ${d.language}`
      : "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 4096);
}

export async function sendToTelegram(
  report,
  { token, chatId, fetcher = fetch },
) {
  if (!token || !chatId)
    throw new Error("Telegram reporting is not configured");
  // Do not log this URL: the token belongs exclusively in Secret Manager.
  const response = await fetcher(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: telegramText(report),
        link_preview_options: { is_disabled: true },
      }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  const result = await response.json();
  if (!response.ok || !result.ok)
    throw new Error(
      `Telegram delivery failed (${result.error_code || response.status})`,
    );
  return result.result.message_id;
}
