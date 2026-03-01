import SwiftUI

// MARK: - Titan Design System
enum Theme {
    // Colors matching the web PWA exactly
    static let primary = Color(hex: "2bee79")       // Bright green accent
    static let background = Color(hex: "102217")     // Deep dark green
    static let surface = Color(hex: "1a2e22")        // Card backgrounds
    static let surfaceLight = Color(hex: "243a2d")   // Slightly lighter surface
    static let textPrimary = Color.white
    static let textSecondary = Color(hex: "9ca3af")  // Gray-400
    static let textMuted = Color(hex: "6b7280")      // Gray-500

    // Workout style colors
    static let strengthColor = Color(hex: "2bee79")
    static let functionalColor = Color(hex: "60a5fa")
    static let hiitColor = Color(hex: "f97316")
    static let cardioColor = Color(hex: "ef4444")
    static let recoveryColor = Color(hex: "a78bfa")
    static let mobilityColor = Color(hex: "2dd4bf")
    static let powerColor = Color(hex: "eab308")
    static let enduranceColor = Color(hex: "ec4899")

    // Nutrition colors
    static let proteinColor = Color(hex: "60a5fa")
    static let carbsColor = Color(hex: "f97316")
    static let fatColor = Color(hex: "ec4899")
    static let calorieColor = Color(hex: "2bee79")

    // Typography
    static let titleFont = Font.system(size: 28, weight: .bold)
    static let headlineFont = Font.system(size: 20, weight: .semibold)
    static let bodyFont = Font.system(size: 16, weight: .regular)
    static let captionFont = Font.system(size: 13, weight: .regular)
    static let smallFont = Font.system(size: 11, weight: .medium)

    // Spacing
    static let paddingSmall: CGFloat = 8
    static let paddingMedium: CGFloat = 16
    static let paddingLarge: CGFloat = 24
    static let cornerRadius: CGFloat = 16
    static let cornerRadiusSmall: CGFloat = 10
}

// MARK: - Color Extension for Hex
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - View Modifiers
struct CardStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(Theme.paddingMedium)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius))
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 16, weight: .bold))
            .foregroundStyle(.black)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Theme.primary)
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius))
            .opacity(configuration.isPressed ? 0.8 : 1.0)
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
    }
}

extension View {
    func cardStyle() -> some View {
        modifier(CardStyle())
    }
}
