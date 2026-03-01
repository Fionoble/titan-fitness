import Foundation
import SwiftData

// MARK: - AI Provider
enum AIProvider: String, Codable, CaseIterable, Identifiable {
    case anthropic
    case openai

    var id: String { rawValue }

    var label: String {
        switch self {
        case .anthropic: "Anthropic (Claude)"
        case .openai: "OpenAI (GPT)"
        }
    }
}

// MARK: - User Profile
@Model
final class UserProfile {
    @Attribute(.unique) var id: String
    var name: String
    var weight: Double? // lbs
    var height: Double? // inches
    var age: Int?
    var injuries: String?
    var additionalEquipment: String?
    var createdAt: Date

    init(
        id: String = "default",
        name: String = "Athlete",
        weight: Double? = nil,
        height: Double? = nil,
        age: Int? = nil,
        injuries: String? = nil,
        additionalEquipment: String? = nil,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.name = name
        self.weight = weight
        self.height = height
        self.age = age
        self.injuries = injuries
        self.additionalEquipment = additionalEquipment
        self.createdAt = createdAt
    }
}

// MARK: - Personal Record
@Model
final class PersonalRecord {
    @Attribute(.unique) var id: String
    var exerciseName: String
    var weight: Double
    var reps: Int
    var date: Date

    init(
        id: String = UUID().uuidString,
        exerciseName: String,
        weight: Double,
        reps: Int,
        date: Date = Date()
    ) {
        self.id = id
        self.exerciseName = exerciseName
        self.weight = weight
        self.reps = reps
        self.date = date
    }
}
