import Foundation
import SwiftData

// MARK: - Equipment Category
enum EquipmentCategory: String, Codable, CaseIterable {
    case weights
    case cardio
    case recovery
    case other

    var label: String {
        switch self {
        case .weights: "Weights"
        case .cardio: "Cardio"
        case .recovery: "Recovery"
        case .other: "Other"
        }
    }

    var icon: String {
        switch self {
        case .weights: "dumbbell.fill"
        case .cardio: "heart.fill"
        case .recovery: "leaf.fill"
        case .other: "ellipsis.circle.fill"
        }
    }
}

// MARK: - Equipment
@Model
final class Equipment {
    @Attribute(.unique) var id: String
    var name: String
    var categoryRaw: String
    var descriptionText: String
    var icon: String
    var enabled: Bool

    var category: EquipmentCategory {
        get { EquipmentCategory(rawValue: categoryRaw) ?? .other }
        set { categoryRaw = newValue.rawValue }
    }

    init(
        id: String,
        name: String,
        category: EquipmentCategory,
        description: String,
        icon: String,
        enabled: Bool = false
    ) {
        self.id = id
        self.name = name
        self.categoryRaw = category.rawValue
        self.descriptionText = description
        self.icon = icon
        self.enabled = enabled
    }

    static let defaults: [Equipment] = [
        Equipment(id: "dumbbells", name: "Dumbbells", category: .weights, description: "Adjustable or fixed", icon: "dumbbell.fill"),
        Equipment(id: "kettlebells", name: "Kettlebells", category: .weights, description: "Various weights", icon: "figure.strengthtraining.traditional"),
        Equipment(id: "barbell", name: "Barbell", category: .weights, description: "Standard or Olympic", icon: "figure.strengthtraining.functional"),
        Equipment(id: "bench", name: "Bench", category: .weights, description: "Flat or adjustable", icon: "rectangle.fill"),
        Equipment(id: "pull-up-bar", name: "Pull-Up Bar", category: .weights, description: "Doorway or mounted", icon: "arrow.up.left.and.arrow.down.right"),
        Equipment(id: "resistance-bands", name: "Resistance Bands", category: .weights, description: "Light to heavy", icon: "lasso"),
        Equipment(id: "stationary-bike", name: "Stationary Bike", category: .cardio, description: "Spin or upright", icon: "bicycle"),
        Equipment(id: "rowing-machine", name: "Rowing Machine", category: .cardio, description: "Air or water", icon: "figure.rowing"),
        Equipment(id: "jump-rope", name: "Jump Rope", category: .cardio, description: "Speed or weighted", icon: "figure.jumprope"),
        Equipment(id: "treadmill", name: "Treadmill", category: .cardio, description: "Manual or motorized", icon: "figure.run"),
        Equipment(id: "yoga-mat", name: "Yoga Mat", category: .recovery, description: "Standard", icon: "figure.yoga"),
        Equipment(id: "foam-roller", name: "Foam Roller", category: .recovery, description: "Recovery tool", icon: "circle.fill"),
        Equipment(id: "ab-wheel", name: "Ab Wheel", category: .other, description: "Core strengthener", icon: "circle.dotted"),
        Equipment(id: "medicine-ball", name: "Medicine Ball", category: .other, description: "Weighted ball", icon: "basketball.fill"),
    ]
}
