import Foundation
import SwiftData
import SwiftUI

// MARK: - DataStore
/// Central persistence layer using SwiftData, equivalent to the web app's db.ts
@Observable
final class DataStore {
    static let shared = DataStore()

    let modelContainer: ModelContainer

    init() {
        let schema = Schema([
            Equipment.self,
            WorkoutPlan.self,
            WorkoutSession.self,
            PersonalRecord.self,
            UserProfile.self,
            ChatMessage.self,
            FoodEntry.self,
            NutritionGoals.self,
            StarredFood.self,
        ])
        let config = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
        do {
            modelContainer = try ModelContainer(for: schema, configurations: [config])
        } catch {
            fatalError("Failed to create ModelContainer: \(error)")
        }
    }

    @MainActor
    var context: ModelContext {
        modelContainer.mainContext
    }

    // MARK: - Equipment

    @MainActor
    func getAllEquipment() -> [Equipment] {
        let descriptor = FetchDescriptor<Equipment>(sortBy: [SortDescriptor(\.name)])
        return (try? context.fetch(descriptor)) ?? []
    }

    @MainActor
    func getEnabledEquipment() -> [Equipment] {
        let descriptor = FetchDescriptor<Equipment>(
            predicate: #Predicate { $0.enabled },
            sortBy: [SortDescriptor(\.name)]
        )
        return (try? context.fetch(descriptor)) ?? []
    }

    @MainActor
    func initDefaultEquipment() {
        let existing = getAllEquipment()
        guard existing.isEmpty else { return }
        for item in Equipment.defaults {
            context.insert(item)
        }
        try? context.save()
    }

    @MainActor
    func toggleEquipment(_ equipment: Equipment) {
        equipment.enabled.toggle()
        try? context.save()
    }

    // MARK: - Workout Plans

    @MainActor
    func savePlan(_ plan: WorkoutPlan) {
        context.insert(plan)
        try? context.save()
    }

    @MainActor
    func getLatestPlan() -> WorkoutPlan? {
        var descriptor = FetchDescriptor<WorkoutPlan>(
            sortBy: [SortDescriptor(\.generatedAt, order: .reverse)]
        )
        descriptor.fetchLimit = 1
        return (try? context.fetch(descriptor))?.first
    }

    // MARK: - Workout Sessions

    @MainActor
    func saveSession(_ session: WorkoutSession) {
        context.insert(session)
        try? context.save()
    }

    @MainActor
    func getAllSessions() -> [WorkoutSession] {
        let descriptor = FetchDescriptor<WorkoutSession>(
            sortBy: [SortDescriptor(\.startedAt, order: .reverse)]
        )
        return (try? context.fetch(descriptor)) ?? []
    }

    @MainActor
    func getRecentSessions(limit: Int) -> [WorkoutSession] {
        var descriptor = FetchDescriptor<WorkoutSession>(
            sortBy: [SortDescriptor(\.startedAt, order: .reverse)]
        )
        descriptor.fetchLimit = limit
        return (try? context.fetch(descriptor)) ?? []
    }

    @MainActor
    func getSessionsByDateRange(start: Date, end: Date) -> [WorkoutSession] {
        let descriptor = FetchDescriptor<WorkoutSession>(
            predicate: #Predicate { $0.startedAt >= start && $0.startedAt <= end },
            sortBy: [SortDescriptor(\.startedAt, order: .reverse)]
        )
        return (try? context.fetch(descriptor)) ?? []
    }

    // MARK: - Personal Records

    @MainActor
    func savePersonalRecord(_ pr: PersonalRecord) {
        context.insert(pr)
        try? context.save()
    }

    @MainActor
    func getPersonalRecords() -> [PersonalRecord] {
        let descriptor = FetchDescriptor<PersonalRecord>(
            sortBy: [SortDescriptor(\.date, order: .reverse)]
        )
        return (try? context.fetch(descriptor)) ?? []
    }

    @MainActor
    func getRecordForExercise(_ exerciseName: String) -> PersonalRecord? {
        let descriptor = FetchDescriptor<PersonalRecord>(
            predicate: #Predicate { $0.exerciseName == exerciseName },
            sortBy: [SortDescriptor(\.weight, order: .reverse)]
        )
        return (try? context.fetch(descriptor))?.first
    }

    // MARK: - Profile

    @MainActor
    func getProfile() -> UserProfile {
        let descriptor = FetchDescriptor<UserProfile>()
        if let profile = (try? context.fetch(descriptor))?.first {
            return profile
        }
        let newProfile = UserProfile()
        context.insert(newProfile)
        try? context.save()
        return newProfile
    }

    @MainActor
    func saveProfile(_ profile: UserProfile) {
        try? context.save()
    }

    // MARK: - Chat Messages

    @MainActor
    func getChatMessages() -> [ChatMessage] {
        let descriptor = FetchDescriptor<ChatMessage>(
            sortBy: [SortDescriptor(\.timestamp)]
        )
        return (try? context.fetch(descriptor)) ?? []
    }

    @MainActor
    func saveChatMessage(_ message: ChatMessage) {
        context.insert(message)
        try? context.save()
    }

    @MainActor
    func clearChat() {
        let messages = getChatMessages()
        for msg in messages {
            context.delete(msg)
        }
        try? context.save()
    }

    // MARK: - Nutrition

    @MainActor
    func getFoodEntries(for date: Date) -> [FoodEntry] {
        let start = Calendar.current.startOfDay(for: date)
        let end = Calendar.current.date(byAdding: .day, value: 1, to: start) ?? start
        let descriptor = FetchDescriptor<FoodEntry>(
            predicate: #Predicate { $0.date >= start && $0.date < end },
            sortBy: [SortDescriptor(\.createdAt)]
        )
        return (try? context.fetch(descriptor)) ?? []
    }

    @MainActor
    func addFoodEntry(_ entry: FoodEntry) {
        context.insert(entry)
        try? context.save()
    }

    @MainActor
    func deleteFoodEntry(_ entry: FoodEntry) {
        context.delete(entry)
        try? context.save()
    }

    @MainActor
    func getNutritionGoals() -> NutritionGoals {
        let descriptor = FetchDescriptor<NutritionGoals>()
        if let goals = (try? context.fetch(descriptor))?.first {
            return goals
        }
        let defaultGoals = NutritionGoals()
        context.insert(defaultGoals)
        try? context.save()
        return defaultGoals
    }

    @MainActor
    func saveNutritionGoals(_ goals: NutritionGoals) {
        try? context.save()
    }

    @MainActor
    func getDailyNutritionSummary(for date: Date) -> DailyNutritionSummary {
        let entries = getFoodEntries(for: date)
        return DailyNutritionSummary(
            calories: entries.reduce(0) { $0 + $1.totalCalories },
            protein: entries.reduce(0) { $0 + $1.totalProtein },
            carbs: entries.reduce(0) { $0 + $1.totalCarbs },
            fat: entries.reduce(0) { $0 + $1.totalFat },
            entries: entries
        )
    }

    // MARK: - Starred Foods

    @MainActor
    func getStarredFoods() -> [StarredFood] {
        let descriptor = FetchDescriptor<StarredFood>(sortBy: [SortDescriptor(\.starredAt, order: .reverse)])
        return (try? context.fetch(descriptor)) ?? []
    }

    @MainActor
    func starFood(_ entry: FoodEntry) -> StarredFood {
        let starred = StarredFood(
            name: entry.name,
            calories: entry.calories,
            protein: entry.protein,
            carbs: entry.carbs,
            fat: entry.fat,
            servingSize: entry.servingSize,
            servings: entry.servings,
            barcode: entry.barcode
        )
        context.insert(starred)
        try? context.save()
        return starred
    }

    @MainActor
    func unstarFood(_ starred: StarredFood) {
        context.delete(starred)
        try? context.save()
    }

    @MainActor
    func getAllFoodEntries() -> [FoodEntry] {
        let descriptor = FetchDescriptor<FoodEntry>(sortBy: [SortDescriptor(\.createdAt, order: .reverse)])
        return (try? context.fetch(descriptor)) ?? []
    }

    @MainActor
    func isStarred(foodName: String) -> Bool {
        let normalizedName = foodName.lowercased().trimmingCharacters(in: .whitespaces)
        let starred = getStarredFoods()
        return starred.contains { $0.name.lowercased().trimmingCharacters(in: .whitespaces) == normalizedName }
    }

    @MainActor
    func findStarredFood(byName name: String) -> StarredFood? {
        let normalizedName = name.lowercased().trimmingCharacters(in: .whitespaces)
        return getStarredFoods().first { $0.name.lowercased().trimmingCharacters(in: .whitespaces) == normalizedName }
    }

    // MARK: - Previous Weights (for auto-fill)

    @MainActor
    func getPreviousWeights() -> [String: Double] {
        let sessions = getRecentSessions(limit: 10)
        var weights: [String: Double] = [:]
        for session in sessions {
            for exercise in session.exercises {
                let key = exercise.exerciseName.lowercased().trimmingCharacters(in: .whitespaces)
                if weights[key] == nil {
                    let maxWeight = exercise.sets.compactMap(\.weight).max()
                    if let w = maxWeight, w > 0 {
                        weights[key] = w
                    }
                }
            }
        }
        return weights
    }

    // MARK: - Data Export / Import

    @MainActor
    func exportAllData() -> String {
        var data: [String: Any] = [:]

        let equipment = getAllEquipment().map { [
            "id": $0.id, "name": $0.name, "category": $0.categoryRaw,
            "description": $0.descriptionText, "icon": $0.icon, "enabled": $0.enabled
        ] as [String: Any] }
        data["equipment"] = equipment

        let sessions = getAllSessions().map { [
            "id": $0.id, "name": $0.name, "style": $0.styleRaw,
            "startedAt": ISO8601DateFormatter().string(from: $0.startedAt),
            "totalVolume": $0.totalVolume, "totalSets": $0.totalSets
        ] as [String: Any] }
        data["sessions"] = sessions

        if let jsonData = try? JSONSerialization.data(withJSONObject: data, options: .prettyPrinted),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            return jsonString
        }
        return "{}"
    }
}
