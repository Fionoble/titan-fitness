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

    @MainActor
    func loadData(store: DataStore) {
        dailySummary = store.getDailyNutritionSummary(for: selectedDate)
        goals = store.getNutritionGoals()
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
