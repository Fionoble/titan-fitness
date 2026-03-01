import Foundation
import SwiftUI

// MARK: - Coach View Model
@Observable
final class CoachViewModel {
    var messages: [ChatMessage] = []
    var inputText = ""
    var isLoading = false

    @MainActor
    func loadMessages(store: DataStore) {
        messages = store.getChatMessages()
    }

    @MainActor
    func sendMessage(store: DataStore) async {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }

        inputText = ""
        isLoading = true

        // Save user message
        let userMsg = ChatMessage(role: .user, content: text)
        store.saveChatMessage(userMsg)
        messages.append(userMsg)

        // Get context
        let equipment = store.getAllEquipment()
        let sessions = store.getRecentSessions(limit: 5)
        let profile = store.getProfile()

        // Call AI
        let response = await AIService.shared.sendMessage(
            userMessage: text,
            chatHistory: messages,
            equipment: equipment,
            recentSessions: sessions,
            injuries: profile.injuries,
            additionalEquipment: profile.additionalEquipment
        )

        // Save assistant message
        let assistantMsg = ChatMessage(role: .assistant, content: response)
        store.saveChatMessage(assistantMsg)
        messages.append(assistantMsg)

        isLoading = false
    }

    @MainActor
    func sendQuickAction(_ action: String, store: DataStore) async {
        inputText = action
        await sendMessage(store: store)
    }

    @MainActor
    func clearChat(store: DataStore) {
        store.clearChat()
        messages = []
    }

    var quickActions: [(label: String, icon: String, prompt: String)] {
        [
            ("Modify for Injury", "bandage.fill", "I have an injury. Can you modify my current workout to avoid aggravating it?"),
            ("Recovery Workout", "leaf.fill", "Generate a light recovery workout for today."),
            ("Explain Exercise", "questionmark.circle.fill", "Can you explain proper form for my exercises?"),
            ("Progressive Overload", "arrow.up.right", "How should I increase weights based on my recent workouts?"),
            ("Motivation", "flame.fill", "I need some motivation to work out today!"),
        ]
    }
}
