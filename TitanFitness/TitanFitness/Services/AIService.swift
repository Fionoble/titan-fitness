import Foundation

// MARK: - AI Service
/// Port of src/ai.ts — supports Anthropic Claude and OpenAI
@Observable
final class AIService {
    static let shared = AIService()

    // Stored in UserDefaults
    var apiKey: String {
        get { UserDefaults.standard.string(forKey: "titan_ai_key") ?? "" }
        set { UserDefaults.standard.set(newValue, forKey: "titan_ai_key") }
    }

    var provider: AIProvider {
        get {
            let raw = UserDefaults.standard.string(forKey: "titan_ai_provider") ?? "anthropic"
            return AIProvider(rawValue: raw) ?? .anthropic
        }
        set { UserDefaults.standard.set(newValue.rawValue, forKey: "titan_ai_provider") }
    }

    var isConfigured: Bool {
        !apiKey.isEmpty
    }

    // MARK: - System Prompt Builder

    func buildSystemPrompt(equipment: [Equipment], recentSessions: [WorkoutSession], injuries: String? = nil, additionalEquipment: String? = nil) -> String {
        let enabledEquip = equipment.filter(\.enabled).map(\.name)
        let recentWorkouts = recentSessions.prefix(5).map { session in
            let exercises = session.exercises.map { "\($0.exerciseName) (\($0.sets.count) sets)" }.joined(separator: ", ")
            let dateStr = session.startedAt.formatted(date: .abbreviated, time: .omitted)
            return "- \(session.name) on \(dateStr): \(exercises), Volume: \(Int(session.totalVolume))lbs"
        }

        var prompt = """
        You are Titan, an expert AI fitness coach built into a home gym app. You're knowledgeable, encouraging, and adaptive.

        USER'S HOME GYM EQUIPMENT:
        \(enabledEquip.isEmpty ? "- No equipment configured yet (bodyweight only)" : enabledEquip.map { "- \($0)" }.joined(separator: "\n"))
        """

        if let extra = additionalEquipment, !extra.isEmpty {
            prompt += "\n\nADDITIONAL EQUIPMENT/NOTES:\n\(extra)"
        }

        if let injuries = injuries, !injuries.isEmpty {
            prompt += "\n\nCURRENT INJURIES/LIMITATIONS:\n\(injuries)\nIMPORTANT: Always account for these injuries. Avoid exercises that aggravate them and suggest alternatives."
        }

        prompt += """

        \nRECENT WORKOUT HISTORY:
        \(recentWorkouts.isEmpty ? "- No recent workouts yet" : recentWorkouts.joined(separator: "\n"))

        GUIDELINES:
        - Only suggest exercises the user can do with their available equipment
        - Reference their workout history to suggest progressive overload
        - If they mention an injury or limitation, immediately adapt recommendations
        - Keep responses concise and actionable
        - You can suggest workout modifications, recovery advice, form tips, and motivation
        - Be conversational and supportive, like a personal trainer
        """

        return prompt
    }

    // MARK: - Send Message

    func sendMessage(
        userMessage: String,
        chatHistory: [ChatMessage],
        equipment: [Equipment],
        recentSessions: [WorkoutSession],
        injuries: String? = nil,
        additionalEquipment: String? = nil
    ) async -> String {
        guard isConfigured else {
            return "I'd love to help! Please set up your AI API key in the Profile settings to enable the chat. You can use either an Anthropic or OpenAI key."
        }

        let systemPrompt = buildSystemPrompt(
            equipment: equipment,
            recentSessions: recentSessions,
            injuries: injuries,
            additionalEquipment: additionalEquipment
        )

        do {
            switch provider {
            case .anthropic:
                return try await callAnthropic(system: systemPrompt, history: chatHistory, userMessage: userMessage)
            case .openai:
                return try await callOpenAI(system: systemPrompt, history: chatHistory, userMessage: userMessage)
            }
        } catch {
            let message = error.localizedDescription
            if message.contains("401") {
                return "There's an issue with your API key. Please check it in Profile settings."
            }
            return "Sorry, I had trouble connecting. Error: \(message)"
        }
    }

    // MARK: - Estimate Nutrition from Text

    func estimateNutrition(foodDescription: String) async -> (name: String, calories: Double, protein: Double, carbs: Double, fat: Double)? {
        guard isConfigured else { return nil }

        let prompt = """
        Estimate the nutritional content of this food item. Return ONLY a JSON object with these exact keys: name (string, cleaned up food name), calories (number), protein (number in grams), carbs (number in grams), fat (number in grams). No explanation, no markdown, just the JSON object.

        Food: \(foodDescription)
        """

        do {
            let response: String
            switch provider {
            case .anthropic:
                response = try await callAnthropic(system: "You are a nutrition estimation assistant. Return only JSON.", history: [], userMessage: prompt)
            case .openai:
                response = try await callOpenAI(system: "You are a nutrition estimation assistant. Return only JSON.", history: [], userMessage: prompt)
            }

            // Parse JSON from response
            let cleaned = response.trimmingCharacters(in: .whitespacesAndNewlines)
                .replacingOccurrences(of: "```json", with: "")
                .replacingOccurrences(of: "```", with: "")
                .trimmingCharacters(in: .whitespacesAndNewlines)

            guard let data = cleaned.data(using: .utf8),
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                return nil
            }

            return (
                name: json["name"] as? String ?? foodDescription,
                calories: (json["calories"] as? NSNumber)?.doubleValue ?? 0,
                protein: (json["protein"] as? NSNumber)?.doubleValue ?? 0,
                carbs: (json["carbs"] as? NSNumber)?.doubleValue ?? 0,
                fat: (json["fat"] as? NSNumber)?.doubleValue ?? 0
            )
        } catch {
            return nil
        }
    }

    // MARK: - Anthropic API

    private func callAnthropic(system: String, history: [ChatMessage], userMessage: String) async throws -> String {
        var messages: [[String: String]] = history.suffix(20).map { [
            "role": $0.role == .user ? "user" : "assistant",
            "content": $0.content
        ] }
        messages.append(["role": "user", "content": userMessage])

        let body: [String: Any] = [
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 1024,
            "system": system,
            "messages": messages
        ]

        var request = URLRequest(url: URL(string: "https://api.anthropic.com/v1/messages")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw AIError.networkError("No HTTP response")
        }

        guard httpResponse.statusCode == 200 else {
            let text = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw AIError.apiError("Anthropic API error \(httpResponse.statusCode): \(text)")
        }

        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let content = json["content"] as? [[String: Any]],
              let text = content.first?["text"] as? String else {
            throw AIError.parseError("Failed to parse Anthropic response")
        }

        return text
    }

    // MARK: - OpenAI API

    private func callOpenAI(system: String, history: [ChatMessage], userMessage: String) async throws -> String {
        var messages: [[String: String]] = [["role": "system", "content": system]]
        for msg in history.suffix(20) {
            messages.append([
                "role": msg.role == .user ? "user" : "assistant",
                "content": msg.content
            ])
        }
        messages.append(["role": "user", "content": userMessage])

        let body: [String: Any] = [
            "model": "gpt-4o-mini",
            "messages": messages,
            "max_tokens": 1024
        ]

        var request = URLRequest(url: URL(string: "https://api.openai.com/v1/chat/completions")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw AIError.networkError("No HTTP response")
        }

        guard httpResponse.statusCode == 200 else {
            let text = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw AIError.apiError("OpenAI API error \(httpResponse.statusCode): \(text)")
        }

        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let choices = json["choices"] as? [[String: Any]],
              let message = choices.first?["message"] as? [String: Any],
              let text = message["content"] as? String else {
            throw AIError.parseError("Failed to parse OpenAI response")
        }

        return text
    }
}

// MARK: - AI Errors
enum AIError: LocalizedError {
    case networkError(String)
    case apiError(String)
    case parseError(String)

    var errorDescription: String? {
        switch self {
        case .networkError(let msg): msg
        case .apiError(let msg): msg
        case .parseError(let msg): msg
        }
    }
}
