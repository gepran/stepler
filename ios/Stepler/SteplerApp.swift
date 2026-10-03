import SwiftUI
import FirebaseCore
import GoogleSignIn

@main
struct SteplerApp: App {
    @StateObject private var store: AppStore

    init() {
        let testing = ProcessInfo.processInfo.arguments.contains("--ui-testing")
        if !testing { FirebaseApp.configure() }
        _store = StateObject(wrappedValue: AppStore(testing: testing))
    }

    var body: some Scene {
        WindowGroup {
            ContentView().environmentObject(store)
                .tint(.orange)
                .onOpenURL { GIDSignIn.sharedInstance.handle($0) }
        }
    }
}
