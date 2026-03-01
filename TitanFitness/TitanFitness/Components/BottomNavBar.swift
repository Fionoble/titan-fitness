import SwiftUI

// MARK: - Tab Items
enum TabItem: String, CaseIterable, Identifiable {
    case home
    case nutrition
    case progress
    case coach
    case profile

    var id: String { rawValue }

    var label: String {
        switch self {
        case .home: "Home"
        case .nutrition: "Nutrition"
        case .progress: "Progress"
        case .coach: "Coach"
        case .profile: "Profile"
        }
    }

    var icon: String {
        switch self {
        case .home: "house.fill"
        case .nutrition: "fork.knife"
        case .progress: "chart.bar.fill"
        case .coach: "bubble.left.fill"
        case .profile: "person.fill"
        }
    }
}
