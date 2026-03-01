import SwiftUI

// MARK: - Active Workout View
struct ActiveWorkoutView: View {
    let store: DataStore
    @Bindable var workoutVM: WorkoutViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var showFinishConfirm = false

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            VStack(spacing: 0) {
                // Top Bar
                topBar

                // Progress Bar
                progressBar

                // Content
                ScrollView {
                    VStack(spacing: 16) {
                        // Exercise Cards
                        ForEach(Array(workoutVM.exerciseLogs.enumerated()), id: \.element.exerciseId) { index, exerciseLog in
                            exerciseSection(index: index, exerciseLog: exerciseLog)
                        }
                    }
                    .padding(.horizontal, Theme.paddingMedium)
                    .padding(.bottom, 120)
                }

                // Rest Timer Overlay
                if workoutVM.restTimerActive {
                    RestTimerView(seconds: workoutVM.restTimerSeconds) {
                        workoutVM.skipRestTimer()
                    }
                    .transition(.move(edge: .bottom))
                }

                // Bottom Actions
                bottomBar
            }
        }
        .preferredColorScheme(.dark)
        .alert("Finish Workout?", isPresented: $showFinishConfirm) {
            Button("Finish", role: .destructive) {
                workoutVM.finishWorkout(store: store)
                dismiss()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Your workout will be saved with all completed sets.")
        }
    }

    // MARK: - Top Bar

    private var topBar: some View {
        HStack {
            Button {
                showFinishConfirm = true
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Theme.textSecondary)
                    .padding(8)
                    .background(Theme.surface)
                    .clipShape(Circle())
            }

            Spacer()

            VStack(spacing: 2) {
                Text(workoutVM.currentPlan?.name ?? "Workout")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Theme.textPrimary)
                Text(workoutVM.formattedElapsedTime)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Theme.primary)
                    .monospacedDigit()
            }

            Spacer()

            // Spacer to balance the X button
            Color.clear.frame(width: 32, height: 32)
        }
        .padding(.horizontal, Theme.paddingMedium)
        .padding(.vertical, 12)
    }

    // MARK: - Progress Bar

    private var progressBar: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Rectangle()
                    .fill(Theme.surface)
                    .frame(height: 4)

                Rectangle()
                    .fill(Theme.primary)
                    .frame(width: geo.size.width * workoutVM.completionPercentage, height: 4)
                    .animation(.easeInOut(duration: 0.3), value: workoutVM.completionPercentage)
            }
        }
        .frame(height: 4)
    }

    // MARK: - Exercise Section

    private func exerciseSection(index: Int, exerciseLog: ExerciseLog) -> some View {
        let template = workoutVM.currentPlan?.exercises[safe: index]

        return VStack(alignment: .leading, spacing: 8) {
            // Exercise header
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    HStack {
                        Text(exerciseLog.exerciseName)
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(Theme.textPrimary)

                        if let group = template?.group {
                            Text("Superset \(group)")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(.black)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Theme.primary)
                                .clipShape(RoundedRectangle(cornerRadius: 4))
                        }
                    }

                    Text(exerciseLog.muscleGroup)
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.primary)
                }
                Spacer()

                let completedCount = exerciseLog.sets.filter(\.completed).count
                Text("\(completedCount)/\(exerciseLog.sets.count)")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.textSecondary)
            }

            // Set Grid
            SetGridView(
                exerciseLog: exerciseLog,
                exerciseTemplate: template,
                onCompleteSet: { setIndex, weight, reps in
                    workoutVM.completeSet(exerciseIndex: index, setIndex: setIndex, weight: weight, reps: reps)
                }
            )
        }
        .padding(12)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius))
    }

    // MARK: - Bottom Bar

    private var bottomBar: some View {
        HStack(spacing: 12) {
            // Progress indicator
            Text("\(Int(workoutVM.completionPercentage * 100))% Complete")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.textSecondary)

            Spacer()

            Button {
                showFinishConfirm = true
            } label: {
                HStack {
                    Image(systemName: "checkmark")
                    Text("Finish")
                }
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(.black)
                .padding(.horizontal, 20)
                .padding(.vertical, 10)
                .background(Theme.primary)
                .clipShape(RoundedRectangle(cornerRadius: 20))
            }
        }
        .padding(.horizontal, Theme.paddingMedium)
        .padding(.vertical, 12)
        .background(Theme.background)
    }
}

// MARK: - Safe Array Access
extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
