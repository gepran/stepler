<h1 align="center">
  <img src="icon.png" alt="Stepler Logo" width="120" />
  <br>
  Stepler
</h1>

<p align="center">
  <strong>A minimal daily task timeline application for macOS and Windows.</strong>
</p>

<p align="center">
  Built with Electron, React, Vite, and Tailwind CSS.
</p>

## ✨ Features

- **Daily Task Timeline:** Organize your tasks seamlessly on a vertical timeline.
- **Subtasks & Attachments:** Break tasks into smaller subtasks, attach images by pasting from clipboard, and quickly sort completed tasks.
- **Multiple Projects:** Support for various projects to switch contexts effortlessly.
- **Trash & History:** Accidentally deleted a task? Easily restore it from the Deleted Tasks history panel.
- **Export & Import:** Export all or parts of your task history to JSON, and import them freely across devices.
- **Advanced Search:** Robust search overlay with click-to-jump task navigation, keyboard shortcuts, and quick action buttons.
- **Tactile UI Animations:** Smooth jelly-like micro-animations, rubbery buttons, and refined subtask transitions for an engaging user experience.
- **Auto-Updates:** Built-in background update checker keeps you on the latest version seamlessly.

## 🛠 Project Setup

### Prerequisites

- [Node.js](https://nodejs.org/)
- npm

### Installation

Clone the repository and install the dependencies:

```bash
npm install
```

### Development

To start the local development server with hot-reloading:

```bash
npm run dev
```

### Building the App

Generate distributable binaries for your operating system:

```bash
# For macOS
npm run build:mac

# For Windows
npm run build:win

# For Linux
npm run build:linux
```

## 💻 Command Line Interface (CLI)

Stepler includes a built-in CLI utility (`stepler-cli.js`) to interact with your local task backend directly from the terminal.

### Usage Modes

You can use the CLI in either **one-shot mode** or **interactive REPL mode**.

#### One-Shot Mode
Execute single commands directly from your shell.

```bash
# List all tasks
node stepler-cli.js list

# Add a new task
node stepler-cli.js add "Review pull requests"

# Remove a task by ID
node stepler-cli.js remove <task_id>
```

#### Interactive REPL Mode
Start an interactive session keeping the CLI open for repeated commands:

```bash
node stepler-cli.js
```
Inside the interactive prompt, you can use the following commands:
- `list` (or `ls`): List all tasks
- `add <title>` (or `create`): Create a new task
- `remove <id>` (or `rm`, `delete`, `del`): Remove a task by its ID
- `help` (or `?`): Show usage help
- `exit` (or `quit`, `q`): Exit the CLI

*(Note: By default, the CLI connects to `http://localhost:3000`. You can override this by providing the `STEPLER_URL` environment variable. The code comments also mention using a `STEPLER_TOKEN` if you ever set up basic auth on the backend).*

## 🤝 Code Quality

- **Linting:** Run `npm run lint` to check for code issues using ESLint.
- **Formatting:** Run `npm run format` to auto-format files using Prettier.
