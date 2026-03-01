import SwiftUI
import SwiftData

@main
struct TitanFitnessApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .modelContainer(DataStore.shared.modelContainer)
        }
    }
}
