import SwiftUI

// MARK: - Workout Complete View
struct WorkoutCompleteView: View {
    let session: WorkoutSession
    var showCloseButton = false
    var onClose: (() -> Void)?
    var onGenerateNew: (() -> Void)?

    // Stat colors matching the web app
    private let blueColor = Color(hex: "60a5fa")
    private let yellowColor = Color(hex: "fbbf24")
    private let roseColor = Color(hex: "f87171")

    // MARK: - Computed Stats

    private var durationFormatted: String {
        let minutes = session.durationSeconds / 60
        let seconds = session.durationSeconds % 60
        return String(format: "%d:%02d", minutes, seconds)
    }

    private var exerciseCount: Int {
        session.exercises.count
    }

    private var totalReps: Int {
        session.exercises.reduce(0) { total, exercise in
            total + exercise.sets.reduce(0) { setTotal, setLog in
                guard setLog.completed else { return setTotal }
                return setTotal + (setLog.reps ?? 0)
            }
        }
    }

    private var formattedVolume: String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: session.totalVolume)) ?? "\(Int(session.totalVolume))"
    }

    private var musclesWorked: [String] {
        let muscles = Set(session.exercises.map(\.muscleGroup))
        return Array(muscles).sorted()
    }

    // MARK: - Body

    var body: some View {
        ZStack(alignment: .topTrailing) {
            ScrollView {
                VStack(spacing: 20) {
                    // Trophy + Title
                    trophyHeader

                    // 2x2 Stats Grid
                    statsGrid

                    // Total Volume
                    if session.totalVolume > 0 {
                        volumeCard
                    }

                    // Muscles Worked
                    if !musclesWorked.isEmpty {
                        musclesSection
                    }

                    // Exercise Breakdown
                    exerciseBreakdown

                    // Generate New Workout button
                    if let onGenerateNew {
                        Button {
                            onGenerateNew()
                        } label: {
                            HStack {
                                Image(systemName: "arrow.clockwise")
                                Text("Generate Another Workout")
                            }
                        }
                        .buttonStyle(PrimaryButtonStyle())
                        .padding(.top, 8)
                    }
                }
                .padding(.horizontal, Theme.paddingMedium)
                .padding(.top, showCloseButton ? 48 : 20)
                .padding(.bottom, 40)
            }
            .background(showCloseButton ? Theme.background : Color.clear)

            // Close button
            if showCloseButton {
                Button {
                    onClose?()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.textSecondary)
                        .padding(10)
                        .background(Theme.surfaceLight)
                        .clipShape(Circle())
                }
                .padding(.top, 12)
                .padding(.trailing, Theme.paddingMedium)
            }
        }
    }

    // MARK: - Trophy Header

    private var trophyHeader: some View {
        VStack(spacing: 12) {
            Image(systemName: "trophy.fill")
                .font(.system(size: 48))
                .foregroundStyle(Theme.primary)

            Text("Workout Complete!")
                .font(.system(size: 24, weight: .bold))
                .foregroundStyle(Theme.textPrimary)

            Text(session.name)
                .font(.system(size: 15))
                .foregroundStyle(Theme.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }

    // MARK: - Stats Grid

    private var statsGrid: some View {
        LazyVGrid(columns: [
            GridItem(.flexible(), spacing: 12),
            GridItem(.flexible(), spacing: 12),
        ], spacing: 12) {
            statCard(icon: "clock", iconColor: Theme.primary, value: durationFormatted, label: "Duration")
            statCard(icon: "figure.strengthtraining.traditional", iconColor: blueColor, value: "\(exerciseCount)", label: "Exercises")
            statCard(icon: "checkmark.circle.fill", iconColor: yellowColor, value: "\(session.totalSets)", label: "Sets")
            statCard(icon: "repeat", iconColor: roseColor, value: "\(totalReps)", label: "Total Reps")
        }
    }

    private func statCard(icon: String, iconColor: Color, value: String, label: String) -> some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundStyle(iconColor)
            Text(value)
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(Theme.textPrimary)
            Text(label)
                .font(.system(size: 12))
                .foregroundStyle(Theme.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall))
    }

    // MARK: - Volume Card

    private var volumeCard: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Total Volume")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.textSecondary)
                Text("\(formattedVolume) lbs")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(Theme.textPrimary)
            }
            Spacer()
            Image(systemName: "scalemass.fill")
                .font(.system(size: 24))
                .foregroundStyle(Theme.primary)
        }
        .cardStyle()
    }

    // MARK: - Muscles Worked

    private var musclesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Muscles Worked")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.textPrimary)

            FlowLayout(spacing: 8) {
                ForEach(musclesWorked, id: \.self) { muscle in
                    Text(muscle.capitalized)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Theme.primary)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Theme.primary.opacity(0.15))
                        .clipShape(Capsule())
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardStyle()
    }

    // MARK: - Exercise Breakdown

    private var exerciseBreakdown: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Exercise Breakdown")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.textPrimary)

            ForEach(session.exercises, id: \.exerciseId) { exercise in
                exerciseRow(exercise)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardStyle()
    }

    private func exerciseRow(_ exercise: ExerciseLog) -> some View {
        let completedSets = exercise.sets.filter(\.completed)
        let bestSet = completedSets.max { a, b in
            ((a.weight ?? 0) * Double(a.reps ?? 0)) < ((b.weight ?? 0) * Double(b.reps ?? 0))
        }

        return HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(exercise.exerciseName)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.textPrimary)

                HStack(spacing: 8) {
                    Text(exercise.muscleGroup.capitalized)
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.textMuted)

                    if let best = bestSet, let w = best.weight, let r = best.reps {
                        Text("Best: \(Int(w)) lbs x \(r)")
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.primary)
                    }
                }
            }
            Spacer()
            Text("\(completedSets.count) sets")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Theme.textSecondary)
        }
        .padding(.vertical, 6)
    }
}

// MARK: - Flow Layout for muscle pills
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = computeLayout(proposal: proposal, subviews: subviews)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = computeLayout(proposal: proposal, subviews: subviews)
        for (index, position) in result.positions.enumerated() {
            subviews[index].place(
                at: CGPoint(x: bounds.minX + position.x, y: bounds.minY + position.y),
                proposal: .unspecified
            )
        }
    }

    private struct LayoutResult {
        var size: CGSize
        var positions: [CGPoint]
    }

    private func computeLayout(proposal: ProposedViewSize, subviews: Subviews) -> LayoutResult {
        let maxWidth = proposal.width ?? .infinity
        var positions: [CGPoint] = []
        var currentX: CGFloat = 0
        var currentY: CGFloat = 0
        var lineHeight: CGFloat = 0
        var totalHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if currentX + size.width > maxWidth, currentX > 0 {
                currentX = 0
                currentY += lineHeight + spacing
                lineHeight = 0
            }
            positions.append(CGPoint(x: currentX, y: currentY))
            lineHeight = max(lineHeight, size.height)
            currentX += size.width + spacing
            totalHeight = currentY + lineHeight
        }

        return LayoutResult(
            size: CGSize(width: maxWidth, height: totalHeight),
            positions: positions
        )
    }
}
