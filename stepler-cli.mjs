#!/usr/bin/env node

/**
 * Stepler CLI — interact with your Todo backend from the terminal.
 *
 * Usage:
 *   Interactive:  STEPLER_TOKEN=<token> node stepler-cli.js
 *   One-shot:     STEPLER_TOKEN=<token> node stepler-cli.js list
 *                 STEPLER_TOKEN=<token> node stepler-cli.js add Buy milk
 *                 STEPLER_TOKEN=<token> node stepler-cli.js remove <id>
 */

import { createInterface } from "node:readline";

// ── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = process.env.STEPLER_URL || "http://127.0.0.1:3000";

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
  white: "\x1b[37m",
  bgCyan: "\x1b[46m",
  bgRed: "\x1b[41m",
};

const ok = (msg) => console.log(`${c.green}✔${c.reset} ${msg}`);
const err = (msg) => console.log(`${c.red}✖${c.reset} ${msg}`);
const info = (msg) => console.log(`${c.cyan}ℹ${c.reset} ${msg}`);

// ── HTTP helpers ─────────────────────────────────────────────────────────────

function headers() {
  return { "Content-Type": "application/json" };
}

async function request(method, path, body) {
  const url = `${BASE_URL}${path}`;
  const opts = { method, headers: headers() };
  if (body) opts.body = JSON.stringify(body);

  try {
    const res = await fetch(url, opts);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!res.ok) {
      err(`${c.bold}HTTP ${res.status}${c.reset} ${res.statusText}`);
      if (data)
        console.log(
          `  ${c.dim}${typeof data === "string" ? data : JSON.stringify(data, null, 2)}${c.reset}`,
        );
      return null;
    }
    return data;
  } catch (e) {
    err(`Connection failed: ${e.message}`);
    return null;
  }
}

// ── Commands ─────────────────────────────────────────────────────────────────

async function listTasks() {
  const data = await request("GET", "/api/tasks");
  if (!data) return;

  const tasks = Array.isArray(data) ? data : data.tasks || data.data || [];

  if (tasks.length === 0) {
    info("No tasks found.");
    return;
  }

  console.log();
  console.log(`${c.bold}${c.cyan}  ID${" ".repeat(20)}Task${c.reset}`);
  console.log(`${c.dim}  ${"─".repeat(50)}${c.reset}`);

  for (const t of tasks) {
    const id = String(t.id || t._id || "???");
    const title = t.text || t.title || "(untitled)";
    const done =
      t.completed || t.done ? `${c.green}✔${c.reset}` : `${c.dim}○${c.reset}`;
    console.log(`  ${done} ${c.yellow}${id.padEnd(22)}${c.reset}${title}`);
  }
  console.log();
}

async function addTask(title) {
  if (!title) {
    err("Usage: add <title>");
    return;
  }
  const data = await request("POST", "/api/tasks", { title });
  if (data) {
    ok(`Task created: ${c.bold}${title}${c.reset}`);
  }
}

async function removeTask(id) {
  if (!id) {
    err("Usage: remove <id>");
    return;
  }
  const data = await request("DELETE", `/api/tasks/${id}`);
  if (data !== null) {
    ok(`Task ${c.yellow}${id}${c.reset} removed.`);
  }
}

function printHelp() {
  console.log(`
${c.bold}${c.cyan}Stepler CLI${c.reset} — manage your tasks from the terminal

${c.bold}Commands:${c.reset}
  ${c.green}list${c.reset}              List all tasks
  ${c.green}add ${c.dim}<title>${c.reset}       Add a new task
  ${c.green}remove ${c.dim}<id>${c.reset}       Remove a task by ID
  ${c.green}help${c.reset}              Show this help
  ${c.green}exit${c.reset}              Quit the CLI

${c.bold}Environment:${c.reset}
  ${c.yellow}STEPLER_URL${c.reset}       Base URL (default: http://localhost:3000)
`);
}

// ── Command dispatcher ───────────────────────────────────────────────────────

async function dispatch(input) {
  const trimmed = input.trim();
  if (!trimmed) return;

  const parts = trimmed.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1).join(" ");

  switch (cmd) {
    case "list":
    case "ls":
      return listTasks();
    case "add":
    case "create":
      return addTask(args);
    case "remove":
    case "rm":
    case "delete":
    case "del":
      return removeTask(args);
    case "help":
    case "?":
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
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // One-shot mode: `node stepler-cli.js list`
  const cliArgs = process.argv.slice(2);
  if (cliArgs.length > 0) {
    await dispatch(cliArgs.join(" "));
    return;
  }

  // Interactive REPL mode
  console.log(
    `\n${c.bold}${c.cyan}Stepler CLI${c.reset} ${c.dim}v1.0.0${c.reset}  —  type ${c.green}help${c.reset} for commands\n`,
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
