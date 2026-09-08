#!/usr/bin/env node

/**
 * Stepler CLI — talk to the running Stepler app from a terminal.
 *
 *   stepler list
 *   stepler add "Review pull requests"
 *   stepler remove <id>
 *   stepler                      (interactive)
 *
 * The app writes its port and access token to its own data folder; this reads
 * them from there, so no configuration is needed. Override with STEPLER_URL /
 * STEPLER_TOKEN when talking to a non-default instance.
 */

import { createInterface } from "node:readline";
import { readFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

// ── Connection details ───────────────────────────────────────────────────────

function userDataDir() {
  if (platform() === "darwin")
    return join(homedir(), "Library", "Application Support", "stepler");
  if (platform() === "win32")
    return join(
      process.env.APPDATA || join(homedir(), "AppData", "Roaming"),
      "stepler",
    );
  return join(
    process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
    "stepler",
  );
}

function connection() {
  let port = 3000;
  let token = process.env.STEPLER_TOKEN || "";
  try {
    const info = JSON.parse(
      readFileSync(join(userDataDir(), "stepler-api.json"), "utf-8"),
    );
    if (info.port) port = info.port;
    if (!token && info.token) token = info.token;
  } catch {
    /* fall back to the defaults below */
  }
  return {
    baseUrl: process.env.STEPLER_URL || `http://127.0.0.1:${port}`,
    token,
  };
}

const { baseUrl: BASE_URL, token: TOKEN } = connection();

// ── ANSI helpers ─────────────────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

const ok = (msg) => console.log(`${c.green}✔${c.reset} ${msg}`);
const err = (msg) => console.log(`${c.red}✖${c.reset} ${msg}`);
const info = (msg) => console.log(`${c.cyan}ℹ${c.reset} ${msg}`);

// ── HTTP ─────────────────────────────────────────────────────────────────────

async function request(method, path, body) {
  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
  };
  if (body) opts.body = JSON.stringify(body);

  try {
    const res = await fetch(`${BASE_URL}${path}`, opts);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    if (res.status === 401) {
      err(
        "Not authorised. Is Stepler running, and is command line access enabled in Settings?",
      );
      return null;
    }
    if (!res.ok) {
      err(`${c.bold}HTTP ${res.status}${c.reset} ${res.statusText}`);
      if (data)
        console.log(
          `  ${c.dim}${typeof data === "string" ? data : JSON.stringify(data)}${c.reset}`,
        );
      return null;
    }
    return data;
  } catch (e) {
    err(
      `Could not reach Stepler at ${BASE_URL} (${e.message}). Is the app running?`,
    );
    return null;
  }
}

// ── Commands ─────────────────────────────────────────────────────────────────

async function listTasks() {
  const data = await request("GET", "/api/tasks");
  if (!data) return;
  const tasks = Array.isArray(data) ? data : [];
  if (tasks.length === 0) return info("No tasks found.");

  console.log();
  for (const t of tasks) {
    const done = t.completed ? `${c.green}✔${c.reset}` : `${c.dim}○${c.reset}`;
    const tags = (t.projects || [])
      .map((p) => `${c.magenta}#${p}${c.reset}`)
      .join(" ");
    const first = String(t.text || "(untitled)").split("\n")[0];
    console.log(
      `  ${done} ${c.yellow}${String(t.id).padEnd(15)}${c.reset}${first} ${tags}`,
    );
    for (const st of t.subtasks || []) {
      console.log(
        `      ${st.completed ? c.green + "✔" : c.dim + "○"}${c.reset} ${st.text}`,
      );
    }
  }
  console.log();
}

async function addTask(title) {
  if (!title) return err("Usage: add <title>");
  const data = await request("POST", "/api/tasks", { title });
  if (data) ok(`Task created: ${c.bold}${title}${c.reset}`);
}

async function removeTask(id) {
  if (!id) return err("Usage: remove <id>");
  const data = await request("DELETE", `/api/tasks/${encodeURIComponent(id)}`);
  if (data) ok(`Task ${c.yellow}${id}${c.reset} moved to the trash.`);
}

function printHelp() {
  console.log(`
${c.bold}${c.cyan}Stepler CLI${c.reset} — manage your tasks from the terminal

${c.bold}Commands:${c.reset}
  ${c.green}list${c.reset}              List today's tasks
  ${c.green}add ${c.dim}<title>${c.reset}       Add a new task
  ${c.green}remove ${c.dim}<id>${c.reset}       Move a task to the trash
  ${c.green}help${c.reset}              Show this help
  ${c.green}exit${c.reset}              Quit the CLI

${c.bold}Environment:${c.reset}
  ${c.yellow}STEPLER_URL${c.reset}       Base URL (default: the running app's port)
  ${c.yellow}STEPLER_TOKEN${c.reset}     Access token (default: read from the app data folder)
`);
}

async function dispatch(input) {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const [cmd, ...rest] = trimmed.split(/\s+/);
  const args = rest.join(" ");

  switch (cmd.toLowerCase()) {
    case "list":
    case "ls":
      return listTasks();
    case "add":
    case "create":
      return addTask(args.replace(/^["']|["']$/g, ""));
    case "remove":
    case "rm":
    case "delete":
    case "del":
      return removeTask(args);
    case "help":
    case "?":
    case "--help":
    case "-h":
      return printHelp();
    case "exit":
    case "quit":
    case "q":
      console.log(`${c.dim}Bye! 👋${c.reset}`);
      process.exit(0);
      break;
    default:
      err(
        `Unknown command: ${c.bold}${cmd}${c.reset}. Type ${c.green}help${c.reset} for usage.`,
      );
  }
  return undefined;
}

async function main() {
  const cliArgs = process.argv.slice(2);
  if (cliArgs.length > 0) {
    await dispatch(cliArgs.join(" "));
    return;
  }

  console.log(
    `\n${c.bold}${c.cyan}Stepler CLI${c.reset}  —  type ${c.green}help${c.reset} for commands\n`,
  );
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${c.magenta}stepler${c.reset}${c.dim}>${c.reset} `,
  });
  rl.prompt();
  rl.on("line", async (line) => {
    await dispatch(line);
    rl.prompt();
  });
  rl.on("close", () => {
    console.log(`\n${c.dim}Bye! 👋${c.reset}`);
    process.exit(0);
  });
}

main();
