import Foundation
import SwiftData

// MARK: - Workout Plan
@Model
final class WorkoutPlan {
    @Attribute(.unique) var id: String
    var name: String
    var styleRaw: String
    var exercisesData: Data // JSON-encoded [ExerciseTemplate]
    var durationMin: Int
    var estimatedCalories: Int
    var focus: String
    var equipmentUsed: [String]
    var generatedAt: Date
    var intensity: Int // 1, 2, or 3

    var style: WorkoutStyle {
        get { WorkoutStyle(rawValue: styleRaw) ?? .strength }
        set { styleRaw = newValue.rawValue }
    }

    var exercises: [ExerciseTemplate] {
        get {
            (try? JSONDecoder().decode([ExerciseTemplate].self, from: exercisesData)) ?? []
        }
        set {
            exercisesData = (try? JSONEncoder().encode(newValue)) ?? Data()
        }
    }

    init(
        id: String = UUID().uuidString,
        name: String,
        style: WorkoutStyle,
        exercises: [ExerciseTemplate],
        durationMin: Int,
        estimatedCalories: Int,
        focus: String,
        equipmentUsed: [String],
        generatedAt: Date = Date(),
        intensity: Int = 2
    ) {
        self.id = id
        self.name = name
        self.styleRaw = style.rawValue
        self.exercisesData = (try? JSONEncoder().encode(exercises)) ?? Data()
        self.durationMin = durationMin
        self.estimatedCalories = estimatedCalories
        self.focus = focus
        self.equipmentUsed = equipmentUsed
        self.generatedAt = generatedAt
        self.intensity = intensity
    }
}
