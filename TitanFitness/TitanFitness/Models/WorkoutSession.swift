import Foundation
import SwiftData

// MARK: - Set Log
struct SetLog: Codable, Identifiable, Hashable {
    var id: String { "\(setNumber)" }
    var setNumber: Int
    var weight: Double?
    var reps: Int?
    var completed: Bool
    var isPersonalRecord: Bool?
}

// MARK: - Exercise Log
struct ExerciseLog: Codable, Identifiable, Hashable {
    var id: String { exerciseId }
    var exerciseId: String
    var exerciseName: String
    var muscleGroup: String
    var sets: [SetLog]
}

// MARK: - Workout Session
@Model
final class WorkoutSession {
    @Attribute(.unique) var id: String
    var planId: String?
    var name: String
    var styleRaw: String
    var startedAt: Date
    var completedAt: Date?
    var durationSeconds: Int
    var exercisesData: Data // JSON-encoded [ExerciseLog]
    var totalVolume: Double
    var totalSets: Int
    var personalRecords: Int
    var notes: String?

    var style: WorkoutStyle {
        get { WorkoutStyle(rawValue: styleRaw) ?? .strength }
        set { styleRaw = newValue.rawValue }
    }

    var exercises: [ExerciseLog] {
        get {
            (try? JSONDecoder().decode([ExerciseLog].self, from: exercisesData)) ?? []
        }
        set {
            exercisesData = (try? JSONEncoder().encode(newValue)) ?? Data()
        }
    }

    init(
        id: String = UUID().uuidString,
        planId: String? = nil,
        name: String,
        style: WorkoutStyle,
        startedAt: Date = Date(),
        completedAt: Date? = nil,
        durationSeconds: Int = 0,
        exercises: [ExerciseLog] = [],
        totalVolume: Double = 0,
        totalSets: Int = 0,
        personalRecords: Int = 0,
        notes: String? = nil
    ) {
        self.id = id
        self.planId = planId
        self.name = name
        self.styleRaw = style.rawValue
        self.startedAt = startedAt
        self.completedAt = completedAt
        self.durationSeconds = durationSeconds
        self.exercisesData = (try? JSONEncoder().encode(exercises)) ?? Data()
        self.totalVolume = totalVolume
        self.totalSets = totalSets
        self.personalRecords = personalRecords
        self.notes = notes
    }
}
