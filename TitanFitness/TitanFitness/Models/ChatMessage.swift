import Foundation
import SwiftData

// MARK: - Chat Message Role
enum ChatRole: String, Codable {
    case user
    case assistant
}

// MARK: - Chat Message
@Model
final class ChatMessage {
    @Attribute(.unique) var id: String
    var roleRaw: String
    var content: String
    var timestamp: Date

    var role: ChatRole {
        get { ChatRole(rawValue: roleRaw) ?? .user }
        set { roleRaw = newValue.rawValue }
    }

    init(
        id: String = UUID().uuidString,
        role: ChatRole,
        content: String,
        timestamp: Date = Date()
    ) {
        self.id = id
        self.roleRaw = role.rawValue
        self.content = content
        self.timestamp = timestamp
    }
}
