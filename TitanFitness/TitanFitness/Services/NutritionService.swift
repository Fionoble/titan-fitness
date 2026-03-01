import Foundation

// MARK: - Nutrition Service
/// Open Food Facts API integration and nutrition tracking
@Observable
final class NutritionService {
    static let shared = NutritionService()

    private var cache: [String: OpenFoodFactsProduct] = [:]

    // MARK: - Open Food Facts Lookup

    func lookupBarcode(_ barcode: String) async -> OpenFoodFactsProduct? {
        if let cached = cache[barcode] {
            return cached
        }

        guard let url = URL(string: "https://world.openfoodfacts.org/api/v0/product/\(barcode).json") else {
            return nil
        }

        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let response = try JSONDecoder().decode(OpenFoodFactsResponse.self, from: data)

            guard response.status == 1, let product = response.product else {
                return nil
            }

            cache[barcode] = product
            return product
        } catch {
            return nil
        }
    }

    // MARK: - Convert to Food Entry

    func createFoodEntry(from product: OpenFoodFactsProduct, mealType: MealType, servings: Double = 1.0) -> FoodEntry {
        FoodEntry(
            name: product.productName ?? "Unknown Food",
            brand: product.brands,
            mealType: mealType,
            calories: product.nutriments?.energyKcal100g ?? 0,
            protein: product.nutriments?.proteins100g ?? 0,
            carbs: product.nutriments?.carbohydrates100g ?? 0,
            fat: product.nutriments?.fat100g ?? 0,
            servingSize: product.servingSize ?? "100g",
            servings: servings
        )
    }
}

// MARK: - Open Food Facts API Models

struct OpenFoodFactsResponse: Codable {
    let status: Int
    let product: OpenFoodFactsProduct?
}

struct OpenFoodFactsProduct: Codable {
    let productName: String?
    let brands: String?
    let servingSize: String?
    let nutriments: OpenFoodFactsNutriments?

    enum CodingKeys: String, CodingKey {
        case productName = "product_name"
        case brands
        case servingSize = "serving_size"
        case nutriments
    }
}

struct OpenFoodFactsNutriments: Codable {
    let energyKcal100g: Double?
    let proteins100g: Double?
    let carbohydrates100g: Double?
    let fat100g: Double?

    enum CodingKeys: String, CodingKey {
        case energyKcal100g = "energy-kcal_100g"
        case proteins100g = "proteins_100g"
        case carbohydrates100g = "carbohydrates_100g"
        case fat100g = "fat_100g"
    }
}
