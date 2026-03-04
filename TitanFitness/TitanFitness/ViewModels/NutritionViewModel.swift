import Foundation
import SwiftUI

// MARK: - Nutrition View Model
@Observable
final class NutritionViewModel {
    var selectedDate: Date = Date()
    var dailySummary = DailyNutritionSummary()
    var goals = NutritionGoals()
    var showingAddFood = false
    var showingBarcode = false
    var showingAIQuickLog = false
    var scannedBarcode: String?
    var selectedMealType: MealType = .breakfast
    var expandedMeals: Set<MealType> = [.breakfast, .lunch, .dinner, .snacks]

    // Add food form
    var foodName = ""
    var foodCalories = ""
    var foodProtein = ""
    var foodCarbs = ""
    var foodFat = ""
    var foodServings = "1"
    var aiQuickLogText = ""
    var isAILoading = false

    // Recent & starred foods
    var recentFoods: [(food: FoodEntry, frequency: Int, lastUsed: Date, score: Double)] = []
    var starredFoods: [StarredFood] = []
    var recentSearchText = ""
    var showingRecentTab = true
    var addFoodTab = 0  // 0 = Recent, 1 = Manual, 2 = AI

    @MainActor
    func loadData(store: DataStore) {
        dailySummary = store.getDailyNutritionSummary(for: selectedDate)
        goals = store.getNutritionGoals()
        loadRecentAndStarred(store: store)
    }

    @MainActor
    func addManualEntry(store: DataStore) {
        let entry = FoodEntry(
            name: foodName,
            mealType: selectedMealType,
            calories: Double(foodCalories) ?? 0,
            protein: Double(foodProtein) ?? 0,
            carbs: Double(foodCarbs) ?? 0,
            fat: Double(foodFat) ?? 0,
            servings: Double(foodServings) ?? 1,
            date: selectedDate
        )
        store.addFoodEntry(entry)
        loadData(store: store)
        clearForm()
    }

    @MainActor
    func handleBarcodeScan(store: DataStore) async {
        guard let barcode = scannedBarcode else { return }

        if let product = await NutritionService.shared.lookupBarcode(barcode) {
            let entry = NutritionService.shared.createFoodEntry(from: product, mealType: selectedMealType)
            store.addFoodEntry(entry)
            loadData(store: store)
        }
        scannedBarcode = nil
    }

    @MainActor
    func aiQuickLog(store: DataStore) async {
        guard !aiQuickLogText.isEmpty else { return }
        isAILoading = true

        if let result = await AIService.shared.estimateNutrition(foodDescription: aiQuickLogText) {
            let entry = FoodEntry(
                name: result.name,
                mealType: selectedMealType,
                calories: result.calories,
                protein: result.protein,
                carbs: result.carbs,
                fat: result.fat,
                date: selectedDate
            )
            store.addFoodEntry(entry)
            loadData(store: store)
            aiQuickLogText = ""
        }

        isAILoading = false
    }

    @MainActor
    func deleteEntry(_ entry: FoodEntry, store: DataStore) {
        store.deleteFoodEntry(entry)
        loadData(store: store)
    }

    @MainActor
    func updateGoals(store: DataStore) {
        store.saveNutritionGoals(goals)
    }

    @MainActor
    func loadRecentAndStarred(store: DataStore) {
        starredFoods = store.getStarredFoods()

        let allEntries = store.getAllFoodEntries()
        var foodMap: [String: (food: FoodEntry, frequency: Int, lastUsed: Date)] = [:]

        for entry in allEntries {
            let key = entry.name.lowercased().trimmingCharacters(in: .whitespaces)
            if let existing = foodMap[key] {
                foodMap[key] = (food: entry.createdAt > existing.food.createdAt ? entry : existing.food,
                               frequency: existing.frequency + 1,
                               lastUsed: max(existing.lastUsed, entry.createdAt))
            } else {
                foodMap[key] = (food: entry, frequency: 1, lastUsed: entry.createdAt)
            }
        }

        let now = Date()
        recentFoods = foodMap.values.map { item in
            let daysSince = now.timeIntervalSince(item.lastUsed) / (60 * 60 * 24)
            let recencyScore = max(0, 1 - daysSince / 30)
            let score = Double(item.frequency) * 0.6 + recencyScore * 10 * 0.4
            return (food: item.food, frequency: item.frequency, lastUsed: item.lastUsed, score: score)
        }.sorted { $0.score > $1.score }

        showingRecentTab = !recentFoods.isEmpty || !starredFoods.isEmpty
    }

    @MainActor
    func toggleStar(_ entry: FoodEntry, store: DataStore) {
        if let existing = store.findStarredFood(byName: entry.name) {
            store.unstarFood(existing)
        } else {
            _ = store.starFood(entry)
        }
        loadRecentAndStarred(store: store)
    }

    @MainActor
    func toggleStarForStarred(_ starred: StarredFood, store: DataStore) {
        store.unstarFood(starred)
        loadRecentAndStarred(store: store)
    }

    @MainActor
    func addFromRecent(_ entry: FoodEntry, store: DataStore) {
        let copy = FoodEntry(
            name: entry.name,
            mealType: selectedMealType,
            calories: entry.calories,
            protein: entry.protein,
            carbs: entry.carbs,
            fat: entry.fat,
            servingSize: entry.servingSize,
            servings: entry.servings,
            date: selectedDate
        )
        store.addFoodEntry(copy)
        loadData(store: store)
    }

    @MainActor
    func addFromStarred(_ starred: StarredFood, store: DataStore) {
        let entry = FoodEntry(
            name: starred.name,
            mealType: selectedMealType,
            calories: starred.calories,
            protein: starred.protein,
            carbs: starred.carbs,
            fat: starred.fat,
            servingSize: starred.servingSize,
            servings: starred.servings,
            date: selectedDate
        )
        store.addFoodEntry(entry)
        loadData(store: store)
    }

    func isStarred(foodName: String) -> Bool {
        let key = foodName.lowercased().trimmingCharacters(in: .whitespaces)
        return starredFoods.contains { $0.name.lowercased().trimmingCharacters(in: .whitespaces) == key }
    }

    func clearForm() {
        foodName = ""
        foodCalories = ""
        foodProtein = ""
        foodCarbs = ""
        foodFat = ""
        foodServings = "1"
    }

    // Computed
    var calorieProgress: Double {
        guard goals.calories > 0 else { return 0 }
        return min(dailySummary.calories / goals.calories, 1.0)
    }

    var proteinProgress: Double {
        guard goals.protein > 0 else { return 0 }
        return min(dailySummary.protein / goals.protein, 1.0)
    }

    var carbsProgress: Double {
        guard goals.carbs > 0 else { return 0 }
        return min(dailySummary.carbs / goals.carbs, 1.0)
    }

    var fatProgress: Double {
        guard goals.fat > 0 else { return 0 }
        return min(dailySummary.fat / goals.fat, 1.0)
    }
}
