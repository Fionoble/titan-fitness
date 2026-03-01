import SwiftUI

// MARK: - Exercise Card View
/// Card displaying exercise details in a workout plan
struct ExerciseCardView: View {
    let exercise: ExerciseTemplate
    let index: Int

    var body: some View {
        HStack(spacing: 12) {
            // Number badge
            ZStack {
                Circle()
                    .fill(Theme.primary.opacity(0.15))
                    .frame(width: 36, height: 36)
                Text("\(index + 1)")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.primary)
            }

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(exercise.name)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.textPrimary)

                    if let group = exercise.group {
                        Text(group)
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.black)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Theme.primary)
                            .clipShape(RoundedRectangle(cornerRadius: 4))
                    }
                }

                HStack(spacing: 8) {
                    Text(exercise.muscleGroup)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Theme.primary)

                    Text("\(exercise.sets) x \(exercise.reps)")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.textSecondary)

                    if let weight = exercise.weight {
                        Text("\(Int(weight)) lbs")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(Theme.textSecondary)
                    }
                }
            }

            Spacer()

            if !exercise.equipment.isEmpty {
                Image(systemName: "dumbbell.fill")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.textMuted)
            }
        }
        .padding(12)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
