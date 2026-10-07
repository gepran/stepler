import SwiftUI
import FirebaseAuth
import UniformTypeIdentifiers

struct IssueReportView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) var dismiss
    @State private var reportID = UUID().uuidString.lowercased()
    @State private var title = ""
    @State private var details = ""
    @State private var contact = ""
    @State private var diagnostics = true
    @State private var busy = false
    @State private var received = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                if received {
                    Section {
                        Label("Report received", systemImage: "checkmark.circle.fill").foregroundStyle(.green)
                        Text("Your report is queued for Stepler support. Thank you.")
                        Text(reportID).font(.caption).textSelection(.enabled)
                    }
                } else {
                    Section { Text("Describe what happened. Reports are sent to Stepler support via Telegram.").font(.footnote).foregroundStyle(.secondary) }
                    Section("Issue") {
                        TextField("Issue title", text: $title).accessibilityIdentifier("report.title")
                        TextField("Steps to reproduce, expected and actual result", text: $details, axis: .vertical).lineLimit(5...10).accessibilityIdentifier("report.description")
                    }
                    Section("Contact (optional)") { TextField("Email or Telegram username", text: $contact).textInputAutocapitalization(.never).autocorrectionDisabled().accessibilityIdentifier("report.contact") }
                    Section {
                        Toggle("Include basic diagnostics", isOn: $diagnostics)
                        Text("App version, iOS, language and sync status. Task content and files are not included.").font(.caption).foregroundStyle(.secondary)
                        if diagnostics { Text("iOS · \(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown") · \(store.syncState)").font(.caption).foregroundStyle(.secondary) }
                    }
                    if let error { Section { Text(error).foregroundStyle(.red).font(.footnote) } }
                    Section { Button { Task { await send() } } label: { HStack { if busy { ProgressView() }; Text(busy ? "Sending…" : "Send report") } }.disabled(busy || title.trimmingCharacters(in: .whitespacesAndNewlines).count < 3 || details.trimmingCharacters(in: .whitespacesAndNewlines).count < 10 || title.count > 120 || details.count > 3000 || contact.count > 160).accessibilityIdentifier("report.send") }
                }
            }
            .disabled(busy)
            .navigationTitle("Report an issue")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button(received ? "Done" : "Cancel") { dismiss() }.disabled(busy).accessibilityIdentifier("report.close") } }
            .interactiveDismissDisabled(busy)
            .onChange(of: title) { _, _ in reportID = UUID().uuidString.lowercased() }
            .onChange(of: details) { _, _ in reportID = UUID().uuidString.lowercased() }
            .onChange(of: contact) { _, _ in reportID = UUID().uuidString.lowercased() }
            .onChange(of: diagnostics) { _, _ in reportID = UUID().uuidString.lowercased() }
        }
    }
    private func send() async {
        busy = true; error = nil
        defer { busy = false }
        var report: [String: Any] = ["id": reportID, "title": title.trimmingCharacters(in: .whitespacesAndNewlines), "description": details.trimmingCharacters(in: .whitespacesAndNewlines), "contact": contact.trimmingCharacters(in: .whitespacesAndNewlines)]
        if diagnostics { report["diagnostics"] = ["platform": "ios", "version": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown", "syncState": store.syncState, "syncErrorCode": store.syncErrorCode, "language": Locale.current.language.languageCode?.identifier ?? "en"] }
        do { try await store.submitIssueReport(report); received = true }
        catch { self.error = error.localizedDescription }
    }
}

extension AppStore {
    func submitIssueReport(_ report: [String: Any]) async throws {
        guard !testing else { throw AppFailure.invalid("Reporting is disabled in tests. Your draft is still available.") }
        var request = URLRequest(url: URL(string: "https://us-central1-stepler-490308.cloudfunctions.net/reportIssue")!)
        request.httpMethod = "POST"; request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let user = Auth.auth().currentUser { request.setValue("Bearer \(try await user.getIDToken())", forHTTPHeaderField: "Authorization") }
        request.httpBody = try JSONSerialization.data(withJSONObject: report)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, let result = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw AppFailure.invalid("Reporting is temporarily unavailable. Your draft is still available; please retry.") }
        guard (200..<300).contains(http.statusCode), result["success"] as? Bool == true, result["id"] as? String == report["id"] as? String else { throw AppFailure.invalid(result["error"] as? String ?? "Could not send the report. Your draft is still available; please retry.") }
    }
    @discardableResult
    func copyAttachmentImage(_ attachment: [String: JSONValue]) -> Bool {
        guard let url = attachmentURL(attachment) else { errorMessage = "This image is still downloading. Please retry after sync finishes."; retrySync(); return false }
        guard let image = UIImage(contentsOfFile: url.path) else { errorMessage = "This image could not be decoded."; return false }
        UIPasteboard.general.image = image
        return true
    }
    @discardableResult
    func copyTask(_ task: TaskRecord) -> Bool {
        var text = task.text
        if !task.subtasks.isEmpty { text += "\n" + task.subtasks.map { "- \($0.text)" }.joined(separator: "\n") }
        if let attachment = task.attachment, attachment["type"] == .string("image") {
            guard let url = attachmentURL(attachment), let image = UIImage(contentsOfFile: url.path), let png = image.pngData() else { errorMessage = "The image is unavailable. Please retry after sync finishes."; retrySync(); return false }
            UIPasteboard.general.setItems([[UTType.utf8PlainText.identifier: text, UTType.png.identifier: png]])
        } else { UIPasteboard.general.string = text }
        return true
    }
}
