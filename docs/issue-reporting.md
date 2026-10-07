# Issue reporting

Desktop, web and iOS expose **Settings → Report an issue**. The form collects a title, a description and optional contact information. Basic diagnostics can be switched off; they contain only platform, app version, interface language, sync state and the sync error code. Task content, attachments, authentication credentials and email addresses from the signed-in account are not included.

The clients POST to `https://us-central1-stepler-490308.cloudfunctions.net/reportIssue`. A success response means the report has been saved in Firestore and queued for delivery. Network errors retain the form draft. Retries reuse the report ID; editing the draft creates a new ID.

`deliverIssueReport` delivers new documents to the owner's private Telegram chat, with retries if Telegram is unavailable. It records the Telegram message ID after delivery. A crash between Telegram receiving a message and Firestore recording it can produce a duplicate; the report ID identifies these. The endpoint limits submissions to five per account and network per 15 minutes. Firestore client rules deny access to the server-only report collections.

## Server setup

The bot is **Stepler Reports**, [@stepler_reports_bot](https://t.me/stepler_reports_bot). The owner must press **Start** in its Telegram chat before it can send messages. BotFather owns bot creation and token rotation.

Keep the bot token and destination chat ID in Firebase Secret Manager for `stepler-490308`. Never put the bot token in renderer, web or iOS code, a committed environment file, or a packaged app. This repository's Electron packaging excludes `functions/`.

```sh
npm ci --prefix functions
firebase functions:secrets:set TELEGRAM_BOT_TOKEN --project stepler-490308
firebase functions:secrets:set TELEGRAM_REPORT_CHAT_ID --project stepler-490308
npm run deploy:reports
```

Enter values at the CLI's private prompt, or use `--data-file` with a private file outside the repository. Use Telegram's official `getUpdates` API after **Start** to obtain the destination private chat ID. Verify the bot username with `getMe` before configuring it. Cloud Functions needs the applicable Firebase billing plan and enabled Cloud Functions, Cloud Build, Artifact Registry, Eventarc and Secret Manager APIs. The CLI checks these prerequisites during deployment.

The authenticated deployer must have permission to deploy functions and manage their secrets. The frontend requires no bot credential. To publish the web form after deployment, run `npm run deploy:web`.

To deploy receipt storage before Telegram credentials are configured, run `npm run deploy:report-intake -- --account <firebase-account>`. This deploys only the HTTP intake entry point. Reports remain in Firestore until Telegram delivery is connected; reports received before the delivery trigger exists need to be forwarded during setup.

## Verification

```sh
npm test
npm run test:desktop
npm ci --prefix functions
npm run test:firebase
npm run test:ios
npm run build:web
```

Desktop tests use a temporary profile and verify actual PNG pixels, combined image/text, copied file references, SVG conversion, and report retry behavior. Firebase emulator tests verify durable receipts, idempotency, submission limits, and denied client access. iOS tests verify the actual pasteboard and report form validation/draft retention. The platform workflow runs desktop tests on macOS and Windows and native tests on an iPhone simulator.

For a production smoke test, submit a clearly labeled setup report, confirm a receipt, and verify the matching ID appears in Telegram. A pending Firestore record is retained when Telegram delivery fails; inspect server logs for the sanitized delivery failure and retry once the configuration is corrected.
