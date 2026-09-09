<h1 align="center">
  <img src="docs/icon.png" alt="Stepler" width="120" />
  <br>
  Stepler
</h1>

<p align="center">
  <strong>A fast daily task timeline for macOS and Windows.</strong>
</p>

<p align="center">
  Built with Electron, React, Vite and Tailwind CSS.
</p>

## ✨ Features

- **Daily timeline.** Today's work sits at the bottom next to the composer; finished days roll into history above it.
- **Quick capture.** A global shortcut brings the window up from anywhere, Esc sends it away, and `⌘N` / `⌘F` jump to the composer and to search.
- **Subtasks, projects, dates and reminders.** Tag a note with a project, give it a day, set a time and get a notification.
- **Attachments.** Paste or attach images and files. They are stored as real files in the app's data folder and can be copied, opened or saved anywhere.
- **Search everything.** Text, subtasks, project names and attachment file names, with keyboard navigation.
- **Trash and history.** Restore deleted tasks, or pull a finished note from any past day back into today.
- **Export and import.** One portable JSON file with the attachments embedded.
- **Optional integrations.** Google Calendar, Jira and Apple Reminders — all off until you turn them on.
- **English, ქართული and Русский.** Switch the interface language in Settings → General.

## 📥 Installing on macOS

The first launch after downloading shows **“Stepler is damaged and can’t be opened”**, or nothing happens at all. The app is not damaged: macOS quarantines anything downloaded from a browser, and Gatekeeper refuses to run it because Stepler is signed ad-hoc rather than with a paid Apple Developer certificate.

Right-click the app in Applications and choose **Open**, then **Open** again in the dialog. You only do this once. Updates installed from inside the app are never quarantined, so this never comes up again.

If you would rather do it from a terminal: `xattr -dr com.apple.quarantine /Applications/Stepler.app`

## 📥 Installing on Windows

The first launch shows a blue **“Windows protected your PC”** screen: click **More info**, then **Run anyway**.

Microsoft Defender SmartScreen blocks anything it has no reputation record for, and Stepler is not signed with a paid Microsoft certificate. Every release is built from the source in this repository, so you can read the code — or build it yourself with `npm run build:win` — before running it.

## 🛠 Project setup

```bash
npm install
npm run dev
```

Build a distributable:

```bash
npm run build:mac    # or build:win / build:linux
```

## 💾 Where your data lives

| File                       | What it is                                                  |
| -------------------------- | ----------------------------------------------------------- |
| `stepler-data.json`        | Tasks, history and trash                                    |
| `stepler-data.backup.json` | The previous good copy, refreshed at every successful start |
| `attachments/`             | Every image and file you attached                           |
| `stepler-settings.json`    | Preferences, including the local API token                  |

On macOS these sit in `~/Library/Application Support/stepler`, on Windows in `%APPDATA%\stepler`, and on Linux in `~/.config/stepler`.

Writes are atomic and batched, so a crash or a forced quit cannot leave the data file half written. If it is ever unreadable anyway, Stepler falls back to the backup on the next start.

**Upgrading from an older version:** attachments used to be stored inline as base64 inside `stepler-data.json`. The first launch after this release moves them into `attachments/` automatically and keeps the old file as `stepler-data.backup.json`. Nothing is lost, and the data file shrinks from tens of megabytes to a few hundred kilobytes.

## 💻 Command line

Stepler exposes a small HTTP API on `127.0.0.1` for the bundled CLI. It requires a token that is written to `stepler-api.json` in the data folder, so only programs running as you can reach it; requests coming from a browser are refused outright. Turn the whole thing off under **Settings → Integrations → Command line access**.

```bash
node stepler-cli.mjs list
node stepler-cli.mjs add "Review pull requests"
node stepler-cli.mjs remove <task_id>
node stepler-cli.mjs            # interactive
```

`STEPLER_URL` and `STEPLER_TOKEN` override the auto-detected connection.

## 🤖 Use it from Claude Code, Codex or Cursor

Stepler ships an MCP server, so a coding agent can read and write your list
without you leaving the terminal. It is a thin front for the local API above,
has no dependencies, and needs nothing but `node`.

```bash
# Installed the app:
claude mcp add stepler -- node "/Applications/Stepler.app/Contents/Resources/app.asar.unpacked/stepler-mcp.mjs"

# Working from a clone:
claude mcp add stepler -- node "$(pwd)/stepler-mcp.mjs"
```

For Codex or Cursor, point their MCP config at the same command.

| Tool            | What it does                                                    |
| --------------- | --------------------------------------------------------------- |
| `list_tasks`    | Today's list, with projects, dates and reminders                |
| `add_task`      | Write a task down — optionally with a project, a day and a time |
| `complete_task` | Tick one off, or put it back                                    |
| `delete_task`   | Send one to the trash                                           |
| `recent_days`   | What was on the list on previous days                           |

Requires the app to be running with **Settings → Integrations → Command line
access** on, since that is what serves the local API. Everything stays on
127.0.0.1.

## 🔌 Integrations

Google Calendar and Jira need OAuth client credentials, which are deliberately **not** shipped inside the app. Provide your own in either place:

- a `.env` file next to `package.json` while developing:

  ```
  GOOGLE_CLIENT_ID=...
  GOOGLE_CLIENT_SECRET=...
  JIRA_CLIENT_ID=...
  JIRA_CLIENT_SECRET=...
  ```

- or `stepler-integrations.json` in the data folder for an installed copy:

  ```json
  {
    "googleClientId": "...",
    "googleClientSecret": "...",
    "jiraClientId": "...",
    "jiraClientSecret": "..."
  }
  ```

Register `http://127.0.0.1:3000/oauth2callback` (Google) and `http://127.0.0.1:3000/jira-callback` (Jira) as the redirect URIs. Access tokens are encrypted with the OS keychain where that is available.

Calendar events are only created for tasks that carry a date, and only while **Create events automatically** is on. Completing or deleting a task updates or removes the mirrored event and reminder.

## 🤝 Code quality

- `npm run lint` — ESLint
- `npm run format` — Prettier
