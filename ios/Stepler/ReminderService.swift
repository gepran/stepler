import Foundation
import UserNotifications
import EventKit

enum ReminderService {
    static func requests(tasks: [TaskRecord], now: Date = Date()) -> [UNNotificationRequest] {
        let calendar = Calendar.current
        let rows = tasks.filter { !$0.deleted && !$0.purged }.flatMap { [$0] + $0.subtasks }
        var scheduled: [(Date, UNNotificationRequest)] = []
        for row in rows where !row.completed {
            guard let time = row.reminder else { continue }
            let parts = time.split(separator: ":").compactMap { Int($0) }
            guard parts.count == 2, (0..<24).contains(parts[0]), (0..<60).contains(parts[1]) else { continue }
            let day = (row.dueDate ?? row.ymd).split(separator: "-").compactMap { Int($0) }
            guard day.count == 3 else { continue }
            var components = DateComponents(); components.year = day[0]; components.month = day[1]; components.day = day[2]; components.hour = parts[0]; components.minute = parts[1]
            guard let date = calendar.date(from: components), date > now else { continue }
            let content = UNMutableNotificationContent(); content.title = "Stepler"; content.body = row.text; content.sound = .default
            let request = UNNotificationRequest(identifier: "stepler.\(row.id)", content: content, trigger: UNCalendarNotificationTrigger(dateMatching: components, repeats: false))
            scheduled.append((date, request))
        }
        return scheduled.sorted { $0.0 < $1.0 }.prefix(60).map(\.1)
    }
    static func requestPermission() async throws -> Bool { try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) }
    @MainActor private static var refreshing: Task<Void, Never>?
    @MainActor private static var generation = 0
    @MainActor static func refresh(tasks: [TaskRecord]) {
        generation += 1
        let version = generation
        let previous = refreshing
        refreshing = Task {
            await previous?.value
            guard generation == version else { return }
            let center = UNUserNotificationCenter.current()
            let pending = await center.pendingNotificationRequests()
            center.removePendingNotificationRequests(withIdentifiers: pending.filter { $0.identifier.hasPrefix("stepler.") }.map(\.identifier))
            for request in requests(tasks: tasks) { try? await center.add(request) }
            if generation == version { refreshing = nil }
        }
    }
}

@MainActor
final class CalendarBridge: ObservableObject {
    @Published var calendarEnabled = false
    @Published var remindersEnabled = false
    private let store = EKEventStore()
    private var busy = false
    init() {
        calendarEnabled = UserDefaults.standard.bool(forKey: "stepler.calendar.enabled")
        remindersEnabled = UserDefaults.standard.bool(forKey: "stepler.reminders.enabled")
    }
    func enable(calendar: Bool, reminders: Bool) async throws {
        if calendar && !calendarEnabled { guard try await store.requestFullAccessToEvents() else { throw AppFailure.invalid("Calendar access was not granted.") } }
        if reminders && !remindersEnabled { guard try await store.requestFullAccessToReminders() else { throw AppFailure.invalid("Reminders access was not granted.") } }
        calendarEnabled = calendar; remindersEnabled = reminders
        UserDefaults.standard.set(calendar, forKey: "stepler.calendar.enabled")
        UserDefaults.standard.set(reminders, forKey: "stepler.reminders.enabled")
    }
    func refresh(tasks: [TaskRecord], account: String) async throws {
        guard !busy, calendarEnabled || remindersEnabled else { return }
        busy = true; defer { busy = false }
        let key = "stepler.calendar.\(account)"
        var links = UserDefaults.standard.dictionary(forKey: key) as? [String: [String: String]] ?? [:]
        let rows = tasks.filter { !$0.deleted && !$0.purged }.flatMap { [$0] + $0.subtasks }
        let active = Set(rows.filter { $0.dueDate != nil }.map(\.id))
        for id in links.keys where !active.contains(id) {
            if let eventID = links[id]?["event"], let event = store.event(withIdentifier: eventID) { try store.remove(event, span: .thisEvent) }
            if let reminderID = links[id]?["reminder"], let reminder = store.calendarItem(withIdentifier: reminderID) as? EKReminder { try store.remove(reminder, commit: true) }
            links.removeValue(forKey: id)
        }
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.dateFormat = "yyyy-MM-dd"
        for row in rows {
            guard let dueDate = row.dueDate, let date = f.date(from: dueDate) else { continue }
            var record = links[row.id] ?? [:]
            if calendarEnabled {
                let event = record["event"].flatMap(store.event(withIdentifier:)) ?? EKEvent(eventStore: store)
                guard let defaultCalendar = event.calendar ?? store.defaultCalendarForNewEvents else { throw AppFailure.invalid("No writable default calendar is available.") }
                event.calendar = defaultCalendar; event.title = row.text; event.startDate = date; event.endDate = Calendar.current.date(byAdding: .day, value: 1, to: date); event.isAllDay = true
                try store.save(event, span: .thisEvent); record["event"] = event.eventIdentifier
                links[row.id] = record; UserDefaults.standard.set(links, forKey: key)
            }
            if remindersEnabled {
                let reminder = record["reminder"].flatMap(store.calendarItem(withIdentifier:)) as? EKReminder ?? EKReminder(eventStore: store)
                guard let defaultCalendar = reminder.calendar ?? store.defaultCalendarForNewReminders() else { throw AppFailure.invalid("No writable Reminders list is available.") }
                reminder.calendar = defaultCalendar; reminder.title = row.text; reminder.isCompleted = row.completed
                reminder.dueDateComponents = Calendar.current.dateComponents([.year, .month, .day], from: date)
                try store.save(reminder, commit: true); record["reminder"] = reminder.calendarItemIdentifier
            }
            links[row.id] = record
            // Record every successful external write before another can fail.
            UserDefaults.standard.set(links, forKey: key)
        }
        UserDefaults.standard.set(links, forKey: key)
    }
}
