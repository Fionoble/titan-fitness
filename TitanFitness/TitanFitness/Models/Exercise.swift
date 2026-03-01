import Foundation
import SwiftData

// MARK: - Workout Style
enum WorkoutStyle: String, Codable, CaseIterable, Identifiable {
    case strength
    case hypertrophy
    case functional
    case hiit
    case cardio
    case recovery
    case mobility
    case power
    case endurance

    var id: String { rawValue }

    var label: String {
        switch self {
        case .strength: "Strength"
        case .hypertrophy: "Hypertrophy"
        case .functional: "Functional"
        case .hiit: "HIIT"
        case .cardio: "Cardio"
        case .recovery: "Recovery"
        case .mobility: "Mobility"
        case .power: "Power"
        case .endurance: "Endurance"
        }
    }

    var icon: String {
        switch self {
        case .strength, .hypertrophy: "dumbbell.fill"
        case .functional: "figure.walk"
        case .hiit: "timer"
        case .cardio: "figure.run"
        case .recovery: "leaf.fill"
        case .mobility: "figure.flexibility"
        case .power: "bolt.fill"
        case .endurance: "heart.fill"
        }
    }

    var color: String {
        switch self {
        case .strength, .hypertrophy: "#2bee79"
        case .functional: "#60a5fa"
        case .hiit: "#f97316"
        case .cardio: "#ef4444"
        case .recovery: "#a78bfa"
        case .mobility: "#2dd4bf"
        case .power: "#eab308"
        case .endurance: "#ec4899"
        }
    }

    var description: String {
        switch self {
        case .strength: "Build raw strength with heavy compound lifts"
        case .hypertrophy: "Maximize muscle growth with volume training"
        case .functional: "Move better in daily life with practical movements"
        case .hiit: "Burn calories fast with high-intensity intervals"
        case .cardio: "Boost heart health and endurance"
        case .recovery: "Heal, lengthen, and restore your body"
        case .mobility: "Improve flexibility and joint health"
        case .power: "Develop explosive strength and speed"
        case .endurance: "Build stamina and staying power"
        }
    }

    var styleNames: [String] {
        switch self {
        case .strength: ["Strength Builder", "Power Session", "Heavy Lifts"]
        case .hypertrophy: ["Muscle Builder", "Hypertrophy Focus", "Growth Session"]
        case .functional: ["Functional Fitness", "Movement Mastery", "Functional Flow"]
        case .hiit: ["HIIT Blitz", "Cardio Crusher", "Interval Burn"]
        case .cardio: ["Cardio Session", "Heart Racer", "Endurance Burn"]
        case .recovery: ["Active Recovery", "Restore & Recover", "Easy Recovery"]
        case .mobility: ["Mobility Flow", "Stretch & Restore", "Flexibility Focus"]
        case .power: ["Power & Explosiveness", "Power Surge", "Explosive Power"]
        case .endurance: ["Endurance Builder", "Stamina Session", "Long Burn"]
        }
    }
}

// MARK: - Exercise (plan template)
struct ExerciseTemplate: Codable, Identifiable, Hashable {
    var id: String = UUID().uuidString
    var name: String
    var muscleGroup: String
    var equipment: [String]
    var sets: Int
    var reps: String
    var weight: Double?
    var notes: String?
    var restSeconds: Int?
    var group: String? // superset grouping: "A", "B", etc.
}

// MARK: - Exercise Database Entry
struct ExerciseDBEntry {
    let name: String
    let muscleGroup: String
    let equipment: [String]
    let defaultSets: Int
    let defaultReps: String
}
