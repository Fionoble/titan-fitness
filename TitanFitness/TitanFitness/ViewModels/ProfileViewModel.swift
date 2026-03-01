import Foundation
import SwiftUI

// MARK: - Profile View Model
@Observable
final class ProfileViewModel {
    var profile = UserProfile()
    var isEditingName = false
    var nameField = ""
    var weightField = ""
    var heightField = ""
    var ageField = ""
    var injuriesField = ""
    var apiKeyField = ""
    var selectedProvider: AIProvider = .anthropic
    var showingExport = false
    var exportData = ""

    @MainActor
    func loadProfile(store: DataStore) {
        profile = store.getProfile()
        nameField = profile.name
        weightField = profile.weight.map { String(Int($0)) } ?? ""
        heightField = profile.height.map { String(Int($0)) } ?? ""
        ageField = profile.age.map { String($0) } ?? ""
        injuriesField = profile.injuries ?? ""

        // Load AI config
        apiKeyField = AIService.shared.apiKey
        selectedProvider = AIService.shared.provider
    }

    @MainActor
    func saveName(store: DataStore) {
        profile.name = nameField
        store.saveProfile(profile)
        isEditingName = false
    }

    @MainActor
    func saveWeight(store: DataStore) {
        profile.weight = Double(weightField)
        store.saveProfile(profile)
    }

    @MainActor
    func saveHeight(store: DataStore) {
        profile.height = Double(heightField)
        store.saveProfile(profile)
    }

    @MainActor
    func saveAge(store: DataStore) {
        profile.age = Int(ageField)
        store.saveProfile(profile)
    }

    @MainActor
    func saveInjuries(store: DataStore) {
        profile.injuries = injuriesField.isEmpty ? nil : injuriesField
        store.saveProfile(profile)
    }

    @MainActor
    func saveAIConfig() {
        AIService.shared.apiKey = apiKeyField
        AIService.shared.provider = selectedProvider
    }

    @MainActor
    func exportAllData(store: DataStore) {
        exportData = store.exportAllData()
        showingExport = true
    }
}
