import SwiftUI
import UniformTypeIdentifiers

struct ExportDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.json] }
    var data: Data
    init(data: Data = Data()) { self.data = data }
    init(configuration: ReadConfiguration) throws { data = configuration.file.regularFileContents ?? Data() }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { FileWrapper(regularFileWithContents: data) }
}

struct SettingsView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) var dismiss
    @AppStorage("stepler.theme") private var theme = "system"
    @State private var auth = false
    @State private var editing: Project?
    @State private var newProject = ""
    @State private var exporting = false
    @State private var importing = false
    @State private var document = ExportDocument()
    @State private var notice: String?
    @ObservedObject var calendarBridge: CalendarBridge
    var body: some View {
        NavigationStack {
            Form {
                Section("Account & sync") {
                    if store.uid != nil {
                        LabeledContent("Signed in", value: store.email ?? "Firebase account")
                        if let profile = store.profile { LabeledContent("Handle", value: "@\(profile.username)") }
                        Button("Sync now", systemImage: "arrow.triangle.2.circlepath") { store.scheduleSync() }
                        Button("Sign out", role: .destructive) { store.signOut() }
                    } else {
                        Text("Your tasks are saved on this iPhone. Sign in to sync with your Mac and the web app.").font(.footnote).foregroundStyle(.secondary)
                        Button("Sign in", systemImage: "person.crop.circle") { auth = true }.disabled(store.testing)
                    }
                    Text(store.syncMessage).font(.caption).foregroundStyle(.secondary)
                }
                Section("Appearance") { Picker("Theme", selection: $theme) { Text("System").tag("system"); Text("Light").tag("light"); Text("Dark").tag("dark") } }
                Section("Projects") {
                    ForEach(store.projects) { project in
                        Button { editing = project } label: {
                            HStack { Circle().fill(Color(project: project)).frame(width: 9, height: 9); Text(project.name).foregroundStyle(.primary); Spacer(); if project.isFavorite { Image(systemName: "star.fill").foregroundStyle(.orange) }; Image(systemName: "chevron.right").font(.caption).foregroundStyle(.secondary) }
                        }.accessibilityIdentifier("settings.project.\(project.name)")
                    }
                    HStack { TextField("Project name", text: $newProject).accessibilityIdentifier("settings.newProject"); Button("Add") { if store.project(ProjectOperation(type: "add", name: newProject)) { newProject = "" } }.disabled(newProject.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) }
                }
                Section("Reminders & calendar") {
                    Button("Enable notifications", systemImage: "bell.badge") {
                        Task { do { notice = try await ReminderService.requestPermission() ? "Notifications enabled." : "Allow notifications in iPhone Settings." } catch { store.errorMessage = error.localizedDescription } }
                    }.disabled(store.testing)
                    Toggle("Mirror dated tasks to Calendar", isOn: Binding(get: { calendarBridge.calendarEnabled }, set: { enabled in Task { await setCalendar(calendar: enabled, reminders: calendarBridge.remindersEnabled) } })).disabled(store.testing)
                    Toggle("Mirror dated tasks to Reminders", isOn: Binding(get: { calendarBridge.remindersEnabled }, set: { enabled in Task { await setCalendar(calendar: calendarBridge.calendarEnabled, reminders: enabled) } })).disabled(store.testing)
                    Text("Mirrors use this iPhone’s default calendar and Reminders list. Enable access when iOS asks.").font(.caption).foregroundStyle(.secondary)
                }
                if store.uid != nil { Section("People") { NavigationLink("Connections", destination: PeopleView()) } }
                Section("Your data") {
                    NavigationLink { TrashView() } label: { Label("Trash (\(store.trash.count))", systemImage: "trash") }.accessibilityIdentifier("settings.trash")
                    Button("Export tasks", systemImage: "square.and.arrow.up") { do { document = ExportDocument(data: try store.exportData()); exporting = true } catch { store.errorMessage = error.localizedDescription } }
                    Button("Import tasks", systemImage: "square.and.arrow.down") { importing = true }
                    Text("Account profiles are kept separately on this iPhone. Use export/import to copy local tasks into an account.").font(.caption).foregroundStyle(.secondary)
                }
                if let notice { Section { Text(notice).font(.footnote).foregroundStyle(.secondary) } }
                Section { HStack { Image("Brand").resizable().frame(width: 28, height: 28).clipShape(RoundedRectangle(cornerRadius: 7)); Text("Stepler").fontWeight(.semibold); Spacer(); Text("\(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "") · iOS").font(.caption).foregroundStyle(.secondary) } }
            }.navigationTitle("Settings")
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() }.accessibilityIdentifier("settings.done") } }
                .sheet(isPresented: $auth) { AuthView() }
                .sheet(item: $editing) { ProjectEditor(project: $0) }
                .fileExporter(isPresented: $exporting, document: document, contentType: .json, defaultFilename: "stepler-export") { result in if case .failure(let error) = result { store.errorMessage = error.localizedDescription } }
                .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { result in
                    do {
                        let url = try result.get(); let scoped = url.startAccessingSecurityScopedResource(); defer { if scoped { url.stopAccessingSecurityScopedResource() } }
                        if try store.importData(Data(contentsOf: url)) { notice = "Tasks imported." }
                    } catch { store.errorMessage = error.localizedDescription }
                }
                .onChange(of: store.snapshot.tasks) { _, tasks in Task { do { try await calendarBridge.refresh(tasks: tasks, account: store.accountKey) } catch { store.errorMessage = error.localizedDescription } } }
        }
    }
    private func setCalendar(calendar: Bool, reminders: Bool) async {
        do { try await calendarBridge.enable(calendar: calendar, reminders: reminders); try await calendarBridge.refresh(tasks: store.snapshot.tasks, account: store.accountKey) }
        catch { store.errorMessage = error.localizedDescription }
    }
}

struct ProjectEditor: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) var dismiss
    let project: Project
    @State private var name: String
    @State private var confirming = false
    init(project: Project) { self.project = project; _name = State(initialValue: project.name) }
    private let colors = ["#f97316", "#ef4444", "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1", "#a855f7", "#ec4899", "#78716c", "#64748b"]
    var body: some View {
        NavigationStack {
            Form {
                Section("Name") { TextField("Project name", text: $name).accessibilityIdentifier("project.rename"); Button("Rename") { if store.project(ProjectOperation(type: "rename", name: project.name, nextName: name)) { dismiss() } }.accessibilityIdentifier("project.renameSave") }
                Section { Button("Toggle favorite", systemImage: "star") { _ = store.project(ProjectOperation(type: "favorite", name: project.name)) }.accessibilityIdentifier("project.favorite") }
                Section("Color") {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 6)) {
                        ForEach(colors, id: \.self) { hex in Button { _ = store.project(ProjectOperation(type: "color", name: project.name, color: hex)) } label: { Circle().fill(Color(project: Project(name: "", color: hex))).frame(width: 34, height: 34).overlay { if store.projects.first(where: { $0.name == project.name })?.color == hex { Image(systemName: "checkmark").foregroundStyle(.white) } } }.accessibilityLabel("Color \(hex)") }
                    }.padding(.vertical, 5)
                }
                Section { Button("Delete project", role: .destructive) { confirming = true }.accessibilityIdentifier("project.delete") }
            }.navigationTitle(project.name).toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
                .confirmationDialog("Remove this project from all tasks?", isPresented: $confirming, titleVisibility: .visible) { Button("Delete project", role: .destructive) { if store.project(ProjectOperation(type: "remove", name: project.name)) { dismiss() } } }
        }
    }
}

struct TrashView: View {
    @EnvironmentObject var store: AppStore
    @State private var confirming = false
    var body: some View {
        List {
            if store.trash.isEmpty { ContentUnavailableView("Trash is empty", systemImage: "trash") }
            ForEach(store.trash.sorted { $0.order > $1.order }) { task in
                VStack(alignment: .leading, spacing: 12) {
                    Text(task.text.isEmpty ? "Attachment" : task.text)
                    HStack {
                        Button("Restore", systemImage: "arrow.uturn.backward") { store.restore(task.id) }.buttonStyle(.borderless).accessibilityIdentifier("trash.restore.\(task.id)")
                        Spacer()
                        Button("Delete forever", role: .destructive) { store.purge(task.id) }.buttonStyle(.borderless).accessibilityIdentifier("trash.purge.\(task.id)")
                    }.font(.caption)
                }.padding(.vertical, 4)
            }
        }.navigationTitle("Trash").toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Empty trash", role: .destructive) { confirming = true }.disabled(store.trash.isEmpty) } }
            .confirmationDialog("Permanently delete all tasks in Trash?", isPresented: $confirming, titleVisibility: .visible) { Button("Empty trash", role: .destructive) { for task in store.trash { store.purge(task.id) } } }
    }
}

struct AuthView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) var dismiss
    @State private var email = ""
    @State private var password = ""
    @State private var create = false
    @State private var busy = false
    var body: some View {
        NavigationStack {
            Form {
                Section { Text("One timeline, on your Mac and iPhone.").font(.title3.weight(.semibold)); Text("Sign in with the same Stepler account to keep tasks and projects in sync.").foregroundStyle(.secondary).font(.subheadline) }
                Section {
                    Button("Continue with Google") { Task { busy = true; await store.googleSignIn(); busy = false; if store.uid != nil { dismiss() } } }.disabled(busy)
                }
                Section("Email") {
                    TextField("Email address", text: $email).keyboardType(.emailAddress).textContentType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
                    SecureField("Password", text: $password).textContentType(create ? .newPassword : .password)
                    Toggle("Create account", isOn: $create)
                    Button(create ? "Create account" : "Sign in") { Task { busy = true; await store.signIn(email: email, password: password, create: create); busy = false; if store.uid != nil { dismiss() } } }.disabled(busy || email.isEmpty || password.count < 6)
                }
                if let error = store.errorMessage { Section { Text(error).foregroundStyle(.red).font(.footnote) } }
            }.navigationTitle("Welcome to Stepler").toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
                .onChange(of: store.uid) { _, uid in if uid != nil { dismiss() } }
        }
    }
}

struct PeopleView: View {
    @EnvironmentObject var store: AppStore
    @State private var term = ""
    @State private var results: [PersonRecord] = []
    var body: some View {
        List {
            Section("Find people") {
                TextField("@handle or full email address", text: $term).textInputAutocapitalization(.never).autocorrectionDisabled()
                Button("Search") { Task { do { results = try await store.findPeople(term) } catch { store.errorMessage = error.localizedDescription } } }
                ForEach(results) { person in HStack { Text("@\(person.username)"); Spacer(); Button("Invite") { Task { await store.invite(person) } }.disabled(store.connections.contains { $0.uid == person.uid }) } }
            }
            Section("Connections") {
                ForEach(store.connections) { person in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack { Text("@\(person.username)"); Spacer(); Text(person.status).font(.caption).foregroundStyle(.secondary) }
                        HStack { if person.status == "incoming" { Button("Accept") { Task { await store.invite(person, accept: true) } } }; Button("Remove", role: .destructive) { Task { await store.disconnect(person) } } }.font(.caption)
                    }
                }
            }
        }.navigationTitle("People")
    }
}
