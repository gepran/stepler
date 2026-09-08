#!/usr/bin/env node
/**
 * An MCP server that puts Stepler in front of a coding agent — Claude Code,
 * Codex, Cursor, anything that speaks MCP.
 *
 * It is a thin front for the local HTTP API the app already serves on
 * 127.0.0.1, so there is one implementation of the rules and this file only
 * translates. No dependencies: the protocol here is JSON-RPC over stdio, and
 * hand-writing it keeps this runnable with a bare `node`.
 *
 *   claude mcp add stepler -- node /path/to/stepler-mcp.mjs
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir, platform } from "node:os";

// --------------------------------------------------------------------------
// Talking to the running app
// --------------------------------------------------------------------------

function dataDir() {
  if (platform() === "darwin")
    return join(homedir(), "Library", "Application Support", "stepler");
  if (platform() === "win32")
    return join(process.env.APPDATA || homedir(), "stepler");
  return join(homedir(), ".config", "stepler");
}

/** The app writes its port and token out for exactly this purpose. */
function connection() {
  if (process.env.STEPLER_URL && process.env.STEPLER_TOKEN)
    return { url: process.env.STEPLER_URL, token: process.env.STEPLER_TOKEN };
  try {
    const info = JSON.parse(
      readFileSync(join(dataDir(), "stepler-api.json"), "utf-8"),
    );
    return { url: `http://127.0.0.1:${info.port}`, token: info.token };
  } catch {
    return null;
  }
}

async function api(path, init = {}) {
  const conn = connection();
  if (!conn)
    throw new Error(
      "Cannot find Stepler. Is the app running, with command line access on in Settings?",
    );
  const res = await fetch(conn.url + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${conn.token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  }).catch(() => {
    throw new Error(`Stepler is not answering on ${conn.url}. Is it running?`);
  });
  const body = await res.json().catch(() => null);
  if (!res.ok)
    throw new Error(body?.error || `Stepler answered ${res.status}.`);
  return body;
}

// --------------------------------------------------------------------------
// Tools
// --------------------------------------------------------------------------

const TOOLS = [
  {
    name: "list_tasks",
    description:
      "Today's tasks in Stepler, with their projects, dates and reminders.",
    inputSchema: {
      type: "object",
      properties: {
        includeCompleted: {
          type: "boolean",
          description: "Include tasks already ticked off. Default true.",
        },
      },
    },
    run: async ({ includeCompleted = true }) => {
      const tasks = await api("/api/tasks");
      const shown = includeCompleted
        ? tasks
        : tasks.filter((t) => !t.completed);
      if (!shown.length) return "Nothing on the list today.";
      return shown
        .map((t) => {
          const bits = [
            `${t.completed ? "[x]" : "[ ]"} ${t.text}`,
            t.priority ? "★" : "",
            t.projects?.length ? `#${t.projects.join(" #")}` : "",
            t.dueDate ? `due ${t.dueDate}` : "",
            t.reminder ? `at ${t.reminder}` : "",
            `(id ${t.id})`,
          ].filter(Boolean);
          return bits.join("  ");
        })
        .join("\n");
    },
  },
  {
    name: "add_task",
    description:
      "Write a task into Stepler's timeline for today. Use this when the person asks to remember, note down or follow up on something.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "The task itself." },
        projects: {
          type: "array",
          items: { type: "string" },
          description: 'Project tags, e.g. ["Product"].',
        },
        dueDate: {
          type: "string",
          description: "A day, as YYYY-MM-DD.",
        },
        reminder: {
          type: "string",
          description: "A time on that day, as HH:MM, to be notified.",
        },
        priority: { type: "boolean", description: "Star it." },
      },
      required: ["title"],
    },
    run: async (args) => {
      const made = await api("/api/tasks", {
        method: "POST",
        body: JSON.stringify(args),
      });
      return `Added "${made.text}" (id ${made.id}).`;
    },
  },
  {
    name: "complete_task",
    description: "Tick a task off, by the id that list_tasks reports.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        completed: {
          type: "boolean",
          description: "false puts it back. Default true.",
        },
      },
      required: ["id"],
    },
    run: async ({ id, completed = true }) => {
      const t = await api(`/api/tasks/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ completed }),
      });
      return `${completed ? "Completed" : "Reopened"}: ${t.text}`;
    },
  },
  {
    name: "delete_task",
    description: "Send a task to Stepler's trash, by id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
    run: async ({ id }) => {
      await api(`/api/tasks/${encodeURIComponent(id)}`, { method: "DELETE" });
      return `Deleted ${id}.`;
    },
  },
  {
    name: "recent_days",
    description:
      "What was on the list on previous days. Useful for a standup, a weekly summary, or working out what is still unfinished.",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number", description: "How many days back. Default 7." },
      },
    },
    run: async ({ days = 7 }) => {
      const history = await api(
        `/api/history?days=${encodeURIComponent(days)}`,
      );
      if (!history.length) return "No history yet.";
      return history
        .map(
          (d) =>
            `${d.date}\n` +
            d.tasks
              .map((t) => `  ${t.completed ? "[x]" : "[ ]"} ${t.text}`)
              .join("\n"),
        )
        .join("\n\n");
    },
  },
];

// --------------------------------------------------------------------------
// JSON-RPC over stdio
// --------------------------------------------------------------------------

function write(message) {
  process.stdout.write(JSON.stringify(message) + "\n");
}

function reply(id, result) {
  if (id !== undefined && id !== null) write({ jsonrpc: "2.0", id, result });
}

function fail(id, message) {
  if (id !== undefined && id !== null)
    write({ jsonrpc: "2.0", id, error: { code: -32603, message } });
}

async function handle(msg) {
  const { id, method, params } = msg;

  if (method === "initialize")
    return reply(id, {
      protocolVersion: params?.protocolVersion || "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "stepler", version: "1.0.0" },
    });

  if (method === "tools/list")
    return reply(id, {
      tools: TOOLS.map(({ name, description, inputSchema }) => ({
        name,
        description,
        inputSchema,
      })),
    });

  if (method === "tools/call") {
    const tool = TOOLS.find((t) => t.name === params?.name);
    if (!tool) return fail(id, `No tool called ${params?.name}.`);
    try {
      const text = await tool.run(params.arguments || {});
      return reply(id, { content: [{ type: "text", text }] });
    } catch (err) {
      // A tool error belongs in the result, so the model can read it and say
      // something useful, rather than as a protocol failure.
      return reply(id, {
        content: [{ type: "text", text: err.message }],
        isError: true,
      });
    }
  }

  if (method === "ping") return reply(id, {});
  // Notifications have no id and want no answer.
  if (id === undefined || id === null) return undefined;
  return fail(id, `Unsupported method ${method}.`);
}

let buffer = "";
let inFlight = 0;
let stdinClosed = false;
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let index;
  while ((index = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    inFlight += 1;
    handle(msg)
      .catch((err) => fail(msg.id, err.message))
      .finally(() => {
        inFlight -= 1;
        if (stdinClosed && inFlight === 0) process.exit(0);
      });
  }
});
// Leave on the way out, but not before the answers do.
process.stdin.on("end", () => {
  stdinClosed = true;
  if (inFlight === 0) process.exit(0);
});
