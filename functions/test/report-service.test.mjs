import assert from "node:assert/strict";
import test from "node:test";
import {
  validateReport,
  telegramText,
  sendToTelegram,
} from "../report-service.mjs";

const report = {
  id: "b4369b53-07f9-424a-a4af-c23c44c16b81",
  title: "Image copy fails",
  description: "Clicking copy on a WebP image fails.",
  contact: "@reporter",
};
test("reports accept all clients and strip unexpected private data", () => {
  for (const platform of ["ios", "win32", "darwin", "web"]) {
    const result = validateReport({
      ...report,
      tasks: ["private"],
      diagnostics: {
        platform,
        version: "1.3.14",
        syncState: "offline",
        authToken: "secret",
      },
    });
    assert.equal(result.diagnostics.platform, platform);
    assert.equal(result.tasks, undefined);
    assert.equal(result.diagnostics.authToken, undefined);
  }
});
test("empty and oversized reports are refused", () => {
  for (const patch of [
    { title: " " },
    { description: "short" },
    { description: "a".repeat(3001) },
    { id: "../path" },
  ])
    assert.throws(() => validateReport({ ...report, ...patch }));
});
test("Telegram message contains useful context and fits its limit", () => {
  const clean = validateReport({
    ...report,
    description: "a".repeat(3000),
    diagnostics: { platform: "ios", syncState: "offline" },
  });
  assert.ok(telegramText(clean).includes("Platform: ios"));
  assert.ok(telegramText(clean).length <= 4096);
});
test("delivery verifies the Telegram response and disables link previews", async () => {
  const message = await sendToTelegram(report, {
    token: "test-token",
    chatId: "123",
    fetcher: async (url, options) => {
      assert.equal(url, "https://api.telegram.org/bottest-token/sendMessage");
      const body = JSON.parse(options.body);
      assert.equal(body.chat_id, "123");
      assert.equal(body.link_preview_options.is_disabled, true);
      return {
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 42 } }),
      };
    },
  });
  assert.equal(message, 42);
  await assert.rejects(
    sendToTelegram(report, {
      token: "test-token",
      chatId: "123",
      fetcher: async () => ({
        ok: false,
        status: 403,
        json: async () => ({ ok: false, error_code: 403 }),
      }),
    }),
    /403/,
  );
});
