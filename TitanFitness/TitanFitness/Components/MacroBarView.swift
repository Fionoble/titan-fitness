import SwiftUI

// MARK: - Macro Bar View
/// Horizontal progress bar for macronutrient tracking
struct MacroBarView: View {
    let label: String
    let current: Double
    let goal: Double
    let color: Color
    let unit: String

    init(label: String, current: Double, goal: Double, color: Color, unit: String = "g") {
        self.label = label
        self.current = current
        self.goal = goal
        self.color = color
        self.unit = unit
    }

    private var progress: Double {
        guard goal > 0 else { return 0 }
        return min(current / goal, 1.0)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(label)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Theme.textSecondary)

                Spacer()

                Text("\(Int(current))/\(Int(goal))\(unit)")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.textPrimary)
            }

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    // Background
                    RoundedRectangle(cornerRadius: 4)
                        .fill(color.opacity(0.15))
                        .frame(height: 8)

                    // Progress
                    RoundedRectangle(cornerRadius: 4)
                        .fill(color)
                        .frame(width: max(0, geo.size.width * progress), height: 8)
                        .animation(.easeInOut(duration: 0.4), value: progress)
                }
            }
            .frame(height: 8)
        }
    }
}
