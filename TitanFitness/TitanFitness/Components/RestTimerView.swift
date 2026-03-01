import SwiftUI

// MARK: - Rest Timer View
/// Overlay showing rest timer between sets
struct RestTimerView: View {
    let seconds: Int
    let onSkip: () -> Void

    var body: some View {
        VStack(spacing: 20) {
            Text("REST")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Theme.textSecondary)
                .tracking(2)

            ZStack {
                Circle()
                    .stroke(Theme.surface, lineWidth: 8)
                    .frame(width: 120, height: 120)

                Circle()
                    .trim(from: 0, to: Double(seconds) / 60.0)
                    .stroke(Theme.primary, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                    .frame(width: 120, height: 120)
                    .rotationEffect(.degrees(-90))
                    .animation(.linear(duration: 1), value: seconds)

                Text("\(seconds)")
                    .font(.system(size: 48, weight: .bold))
                    .foregroundStyle(Theme.textPrimary)
                    .monospacedDigit()
            }

            Button(action: onSkip) {
                Text("Skip Rest")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.primary)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 10)
                    .background(Theme.primary.opacity(0.15))
                    .clipShape(RoundedRectangle(cornerRadius: 20))
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
        .background(Theme.background.opacity(0.95))
        .clipShape(RoundedRectangle(cornerRadius: 20))
    }
}
