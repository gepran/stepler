import SwiftUI
import PhotosUI
import UniformTypeIdentifiers
import QuickLook

extension Color {
    init(project: Project?) {
        let hex = project?.color?.replacingOccurrences(of: "#", with: "") ?? "f97316"
        let value = UInt64(hex, radix: 16) ?? 0xf97316
        self.init(red: Double((value >> 16) & 255) / 255, green: Double((value >> 8) & 255) / 255, blue: Double(value & 255) / 255)
    }
}

struct ContentView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.scenePhase) private var scenePhase
    @State private var search = ""
    @State private var draft = ""
    @FocusState private var composerFocused: Bool
    @State private var showProjects = false
    @State private var showSettings = false
    @State private var editing: TaskRecord?
    @State private var creating = false
    @State private var mentionsOnly = false
    @AppStorage("stepler.theme") private var theme = "system"
    private var visible: [TaskRecord] {
        store.tasks.filter { row in
            (store.selectedProject == nil || row.projects.contains(store.selectedProject!)) &&
            (search.isEmpty || row.text.localizedCaseInsensitiveContains(search) || row.subtasks.contains { $0.text.localizedCaseInsensitiveContains(search) })
        }
    }
    private var days: [String] { Array(Set(visible.map(\.ymd))).sorted(by: >) }
    var body: some View {
        NavigationStack {
            List {
                if mentionsOnly {
                    if store.mentions.isEmpty { ContentUnavailableView("No mentions", systemImage: "at", description: Text("Tasks addressed to you by connected people appear here.")) }
                    ForEach(store.mentions) { MentionRow(mention: $0) }
                } else if visible.isEmpty {
                    ContentUnavailableView(search.isEmpty ? "Room for a fresh start" : "No matching tasks", systemImage: search.isEmpty ? "checklist" : "magnifyingglass", description: Text(search.isEmpty ? "Write your first task below. It stays saved on your iPhone, even offline." : "Try another phrase or project."))
                        .listRowSeparator(.hidden)
                } else {
                    ForEach(days, id: \.self) { day in
                        Section(day == TaskRecord.day(Date()) ? "Today" : day) {
                            ForEach(TaskRecord.ordered(visible.filter { $0.ymd == day })) { task in
                                TaskRow(task: task, edit: { editing = task })
                                    .draggable(task.id)
                                    .dropDestination(for: String.self) { ids, _ in store.reorder(ids, before: task.id); return true }
                                    .swipeActions(edge: .trailing) { Button("Delete", role: .destructive) { store.delete(task.id) } }
                                    .contextMenu {
                                        Button("Edit", systemImage: "pencil") { editing = task }
                                        Button("Copy task", systemImage: "doc.on.doc") { store.copyTask(task) }
                                        Button(task.priority ? "Remove priority" : "Set priority", systemImage: "star") { store.edit(task.id) { $0.priority.toggle() } }
                                        Menu("Move into task") { ForEach(store.tasks.filter { $0.id != task.id }) { target in Button(target.text) { store.nest(task.id, under: target.id) } } }
                                        Button("Delete", systemImage: "trash", role: .destructive) { store.delete(task.id) }
                                    }
                            }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .accessibilityIdentifier("task.timeline")
            .contentShape(Rectangle())
            .simultaneousGesture(TapGesture().onEnded { dismissKeyboard() })
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(store.selectedProject ?? (mentionsOnly ? "Mentions" : "Stepler"))
            .searchable(text: $search, prompt: "Search tasks and subtasks")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Projects", systemImage: "sidebar.left") { showProjects = true }.accessibilityIdentifier("projects.open")
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button("Mentions", systemImage: mentionsOnly ? "at.circle.fill" : "at") { mentionsOnly.toggle() }.accessibilityIdentifier("mentions.filter")
                    Button("Settings", systemImage: "gearshape") { showSettings = true }.accessibilityIdentifier("settings.open")
                }
            }
            .safeAreaInset(edge: .bottom) {
                VStack(spacing: 10) {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(store.projects) { project in
                                ProjectChip(project: project, selected: store.selectedProject == project.name) { store.selectedProject = store.selectedProject == project.name ? nil : project.name }
                                    .accessibilityIdentifier("composer.project.\(project.name)")
                            }
                            Button("New project", systemImage: "plus") { showProjects = true }.font(.caption.weight(.semibold))
                        }.padding(.horizontal)
                    }
                    HStack(spacing: 12) {
                        Button("Add details", systemImage: "plus.circle") { creating = true }.labelStyle(.iconOnly).font(.title2).accessibilityIdentifier("task.details")
                        TextField("What needs to get done?", text: $draft, axis: .vertical).lineLimit(1...4)
                            .focused($composerFocused)
                            .submitLabel(.done).onSubmit(addDraft).accessibilityIdentifier("task.draft")
                        Button(action: addDraft) { Image(systemName: "arrow.up.circle.fill").font(.title) }
                            .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                            .accessibilityLabel("Add task").accessibilityIdentifier("task.add")
                    }.padding(.horizontal)
                    HStack {
                        Circle().fill(store.syncState == "synced" ? Color.green : (store.syncState == "error" ? Color.red : Color.secondary)).frame(width: 5, height: 5)
                        Text(store.syncMessage).font(.caption2).foregroundStyle(.secondary)
                        Spacer()
                        Text("\(store.tasks.filter(\.completed).count) / \(store.tasks.count) done").font(.caption2.monospacedDigit()).foregroundStyle(.secondary)
                    }.padding(.horizontal).contentShape(Rectangle()).onTapGesture { dismissKeyboard() }
                }.padding(.vertical, 12).background(.regularMaterial)
            }
        }
        .onChange(of: scenePhase) { _, phase in if phase == .active { store.retrySync() } }
        .preferredColorScheme(theme == "dark" ? .dark : theme == "light" ? .light : nil)
        .onChange(of: store.uid) { _, _ in draft = ""; editing = nil; creating = false; search = ""; showProjects = false; mentionsOnly = false }
        .sheet(isPresented: $showProjects) { ProjectSidebar() }
        .sheet(isPresented: $showSettings) { SettingsView(calendarBridge: store.calendarBridge) }
        .sheet(isPresented: $creating) { TaskEditor(projects: store.selectedProject.map { [$0] } ?? []) }
        .sheet(item: $editing) { TaskEditor(task: $0) }
        .alert("Stepler", isPresented: Binding(get: { store.errorMessage != nil }, set: { if !$0 { store.errorMessage = nil } })) {
            Button("OK") { store.errorMessage = nil }
        } message: { Text(store.errorMessage ?? "") }
    }
    private func addDraft() {
        if store.add(text: draft, projects: store.selectedProject.map { [$0] } ?? []) { draft = ""; mentionsOnly = false }
    }
    private func dismissKeyboard() {
        composerFocused = false
        // Search owns its own focus state inside searchable; resign its
        // responder too without clearing either search text or the draft.
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }
}

struct ProjectChip: View {
    let project: Project
    var selected: Bool
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 5) { Circle().fill(Color(project: project)).frame(width: 6, height: 6); if project.isFavorite { Image(systemName: "star.fill").font(.system(size: 8)) }; Text(project.name) }
                .font(.caption.weight(.medium)).padding(.horizontal, 12).padding(.vertical, 8)
                .foregroundStyle(selected ? Color.white : Color.primary).background(selected ? Color(project: project) : Color.secondary.opacity(0.10), in: Capsule())
        }.buttonStyle(.plain)
    }
}

struct TaskRow: View {
    @EnvironmentObject var store: AppStore
    var task: TaskRecord
    var edit: () -> Void
    @State private var preview: PreviewFile?
    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(alignment: .top, spacing: 12) {
                Button { store.edit(task.id) { $0.completed.toggle() } } label: { Image(systemName: task.completed ? "checkmark.circle.fill" : "circle").font(.title3).foregroundStyle(task.completed ? Color.orange : Color.secondary) }
                    .buttonStyle(.borderless).accessibilityLabel(task.completed ? "Mark incomplete" : "Complete task").accessibilityIdentifier("task.complete.\(task.id)")
                Button(action: edit) { Text(task.text.isEmpty ? "Attachment" : task.text).strikethrough(task.completed).foregroundStyle(task.completed ? Color.secondary : Color.primary).frame(maxWidth: .infinity, alignment: .leading).multilineTextAlignment(.leading) }
                    .buttonStyle(.borderless).accessibilityIdentifier("task.row.\(task.id)")
                Button { store.edit(task.id) { $0.priority.toggle() } } label: { Image(systemName: task.priority ? "star.fill" : "star").foregroundStyle(task.priority ? Color.orange : Color.secondary.opacity(0.5)) }
                    .buttonStyle(.borderless).accessibilityLabel("Priority").accessibilityIdentifier("task.priority.\(task.id)")
            }
            if !task.projects.isEmpty || task.dueDate != nil || task.reminder != nil {
                HStack(spacing: 8) {
                    ForEach(task.projects, id: \.self) { name in Text(name).font(.caption2.weight(.medium)).foregroundStyle(Color(project: store.projects.first { $0.name == name })).padding(.horizontal, 7).padding(.vertical, 3).background(.quaternary, in: Capsule()) }
                    if let date = task.dueDate { Label(date, systemImage: "calendar").font(.caption2).foregroundStyle(.secondary) }
                    if let reminder = task.reminder { Label(reminder, systemImage: "bell").font(.caption2).foregroundStyle(.secondary) }
                }.padding(.leading, 32)
            }
            if let attachment = task.attachment {
                Button {
                    if let url = store.attachmentURL(attachment) { preview = PreviewFile(url: url) } else { store.errorMessage = "This attachment is downloading. Please retry when sync finishes."; store.scheduleSync() }
                } label: {
                    if let url = store.attachmentURL(attachment), let image = UIImage(contentsOfFile: url.path), attachment["type"] == .string("image") { Image(uiImage: image).resizable().scaledToFit().frame(maxHeight: 160).clipShape(RoundedRectangle(cornerRadius: 12)) }
                    else { Label(attachment["name"].flatMap { if case .string(let s) = $0 { return s }; return nil } ?? "Attachment", systemImage: "paperclip").font(.caption) }
                }.buttonStyle(.borderless).padding(.leading, 32)
                    .contextMenu {
                        if attachment["type"] == .string("image") { Button("Copy image", systemImage: "doc.on.doc") { store.copyAttachmentImage(attachment) } }
                    }
            }
            ForEach(task.subtasks) { child in
                HStack(spacing: 10) {
                    Button { store.edit(task.id) { parent in if let i = parent.subtasks.firstIndex(where: { $0.id == child.id }) { parent.subtasks[i].completed.toggle() } } } label: { Image(systemName: child.completed ? "checkmark.circle.fill" : "circle").foregroundStyle(child.completed ? Color.orange : Color.secondary) }.buttonStyle(.borderless)
                    Text(child.text).font(.subheadline).strikethrough(child.completed).foregroundStyle(child.completed ? .secondary : .primary)
                }.padding(.leading, 34).contextMenu {
                    Button("Promote to task", systemImage: "arrow.up.right") { store.promote(child.id, from: task.id) }
                    Button("Delete subtask", systemImage: "trash", role: .destructive) { store.edit(task.id) { $0.subtasks.removeAll { $0.id == child.id } } }
                }
            }
        }.padding(.vertical, 5)
            .sheet(item: $preview) { file in
                NavigationStack {
                    QuickPreview(url: file.url).ignoresSafeArea(edges: .bottom)
                        .toolbar {
                            ToolbarItem(placement: .cancellationAction) { Button("Done") { preview = nil } }
                            ToolbarItem(placement: .primaryAction) { Button("Copy image", systemImage: "doc.on.doc") {
                                if let attachment = task.attachment { store.copyAttachmentImage(attachment) }
                            }.disabled(task.attachment?["type"] != .string("image")) }
                        }
                }
            }
    }
}

struct ProjectSidebar: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) var dismiss
    @State private var name = ""
    var body: some View {
        NavigationStack {
            List {
                Button { store.selectedProject = nil; dismiss() } label: { Label("All tasks", systemImage: "tray.full") }.accessibilityIdentifier("sidebar.all")
                Section("Projects") {
                    ForEach(store.projects) { project in
                        Button { store.selectedProject = project.name; dismiss() } label: {
                            HStack { Circle().fill(Color(project: project)).frame(width: 9, height: 9); Text(project.name).foregroundStyle(.primary); Spacer(); if project.isFavorite { Image(systemName: "star.fill").foregroundStyle(.orange) }; Text("\(store.tasks.filter { $0.projects.contains(project.name) }.count)").foregroundStyle(.secondary).font(.caption.monospacedDigit()) }
                        }.accessibilityIdentifier("sidebar.project.\(project.name)")
                    }
                    HStack {
                        TextField("Project name", text: $name).accessibilityIdentifier("project.name")
                        Button("Add") { if store.project(ProjectOperation(type: "add", name: name)) { name = "" } }.disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty).accessibilityIdentifier("project.add")
                    }
                }
            }.navigationTitle("Projects").toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
    }
}

struct TaskEditor: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) var dismiss
    @State private var task: TaskRecord
    private let original: TaskRecord?
    @State private var dated: Bool
    @State private var date: Date
    @State private var alarm: Bool
    @State private var time: Date
    @State private var childText = ""
    @State private var projectName = ""
    @State private var photo: PhotosPickerItem?
    @State private var importing = false
    @State private var busy = false
    @State private var localError: String?
    init(task: TaskRecord? = nil, projects: [String] = []) {
        let row = task ?? TaskRecord(text: "", projects: projects)
        _task = State(initialValue: row); original = task
        _dated = State(initialValue: row.dueDate != nil); _alarm = State(initialValue: row.reminder != nil)
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; _date = State(initialValue: row.dueDate.flatMap(f.date(from:)) ?? Date())
        let tf = DateFormatter(); tf.dateFormat = "HH:mm"; _time = State(initialValue: row.reminder.flatMap(tf.date(from:)) ?? Date())
    }
    var body: some View {
        NavigationStack {
            Form {
                Section("Task") {
                    TextEditor(text: $task.text).frame(minHeight: 90).accessibilityIdentifier("editor.text")
                    Toggle("Priority", isOn: $task.priority).accessibilityIdentifier("editor.priority")
                    if original != nil { Toggle("Completed", isOn: $task.completed) }
                }
                Section("Projects") {
                    ScrollView(.horizontal, showsIndicators: false) { HStack { ForEach(store.projects) { project in ProjectChip(project: project, selected: task.projects.contains(project.name)) { if task.projects.contains(project.name) { task.projects.removeAll { $0 == project.name } } else { task.projects.append(project.name) } }.accessibilityIdentifier("editor.project.\(project.name)") } } }
                    HStack {
                        TextField("New project", text: $projectName).accessibilityIdentifier("editor.newProject")
                        Button("Add") { if store.project(ProjectOperation(type: "add", name: projectName)) { task.projects.append(projectName.trimmingCharacters(in: .whitespacesAndNewlines)); projectName = "" } }.disabled(projectName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty).accessibilityIdentifier("editor.projectAdd")
                    }
                }
                Section("Schedule") {
                    Toggle("Due date", isOn: $dated)
                    if dated { DatePicker("Date", selection: $date, displayedComponents: .date) }
                    Toggle("Reminder", isOn: $alarm)
                    if alarm { DatePicker("Time", selection: $time, displayedComponents: .hourAndMinute) }
                }
                Section("Subtasks") {
                    ForEach(task.subtasks) { child in
                        HStack {
                            Button { if let i = task.subtasks.firstIndex(where: { $0.id == child.id }) { task.subtasks[i].completed.toggle() } } label: { Image(systemName: child.completed ? "checkmark.circle.fill" : "circle") }.buttonStyle(.borderless)
                            TextField("Subtask", text: Binding(get: { task.subtasks.first { $0.id == child.id }?.text ?? "" }, set: { value in if let i = task.subtasks.firstIndex(where: { $0.id == child.id }) { task.subtasks[i].text = value } }))
                        }.swipeActions { Button("Delete", role: .destructive) { task.subtasks.removeAll { $0.id == child.id } } }
                    }.onMove { task.subtasks.move(fromOffsets: $0, toOffset: $1) }
                    HStack {
                        TextField("Add subtask", text: $childText).accessibilityIdentifier("editor.subtask")
                        Button("Add") { if !childText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && task.subtasks.count < 500 { task.subtasks.append(TaskRecord(text: childText)); childText = "" } }.accessibilityIdentifier("editor.subtaskAdd")
                    }
                }
                Section("Attachment") {
                    if let attachment = task.attachment {
                        HStack { Label(attachment["name"].flatMap { if case .string(let s) = $0 { return s }; return nil } ?? "Attachment", systemImage: "paperclip"); Spacer(); Button("Remove", role: .destructive) { task.attachment = nil } }
                    }
                    PhotosPicker(selection: $photo, matching: .images) { Label("Choose photo", systemImage: "photo") }
                    Button("Choose file", systemImage: "doc") { importing = true }
                    Button("Paste image", systemImage: "doc.on.clipboard") {
                        if let image = UIPasteboard.general.image, let data = image.pngData() { attach(data, name: "Clipboard.png", image: true) } else { localError = "The clipboard does not contain an image." }
                    }
                }
                if let localError { Section { Text(localError).foregroundStyle(.red).font(.footnote) } }
            }.navigationTitle(original == nil ? "New task" : "Edit task")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                    ToolbarItem(placement: .confirmationAction) { Button("Save") { Task { await save() } }.disabled(busy || (task.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && task.attachment == nil)).accessibilityIdentifier("editor.save") }
                }
                .fileImporter(isPresented: $importing, allowedContentTypes: [.item]) { result in
                    do {
                        let url = try result.get(); let scoped = url.startAccessingSecurityScopedResource(); defer { if scoped { url.stopAccessingSecurityScopedResource() } }
                        attach(try Data(contentsOf: url), name: url.lastPathComponent, image: UTType(filenameExtension: url.pathExtension)?.conforms(to: .image) ?? false)
                    } catch { localError = error.localizedDescription }
                }
                .onChange(of: photo) { _, item in
                    Task {
                        busy = true; defer { busy = false }
                        do { guard let data = try await item?.loadTransferable(type: Data.self) else { return }; attach(data, name: "Photo.\(item?.supportedContentTypes.first?.preferredFilenameExtension ?? "jpg")", image: true) }
                        catch { localError = error.localizedDescription }
                    }
                }
                .onChange(of: store.snapshot.projectState) { _, state in task.rewriteProjects(state) }
        }
    }
    private func attach(_ data: Data, name: String, image: Bool) {
        do { task.attachment = try store.storeAttachment(data, name: name, image: image) }
        catch { localError = error.localizedDescription }
    }
    private func save() async {
        guard !busy else { return }; busy = true; defer { busy = false }
        task.text = String(task.text.trimmingCharacters(in: .whitespacesAndNewlines).prefix(20_000))
        task.dueDate = dated ? TaskRecord.day(date) : nil
        let f = DateFormatter(); f.dateFormat = "HH:mm"; task.reminder = alarm ? f.string(from: time) : nil
        if alarm && !store.testing {
            do { if !(try await ReminderService.requestPermission()) { localError = "Notification permission is off. The reminder is saved; enable notifications in iPhone Settings." } }
            catch { localError = error.localizedDescription }
        }
        task.rewriteProjects(store.snapshot.projectState)
        let latest = store.snapshot.tasks.first { $0.id == task.id }
        let merged = TaskRecord.merge(base: original, local: task, remote: latest)
        if store.put(merged) { dismiss() } else { localError = store.errorMessage }
    }
}

struct MentionRow: View {
    @EnvironmentObject var store: AppStore
    var mention: MentionRecord
    @State private var addChild = false
    @State private var childText = ""
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("@\(mention.username)").font(.caption.weight(.semibold)).foregroundStyle(.orange)
            HStack {
                Button { Task { await store.editMention(mention, completed: !mention.task.completed) } } label: { Image(systemName: mention.task.completed ? "checkmark.circle.fill" : "circle") }.buttonStyle(.borderless)
                Text(mention.task.text).strikethrough(mention.task.completed)
                Spacer()
                Button { Task { await store.editMention(mention, priority: !mention.task.priority) } } label: { Image(systemName: mention.task.priority ? "star.fill" : "star") }.buttonStyle(.borderless)
            }
            ForEach(mention.task.subtasks) { child in
                Button {
                    var rows = mention.task.subtasks; if let i = rows.firstIndex(where: { $0.id == child.id }) { rows[i].completed.toggle() }
                    Task { await store.editMention(mention, subtasks: rows) }
                } label: { Label(child.text, systemImage: child.completed ? "checkmark.circle.fill" : "circle").font(.subheadline) }.buttonStyle(.borderless)
            }
            Button("Add subtask", systemImage: "plus") { addChild = true }.font(.caption).buttonStyle(.borderless)
        }.swipeActions { Button("Dismiss", role: .destructive) { Task { await store.dismissMention(mention) } } }
            .alert("Add subtask", isPresented: $addChild) { TextField("Subtask", text: $childText); Button("Add") { if !childText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { Task { await store.editMention(mention, subtasks: mention.task.subtasks + [TaskRecord(text: childText)]); childText = "" } } }; Button("Cancel", role: .cancel) {} }
    }
}

struct PreviewFile: Identifiable { var url: URL; var id: String { url.path } }
struct QuickPreview: UIViewControllerRepresentable {
    var url: URL
    func makeCoordinator() -> Coordinator { Coordinator(url: url) }
    func makeUIViewController(context: Context) -> QLPreviewController { let view = QLPreviewController(); view.dataSource = context.coordinator; return view }
    func updateUIViewController(_ uiViewController: QLPreviewController, context: Context) {}
    final class Coordinator: NSObject, QLPreviewControllerDataSource {
        let url: URL; init(url: URL) { self.url = url }
        func numberOfPreviewItems(in controller: QLPreviewController) -> Int { 1 }
        func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem { url as NSURL }
    }
}
