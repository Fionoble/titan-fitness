import SwiftUI

// MARK: - Calorie Ring View
/// Circular progress ring for calorie tracking
struct CalorieRingView: View {
    let consumed: Double
    let goal: Double
    let lineWidth: CGFloat
    let size: CGFloat

    init(consumed: Double, goal: Double, lineWidth: CGFloat = 12, size: CGFloat = 160) {
        self.consumed = consumed
        self.goal = goal
        self.lineWidth = lineWidth
        self.size = size
    }

    private var progress: Double {
        guard goal > 0 else { return 0 }
        return min(consumed / goal, 1.0)
    }

    private var remaining: Int {
        max(0, Int(goal - consumed))
    }

    var body: some View {
        ZStack {
            // Background ring
            Circle()
                .stroke(Theme.surface, lineWidth: lineWidth)
                .frame(width: size, height: size)

            // Progress ring
            Circle()
                .trim(from: 0, to: progress)
                .stroke(
                    Theme.primary,
                    style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
                )
                .frame(width: size, height: size)
                .rotationEffect(.degrees(-90))
                .animation(.easeInOut(duration: 0.5), value: progress)

            // Center text
            VStack(spacing: 2) {
                Text("\(remaining)")
                    .font(.system(size: size * 0.2, weight: .bold))
                    .foregroundStyle(Theme.textPrimary)
                Text("remaining")
                    .font(.system(size: size * 0.08, weight: .medium))
                    .foregroundStyle(Theme.textSecondary)
            }
        }
    }
}

// MARK: - Mini Ring
struct MiniRingView: View {
    let progress: Double
    let color: Color
    let size: CGFloat

    init(progress: Double, color: Color, size: CGFloat = 40) {
        self.progress = progress
        self.color = color
        self.size = size
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(color.opacity(0.2), lineWidth: 4)
                .frame(width: size, height: size)

            Circle()
                .trim(from: 0, to: min(progress, 1.0))
                .stroke(color, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                .frame(width: size, height: size)
                .rotationEffect(.degrees(-90))
        }
    }
}
