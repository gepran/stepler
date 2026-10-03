/* Runs the actual built app with disposable data, never the user's profile. */
const { app, BrowserWindow } = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "stepler-review-"));
app.setPath("userData", profile);
app.setName("Stepler review tests");
const now = Date.now();
const ids = [`${now - 3000}-a`, `${now - 2000}-b`, `${now - 1000}-c`];
fs.writeFileSync(
  path.join(profile, "stepler-settings.json"),
  JSON.stringify({
    language: "en",
    theme: "dark",
    hotkey: "Shift+F24",
    apiPort: 0,
    captureSelection: false,
    projects: ["Work", { name: "work", color: "#abcdef" }],
  }),
);
fs.writeFileSync(
  path.join(profile, "stepler-data.json"),
  JSON.stringify({
    tasks: ids.map((id, index) => ({
      id,
      text: `Task ${index + 1}`,
      completed: false,
      priority: false,
      projects: ["Work"],
      ...(index === 0
        ? {
            subtasks: [
              {
                id: `${now - 2500}-s`,
                text: "Child",
                completed: false,
                projects: ["Work"],
              },
            ],
          }
        : {}),
    })),
    history: [
      {
        ymd: "2026-01-01",
        tasks: [
          {
            id: "1767225600000-old",
            text: "History",
            projects: ["Work", "Archive"],
            completed: false,
          },
        ],
      },
    ],
    deletedTasks: [
      {
        id: "1767225600001-trash",
        text: "Trash",
        projects: ["Work"],
        completed: false,
        deletedAt: now,
      },
    ],
  }),
);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let win;
const evaluate = async (fn, ...args) => {
  const result = await win.webContents.executeJavaScript(
    `(async () => { try { return { value: await (${fn.toString()})(...${JSON.stringify(args)}) }; } catch (err) { return { error: err.stack }; } })()`,
  );
  if (result.error) throw new Error(result.error);
  return result.value;
};
async function until(fn, ...args) {
  for (let i = 0; i < 100; i++) {
    if (await evaluate(fn, ...args)) return;
    await delay(50);
  }
  throw new Error(`Timed out: ${fn.toString().slice(0, 160)}`);
}
const ipc = (channel, ...args) =>
  evaluate(
    (channel, args) => window.electron.ipcRenderer.invoke(channel, ...args),
    channel,
    args,
  );
const data = () => ipc("load-app-data");
const flat = (data) => [
  ...data.tasks,
  ...data.history.flatMap((day) => day.tasks),
];
const passed = [];
async function check(name, action) {
  await action();
  passed.push(name);
  console.log(`PASS ${name}`);
}

app.once("browser-window-created", (_event, created) => {
  win = created;
  win.webContents.on("console-message", (event) => {
    if (event.level === "error") console.error(event.message);
  });
  win.webContents.once("did-finish-load", async () => {
    try {
      await until(
        () =>
          document.querySelectorAll('[id^="task-"]').length >= 3 &&
          document.querySelector("textarea"),
      );
      await evaluate(() => {
        window.reviewSetValue = (el, value) => {
          Object.getOwnPropertyDescriptor(
            el.tagName === "TEXTAREA"
              ? HTMLTextAreaElement.prototype
              : HTMLInputElement.prototype,
            "value",
          ).set.call(el, value);
          el.dispatchEvent(new Event("input", { bubbles: true }));
        };
        document.querySelector("textarea").focus();
        window.reviewSetValue(
          document.querySelector("textarea"),
          "Review draft",
        );
      });
      await until(() =>
        document.querySelector('[data-project-list="composer"]'),
      );

      await check(
        "projects agree in both sidebar states, composer and settings",
        async () => {
          win.webContents.send("open-settings");
          await until(() => document.querySelector("nav"));
          await evaluate(() =>
            [...document.querySelectorAll("nav button")]
              .find((b) => b.textContent.trim() === "Projects")
              .click(),
          );
          await until(() =>
            document.querySelector('[data-project-list="settings"]'),
          );
          const lists = await evaluate(() =>
            [...document.querySelectorAll("[data-project-list]")].map((list) =>
              [...list.querySelectorAll("[data-project-name]")].map(
                (row) => row.dataset.projectName,
              ),
            ),
          );
          assert.equal(lists.length, 4);
          for (const list of lists)
            assert.deepEqual(
              list,
              ["Archive", "work", "Work"].sort((a, b) => a.localeCompare(b)),
            );
        },
      );

      await check(
        "rapid project writes do not lose additions or favorite toggles",
        async () => {
          await evaluate(async () => {
            const invoke = window.electron.ipcRenderer.invoke;
            await Promise.all([
              invoke("mutate-project", { type: "add", name: "First" }),
              invoke("mutate-project", { type: "add", name: "Second" }),
            ]);
            await Promise.all([
              invoke("mutate-project", { type: "favorite", name: "First" }),
              invoke("mutate-project", { type: "favorite", name: "First" }),
            ]);
          });
          const saved = await ipc("get-settings");
          assert.ok(saved.projects.some((p) => p.name === "Second"));
          assert.equal(
            saved.projects.find((p) => p.name === "First").isFavorite,
            false,
          );
        },
      );

      await check(
        "rename updates task labels, nested labels, history and trash",
        async () => {
          await evaluate(() =>
            document
              .querySelector(
                '[data-project-list="settings"] [data-project-name="Work"] button[title="Rename"]',
              )
              .click(),
          );
          await evaluate(() => {
            const input = document.querySelector(
              '[data-project-name="Work"] input',
            );
            window.reviewSetValue(input, "Renamed");
          });
          await evaluate(() =>
            document
              .querySelector('[data-project-name="Work"] input')
              .dispatchEvent(
                new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
              ),
          );
          await until(() =>
            document.querySelector(
              '[data-project-list="settings"] [data-project-name="Renamed"]',
            ),
          );
          const snapshot = await data();
          assert.deepEqual(snapshot.tasks[0].projects, ["Renamed"]);
          assert.deepEqual(snapshot.tasks[0].subtasks[0].projects, ["Renamed"]);
          assert.deepEqual(snapshot.history[0].tasks[0].projects, [
            "Renamed",
            "Archive",
          ]);
          assert.deepEqual(snapshot.deletedTasks[0].projects, ["Renamed"]);
        },
      );

      await check(
        "project deletion removes labels everywhere without resurrection",
        async () => {
          await evaluate(() =>
            document
              .querySelector(
                '[data-project-list="settings"] [data-project-name="Renamed"] button[title="Delete project and remove its labels"]',
              )
              .click(),
          );
          await until(
            () => !document.querySelector('[data-project-name="Renamed"]'),
          );
          const snapshot = await data();
          assert.equal(snapshot.tasks[0].projects, undefined);
          assert.equal(snapshot.tasks[0].subtasks[0].projects, undefined);
          assert.equal(snapshot.deletedTasks[0].projects, undefined);
          assert.deepEqual(snapshot.history[0].tasks[0].projects, ["Archive"]);
          assert.ok(
            (await ipc("get-settings")).projects.some((p) => p.name === "work"),
          );
          await evaluate(() =>
            window.dispatchEvent(
              new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
            ),
          );
          await until(() => !document.querySelector("nav"));
        },
      );

      await check(
        "composer creates a project before the task and all lists refresh",
        async () => {
          await evaluate(() => {
            document.querySelector("textarea").focus();
          });
          await until(() =>
            document.querySelector('input[placeholder="New..."]'),
          );
          await evaluate(() =>
            window.reviewSetValue(
              document.querySelector('input[placeholder="New..."]'),
              "Composer project",
            ),
          );
          await evaluate(() =>
            document
              .querySelector('input[placeholder="New..."]')
              .dispatchEvent(
                new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
              ),
          );
          await until(
            () =>
              document.querySelectorAll(
                '[data-project-name="Composer project"]',
              ).length === 3,
          );
          await evaluate(() =>
            window.reviewSetValue(
              document.querySelector("textarea"),
              "New task",
            ),
          );
          await evaluate(() =>
            document
              .querySelector("textarea")
              .dispatchEvent(
                new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
              ),
          );
          await until(() => document.body.textContent.includes("New task"));
          await delay(100);
          assert.deepEqual(
            flat(await data()).find((t) => t.text === "New task").projects,
            ["Composer project"],
          );
        },
      );

      await check("editing, completion and priority persist", async () => {
        await evaluate((id) => {
          const row = document.getElementById(`task-${id}`);
          [...row.querySelectorAll("span")]
            .find((el) => el.textContent === "Task 2")
            .click();
        }, ids[1]);
        await until(
          (id) =>
            document.getElementById(`task-${id}`).querySelector("textarea"),
          ids[1],
        );
        await evaluate(
          (id) =>
            window.reviewSetValue(
              document.getElementById(`task-${id}`).querySelector("textarea"),
              "Edited task",
            ),
          ids[1],
        );
        await evaluate(
          (id) =>
            document
              .getElementById(`task-${id}`)
              .querySelector("textarea")
              .dispatchEvent(
                new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
              ),
          ids[1],
        );
        await evaluate(
          (id) =>
            document
              .getElementById(`task-${id}`)
              .dispatchEvent(new MouseEvent("mouseover", { bubbles: true })),
          ids[1],
        );
        await until(
          (id) =>
            [
              ...document
                .getElementById(`task-${id}`)
                .querySelectorAll("button"),
            ].some((b) => b.textContent.trim() === "Priority"),
          ids[1],
        );
        await evaluate(
          (id) =>
            [
              ...document
                .getElementById(`task-${id}`)
                .querySelectorAll("button"),
            ]
              .find((b) => b.textContent.trim() === "Priority")
              .click(),
          ids[1],
        );
        await evaluate(
          (id) =>
            document
              .getElementById(`task-${id}`)
              .querySelector('button[title="Mark as done"]')
              .click(),
          ids[1],
        );
        await delay(100);
        const task = flat(await data()).find((t) => t.id === ids[1]);
        assert.equal(task.text, "Edited task");
        assert.equal(task.completed, true);
        assert.equal(task.priority, true);
        await evaluate(
          (id) =>
            document
              .getElementById(`task-${id}`)
              .querySelector('button[title="Mark as not done"]')
              .click(),
          ids[1],
        );
      });

      await check("real DOM drop retains order after rerender", async () => {
        await evaluate(
          (source, target) => {
            const row = document.getElementById(`task-${target}`);
            const rect = row.getBoundingClientRect();
            const transfer = new DataTransfer();
            transfer.setData(
              "application/json",
              JSON.stringify({ type: "task", id: source }),
            );
            row.dispatchEvent(
              new DragEvent("drop", {
                bubbles: true,
                cancelable: true,
                dataTransfer: transfer,
                clientY: rect.top + 1,
              }),
            );
          },
          ids[2],
          ids[0],
        );
        await delay(100);
        const rows = await evaluate(() =>
          [...document.querySelectorAll('[id^="task-"]')].map((row) => row.id),
        );
        assert.ok(
          rows.indexOf(`task-${ids[2]}`) < rows.indexOf(`task-${ids[0]}`),
        );
        assert.ok(
          flat(await data()).find((t) => t.id === ids[2]).sortOrder !==
            undefined,
        );
      });

      await check("subtask add, edit, toggle and delete persist", async () => {
        await evaluate(
          (id) =>
            document
              .getElementById(`task-${id}`)
              .dispatchEvent(new MouseEvent("mouseover", { bubbles: true })),
          ids[0],
        );
        await until(
          (id) =>
            [
              ...document
                .getElementById(`task-${id}`)
                .querySelectorAll("button"),
            ].some((b) => b.textContent.trim() === "Subtask"),
          ids[0],
        );
        await evaluate(
          (id) =>
            [
              ...document
                .getElementById(`task-${id}`)
                .querySelectorAll("button"),
            ]
              .find((b) => b.textContent.trim() === "Subtask")
              .click(),
          ids[0],
        );
        await until(() =>
          document.querySelector('input[placeholder="New subtask…"]'),
        );
        await evaluate(() =>
          window.reviewSetValue(
            document.querySelector('input[placeholder="New subtask…"]'),
            "Added child",
          ),
        );
        await evaluate(() =>
          document
            .querySelector('input[placeholder="New subtask…"]')
            .dispatchEvent(
              new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
            ),
        );
        await until(() =>
          [...document.querySelectorAll("span")].some(
            (el) => el.textContent === "Added child",
          ),
        );
        await evaluate(() =>
          [...document.querySelectorAll("span")]
            .find((el) => el.textContent === "Added child")
            .click(),
        );
        await until(() =>
          [...document.querySelectorAll("input")].some(
            (el) => el.value === "Added child",
          ),
        );
        await evaluate(() =>
          window.reviewSetValue(
            [...document.querySelectorAll("input")].find(
              (el) => el.value === "Added child",
            ),
            "Edited child",
          ),
        );
        await evaluate(() =>
          [...document.querySelectorAll("input")]
            .find((el) => el.value === "Edited child")
            .dispatchEvent(
              new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
            ),
        );
        await evaluate(() =>
          [...document.querySelectorAll("span")]
            .find((el) => el.textContent === "Edited child")
            .closest('[class*="group/subtask"]')
            .querySelector("button")
            .click(),
        );
        await delay(100);
        const parent = flat(await data()).find((t) => t.id === ids[0]);
        assert.ok(
          parent.subtasks.some(
            (st) => st.text === "Edited child" && st.completed,
          ),
        );
        await evaluate(() =>
          [...document.querySelectorAll("span")]
            .find((el) => el.textContent === "Edited child")
            .closest('[class*="group/subtask"]')
            .querySelector('button[title="Delete subtask"]')
            .click(),
        );
        await delay(150);
        assert.equal(
          flat(await data()).find((t) => t.id === ids[0]).subtasks.length,
          1,
        );
      });

      await check("reminder save and clear persist", async () => {
        await evaluate(
          (id) =>
            [
              ...document
                .getElementById(`task-${id}`)
                .querySelectorAll("button"),
            ]
              .find((b) => b.textContent.trim() === "Remind")
              .click(),
          ids[0],
        );
        await until(
          (id) =>
            [
              ...document
                .getElementById(`task-${id}`)
                .querySelectorAll("button"),
            ].some((b) => b.textContent.trim() === "Save"),
          ids[0],
        );
        // Allow CSS scroll snapping to settle: opening the picker must not
        // silently change the default minute from 00 to 01.
        await delay(250);
        await evaluate(
          (id) =>
            [
              ...document
                .getElementById(`task-${id}`)
                .querySelectorAll("button"),
            ]
              .find((b) => b.textContent.trim() === "Save")
              .click(),
          ids[0],
        );
        await delay(100);
        assert.equal(
          flat(await data()).find((t) => t.id === ids[0]).reminder,
          "09:00",
        );
        await evaluate(
          (id) =>
            [
              ...document
                .getElementById(`task-${id}`)
                .querySelectorAll("button"),
            ]
              .find((b) => b.textContent.trim() === "Remind")
              .click(),
          ids[0],
        );
        await evaluate(
          (id) =>
            [
              ...document
                .getElementById(`task-${id}`)
                .querySelectorAll("button"),
            ]
              .find((b) => b.textContent.trim() === "Clear")
              .click(),
          ids[0],
        );
        await delay(100);
        assert.equal(
          flat(await data()).find((t) => t.id === ids[0]).reminder,
          undefined,
        );
      });

      await check(
        "search reveals a task hidden by a project filter",
        async () => {
          await evaluate(() =>
            document
              .querySelector(
                '[data-project-list="sidebar-collapsed"] [data-project-name="Composer project"]',
              )
              .click(),
          );
          await until((id) => !document.getElementById(`task-${id}`), ids[1]);
          win.webContents.send("open-search");
          await until(() => document.querySelector('input[class*="text-4xl"]'));
          await evaluate(() =>
            window.reviewSetValue(
              document.querySelector('input[class*="text-4xl"]'),
              "Edited task",
            ),
          );
          await until(() =>
            [...document.querySelectorAll("div.text-lg")].some(
              (el) => el.textContent === "Edited task",
            ),
          );
          await evaluate(() =>
            [...document.querySelectorAll("div.text-lg")]
              .find((el) => el.textContent === "Edited task")
              .click(),
          );
          await until((id) => document.getElementById(`task-${id}`), ids[1]);
        },
      );

      await check(
        "task deletion, restoration and permanent deletion persist",
        async () => {
          const remove = async () => {
            await evaluate(
              (id) =>
                document
                  .getElementById(`task-${id}`)
                  .dispatchEvent(
                    new MouseEvent("mouseover", { bubbles: true }),
                  ),
              ids[2],
            );
            await until(
              (id) =>
                [
                  ...document
                    .getElementById(`task-${id}`)
                    .querySelectorAll("button"),
                ].some((b) => b.textContent.trim() === "Delete"),
              ids[2],
            );
            await evaluate(
              (id) =>
                [
                  ...document
                    .getElementById(`task-${id}`)
                    .querySelectorAll("button"),
                ]
                  .find((b) => b.textContent.trim() === "Delete")
                  .click(),
              ids[2],
            );
            await until((id) => !document.getElementById(`task-${id}`), ids[2]);
          };
          const openTrash = async () => {
            win.webContents.send("open-settings");
            await until(() => document.querySelector("nav"));
            await evaluate(() =>
              [...document.querySelectorAll("nav button")]
                .find((b) => b.textContent.trim().startsWith("Trash"))
                .click(),
            );
            await until(() =>
              document.querySelector('button[title="Restore task"]'),
            );
          };
          await remove();
          await openTrash();
          await evaluate(() =>
            [...document.querySelectorAll('button[title="Restore task"]')]
              .find((b) => b.closest(".group").textContent.includes("Task 3"))
              .click(),
          );
          await evaluate(() =>
            window.dispatchEvent(
              new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
            ),
          );
          await until((id) => document.getElementById(`task-${id}`), ids[2]);
          await remove();
          await openTrash();
          await evaluate(() =>
            [...document.querySelectorAll('button[title="Delete forever"]')]
              .find((b) => b.closest(".group").textContent.includes("Task 3"))
              .click(),
          );
          await delay(150);
          const snapshot = await data();
          assert.ok(!snapshot.deletedTasks.some((t) => t.id === ids[2]));
          assert.ok(
            snapshot.purgedTasks.some(
              (t) => t.id === ids[2] && t.text === "" && t.purged,
            ),
          );
          await evaluate(() =>
            window.dispatchEvent(
              new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
            ),
          );
        },
      );

      await check(
        "mentions-only filter cannot erase tasks or history from persistence",
        async () => {
          win.webContents.send("collab-snapshot", {
            uid: null,
            profile: null,
            connections: [],
            mentions: [
              {
                id: `${now}-mention`,
                taskId: `${now}-mention`,
                text: "Incoming",
                fromUid: "other",
                read: false,
              },
            ],
          });
          await until(() => document.querySelector("button[aria-pressed]"));
          const before = flat(await data()).length;
          await evaluate(() =>
            document.querySelector("button[aria-pressed]").click(),
          );
          await delay(200);
          assert.equal(flat(await data()).length, before);
          await evaluate(() =>
            document.querySelector("button[aria-pressed]").click(),
          );
          await delay(100);
        },
      );

      await check("pasted image persists as an attachment", async () => {
        await evaluate(() => {
          const png = Uint8Array.from(
            atob(
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nwsAAAAASUVORK5CYII=",
            ),
            (c) => c.charCodeAt(0),
          );
          const transfer = new DataTransfer();
          transfer.items.add(
            new File([png], "paste.png", { type: "image/png" }),
          );
          document.querySelector("textarea").dispatchEvent(
            new ClipboardEvent("paste", {
              bubbles: true,
              cancelable: true,
              clipboardData: transfer,
            }),
          );
        });
        await until(() =>
          document.querySelector('button[title="Remove attachment"]'),
        );
        await evaluate(() =>
          document
            .querySelector("textarea")
            .dispatchEvent(
              new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
            ),
        );
        await delay(500);
        assert.ok(
          flat(await data()).some((t) => t.attachment?.name === "paste.png"),
        );
      });

      await check(
        "attachment write failure keeps the draft and retry creates only one task",
        async () => {
          const before = flat(await data()).length;
          const write = fs.writeFileSync;
          fs.writeFileSync = (file, ...args) => {
            if (String(file).startsWith(path.join(profile, "attachments")))
              throw new Error("Simulated disk full");
            return write(file, ...args);
          };
          try {
            await evaluate(() => {
              window.reviewSetValue(
                document.querySelector("textarea"),
                "Keep this draft",
              );
              const transfer = new DataTransfer();
              transfer.items.add(
                new File(["contents"], "retry.txt", { type: "text/plain" }),
              );
              document.querySelector("textarea").dispatchEvent(
                new ClipboardEvent("paste", {
                  bubbles: true,
                  cancelable: true,
                  clipboardData: transfer,
                }),
              );
            });
            await until(() =>
              document.querySelector('button[title="Remove attachment"]'),
            );
            await evaluate(() =>
              document
                .querySelector("textarea")
                .dispatchEvent(
                  new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
                ),
            );
            await delay(200);
            assert.equal(flat(await data()).length, before);
            assert.equal(
              await evaluate(() => document.querySelector("textarea").value),
              "Keep this draft",
            );
            assert.ok(
              await evaluate(() =>
                document.querySelector('button[title="Remove attachment"]'),
              ),
            );
          } finally {
            fs.writeFileSync = write;
          }
          await evaluate(() =>
            document
              .querySelector("textarea")
              .dispatchEvent(
                new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
              ),
          );
          await delay(200);
          const snapshot = flat(await data());
          assert.equal(snapshot.length, before + 1);
          assert.equal(
            snapshot.find((task) => task.text === "Keep this draft").attachment
              .name,
            "retry.txt",
          );
        },
      );

      await check(
        "preload hides environment, rejects unknown IPC and attachment traversal",
        async () => {
          assert.equal(
            await evaluate(() => window.electron.process.env),
            undefined,
          );
          assert.equal(
            await evaluate(() =>
              window.electron.ipcRenderer.invoke("not-allowed").then(
                () => false,
                () => true,
              ),
            ),
            true,
          );
          assert.equal(
            (await ipc("read-attachment", { id: "../../etc/passwd" })).success,
            false,
          );
          const probe = new BrowserWindow({
            show: false,
            webPreferences: {
              sandbox: true,
              contextIsolation: true,
              preload: path.resolve("out/preload/index.js"),
            },
          });
          const file = path.join(profile, "untrusted.html");
          fs.writeFileSync(file, "<!doctype html><p>Untrusted frame</p>");
          await probe.loadFile(file);
          assert.equal(
            await probe.webContents.executeJavaScript(
              'window.electron.ipcRenderer.invoke("get-settings").then(() => false, () => true)',
            ),
            true,
          );
          probe.destroy();
        },
      );

      await check(
        "API authentication, browser rejection, malformed URLs and immediate disable",
        async () => {
          const info = JSON.parse(
            fs.readFileSync(path.join(profile, "stepler-api.json")),
          );
          const url = `http://127.0.0.1:${info.port}`;
          const headers = { Authorization: `Bearer ${info.token}` };
          assert.equal((await fetch(`${url}/api/tasks`)).status, 401);
          assert.equal(
            (
              await fetch(`${url}/api/tasks`, {
                headers: { ...headers, Origin: "https://attacker.example" },
              })
            ).status,
            403,
          );
          assert.equal(
            (
              await fetch(`${url}/api/tasks/%broken`, {
                method: "DELETE",
                headers,
              })
            ).status,
            400,
          );
          await ipc("update-settings", { apiEnabled: false });
          assert.equal(
            (await fetch(`${url}/api/tasks`, { headers })).status,
            403,
          );
          assert.equal(
            (await fetch(`${url}/oauth2callback?state=invalid`)).status,
            400,
          );
          await ipc("update-settings", { apiEnabled: true });
          assert.equal(
            (await fetch(`${url}/api/tasks`, { headers })).status,
            200,
          );
        },
      );

      await delay(500);
      await check(
        "switching accounts isolates tasks and rejects an old renderer snapshot",
        async () => {
          const original = await ipc("load-app-data");
          mainModule.selectLocalAccount("review-account-a");
          await delay(200);
          const first = await ipc("load-app-data");
          assert.ok(flat(first).some((task) => task.text === "Edited task"));
          await evaluate(() =>
            window.reviewSetValue(
              document.querySelector("textarea"),
              "Private account A draft",
            ),
          );
          const originalWrite = fs.writeFileSync;
          try {
            fs.writeFileSync = (file, ...args) => {
              if (String(file).includes("stepler-settings.json"))
                throw new Error("Simulated settings disk full");
              return originalWrite(file, ...args);
            };
            assert.throws(
              () => mainModule.selectLocalAccount("review-account-b"),
              /Simulated settings disk full/,
            );
          } finally {
            fs.writeFileSync = originalWrite;
          }
          assert.ok(
            flat(await ipc("load-app-data")).some(
              (task) => task.text === "Edited task",
            ),
          );
          mainModule.selectLocalAccount("review-account-b");
          await delay(200);
          const second = await ipc("load-app-data");
          assert.equal(flat(second).length, 0);
          assert.equal((await ipc("get-settings")).projects.length, 0);
          assert.equal(
            await evaluate(() => document.querySelector("textarea").value),
            "",
          );
          assert.equal(
            (
              await ipc("save-app-data", {
                ...original,
                accountEpoch: first.accountEpoch,
              })
            ).ok,
            false,
          );
          assert.equal(flat(await ipc("load-app-data")).length, 0);
          mainModule.selectLocalAccount("review-account-a");
          await delay(300);
          assert.ok(
            flat(await ipc("load-app-data")).some(
              (task) => task.text === "Edited task",
            ),
          );
        },
      );
      const stored = JSON.parse(
        fs.readFileSync(path.join(profile, "stepler-data.json")),
      );
      assert.ok(flat(stored).some((t) => t.text === "Edited task"));
      console.log(
        JSON.stringify({
          passed: passed.length,
          profile,
          electron: process.versions.electron,
        }),
      );
      app.exit(0);
    } catch (err) {
      console.error(err);
      console.error(`Disposable profile: ${profile}`);
      app.exit(1);
    }
  });
});
const mainModule = require("../out/main/index.js");
setTimeout(() => {
  console.error("Desktop test timeout");
  app.exit(1);
}, 60_000);
