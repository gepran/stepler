/**
 * One object per language, same shape throughout. English is the source of
 * truth: anything missing elsewhere falls back to it, so a half-finished
 * translation still renders a usable window.
 *
 * `{name}` placeholders are filled at call time. Plural keys carry the CLDR
 * form names (one / few / many / other) — Russian needs three where English
 * needs two.
 */

const en = {
  auth: {
    tagline: "Your day, on every device.",
    signIn: "Sign in",
    signUp: "Create account",
    email: "Email",
    password: "Password",
    google: "Continue with Google",
    or: "or",
    toSignUp: "No account yet? Create one",
    toSignIn: "Already have an account? Sign in",
    signOut: "Sign out",
    backToSite: "← Back to stepler",
    working: "One moment…",
    syncing: "Syncing…",
    synced: "Synced",
    offline: "Offline — saved here, will sync later",
    errors: {
      invalidEmail: "That does not look like an email address.",
      wrongPassword: "Wrong email or password.",
      emailInUse: "That email already has an account. Try signing in.",
      weakPassword: "Use at least six characters.",
      tooMany: "Too many attempts. Wait a minute and try again.",
      popupClosed: "The Google window closed before sign-in finished.",
      network: "No connection to the server.",
      generic: "Sign-in failed. Please try again.",
    },
  },
  menu: {
    about: "About Stepler",
    settings: "Settings…",
    edit: "Edit",
    view: "View",
    searchTasks: "Search Tasks",
    newTask: "New Task",
    window: "Window",
    showStepler: "Show Stepler",
    quit: "Quit",
  },

  common: {
    connect: "Connect",
    disconnect: "Disconnect",
    close: "Close",
    save: "Save",
    clear: "Clear",
    cancel: "Cancel",
    delete: "Delete",
    copy: "Copy",
    preview: "Preview",
    open: "Open",
    settings: "Settings",
    saveAs: "Save as…",
    copyFile: "Copy file",
    copyImage: "Copy image",
    removeAttachment: "Remove attachment",
  },

  app: {
    toggleSidebar: "Toggle Sidebar",
    hideCompleted: "Hide Completed",
    showAll: "Show All",
    allDone: "Everything here is done and hidden.",
    nothingToday: "Nothing today yet. Start typing below.",
    jumpNewest: "Jump to the newest task",
    showPreviousWeek: "Show the previous week",
    today: "Today",
    tomorrow: "Tomorrow",
    counter: "{done} / {total} Today",
  },

  toast: {
    attachmentFailed: "Could not save that attachment",
    gcalFailed: "Could not add this to Google Calendar",
    gcalUnreachable: "Could not reach Google Calendar",
    jiraFailed: "Jira: {error}",
    jiraNoIssue: "could not create issue",
    jiraSprint: "{key} created, but {error}",
    exported: "Exported",
    exportFailed: "Export failed",
    importFailed: "Import failed",
    imported: {
      one: "Imported {count} task",
      other: "Imported {count} tasks",
    },
    nothingToImport: "Nothing new to import",
    filePathCopied: "File path copied",
    fileCopied: "File copied",
    imageCopied: "Image copied",
    copied: "Copied",
    copyFailed: "Copy failed",
    taskCopied: "Task copied",
    taskAndImageCopied: "Task and image copied",
    fileTooLarge: "That file is larger than 64 MB",
    gcalDisconnected: "Disconnected from Google Calendar",
    jiraDisconnected: "Disconnected from Jira",
    jiraConnected: "Connected to Jira as {name}",
    restartToApply: "Restart Stepler to apply this change",
  },

  task: {
    dragHint: "Drag to reorder or nest",
    markDone: "Mark as done",
    markNotDone: "Mark as not done",
    removeProject: "Remove project",
    remove: "Remove",
    deleteSubtask: "Delete subtask",
    newSubtask: "New subtask…",
    addSubtask: "Add subtask",
    newProject: "New project…",
    subtask: "Subtask",
    priority: "Priority",
    project: "Project",
    remind: "Remind",
    viewInCalendar: "View in Google Calendar",
    openInJira: "Open in Jira",
    carryOver: "Copy this note into Today so you can work on it again",
    moveToToday: "Move to Today",
  },

  input: {
    prompt: "What's on your mind?",
    collapse: "Collapse",
    expand: "Expand",
    removeDate: "Remove date",
    newShort: "New...",
    projects: "Projects",
    jiraProject: "Jira Project",
    backlog: "Backlog",
    clearJiraProject: "Clear Jira project",
    attach: "Attach image or file",
    dictate: "Dictate",
    dictateHint: "Start dictation (Fn twice)",
    addTask: "Add task",
  },

  search: {
    placeholder: "Search tasks, projects, files…",
    noResults: "No tasks found",
    close: "Close (Esc)",
  },

  file: {
    noPreview: "Preview is not available for this file type",
    openInSystem: "Open in system app",
  },

  trash: {
    title: "Deleted Tasks",
    inTrash: {
      one: "{count} task in trash",
      other: "{count} tasks in trash",
    },
    empty: "Trash is empty",
    emptyHint: "Deleted tasks will appear here",
    deletedAt: "Deleted {when}",
    justNow: "just now",
    minutesAgo: "{count}m ago",
    hoursAgo: "{count}h ago",
    completed: "Completed",
    subtaskCount: {
      one: "{count} subtask",
      other: "{count} subtasks",
    },
    restore: "Restore task",
    deleteForever: "Delete forever",
    persistNote: "Deleted tasks persist until cleared",
    clearAll: "Clear All",
  },

  sidebar: {
    projects: "Projects",
    allProjects: "All Projects",
    trash: "Trash",
    noProjects: "No projects found.",
    projectTasks: {
      one: "{name} — {count} task",
      other: "{name} — {count} tasks",
    },
  },

  update: {
    reveal: "Show the file",
    revealed:
      "{name} is in your Downloads \u2014 unzip it and drag Stepler into Applications.",
    revealFailed:
      "There is no downloaded copy \u2014 opening the download page.",
    checkNow: "Check for updates",
    newAvailable: "A new version is ready",
    checking: "Checking…",
    upToDate: "You are on the latest version",
    neverChecked: "Not checked yet",
    unavailable: "Updates are not available in this build",
    version: "Version {version}",
    downloading: "Downloading the new version",
    updating: "Updating…",
    update: "Update",
    updateTo: "Update to {version}",
    install: "Install {version}",
    restartTo: "Restart to update to {version}",
    theNewVersion: "the new version",
    unknownError: "unknown error",
    replaceFailed:
      "Stepler could not replace itself ({error}). This puts the downloaded build in your Downloads folder.",
  },

  collab: {
    title: "Collaboration",
    yourHandle: "Your handle — this is what people type to mention you",
    noHandle: "No handle yet",
    find: "Find someone",
    searchPlaceholder: "Handle or email — testeruser, or name@company.com",
    noResults: "Nobody found for \u201C{term}\u201D.",
    invite: "Invite",
    invited: "Invited",
    accept: "Accept",
    decline: "Decline",
    connected: "Connected",
    waiting: "Waiting",
    disconnect: "Disconnect",
    incoming: "Wants to connect with you",
    connections: "Your people",
    noneYet: "Nobody yet. Search above to invite someone.",
    hint: "Once you are both connected, put @their-handle in a task and it appears in their list too. They can read it, not change it.",
    mentionedYou: "mentioned you",
    markRead: "Got it",
    dismiss: "Remove from my list",
    dismissHint:
      "This only takes it off your list \u2014 the person who wrote it keeps their task.",
    showMentions: "Show only tasks you were mentioned in ({count} unread)",
    showAll: "Show everything again",
    noMentions: "Nobody has mentioned you yet.",
    failed: "That did not go through. Try again.",
    toastInvited: "Invitation sent",
    toastAccepted: "Connected",
    toastRemoved: "Disconnected",
  },
  settings: {
    sync: {
      title: "Account and sync",
      blurb:
        "Sign in and your tasks follow you — to the web app and to your other computers.",
      browserNote: "Google sign-in opens in your browser.",
      offBlurb: "Not signed in. Tasks stay on this computer only.",
      states: {
        off: "Not syncing",
        "signing-in": "Signing in…",
        syncing: "Syncing…",
        synced: "Everything is synced",
        error: "Sync problem",
      },
    },
    title: "Settings",
    tabs: {
      general: "General",
      projects: "Projects",
      integrations: "Integrations",
      collab: "Collaboration",
      guide: "Guide",
      data: "Data",
      trash: "Trash",
    },
    general: {
      title: "General",
      appearance: "Appearance",
      light: "Light",
      dark: "Dark",
      system: "System",
      language: "Language",
      languageHint: "Menus, buttons and the guide switch straight away.",
      shortcut: "Global Shortcut",
      change: "Change",
      recording: "Press the new combination… (Esc to cancel)",
      shortcutHint:
        "Press this combination from any app to show or hide Stepler.",
      shortcutError: "Use at least one of ⌘, ⌃ or ⌥ together with another key.",
      behaviour: "Behaviour",
      captureSelection: "Bring the selection with you",
      captureSelectionHint:
        "Text selected in another app lands in the composer when you open Stepler with the shortcut. Your clipboard is put back afterwards.",
      escToHide: "Hide with Esc",
      escToHideHint: "Press Esc on an empty input to send the window away.",
    },
    projects: {
      title: "Projects",
      placeholder: "Enter project name…",
      empty:
        "No saved projects yet. Projects you type on a task show up here automatically.",
      pin: "Pin to the top",
      rename: "Rename",
      removeSaved: "Remove from the saved list",
    },
    integrations: {
      title: "Integrations",
      blurb:
        "Everything here is off until you turn it on. Nothing leaves this machine otherwise.",
      gcalNeedsCreds: "Needs your own Google OAuth credentials.",
      gcalConnected: "Connected",
      gcalBlurb: "Create an event for tasks that have a date.",
      gcalCredsBefore:
        "No credentials ship inside Stepler, so nobody borrows anyone else's. Register your own OAuth app, then put the id and secret in",
      gcalCredsAfter: "in the data folder.",
      openDataFolder: "Open data folder",
      setupGuide: "Setup guide",
      autoEvents: "Create events automatically",
      autoEventsHint: "Only for tasks that carry a date.",
      signInFailed: "Could not start sign-in",
      jiraBlurb:
        "Create Jira issues straight from a note, in the sprint you pick.",
      jiraNote:
        "Atlassian has no sign-in that a downloadable app can ship, so Stepler uses an API token you make yourself. It is stored encrypted on this machine and goes nowhere else.",
      jiraEmail: "Your Atlassian account email",
      jiraToken: "API token",
      jiraChecking: "Checking…",
      jiraCreateToken: "Create a token",
      jiraUseOauth: "Use OAuth instead",
      jiraConnectFailed: "Could not connect",
      remindersBlurb: "Mirror dated tasks into Reminders.",
      cli: "Command line access",
      cliBlurb:
        "Lets the bundled CLI add and list tasks on 127.0.0.1. Requires a token that only apps on this computer can read.",
    },
    data: {
      title: "Data Management",
      export: "Export",
      exportBlurb:
        "One JSON file with every task, including the attachments themselves.",
      import: "Import",
      importBlurb:
        "Merge an export back in. Existing tasks are never overwritten.",
      backupNote:
        "Stepler keeps a backup copy of the previous data file every time it starts, next to your tasks in the app data folder.",
    },
  },

  guide: {
    heading: "How Stepler works",
    intro: "Short answers to “how do I…”. Open any line to see the steps.",
    searchPlaceholder: "Search this guide — reminder, sprint, backup…",
    noMatch: "Nothing here matches “{query}”.",
    start: {
      title: "Getting started",
      blurb: "The whole app in three moves.",
      write: {
        title: "Write something down",
        steps: [
          "Click the box at the bottom, or press {mod}N.",
          "Type the thing. Press Enter.",
          "It appears in today's list, above the box.",
        ],
      },
      tick: {
        title: "Tick it off",
        steps: [
          "Click the circle to the left of a task.",
          "It stays on the day, crossed out, so you can see what the day held.",
          "Changed your mind? Click the circle again.",
        ],
      },
      around: {
        title: "Find your way around",
        steps: [
          "Today sits at the bottom, next to the box you type in.",
          "Scroll up to walk back through previous days.",
          "The counter at the top right says how much of today is done.",
        ],
      },
    },
    open: {
      title: "Opening Stepler from anywhere",
      blurb: "You should never have to go looking for it.",
      shortcut: {
        title: "The shortcut",
        steps: [
          "Press {hotkey} in any app and Stepler comes forward.",
          "Press it again, or press Esc, and it goes away.",
          "You can change the combination in Settings → General.",
        ],
      },
      selection: {
        title: "Bring the selection with you",
        steps: [
          "The first time, macOS asks to let Stepler read what is selected: tick Stepler under System Settings → Privacy & Security → Accessibility. Without that it cannot work.",
          "Select some text anywhere — an email, a page, a chat.",
          "Press {hotkey}.",
          "The text is already in the box, waiting. Add to it or press Enter.",
          "Your clipboard is left exactly as you had it.",
          "Turn this off in Settings → General if you would rather it did not.",
        ],
      },
    },
    details: {
      title: "Dates, times and reminders",
      blurb: "For the things that have to happen at a particular moment.",
      day: {
        title: "Give a task a day",
        steps: [
          "Before pressing Enter, click one of the days under the box.",
          "The task carries that day as a small blue tag.",
          "The day has to be chosen while writing it — it cannot be added later.",
        ],
      },
      notification: {
        title: "Get a notification",
        steps: [
          "Hover over a task and click the bell.",
          "Pick a time and confirm.",
          "At that time your computer shows a notification with the task in it.",
          "Stepler has to be running for the notification to arrive.",
        ],
      },
      important: {
        title: "Mark something important",
        steps: [
          "Hover over a task and click the star.",
          "Starred tasks move to the bottom of the day, where you look last.",
        ],
      },
    },
    organise: {
      title: "Keeping it organised",
      blurb: "Only as much structure as you actually want.",
      projects: {
        title: "Projects",
        steps: [
          "While writing, click a project name under the box, or type a new one next to “New…”.",
          "Click a project in the left sidebar to see only its tasks.",
          "Rename or remove projects in Settings → Projects.",
        ],
      },
      subtasks: {
        title: "Subtasks",
        steps: [
          "Hover over a task and click Subtask.",
          "Type the smaller step and press Enter.",
          "Subtasks tick off on their own and sit under their parent.",
        ],
      },
      files: {
        title: "Files and images",
        steps: [
          "Paste an image straight into the box, or click + to pick a file.",
          "Click the attachment on a task to open a preview.",
          "Files are kept as real files — you can copy them out or save them anywhere.",
        ],
      },
      search: {
        title: "Search",
        steps: [
          "Press {mod}F.",
          "Type anything: task text, a subtask, a project, even a file name.",
          "Move with the arrow keys, press Enter to jump to it in the timeline.",
        ],
      },
    },
    collaborate: {
      title: "Working with other people",
      blurb: "Connect with someone, then put their name on a task.",
      connect: {
        title: "Connect with someone",
        steps: [
          "Open Settings and go to Collaboration.",
          "Your own handle is at the top — it comes from your email, so testeruser@gmail.com becomes @testeruser.",
          "Search for the person by handle or by email address, and press Invite.",
          "Nothing is shared until they open their own Collaboration page and accept.",
        ],
      },
      mention: {
        title: "Put someone on a task",
        steps: [
          "Type @ in the task box. The people you are connected to appear — pick one.",
          "Write the rest of the task and press Enter.",
          "A copy lands in their list, on the same day, marked with your handle.",
          "They can read it. Only you can change it or tick it off.",
        ],
      },
      inbox: {
        title: "When somebody mentions you",
        steps: [
          "A round @ button appears in the bottom right corner with a number on it.",
          "Click it to show only the tasks you were mentioned in.",
          "Click it again to go back to your whole list.",
        ],
      },
    },
    safety: {
      title: "Nothing gets lost",
      blurb: "What happens to things you finish or delete.",
      trash: {
        title: "Trash",
        steps: [
          "Deleted a task by mistake? Click the bin in the sidebar.",
          "Find it and put it back.",
          "The last 500 deleted tasks are kept.",
        ],
      },
      past: {
        title: "Past days",
        steps: [
          "Scroll up past today to read any previous day.",
          "Something still relevant? Drag it down onto today to carry it over.",
        ],
      },
      data: {
        title: "Your data",
        steps: [
          "Everything lives in a folder on this computer and nowhere else.",
          "Settings → Data exports the lot as one file, attachments included.",
          "That same file imports back, on this machine or another one.",
          "A backup copy is kept automatically every time Stepler starts cleanly.",
        ],
      },
    },
    connect: {
      title: "Connecting other apps",
      blurb: "All optional, all off until you switch them on.",
      reminders: {
        title: "Apple Reminders",
        steps: [
          "Settings → Integrations → turn on Apple Reminders.",
          "From then on, a task you give a day or a time also appears in Reminders.",
          "They land in a list called Stepler, so your own lists stay as they were.",
          "Ticking it off in Stepler ticks it off in Reminders too.",
          "Only tasks made after you switch it on are mirrored.",
        ],
      },
      gcal: {
        title: "Google Calendar",
        steps: [
          "Settings → Integrations → Google Calendar → Connect.",
          "Sign in and, on Google's screen, tick the calendar permission — this is easy to miss, and without it nothing will sync.",
          "After that, a task with a day also becomes an event.",
          "Needs your own Google credentials; the Setup guide button explains where they go.",
        ],
      },
      jira: {
        title: "Jira",
        steps: [
          "Settings → Integrations → Jira.",
          "Click Create a token, make one on Atlassian's page, and copy it.",
          "Fill in your site address, your account email and the token, then Connect.",
          "While writing a task you can now pick a Jira project, and a sprint if the project has one.",
          "The task becomes a Jira issue in that sprint.",
        ],
      },
    },
    power: {
      title: "If you live in a terminal",
      blurb: "Optional, and safe to ignore.",
      cli: {
        title: "Command line and coding agents",
        steps: [
          "Settings → Integrations → Command line access has to be on.",
          "The bundled CLI can list and add tasks without opening the window.",
          "Claude Code, Codex and Cursor can be connected too, so an assistant can put things on your list for you.",
          "Everything stays on this computer, behind a token only apps running as you can read.",
        ],
      },
      updates: {
        title: "Updates",
        steps: [
          "Stepler checks for a new version when it starts.",
          "When one is ready, a button appears at the top of the window.",
          "Click it and Stepler restarts into the new version.",
          "If it cannot install itself, the button turns orange and takes you to the download instead.",
        ],
      },
    },
  },
};

const ka = {
  auth: {
    tagline: "შენი დღე — ყველა მოწყობილობაზე.",
    signIn: "შესვლა",
    signUp: "ანგარიშის შექმნა",
    email: "ელფოსტა",
    password: "პაროლი",
    google: "Google-ით გაგრძელება",
    or: "ან",
    toSignUp: "ჯერ არ გაქვს ანგარიში? შექმენი",
    toSignIn: "უკვე გაქვს ანგარიში? შედი",
    signOut: "გასვლა",
    backToSite: "← საიტზე დაბრუნება",
    working: "ერთი წამი…",
    syncing: "სინქრონიზაცია…",
    synced: "დასინქრონიზდა",
    offline: "ქსელი არ არის — შენახულია, მოგვიანებით დასინქრონდება",
    errors: {
      invalidEmail: "ეს ელფოსტის მისამართს არ ჯგავს.",
      wrongPassword: "არასწორი ელფოსტა ან პაროლი.",
      emailInUse: "ამ ელფოსტაზე ანგარიში უკვე არსებობს. სცადე შესვლა.",
      weakPassword: "საჭიროა მინიმუმ 6 სიმბოლო.",
      tooMany: "ზედმეტი მცდელობა. დაელოდე წუთი.",
      popupClosed: "Google-ის ფანჯარა დაიხურა შესვლამდე.",
      network: "სერვერთან კავშირი არ არის.",
      generic: "შესვლა ვერ მოხერხდა. სცადე თავიდან.",
    },
  },
  dates: {
    months: [
      "იანვარი",
      "თებერვალი",
      "მარტი",
      "აპრილი",
      "მაისი",
      "ივნისი",
      "ივლისი",
      "აგვისტო",
      "სექტემბერი",
      "ოქტომბერი",
      "ნოემბერი",
      "დეკემბერი",
    ],
    monthsShort: [
      "იან",
      "თებ",
      "მარ",
      "აპრ",
      "მაი",
      "ივნ",
      "ივლ",
      "აგვ",
      "სექ",
      "ოქტ",
      "ნოე",
      "დეკ",
    ],
    weekdays: [
      "კვირა",
      "ორშაბათი",
      "სამშაბათი",
      "ოთხშაბათი",
      "ხუთშაბათი",
      "პარასკევი",
      "შაბათი",
    ],
    weekdaysShort: ["კვი", "ორშ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ"],
  },

  menu: {
    about: "Stepler-ის შესახებ",
    settings: "პარამეტრები…",
    edit: "რედაქტირება",
    view: "ხედი",
    searchTasks: "დავალებების ძებნა",
    newTask: "ახალი დავალება",
    window: "ფანჯარა",
    showStepler: "Stepler-ის ჩვენება",
    quit: "გასვლა",
  },

  common: {
    connect: "დაკავშირება",
    disconnect: "გათიშვა",
    close: "დახურვა",
    save: "შენახვა",
    clear: "გასუფთავება",
    cancel: "გაუქმება",
    delete: "წაშლა",
    copy: "კოპირება",
    preview: "წინასწარი ნახვა",
    open: "გახსნა",
    settings: "პარამეტრები",
    saveAs: "შენახვა როგორც…",
    copyFile: "ფაილის კოპირება",
    copyImage: "სურათის კოპირება",
    removeAttachment: "დანართის მოშორება",
  },

  app: {
    toggleSidebar: "გვერდითი პანელი",
    hideCompleted: "დასრულებულების დამალვა",
    showAll: "ყველას ჩვენება",
    allDone: "აქ ყველაფერი დასრულებულია და დამალული.",
    nothingToday: "დღეს ჯერ არაფერია. დაიწყე წერა ქვემოთ.",
    jumpNewest: "უახლეს დავალებაზე გადასვლა",
    showPreviousWeek: "წინა კვირის ჩვენება",
    today: "დღეს",
    tomorrow: "ხვალ",
    counter: "{done} / {total} დღეს",
  },

  toast: {
    attachmentFailed: "დანართის შენახვა ვერ მოხერხდა",
    gcalFailed: "Google Calendar-ში დამატება ვერ მოხერხდა",
    gcalUnreachable: "Google Calendar მიუწვდომელია",
    jiraFailed: "Jira: {error}",
    jiraNoIssue: "ამოცანის შექმნა ვერ მოხერხდა",
    jiraSprint: "{key} შეიქმნა, მაგრამ {error}",
    exported: "ექსპორტი დასრულდა",
    exportFailed: "ექსპორტი ვერ შესრულდა",
    importFailed: "იმპორტი ვერ შესრულდა",
    imported: {
      one: "იმპორტირდა {count} დავალება",
      other: "იმპორტირდა {count} დავალება",
    },
    nothingToImport: "ახალი არაფერია იმპორტისთვის",
    filePathCopied: "ფაილის მისამართი დაკოპირდა",
    fileCopied: "ფაილი დაკოპირდა",
    imageCopied: "სურათი დაკოპირდა",
    copied: "დაკოპირდა",
    copyFailed: "კოპირება ვერ მოხერხდა",
    taskCopied: "დავალება დაკოპირდა",
    taskAndImageCopied: "დავალება და სურათი დაკოპირდა",
    fileTooLarge: "ეს ფაილი 64 მბ-ზე დიდია",
    gcalDisconnected: "Google Calendar გათიშულია",
    jiraDisconnected: "Jira გათიშულია",
    jiraConnected: "Jira-სთან დაკავშირდი როგორც {name}",
    restartToApply: "ცვლილების ასამოქმედებლად გადატვირთე Stepler",
  },

  task: {
    dragHint: "გადაათრიე გადასალაგებლად ან ჩასადგმელად",
    markDone: "დასრულებულად მონიშვნა",
    markNotDone: "დაუსრულებლად მონიშვნა",
    removeProject: "პროექტის მოშორება",
    remove: "მოშორება",
    deleteSubtask: "ქვედავალების წაშლა",
    newSubtask: "ახალი ქვედავალება…",
    addSubtask: "ქვედავალების დამატება",
    newProject: "ახალი პროექტი…",
    subtask: "ქვედავალება",
    priority: "პრიორიტეტი",
    project: "პროექტი",
    remind: "შეხსენება",
    viewInCalendar: "ნახვა Google Calendar-ში",
    openInJira: "გახსნა Jira-ში",
    carryOver: "დააკოპირე ეს ჩანაწერი დღევანდელში, რომ ისევ იმუშაო მასზე",
    moveToToday: "დღევანდელში გადატანა",
  },

  input: {
    prompt: "რაზე ფიქრობ?",
    collapse: "აკეცვა",
    expand: "გაშლა",
    removeDate: "თარიღის მოშორება",
    newShort: "ახალი...",
    projects: "პროექტები",
    jiraProject: "Jira პროექტი",
    backlog: "Backlog",
    clearJiraProject: "Jira პროექტის გასუფთავება",
    attach: "სურათის ან ფაილის მიმაგრება",
    dictate: "კარნახი",
    dictateHint: "კარნახის დაწყება (Fn ორჯერ)",
    addTask: "დავალების დამატება",
  },

  search: {
    placeholder: "მოძებნე დავალებები, პროექტები, ფაილები…",
    noResults: "დავალებები ვერ მოიძებნა",
    close: "დახურვა (Esc)",
  },

  file: {
    noPreview: "ამ ტიპის ფაილის წინასწარი ნახვა შეუძლებელია",
    openInSystem: "სისტემურ აპში გახსნა",
  },

  trash: {
    title: "წაშლილი დავალებები",
    inTrash: {
      one: "სანაგვეშია {count} დავალება",
      other: "სანაგვეშია {count} დავალება",
    },
    empty: "სანაგვე ცარიელია",
    emptyHint: "წაშლილი დავალებები აქ გამოჩნდება",
    deletedAt: "წაიშალა {when}",
    justNow: "ახლახან",
    minutesAgo: "{count} წთ წინ",
    hoursAgo: "{count} სთ წინ",
    completed: "დასრულებული",
    subtaskCount: {
      one: "{count} ქვედავალება",
      other: "{count} ქვედავალება",
    },
    restore: "დავალების აღდგენა",
    deleteForever: "სამუდამოდ წაშლა",
    persistNote: "წაშლილი დავალებები რჩება, სანამ არ გაასუფთავებ",
    clearAll: "ყველას გასუფთავება",
  },

  sidebar: {
    projects: "პროექტები",
    allProjects: "ყველა პროექტი",
    trash: "სანაგვე",
    noProjects: "პროექტები ვერ მოიძებნა.",
    projectTasks: {
      one: "{name} — {count} დავალება",
      other: "{name} — {count} დავალება",
    },
  },

  update: {
    reveal:
      "\u10E4\u10D0\u10D8\u10DA\u10D8\u10E1 \u10E9\u10D5\u10D4\u10DC\u10D4\u10D1\u10D0",
    revealed:
      "{name} \u10D0\u10E0\u10D8\u10E1 Downloads-\u10E8\u10D8 \u2014 \u10D2\u10D0\u10D0\u10EE\u10D0\u10E0\u10D8\u10E1\u10EE\u10D4\u10D7 \u10D3\u10D0 \u10E9\u10D0\u10D0\u10D2\u10D3\u10D4\u10D7 Applications-\u10E8\u10D8.",
    revealFailed:
      "\u10E9\u10D0\u10DB\u10DD\u10E2\u10D5\u10D8\u10E0\u10D7\u10E3\u10DA\u10D8 \u10D0\u10E1\u10DA\u10D8 \u10D0\u10E0 \u10D0\u10E0\u10D8\u10E1 \u2014 \u10D5\u10EE\u10E1\u10DC\u10D8\u10D7 \u10D2\u10D5\u10D4\u10E0\u10D3\u10E1.",
    checkNow: "განახლების შემოწმება",
    newAvailable: "ახალი ვერსია მზადია",
    checking: "მოწმება…",
    upToDate: "გაქვთ უახლესი ვერსია",
    neverChecked: "ჯერ არ შემოწმებულა",
    unavailable: "ამ ასლში განახლებები მიუწვდომელია",
    version: "ვერსია {version}",
    downloading: "ახალი ვერსია იწერება",
    updating: "განახლება…",
    update: "განახლება",
    updateTo: "განახლება {version}-ზე",
    install: "დააყენე {version}",
    restartTo: "გადატვირთე, რომ განახლდეს {version}-ზე",
    theNewVersion: "ახალ ვერსიაზე",
    unknownError: "უცნობი შეცდომა",
    replaceFailed:
      "Stepler-მა საკუთარი თავის ჩანაცვლება ვერ შეძლო ({error}). ჩამოტვირთული ბილდი Downloads საქაღალდეში მოხვდება.",
  },

  collab: {
    title:
      "\u10D7\u10D0\u10DC\u10D0\u10DB\u10E8\u10E0\u10DD\u10DB\u10DA\u10DD\u10D1\u10D0",
    yourHandle:
      "\u10D7\u10E5\u10D5\u10D4\u10DC\u10D8 \u10DB\u10D8\u10DB\u10D0\u10E0\u10D7\u10D5\u10D0 \u2014 \u10D0\u10DB\u10D8\u10D7 \u10D2\u10D8\u10EE\u10E1\u10D4\u10DC\u10D4\u10D1\u10D4\u10DC",
    noHandle:
      "\u10DB\u10D8\u10DB\u10D0\u10E0\u10D7\u10D5\u10D0 \u10D2\u10D0\u10DB\u10DD\u10E3\u10E7\u10D4\u10DC\u10D4\u10D1\u10D4\u10DA\u10D8\u10D0",
    find: "\u10D8\u10DE\u10DD\u10D5\u10D4 \u10D0\u10D3\u10D0\u10DB\u10D8\u10D0\u10DC\u10D8",
    searchPlaceholder:
      "\u10DB\u10D8\u10DB\u10D0\u10E0\u10D7\u10D5\u10D0 \u10D0\u10DC \u10E4\u10DD\u10E1\u10E2\u10D0",
    noResults:
      "\u10D0\u10E0\u10D0\u10D5\u10D8\u10DC \u10DB\u10DD\u10D8\u10EB\u10D4\u10D1\u10DC\u10D0 \u201C{term}\u201D-\u10D6\u10D4.",
    invite: "\u10DB\u10DD\u10EC\u10D5\u10D4\u10D5\u10D0",
    invited: "\u10DB\u10DD\u10EC\u10D5\u10D4\u10E3\u10DA\u10D8\u10D0",
    accept: "\u10DB\u10D8\u10E6\u10D4\u10D1\u10D0",
    decline: "\u10E3\u10D0\u10E0\u10D9\u10D5\u10D0",
    connected:
      "\u10D3\u10D0\u10D9\u10D0\u10D5\u10E8\u10D8\u10E0\u10D4\u10D1\u10E3\u10DA\u10D8",
    waiting: "\u10DA\u10DD\u10D3\u10D8\u10DC\u10E8\u10D8",
    disconnect: "\u10D2\u10D0\u10DC\u10D7\u10D8\u10E8\u10D5\u10D0",
    incoming:
      "\u10D3\u10D0\u10D9\u10D0\u10D5\u10E8\u10D8\u10E0\u10D4\u10D1\u10D0 \u10E1\u10E3\u10E0\u10E1",
    connections:
      "\u10D7\u10E5\u10D5\u10D4\u10DC\u10D8 \u10D0\u10D3\u10D0\u10DB\u10D8\u10D0\u10DC\u10D4\u10D1\u10D8",
    noneYet:
      "\u10D2\u10D0\u10DB\u10DD\u10D8\u10EB\u10D4\u10D1\u10DC\u10D4\u10D7 \u10D0\u10D3\u10D0\u10DB\u10D8\u10D0\u10DC\u10D8 \u10D6\u10D4\u10DB\u10DD\u10D7.",
    hint: "\u10D3\u10D0\u10D9\u10D0\u10D5\u10E8\u10D8\u10E0\u10D4\u10D1\u10D8\u10E1 \u10E8\u10D4\u10DB\u10D3\u10D4\u10D2 \u10D3\u10D0\u10D0\u10DB\u10D0\u10E2\u10D4\u10D7 @\u10DB\u10D8\u10DB\u10D0\u10E0\u10D7\u10D5\u10D0 \u10D3\u10D0\u10D5\u10D0\u10DA\u10D4\u10D1\u10D0\u10E8\u10D8 \u2014 \u10D8\u10E1 \u10DB\u10D0\u10E1\u10D0\u10E3\u10EA \u10D2\u10D0\u10DB\u10DD\u10E9\u10DC\u10D3\u10D4\u10D1\u10D0. \u10E8\u10D4\u10E3\u10EB\u10DA\u10D8\u10D0 \u10EC\u10D0\u10D9\u10D8\u10D7\u10EE\u10D5\u10D0, \u10DB\u10D0\u10D2\u10E0\u10D0\u10DB \u10D0\u10E0 \u10E8\u10D4\u10EA\u10D5\u10DA\u10D0.",
    mentionedYou:
      "\u10D2\u10D8\u10EE\u10E1\u10D4\u10DC\u10D4\u10D1\u10D0\u10D7",
    markRead: "\u10D2\u10D0\u10D5\u10D8\u10D2\u10D4",
    dismiss:
      "\u10E9\u10D4\u10DB\u10D8 \u10E1\u10D8\u10D8\u10D3\u10D0\u10DC \u10DB\u10DD\u10EA\u10D8\u10DA\u10D4\u10D1\u10D0",
    dismissHint:
      "\u10D4\u10E1 \u10DB\u10EE\u10DD\u10DA\u10DD\u10D3 \u10D7\u10E5\u10D5\u10D4\u10DC\u10D8 \u10E1\u10D8\u10D8\u10D3\u10D0\u10DC \u10E8\u10DA\u10D8\u10E1 \u2014 \u10D0\u10D5\u10E2\u10DD\u10E0\u10E1 \u10D3\u10D0\u10D5\u10D0\u10DA\u10D4\u10D1\u10D0 \u10E0\u10E9\u10D4\u10D1\u10D0.",
    showMentions:
      "\u10DB\u10EE\u10DD\u10DA\u10DD\u10D3 \u10D8\u10E1, \u10E1\u10D0\u10D3\u10D0\u10EA \u10D2\u10D8\u10EE\u10E1\u10D4\u10DC\u10D4\u10D1\u10D4\u10DC ({count})",
    showAll:
      "\u10E7\u10D5\u10D4\u10DA\u10D0\u10E4\u10D4\u10E0\u10D8\u10E1 \u10E9\u10D5\u10D4\u10DC\u10D4\u10D1\u10D0",
    noMentions:
      "\u10E1\u10D0\u10D3\u10D0\u10EC\u10D4\u10E0\u10D8 \u10D0\u10E0\u10D0\u10D5\u10D8\u10DC \u10D2\u10D8\u10EE\u10E1\u10D4\u10DC\u10D8\u10D4\u10D1\u10D8\u10D0.",
    failed:
      "\u10D5\u10D4\u10E0 \u10D2\u10D0\u10DC\u10EE\u10DD\u10E0\u10EA\u10D8\u10D4\u10DA\u10D3\u10D0. \u10E1\u10EA\u10D0\u10D3\u10D4\u10D7 \u10D7\u10D0\u10D5\u10D8\u10D3\u10D0\u10DC.",
    toastInvited:
      "\u10DB\u10DD\u10EC\u10D5\u10D4\u10D5\u10D0 \u10D2\u10D0\u10D8\u10D2\u10D6\u10D0\u10D5\u10DC\u10D0",
    toastAccepted:
      "\u10D3\u10D0\u10D9\u10D0\u10D5\u10E8\u10D8\u10E0\u10D3\u10D8\u10D7",
    toastRemoved: "\u10D2\u10D0\u10DC\u10D7\u10D8\u10E8\u10D3\u10D8\u10D7",
  },
  settings: {
    sync: {
      title: "ანგარიში და სინქრონიზაცია",
      blurb:
        "შედი და შენი დავალებები გეყოლება — ვებზეც და სხვა კომპიუტერებზეც.",
      browserNote: "Google-ით შესვლა ბრაუზერში გაიხსნება.",
      offBlurb: "არ ხარ შესული. დავალებები მხოლოდ ამ კომპიუტერში რჩება.",
      states: {
        off: "არ სინქრონიზდება",
        "signing-in": "შესვლა…",
        syncing: "სინქრონიზაცია…",
        synced: "ყველაფერი დასინქრონიზდა",
        error: "სინქრონიზაციის პრობლემა",
      },
    },
    title: "პარამეტრები",
    tabs: {
      general: "ზოგადი",
      projects: "პროექტები",
      integrations: "ინტეგრაციები",
      collab: "თანამშრომლობა",
      guide: "გზამკვლევი",
      data: "მონაცემები",
      trash: "სანაგვე",
    },
    general: {
      title: "ზოგადი",
      appearance: "გარეგნობა",
      light: "ნათელი",
      dark: "მუქი",
      system: "სისტემური",
      language: "ენა",
      languageHint: "მენიუ, ღილაკები და გზამკვლევი მაშინვე იცვლება.",
      shortcut: "გლობალური მალსახმობი",
      change: "შეცვლა",
      recording: "დააჭირე ახალ კომბინაციას… (Esc — გაუქმება)",
      shortcutHint:
        "დააჭირე ამ კომბინაციას ნებისმიერი აპიდან, რომ Stepler გამოჩნდეს ან დაიმალოს.",
      shortcutError:
        "გამოიყენე ⌘, ⌃ ან ⌥ სულ მცირე ერთი მათგანი სხვა ღილაკთან ერთად.",
      behaviour: "ქცევა",
      captureSelection: "მონიშნული ტექსტის თან წამოღება",
      captureSelectionHint:
        "სხვა აპში მონიშნული ტექსტი პირდაპირ შეტანის ველში ხვდება, როცა Stepler-ს მალსახმობით გახსნი. ბუფერი უცვლელად ბრუნდება.",
      escToHide: "დამალვა Esc-ით",
      escToHideHint: "დააჭირე Esc-ს ცარიელ ველზე და ფანჯარა გაქრება.",
    },
    projects: {
      title: "პროექტები",
      placeholder: "შეიყვანე პროექტის სახელი…",
      empty:
        "შენახული პროექტები ჯერ არ არის. დავალებაზე აკრეფილი პროექტები აქ ავტომატურად გამოჩნდება.",
      pin: "თავში მიმაგრება",
      rename: "სახელის შეცვლა",
      removeSaved: "შენახული სიიდან ამოღება",
    },
    integrations: {
      title: "ინტეგრაციები",
      blurb:
        "აქ ყველაფერი გამორთულია, სანამ თავად არ ჩართავ. სხვა შემთხვევაში არაფერი ტოვებს ამ კომპიუტერს.",
      gcalNeedsCreds: "საჭიროა შენი Google OAuth მონაცემები.",
      gcalConnected: "დაკავშირებულია",
      gcalBlurb: "შექმენი მოვლენა იმ დავალებებისთვის, რომლებსაც თარიღი აქვს.",
      gcalCredsBefore:
        "Stepler-ს საკუთარი მონაცემები არ მოჰყვება, რომ არავინ ისესხოს სხვისი. დაარეგისტრირე შენი OAuth აპლიკაცია და ჩასვი id და secret ფაილში",
      gcalCredsAfter: "მონაცემების საქაღალდეში.",
      openDataFolder: "მონაცემების საქაღალდის გახსნა",
      setupGuide: "დაყენების გზამკვლევი",
      autoEvents: "მოვლენების ავტომატური შექმნა",
      autoEventsHint: "მხოლოდ იმ დავალებებისთვის, რომლებსაც თარიღი აქვს.",
      signInFailed: "შესვლა ვერ დაიწყო",
      jiraBlurb:
        "შექმენი Jira-ს ამოცანები პირდაპირ ჩანაწერიდან, შენ მიერ არჩეულ სპრინტში.",
      jiraNote:
        "Atlassian-ს არ აქვს შესვლის ისეთი გზა, რომელსაც ჩამოსატვირთი აპი მოიტანდა, ამიტომ Stepler იყენებს API ტოკენს, რომელსაც თავად ქმნი. ის დაშიფრულად ინახება ამ კომპიუტერზე და არსად არ მიდის.",
      jiraEmail: "შენი Atlassian ანგარიშის ელფოსტა",
      jiraToken: "API ტოკენი",
      jiraChecking: "მოწმდება…",
      jiraCreateToken: "ტოკენის შექმნა",
      jiraUseOauth: "სანაცვლოდ OAuth-ის გამოყენება",
      jiraConnectFailed: "დაკავშირება ვერ მოხერხდა",
      remindersBlurb: "თარიღიანი დავალებების ასახვა Reminders-ში.",
      cli: "ბრძანების სტრიქონის წვდომა",
      cliBlurb:
        "საშუალებას აძლევს თანდართულ CLI-ს დაამატოს და აჩვენოს დავალებები 127.0.0.1-ზე. საჭიროა ტოკენი, რომელსაც მხოლოდ ამ კომპიუტერის აპები კითხულობენ.",
    },
    data: {
      title: "მონაცემების მართვა",
      export: "ექსპორტი",
      exportBlurb: "ერთი JSON ფაილი ყველა დავალებით, დანართების ჩათვლით.",
      import: "იმპორტი",
      importBlurb:
        "დააბრუნე ექსპორტი უკან. არსებული დავალებები არასდროს გადაიწერება.",
      backupNote:
        "Stepler ყოველ გაშვებაზე ინახავს წინა მონაცემების სარეზერვო ასლს, შენს დავალებებთან ერთად აპის მონაცემების საქაღალდეში.",
    },
  },

  guide: {
    heading: "როგორ მუშაობს Stepler",
    intro:
      "მოკლე პასუხები კითხვაზე „როგორ…“. გახსენი ნებისმიერი ხაზი ნაბიჯებისთვის.",
    searchPlaceholder:
      "მოძებნე გზამკვლევში — შეხსენება, სპრინტი, სარეზერვო ასლი…",
    noMatch: "აქ არაფერი ემთხვევა „{query}“-ს.",
    start: {
      title: "დასაწყისი",
      blurb: "მთელი აპი სამ მოძრაობაში.",
      write: {
        title: "ჩაიწერე რაღაც",
        steps: [
          "დააჭირე ქვემოთ მდებარე ველს ან {mod}N-ს.",
          "აკრიფე საქმე. დააჭირე Enter-ს.",
          "ის გამოჩნდება დღევანდელ სიაში, ველის ზემოთ.",
        ],
      },
      tick: {
        title: "მონიშნე შესრულებულად",
        steps: [
          "დააჭირე წრეს დავალების მარცხნივ.",
          "ის რჩება იმ დღეს, გადახაზული, რომ ნახო რა იყო ამ დღეს.",
          "გადაიფიქრე? კიდევ ერთხელ დააჭირე წრეს.",
        ],
      },
      around: {
        title: "გაერკვიე ინტერფეისში",
        steps: [
          "დღევანდელი დღე ქვემოთაა, იმ ველის გვერდით, სადაც კრეფ.",
          "აწიე ზემოთ, რომ წინა დღეებში გადაიაროთ.",
          "ზედა მარჯვენა კუთხის მრიცხველი აჩვენებს, რამდენია დღეს გაკეთებული.",
        ],
      },
    },
    open: {
      title: "Stepler-ის გახსნა ნებისმიერი ადგილიდან",
      blurb: "მისი ძებნა არასდროს არ უნდა მოგიწიოს.",
      shortcut: {
        title: "მალსახმობი",
        steps: [
          "დააჭირე {hotkey}-ს ნებისმიერ აპში და Stepler წინ წამოვა.",
          "კიდევ ერთხელ დააჭირე, ან Esc-ს, და ის გაქრება.",
          "კომბინაციის შეცვლა შეგიძლია პარამეტრები → ზოგადი.",
        ],
      },
      selection: {
        title: "მონიშნული ტექსტის თან წამოღება",
        steps: [
          "პირველად macOS ითხოვს ნებართვას, რომ Stepler-მა წაიკითხოს მონიშნული: მონიშნე Stepler აქ — System Settings → Privacy & Security → Accessibility. ამის გარეშე ვერ იმუშავებს.",
          "მონიშნე ტექსტი სადმე — წერილში, გვერდზე, ჩატში.",
          "დააჭირე {hotkey}-ს.",
          "ტექსტი უკვე ველშია და გელოდება. დაამატე ან დააჭირე Enter-ს.",
          "ბუფერი ზუსტად ისე რჩება, როგორც გქონდა.",
          "თუ არ გინდა, გამორთე პარამეტრები → ზოგადი.",
        ],
      },
    },
    details: {
      title: "თარიღები, დრო და შეხსენებები",
      blurb: "იმ საქმეებისთვის, რომლებიც კონკრეტულ მომენტში უნდა მოხდეს.",
      day: {
        title: "მიაკუთვნე დავალებას დღე",
        steps: [
          "Enter-ზე დაჭერამდე დააჭირე ერთ-ერთ დღეს ველის ქვემოთ.",
          "დავალებას ეს დღე პატარა ლურჯ ჭდედ მიჰყვება.",
          "დღე წერის დროს უნდა აირჩიო — მოგვიანებით ვერ დაამატებ.",
        ],
      },
      notification: {
        title: "მიიღე შეტყობინება",
        steps: [
          "მიიტანე კურსორი დავალებაზე და დააჭირე ზარს.",
          "აირჩიე დრო და დაადასტურე.",
          "იმ დროს კომპიუტერი გაჩვენებს შეტყობინებას დავალებით.",
          "შეტყობინების მისაღებად Stepler გაშვებული უნდა იყოს.",
        ],
      },
      important: {
        title: "მონიშნე მნიშვნელოვანი",
        steps: [
          "მიიტანე კურსორი დავალებაზე და დააჭირე ვარსკვლავს.",
          "მონიშნული დავალებები დღის ბოლოში გადადის, სადაც ბოლოს იხედები.",
        ],
      },
    },
    organise: {
      title: "წესრიგის შენარჩუნება",
      blurb: "მხოლოდ იმდენი სტრუქტურა, რამდენიც მართლა გინდა.",
      projects: {
        title: "პროექტები",
        steps: [
          "წერისას დააჭირე პროექტის სახელს ველის ქვემოთ, ან აკრიფე ახალი „ახალი…“-ს გვერდით.",
          "დააჭირე პროექტს მარცხენა პანელში, რომ მხოლოდ მისი დავალებები დაინახო.",
          "პროექტების სახელის შეცვლა ან წაშლა — პარამეტრები → პროექტები.",
        ],
      },
      subtasks: {
        title: "ქვედავალებები",
        steps: [
          "მიიტანე კურსორი დავალებაზე და დააჭირე „ქვედავალება“.",
          "აკრიფე პატარა ნაბიჯი და დააჭირე Enter-ს.",
          "ქვედავალებები დამოუკიდებლად ინიშნება და მშობელ დავალებას ქვემოთ უდგას.",
        ],
      },
      files: {
        title: "ფაილები და სურათები",
        steps: [
          "ჩასვი სურათი პირდაპირ ველში, ან დააჭირე + ფაილის ასარჩევად.",
          "დააჭირე დავალების დანართს წინასწარი ნახვისთვის.",
          "ფაილები ნამდვილ ფაილებად ინახება — შეგიძლია გადმოაკოპირო ან სადმე შეინახო.",
        ],
      },
      search: {
        title: "ძებნა",
        steps: [
          "დააჭირე {mod}F-ს.",
          "აკრიფე რაც გინდა: დავალების ტექსტი, ქვედავალება, პროექტი, თუნდაც ფაილის სახელი.",
          "იმოძრავე ისრებით, დააჭირე Enter-ს, რომ ტაიმლაინში გადახვიდე.",
        ],
      },
    },
    collaborate: {
      title: "სხვებთან ერთად",
      blurb: "დაამკავშირეთ ადამიანი და მიანიშნეთ დავალებაში.",
      connect: {
        title: "დაკავშირება",
        steps: [
          "გახსენით პარამეტრები და აირჩიეთ „თანამშრომლობა“.",
          "ზედა თქვენი მიმართვაა — იგი ფოსტიდან მოდის.",
          "მოემის ადამიანი მიმართვით ან ფოსტით და დაათითეთ „მოწვევა“.",
          "სანამ ის დაადასტურებს, არაფერი გაზიარდება.",
        ],
      },
      mention: {
        title: "დავალებაში მითითება",
        steps: [
          "დავალების ველში აკრეფეთ @ და აირკიეთ ადამიანი.",
          "დაასრულეთ დავალება და დაათითეთ Enter.",
          "ასლი მივა მასთან იმავე დღეს.",
          "მას აკითხვს; შეცვლა მხოლოდ თქვენ შეგიძლიათ.",
        ],
      },
      inbox: {
        title: "როცა თქვენ გიხსენებენ",
        steps: [
          "მარჯვენა ქვედა გამოჩნდება @ ღილაკი რიცხვით.",
          "დაათითეთ — დარჩება მხოლოდ ის, სადაც გიხსენებენ.",
          "დაათითეთ კვლავ და დაბრუნდება ყველაფერი.",
        ],
      },
    },
    safety: {
      title: "არაფერი იკარგება",
      blurb: "რა ემართება იმას, რასაც ასრულებ ან შლი.",
      trash: {
        title: "სანაგვე",
        steps: [
          "შემთხვევით წაშალე დავალება? დააჭირე სანაგვეს გვერდით პანელში.",
          "იპოვე და დააბრუნე.",
          "ბოლო 500 წაშლილი დავალება ინახება.",
        ],
      },
      past: {
        title: "წარსული დღეები",
        steps: [
          "აწიე ზემოთ დღევანდელს, რომ ნებისმიერი წინა დღე წაიკითხო.",
          "რაღაც ისევ აქტუალურია? ჩამოათრიე დღევანდელზე, რომ გადმოიტანო.",
        ],
      },
      data: {
        title: "შენი მონაცემები",
        steps: [
          "ყველაფერი ამ კომპიუტერის საქაღალდეშია და სხვაგან არსად.",
          "პარამეტრები → მონაცემები ყველაფერს ერთ ფაილად გაიტანს, დანართებიანად.",
          "იგივე ფაილი უკან შემოაქვს — ამ მანქანაზე ან სხვაზე.",
          "სარეზერვო ასლი ავტომატურად ინახება ყოველ ჯერზე, როცა Stepler წესიერად იშვება.",
        ],
      },
    },
    connect: {
      title: "სხვა აპების დაკავშირება",
      blurb: "ყველა არჩევითია და გამორთულია, სანამ არ ჩართავ.",
      reminders: {
        title: "Apple Reminders",
        steps: [
          "პარამეტრები → ინტეგრაციები → ჩართე Apple Reminders.",
          "ამის შემდეგ დავალება, რომელსაც დღეს ან დროს მიაკუთვნებ, Reminders-შიც გამოჩნდება.",
          "ისინი ხვდება სიაში სახელად Stepler, ასე რომ შენი სიები უცვლელი რჩება.",
          "Stepler-ში მონიშვნა Reminders-შიც ნიშნავს მას.",
          "აისახება მხოლოდ ის დავალებები, რომლებიც ჩართვის შემდეგ შეიქმნა.",
        ],
      },
      gcal: {
        title: "Google Calendar",
        steps: [
          "პარამეტრები → ინტეგრაციები → Google Calendar → დაკავშირება.",
          "შედი და Google-ის ეკრანზე მონიშნე კალენდრის ნებართვა — ადვილი გამოსატოვებელია და მის გარეშე არაფერი დასინქრონდება.",
          "ამის შემდეგ თარიღიანი დავალება მოვლენადაც იქცევა.",
          "საჭიროა შენი Google მონაცემები; ღილაკი „დაყენების გზამკვლევი“ ხსნის, სად უნდა ჩაიწეროს.",
        ],
      },
      jira: {
        title: "Jira",
        steps: [
          "პარამეტრები → ინტეგრაციები → Jira.",
          "დააჭირე „ტოკენის შექმნა“, შექმენი ის Atlassian-ის გვერდზე და დააკოპირე.",
          "შეავსე საიტის მისამართი, ანგარიშის ელფოსტა და ტოკენი, შემდეგ დააჭირე „დაკავშირება“.",
          "დავალების წერისას უკვე შეგიძლია აირჩიო Jira-ს პროექტი და სპრინტი, თუ პროექტს აქვს.",
          "დავალება იმ სპრინტში Jira-ს ამოცანად იქცევა.",
        ],
      },
    },
    power: {
      title: "თუ ტერმინალში ცხოვრობ",
      blurb: "არჩევითია და უსაფრთხოდ გამოსატოვებელი.",
      cli: {
        title: "ბრძანების სტრიქონი და კოდის აგენტები",
        steps: [
          "პარამეტრები → ინტეგრაციები → „ბრძანების სტრიქონის წვდომა“ ჩართული უნდა იყოს.",
          "თანდართულ CLI-ს შეუძლია დავალებების ჩვენება და დამატება ფანჯრის გახსნის გარეშე.",
          "Claude Code, Codex და Cursor-იც შეიძლება დაუკავშირდეს, რომ ასისტენტმა შენს სიაში ჩაგიწეროს.",
          "ყველაფერი ამ კომპიუტერზე რჩება, ტოკენის მიღმა, რომელსაც მხოლოდ შენი სახელით გაშვებული აპები კითხულობენ.",
        ],
      },
      updates: {
        title: "განახლებები",
        steps: [
          "Stepler გაშვებისას ამოწმებს ახალ ვერსიას.",
          "როცა ერთი მზადაა, ფანჯრის თავში ღილაკი ჩნდება.",
          "დააჭირე და Stepler ახალ ვერსიაში გადაიტვირთება.",
          "თუ თავად ვერ დაყენდება, ღილაკი ნარინჯისფრდება და ჩამოტვირთვაზე გადაგიყვანს.",
        ],
      },
    },
  },
};

const ru = {
  auth: {
    tagline: "Твой день — на каждом устройстве.",
    signIn: "Войти",
    signUp: "Создать аккаунт",
    email: "Почта",
    password: "Пароль",
    google: "Продолжить с Google",
    or: "или",
    toSignUp: "Ещё нет аккаунта? Создать",
    toSignIn: "Уже есть аккаунт? Войти",
    signOut: "Выйти",
    backToSite: "← На сайт Stepler",
    working: "Секунду…",
    syncing: "Синхронизация…",
    synced: "Синхронизировано",
    offline: "Нет сети — сохранено, синхронизируется позже",
    errors: {
      invalidEmail: "Это не похоже на адрес почты.",
      wrongPassword: "Неверная почта или пароль.",
      emailInUse: "На эту почту аккаунт уже есть. Попробуй войти.",
      weakPassword: "Нужно хотя бы шесть символов.",
      tooMany: "Слишком много попыток. Подожди минуту.",
      popupClosed: "Окно Google закрылось раньше, чем вход завершился.",
      network: "Нет связи с сервером.",
      generic: "Войти не удалось. Попробуй ещё раз.",
    },
  },
  menu: {
    about: "О Stepler",
    settings: "Настройки…",
    edit: "Правка",
    view: "Вид",
    searchTasks: "Поиск задач",
    newTask: "Новая задача",
    window: "Окно",
    showStepler: "Показать Stepler",
    quit: "Выйти",
  },

  common: {
    connect: "Подключить",
    disconnect: "Отключить",
    close: "Закрыть",
    save: "Сохранить",
    clear: "Очистить",
    cancel: "Отмена",
    delete: "Удалить",
    copy: "Копировать",
    preview: "Просмотр",
    open: "Открыть",
    settings: "Настройки",
    saveAs: "Сохранить как…",
    copyFile: "Копировать файл",
    copyImage: "Копировать изображение",
    removeAttachment: "Убрать вложение",
  },

  app: {
    toggleSidebar: "Боковая панель",
    hideCompleted: "Скрыть выполненные",
    showAll: "Показать все",
    allDone: "Здесь всё сделано и скрыто.",
    nothingToday: "Сегодня пока пусто. Начните печатать ниже.",
    jumpNewest: "К самой свежей задаче",
    showPreviousWeek: "Показать прошлую неделю",
    today: "Сегодня",
    tomorrow: "Завтра",
    counter: "{done} / {total} сегодня",
  },

  toast: {
    attachmentFailed: "Не удалось сохранить вложение",
    gcalFailed: "Не удалось добавить в Google Календарь",
    gcalUnreachable: "Google Календарь недоступен",
    jiraFailed: "Jira: {error}",
    jiraNoIssue: "не удалось создать задачу",
    jiraSprint: "{key} создана, но {error}",
    exported: "Экспортировано",
    exportFailed: "Не удалось экспортировать",
    importFailed: "Не удалось импортировать",
    imported: {
      one: "Импортирована {count} задача",
      few: "Импортировано {count} задачи",
      many: "Импортировано {count} задач",
      other: "Импортировано {count} задач",
    },
    nothingToImport: "Нового для импорта нет",
    filePathCopied: "Путь к файлу скопирован",
    fileCopied: "Файл скопирован",
    imageCopied: "Изображение скопировано",
    copied: "Скопировано",
    copyFailed: "Не удалось скопировать",
    taskCopied: "Задача скопирована",
    taskAndImageCopied: "Задача и изображение скопированы",
    fileTooLarge: "Этот файл больше 64 МБ",
    gcalDisconnected: "Google Календарь отключён",
    jiraDisconnected: "Jira отключена",
    jiraConnected: "Подключено к Jira как {name}",
    restartToApply: "Перезапустите Stepler, чтобы изменение вступило в силу",
  },

  task: {
    dragHint: "Перетащите, чтобы переставить или вложить",
    markDone: "Отметить выполненной",
    markNotDone: "Снять отметку",
    removeProject: "Убрать проект",
    remove: "Убрать",
    deleteSubtask: "Удалить подзадачу",
    newSubtask: "Новая подзадача…",
    addSubtask: "Добавить подзадачу",
    newProject: "Новый проект…",
    subtask: "Подзадача",
    priority: "Приоритет",
    project: "Проект",
    remind: "Напомнить",
    viewInCalendar: "Открыть в Google Календаре",
    openInJira: "Открыть в Jira",
    carryOver: "Скопировать эту запись в сегодня, чтобы вернуться к ней",
    moveToToday: "Перенести в сегодня",
  },

  input: {
    prompt: "О чём думаете?",
    collapse: "Свернуть",
    expand: "Развернуть",
    removeDate: "Убрать дату",
    newShort: "Новый...",
    projects: "Проекты",
    jiraProject: "Проект Jira",
    backlog: "Бэклог",
    clearJiraProject: "Очистить проект Jira",
    attach: "Прикрепить изображение или файл",
    dictate: "Диктовка",
    dictateHint: "Начать диктовку (Fn дважды)",
    addTask: "Добавить задачу",
  },

  search: {
    placeholder: "Поиск по задачам, проектам, файлам…",
    noResults: "Задачи не найдены",
    close: "Закрыть (Esc)",
  },

  file: {
    noPreview: "Просмотр для этого типа файла недоступен",
    openInSystem: "Открыть в системном приложении",
  },

  trash: {
    title: "Удалённые задачи",
    inTrash: {
      one: "{count} задача в корзине",
      few: "{count} задачи в корзине",
      many: "{count} задач в корзине",
      other: "{count} задач в корзине",
    },
    empty: "Корзина пуста",
    emptyHint: "Удалённые задачи появятся здесь",
    deletedAt: "Удалено {when}",
    justNow: "только что",
    minutesAgo: "{count} мин назад",
    hoursAgo: "{count} ч назад",
    completed: "Выполнена",
    subtaskCount: {
      one: "{count} подзадача",
      few: "{count} подзадачи",
      many: "{count} подзадач",
      other: "{count} подзадач",
    },
    restore: "Восстановить задачу",
    deleteForever: "Удалить навсегда",
    persistNote: "Удалённые задачи хранятся, пока их не очистить",
    clearAll: "Очистить всё",
  },

  sidebar: {
    projects: "Проекты",
    allProjects: "Все проекты",
    trash: "Корзина",
    noProjects: "Проекты не найдены.",
    projectTasks: {
      one: "{name} — {count} задача",
      few: "{name} — {count} задачи",
      many: "{name} — {count} задач",
      other: "{name} — {count} задач",
    },
  },

  update: {
    reveal:
      "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0444\u0430\u0439\u043B",
    revealed:
      "{name} \u043B\u0435\u0436\u0438\u0442 \u0432 \u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u0445 \u2014 \u0440\u0430\u0441\u043F\u0430\u043A\u0443\u0439\u0442\u0435 \u0438 \u043F\u0435\u0440\u0435\u0442\u0430\u0449\u0438\u0442\u0435 Stepler \u0432 Applications.",
    revealFailed:
      "\u0421\u043A\u0430\u0447\u0430\u043D\u043D\u043E\u0439 \u043A\u043E\u043F\u0438\u0438 \u043D\u0435\u0442 \u2014 \u043E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u043C \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438.",
    checkNow: "Проверить обновления",
    newAvailable: "Готова новая версия",
    checking: "Проверяем…",
    upToDate: "У вас последняя версия",
    neverChecked: "Ещё не проверяли",
    unavailable: "В этой сборке обновления недоступны",
    version: "Версия {version}",
    downloading: "Загружается новая версия",
    updating: "Обновление…",
    update: "Обновить",
    updateTo: "Обновить до {version}",
    install: "Установить {version}",
    restartTo: "Перезапустить и обновить до {version}",
    theNewVersion: "новой версии",
    unknownError: "неизвестная ошибка",
    replaceFailed:
      "Stepler не смог заменить себя ({error}). Загруженная сборка окажется в папке «Загрузки».",
  },

  collab: {
    title:
      "\u0421\u043E\u0432\u043C\u0435\u0441\u0442\u043D\u0430\u044F \u0440\u0430\u0431\u043E\u0442\u0430",
    yourHandle:
      "\u0412\u0430\u0448 \u043D\u0438\u043A \u2014 \u0435\u0433\u043E \u043F\u0438\u0448\u0443\u0442, \u0447\u0442\u043E\u0431\u044B \u0432\u0430\u0441 \u043E\u0442\u043C\u0435\u0442\u0438\u0442\u044C",
    noHandle:
      "\u041D\u0438\u043A\u0430 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442",
    find: "\u041D\u0430\u0439\u0442\u0438 \u0447\u0435\u043B\u043E\u0432\u0435\u043A\u0430",
    searchPlaceholder:
      "\u041D\u0438\u043A \u0438\u043B\u0438 \u043F\u043E\u0447\u0442\u0430 \u2014 testeruser \u0438\u043B\u0438 name@company.com",
    noResults:
      "\u041F\u043E \u00AB{term}\u00BB \u043D\u0438\u043A\u043E\u0433\u043E \u043D\u0435 \u043D\u0430\u0448\u043B\u043E\u0441\u044C.",
    invite: "\u041F\u0440\u0438\u0433\u043B\u0430\u0441\u0438\u0442\u044C",
    invited: "\u041F\u0440\u0438\u0433\u043B\u0430\u0448\u0451\u043D",
    accept: "\u041F\u0440\u0438\u043D\u044F\u0442\u044C",
    decline: "\u041E\u0442\u043A\u043B\u043E\u043D\u0438\u0442\u044C",
    connected: "\u0421\u0432\u044F\u0437\u0430\u043D\u044B",
    waiting: "\u0416\u0434\u0451\u043C \u043E\u0442\u0432\u0435\u0442\u0430",
    disconnect:
      "\u0420\u0430\u0437\u043E\u0440\u0432\u0430\u0442\u044C \u0441\u0432\u044F\u0437\u044C",
    incoming:
      "\u0425\u043E\u0447\u0435\u0442 \u0441 \u0432\u0430\u043C\u0438 \u0441\u0432\u044F\u0437\u0430\u0442\u044C\u0441\u044F",
    connections: "\u0412\u0430\u0448\u0438 \u043B\u044E\u0434\u0438",
    noneYet:
      "\u041F\u043E\u043A\u0430 \u043D\u0438\u043A\u043E\u0433\u043E. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u0447\u0435\u043B\u043E\u0432\u0435\u043A\u0430 \u0432\u044B\u0448\u0435 \u0438 \u043F\u0440\u0438\u0433\u043B\u0430\u0441\u0438\u0442\u0435.",
    hint: "\u041A\u043E\u0433\u0434\u0430 \u0441\u0432\u044F\u0437\u044C \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430, \u043D\u0430\u043F\u0438\u0448\u0438\u0442\u0435 @\u043D\u0438\u043A \u0432 \u0437\u0430\u0434\u0430\u0447\u0435 \u2014 \u043E\u043D\u0430 \u043F\u043E\u044F\u0432\u0438\u0442\u0441\u044F \u0438 \u0443 \u043D\u0435\u0433\u043E. \u0427\u0438\u0442\u0430\u0442\u044C \u043C\u043E\u0436\u043D\u043E, \u043C\u0435\u043D\u044F\u0442\u044C \u2014 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442.",
    mentionedYou:
      "\u043E\u0442\u043C\u0435\u0442\u0438\u043B \u0432\u0430\u0441",
    markRead: "\u041F\u0440\u043E\u0447\u0438\u0442\u0430\u043D\u043E",
    dismiss:
      "\u0423\u0431\u0440\u0430\u0442\u044C \u0438\u0437 \u043C\u043E\u0435\u0433\u043E \u0441\u043F\u0438\u0441\u043A\u0430",
    dismissHint:
      "\u042D\u0442\u043E \u0443\u0431\u0435\u0440\u0451\u0442 \u0437\u0430\u0434\u0430\u0447\u0443 \u0442\u043E\u043B\u044C\u043A\u043E \u0443 \u0432\u0430\u0441 \u2014 \u0443 \u0430\u0432\u0442\u043E\u0440\u0430 \u043E\u043D\u0430 \u043E\u0441\u0442\u0430\u043D\u0435\u0442\u0441\u044F.",
    showMentions:
      "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0437\u0430\u0434\u0430\u0447\u0438 \u0441 \u0432\u0430\u0448\u0435\u0439 \u043E\u0442\u043C\u0435\u0442\u043A\u043E\u0439 ({count} \u043D\u043E\u0432\u044B\u0445)",
    showAll:
      "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0432\u0441\u0451",
    noMentions:
      "\u0412\u0430\u0441 \u043F\u043E\u043A\u0430 \u043D\u0438\u043A\u0442\u043E \u043D\u0435 \u043E\u0442\u043C\u0435\u0447\u0430\u043B.",
    failed:
      "\u041D\u0435 \u043F\u043E\u043B\u0443\u0447\u0438\u043B\u043E\u0441\u044C. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0451 \u0440\u0430\u0437.",
    toastInvited:
      "\u041F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u0435 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043E",
    toastAccepted: "\u0421\u0432\u044F\u0437\u0430\u043B\u0438\u0441\u044C",
    toastRemoved:
      "\u0421\u0432\u044F\u0437\u044C \u0440\u0430\u0437\u043E\u0440\u0432\u0430\u043D\u0430",
  },
  settings: {
    sync: {
      title: "Аккаунт и синхронизация",
      blurb:
        "Войди — и задачи будут с тобой и в вебе, и на других компьютерах.",
      browserNote: "Вход через Google откроется в браузере.",
      offBlurb: "Вход не выполнен. Задачи остаются только на этом компьютере.",
      states: {
        off: "Без синхронизации",
        "signing-in": "Вход…",
        syncing: "Синхронизация…",
        synced: "Всё синхронизировано",
        error: "Проблема с синхронизацией",
      },
    },
    title: "Настройки",
    tabs: {
      general: "Общие",
      projects: "Проекты",
      integrations: "Интеграции",
      collab: "Совместная работа",
      guide: "Руководство",
      data: "Данные",
      trash: "Корзина",
    },
    general: {
      title: "Общие",
      appearance: "Оформление",
      light: "Светлая",
      dark: "Тёмная",
      system: "Системная",
      language: "Язык",
      languageHint: "Меню, кнопки и руководство переключаются сразу.",
      shortcut: "Глобальное сочетание клавиш",
      change: "Изменить",
      recording: "Нажмите новое сочетание… (Esc — отмена)",
      shortcutHint:
        "Нажмите это сочетание в любом приложении, чтобы показать или скрыть Stepler.",
      shortcutError:
        "Используйте хотя бы одну из клавиш ⌘, ⌃ или ⌥ вместе с другой клавишей.",
      behaviour: "Поведение",
      captureSelection: "Забирать выделенный текст",
      captureSelectionHint:
        "Текст, выделенный в другом приложении, попадает в поле ввода, когда вы открываете Stepler сочетанием клавиш. Буфер обмена возвращается на место.",
      escToHide: "Скрывать по Esc",
      escToHideHint: "Нажмите Esc в пустом поле, и окно исчезнет.",
    },
    projects: {
      title: "Проекты",
      placeholder: "Введите название проекта…",
      empty:
        "Сохранённых проектов пока нет. Проекты, которые вы пишете в задаче, появляются здесь сами.",
      pin: "Закрепить сверху",
      rename: "Переименовать",
      removeSaved: "Убрать из сохранённых",
    },
    integrations: {
      title: "Интеграции",
      blurb:
        "Здесь всё выключено, пока вы сами не включите. В остальном ничего не покидает этот компьютер.",
      gcalNeedsCreds: "Нужны ваши собственные учётные данные Google OAuth.",
      gcalConnected: "Подключено",
      gcalBlurb: "Создавать событие для задач с датой.",
      gcalCredsBefore:
        "Внутри Stepler нет никаких учётных данных, чтобы никто не пользовался чужими. Зарегистрируйте своё OAuth-приложение и впишите id и secret в",
      gcalCredsAfter: "в папке с данными.",
      openDataFolder: "Открыть папку с данными",
      setupGuide: "Инструкция по настройке",
      autoEvents: "Создавать события автоматически",
      autoEventsHint: "Только для задач с датой.",
      signInFailed: "Не удалось начать вход",
      jiraBlurb: "Создавайте задачи Jira прямо из записи, в выбранном спринте.",
      jiraNote:
        "У Atlassian нет входа, который можно вшить в скачиваемое приложение, поэтому Stepler использует API-токен, который вы создаёте сами. Он хранится зашифрованным на этом компьютере и никуда не уходит.",
      jiraEmail: "Почта вашего аккаунта Atlassian",
      jiraToken: "API-токен",
      jiraChecking: "Проверяем…",
      jiraCreateToken: "Создать токен",
      jiraUseOauth: "Использовать OAuth",
      jiraConnectFailed: "Не удалось подключиться",
      remindersBlurb: "Дублировать задачи с датой в Напоминания.",
      cli: "Доступ из командной строки",
      cliBlurb:
        "Позволяет встроенному CLI добавлять и показывать задачи на 127.0.0.1. Нужен токен, который читают только приложения на этом компьютере.",
    },
    data: {
      title: "Управление данными",
      export: "Экспорт",
      exportBlurb: "Один файл JSON со всеми задачами, включая сами вложения.",
      import: "Импорт",
      importBlurb:
        "Влить экспорт обратно. Существующие задачи никогда не перезаписываются.",
      backupNote:
        "При каждом запуске Stepler сохраняет резервную копию предыдущего файла данных рядом с вашими задачами в папке приложения.",
    },
  },

  guide: {
    heading: "Как работает Stepler",
    intro:
      "Короткие ответы на «как мне…». Откройте любую строку, чтобы увидеть шаги.",
    searchPlaceholder: "Поиск по руководству — напоминание, спринт, копия…",
    noMatch: "Ничего не совпадает с «{query}».",
    start: {
      title: "С чего начать",
      blurb: "Всё приложение в трёх движениях.",
      write: {
        title: "Запишите что-нибудь",
        steps: [
          "Нажмите на поле внизу или на {mod}N.",
          "Наберите дело. Нажмите Enter.",
          "Оно появится в списке на сегодня, над полем.",
        ],
      },
      tick: {
        title: "Отметьте выполненным",
        steps: [
          "Нажмите на кружок слева от задачи.",
          "Она останется в этом дне, зачёркнутой, чтобы было видно, чем день был занят.",
          "Передумали? Нажмите на кружок ещё раз.",
        ],
      },
      around: {
        title: "Освойтесь",
        steps: [
          "Сегодня внизу, рядом с полем, в которое вы печатаете.",
          "Прокрутите вверх, чтобы пройтись по прошлым дням.",
          "Счётчик справа сверху говорит, сколько из сегодняшнего сделано.",
        ],
      },
    },
    open: {
      title: "Открыть Stepler откуда угодно",
      blurb: "Искать его не должно приходиться никогда.",
      shortcut: {
        title: "Сочетание клавиш",
        steps: [
          "Нажмите {hotkey} в любом приложении, и Stepler выйдет вперёд.",
          "Нажмите ещё раз или Esc — и он уйдёт.",
          "Сочетание можно изменить в Настройки → Общие.",
        ],
      },
      selection: {
        title: "Забрать выделенный текст с собой",
        steps: [
          "В первый раз macOS попросит разрешить Stepler читать выделенное: отметьте Stepler в System Settings → Privacy & Security → Accessibility. Без этого работать не будет.",
          "Выделите текст где угодно — в письме, на странице, в чате.",
          "Нажмите {hotkey}.",
          "Текст уже в поле и ждёт. Дополните его или нажмите Enter.",
          "Буфер обмена останется ровно таким, каким был.",
          "Если не хотите этого, выключите в Настройки → Общие.",
        ],
      },
    },
    details: {
      title: "Даты, время и напоминания",
      blurb: "Для того, что должно случиться в конкретный момент.",
      day: {
        title: "Назначьте задаче день",
        steps: [
          "Перед Enter нажмите на один из дней под полем.",
          "Задача понесёт этот день маленькой синей меткой.",
          "День выбирается во время написания — потом его добавить нельзя.",
        ],
      },
      notification: {
        title: "Получить уведомление",
        steps: [
          "Наведите курсор на задачу и нажмите колокольчик.",
          "Выберите время и подтвердите.",
          "В это время компьютер покажет уведомление с задачей.",
          "Чтобы уведомление пришло, Stepler должен быть запущен.",
        ],
      },
      important: {
        title: "Отметьте важное",
        steps: [
          "Наведите курсор на задачу и нажмите звёздочку.",
          "Отмеченные задачи уходят вниз дня, туда, куда вы смотрите последним.",
        ],
      },
    },
    organise: {
      title: "Держать в порядке",
      blurb: "Ровно столько структуры, сколько вам действительно нужно.",
      projects: {
        title: "Проекты",
        steps: [
          "Во время написания нажмите на название проекта под полем или наберите новое рядом с «Новый…».",
          "Нажмите на проект в левой панели, чтобы увидеть только его задачи.",
          "Переименовать или убрать проекты — в Настройки → Проекты.",
        ],
      },
      subtasks: {
        title: "Подзадачи",
        steps: [
          "Наведите курсор на задачу и нажмите «Подзадача».",
          "Наберите шаг поменьше и нажмите Enter.",
          "Подзадачи отмечаются сами по себе и стоят под своим родителем.",
        ],
      },
      files: {
        title: "Файлы и изображения",
        steps: [
          "Вставьте изображение прямо в поле или нажмите +, чтобы выбрать файл.",
          "Нажмите на вложение в задаче, чтобы открыть просмотр.",
          "Файлы хранятся настоящими файлами — их можно скопировать или сохранить куда угодно.",
        ],
      },
      search: {
        title: "Поиск",
        steps: [
          "Нажмите {mod}F.",
          "Наберите что угодно: текст задачи, подзадачу, проект, даже имя файла.",
          "Двигайтесь стрелками, нажмите Enter, чтобы перейти к задаче на ленте.",
        ],
      },
    },
    collaborate: {
      title: "Работа вдвоём",
      blurb: "Свяжитесь с человеком и отмечайте его в задачах.",
      connect: {
        title: "Связаться с человеком",
        steps: [
          "Откройте Настройки и раздел «Совместная работа».",
          "Сверху — ваш ник. Он берётся из почты: testeruser@gmail.com становится @testeruser.",
          "Найдите человека по нику или почте и нажмите «Пригласить».",
          "Ничего не передаётся, пока он не подтвердит у себя.",
        ],
      },
      mention: {
        title: "Отметить человека в задаче",
        steps: [
          "Начните писать @ в поле задачи — появятся ваши люди. Выберите нужного.",
          "Допишите задачу и нажмите Enter.",
          "Копия появится в его списке в тот же день, с вашим ником.",
          "Он её читает. Менять и закрывать можете только вы.",
        ],
      },
      inbox: {
        title: "Когда отметили вас",
        steps: [
          "В правом нижнем углу появится круглая кнопка @ с числом.",
          "Нажмите — останутся только задачи с вашей отметкой.",
          "Нажмите ещё раз — вернётся весь список.",
        ],
      },
    },
    safety: {
      title: "Ничего не теряется",
      blurb: "Что происходит с тем, что вы завершаете или удаляете.",
      trash: {
        title: "Корзина",
        steps: [
          "Удалили задачу по ошибке? Нажмите на корзину в боковой панели.",
          "Найдите её и верните на место.",
          "Хранятся последние 500 удалённых задач.",
        ],
      },
      past: {
        title: "Прошлые дни",
        steps: [
          "Прокрутите выше сегодня, чтобы прочитать любой прошлый день.",
          "Что-то всё ещё актуально? Перетащите вниз на сегодня, чтобы перенести.",
        ],
      },
      data: {
        title: "Ваши данные",
        steps: [
          "Всё лежит в папке на этом компьютере и больше нигде.",
          "Настройки → Данные выгружают всё одним файлом, вместе с вложениями.",
          "Тот же файл вливается обратно — на этой машине или на другой.",
          "Резервная копия сохраняется автоматически при каждом чистом запуске Stepler.",
        ],
      },
    },
    connect: {
      title: "Подключение других приложений",
      blurb: "Всё по желанию и всё выключено, пока вы не включите.",
      reminders: {
        title: "Apple Напоминания",
        steps: [
          "Настройки → Интеграции → включите Apple Reminders.",
          "С этого момента задача, которой вы дали день или время, появляется и в Напоминаниях.",
          "Они попадают в список Stepler, так что ваши списки остаются как были.",
          "Отметка в Stepler отмечает задачу и в Напоминаниях.",
          "Дублируются только задачи, созданные после включения.",
        ],
      },
      gcal: {
        title: "Google Календарь",
        steps: [
          "Настройки → Интеграции → Google Calendar → Подключить.",
          "Войдите и на экране Google отметьте разрешение на календарь — его легко пропустить, а без него ничего не синхронизируется.",
          "После этого задача с днём становится ещё и событием.",
          "Нужны ваши собственные учётные данные Google; кнопка «Инструкция по настройке» объясняет, куда их вписать.",
        ],
      },
      jira: {
        title: "Jira",
        steps: [
          "Настройки → Интеграции → Jira.",
          "Нажмите «Создать токен», создайте его на странице Atlassian и скопируйте.",
          "Впишите адрес сайта, почту аккаунта и токен, затем нажмите «Подключить».",
          "Теперь при написании задачи можно выбрать проект Jira и спринт, если он у проекта есть.",
          "Задача становится задачей Jira в этом спринте.",
        ],
      },
    },
    power: {
      title: "Если вы живёте в терминале",
      blurb: "По желанию, и это можно спокойно пропустить.",
      cli: {
        title: "Командная строка и кодовые агенты",
        steps: [
          "Настройки → Интеграции → «Доступ из командной строки» должен быть включён.",
          "Встроенный CLI умеет показывать и добавлять задачи, не открывая окно.",
          "Claude Code, Codex и Cursor тоже можно подключить, чтобы ассистент записывал дела в ваш список.",
          "Всё остаётся на этом компьютере, за токеном, который читают только приложения, запущенные от вашего имени.",
        ],
      },
      updates: {
        title: "Обновления",
        steps: [
          "При запуске Stepler проверяет, нет ли новой версии.",
          "Когда она готова, вверху окна появляется кнопка.",
          "Нажмите — и Stepler перезапустится в новую версию.",
          "Если установить себя он не может, кнопка станет оранжевой и приведёт к загрузке.",
        ],
      },
    },
  },
};

export const translations = { en, ka, ru };
