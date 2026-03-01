import Foundation
import SwiftData

// MARK: - Meal Type
enum MealType: String, Codable, CaseIterable, Identifiable {
    case breakfast
    case lunch
    case dinner
    case snacks

    var id: String { rawValue }

    var label: String {
        switch self {
        case .breakfast: "Breakfast"
        case .lunch: "Lunch"
        case .dinner: "Dinner"
        case .snacks: "Snacks"
        }
    }

    var icon: String {
        switch self {
        case .breakfast: "sun.rise.fill"
        case .lunch: "sun.max.fill"
        case .dinner: "moon.fill"
        case .snacks: "carrot.fill"
        }
    }
}

// MARK: - Food Entry
@Model
final class FoodEntry {
    @Attribute(.unique) var id: String
    var name: String
    var brand: String?
    var barcode: String?
    var mealTypeRaw: String
    var calories: Double
    var protein: Double
    var carbs: Double
    var fat: Double
    var servingSize: String?
    var servings: Double
    var date: Date
    var createdAt: Date

    var mealType: MealType {
        get { MealType(rawValue: mealTypeRaw) ?? .snacks }
        set { mealTypeRaw = newValue.rawValue }
    }

    // Computed totals based on servings
    var totalCalories: Double { calories * servings }
    var totalProtein: Double { protein * servings }
    var totalCarbs: Double { carbs * servings }
    var totalFat: Double { fat * servings }

    init(
        id: String = UUID().uuidString,
        name: String,
        brand: String? = nil,
        barcode: String? = nil,
        mealType: MealType,
        calories: Double,
        protein: Double,
        carbs: Double,
        fat: Double,
        servingSize: String? = nil,
        servings: Double = 1.0,
        date: Date = Date(),
        createdAt: Date = Date()
    ) {
        self.id = id
        self.name = name
        self.brand = brand
        self.barcode = barcode
        self.mealTypeRaw = mealType.rawValue
        self.calories = calories
        self.protein = protein
        self.carbs = carbs
        self.fat = fat
        self.servingSize = servingSize
        self.servings = servings
        self.date = Calendar.current.startOfDay(for: date)
        self.createdAt = createdAt
    }
}

// MARK: - Nutrition Goals
@Model
final class NutritionGoals {
    @Attribute(.unique) var id: String
    var calories: Double
    var protein: Double
    var carbs: Double
    var fat: Double

    init(
        id: String = "default",
        calories: Double = 2000,
        protein: Double = 150,
        carbs: Double = 200,
        fat: Double = 65
    ) {
        self.id = id
        self.calories = calories
        self.protein = protein
        self.carbs = carbs
        self.fat = fat
    }
}

// MARK: - Daily Summary (computed, not persisted)
struct DailyNutritionSummary {
    var calories: Double = 0
    var protein: Double = 0
    var carbs: Double = 0
    var fat: Double = 0
    var entries: [FoodEntry] = []

    func entriesForMeal(_ meal: MealType) -> [FoodEntry] {
        entries.filter { $0.mealType == meal }
    }

    func caloriesForMeal(_ meal: MealType) -> Double {
        entriesForMeal(meal).reduce(0) { $0 + $1.totalCalories }
    }
}
