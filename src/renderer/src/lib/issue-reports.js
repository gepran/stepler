export const REPORT_ENDPOINT =
  "https://us-central1-stepler-490308.cloudfunctions.net/reportIssue";

/** Only an acknowledged, durable receipt counts as a successful submission. */
export async function postIssueReport(report, { token, fetcher = fetch } = {}) {
  const response = await fetcher(REPORT_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(report),
    signal: AbortSignal.timeout(20_000),
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(
      "Reporting is temporarily unavailable. Your draft is still available; please retry.",
    );
  }
  if (!response.ok || result.success !== true || result.id !== report.id)
    throw new Error(result.error || "Could not send the report. Please retry.");
  return result;
}
