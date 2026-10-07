# Stepler for iOS

Native SwiftUI app for iPhone and iPad, iOS 17 or later. It includes tasks and
subtasks, projects with colors/favorites, history, search, drag reordering,
nesting/promotion, priority, reminders, files/photos/paste, trash, JSON
import/export, Google/email sign-in, Firebase sync, connections and mentions.
Apple Calendar and Reminders mirrors can be enabled in Settings.

The timeline matches the web app: days run oldest to newest, with newer tasks
at the bottom of each day's existing ordering. It opens at the bottom, including
when the first sync snapshot arrives after launch, and shows newly added tasks.

Open `Stepler.xcodeproj` in Xcode. The committed Firebase configuration belongs
to the existing Stepler project and the `com.stepler.app.ios` registration.
Swift packages are pinned in the project's `Package.resolved`. To regenerate
the project after changing `project.yml`, run `xcodegen generate --spec ios/project.yml`
from the repository root. Build output and package checkouts are ignored.

From the repository root:

```sh
npm run test:ios
npm run build:ios
npm run install:ios
```

The test command chooses a booted iPhone simulator or an available iPhone
simulator. Set `IOS_SIMULATOR_ID` to select one explicitly. Installation builds,
then installs and launches on the single paired iPhone; when more than one is
paired, use `npm run install:ios -- <device-id>` or `IOS_DEVICE_ID`.
Automatic signing uses the configured development team; change it in Xcode or
`project.yml` if building under another Apple account. This is a development
installation, not an App Store or TestFlight release.

Use Settings → Sign in → Continue with Google, with the desktop account, to
synchronize. Each account has a separate protected local snapshot and
attachment directory. Guest tasks remain in a separate guest profile; export
and import them explicitly if you want to copy them into an account. Pending
edits and project operations survive restarts. Independent task fields and
child edits merge transactionally; conflicting changes to the same field use
the latest committed local edit. Permanent-deletion tombstones prevail.

Unit tests and UI tests use disposable data and do not authenticate to the
live Firebase project. They do not grant Calendar/Reminders access or modify
personal external calendars. Full live sign-in, background notification
delivery and external calendar integrations still require verification with
the user's accounts and permissions.

The desktop/web/Firebase regression command is `npm run test:all` (Firebase CLI
and Java are required). Emulator tests are isolated to `demo-stepler-review`
and fail if the emulator is unavailable; they do not silently skip.

Setup references: [Firebase iOS setup](https://firebase.google.com/docs/ios/setup),
[Xcode command-line tools](https://developer.apple.com/documentation/xcode/xcode-command-line-tool-reference).
