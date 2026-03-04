import SwiftUI

// MARK: - Home View
struct HomeView: View {
    @Environment(\.modelContext) private var modelContext
    let store: DataStore
    @Bindable var workoutVM: WorkoutViewModel
    let nutritionVM: NutritionViewModel
    @Binding var selectedTab: TabItem
    @State private var showDiscover = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    // Header
                    headerSection

                    // Completed Today card (collapsed, when plan is newer)
                    if workoutVM.showCompletedCard, let session = workoutVM.todayCompletedSession {
                        completedTodayCard(session)
                    }

                    // Main content: inline completion or workout plan
                    if workoutVM.showInlineCompletion, let session = workoutVM.todayCompletedSession {
                        WorkoutCompleteView(session: session, onGenerateNew: {
                            workoutVM.generateTodayWorkout(store: store)
                        })
                    } else if let plan = workoutVM.currentPlan {
                        workoutCard(plan)
                    } else {
                        loadingCard
                    }

                    // Quick Actions
                    quickActionsRow

                    // Nutrition Summary Card
                    nutritionSummaryCard

                    // Discover Card
                    discoverCard
                }
                .padding(.horizontal, Theme.paddingMedium)
                .padding(.bottom, 100)
            }
            .background(Theme.background)
            .navigationBarHidden(true)
            .onAppear {
                workoutVM.loadLatestPlan(store: store)
                nutritionVM.loadData(store: store)
            }
            .fullScreenCover(isPresented: $workoutVM.isWorkoutActive) {
                ActiveWorkoutView(store: store, workoutVM: workoutVM)
            }
            .sheet(isPresented: $showDiscover) {
                DiscoverView(store: store, workoutVM: workoutVM)
            }
            .sheet(isPresented: $workoutVM.showCompletedDetail) {
                if let session = workoutVM.todayCompletedSession {
                    WorkoutCompleteView(session: session, showCloseButton: true) {
                        workoutVM.showCompletedDetail = false
                    }
                }
            }
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(greetingText)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Theme.textSecondary)
                Text(workoutVM.showInlineCompletion ? "Workout Done" : "Today's Plan")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(Theme.textPrimary)
            }
            Spacer()
            Image(systemName: workoutVM.showInlineCompletion ? "trophy.fill" : "bolt.fill")
                .font(.system(size: 24))
                .foregroundStyle(Theme.primary)
        }
        .padding(.top, 20)
    }

    private var greetingText: String {
        let hour = Calendar.current.component(.hour, from: Date())
        if hour < 12 { return "Good Morning" }
        if hour < 17 { return "Good Afternoon" }
        return "Good Evening"
    }

    // MARK: - Completed Today Card (Collapsed)

    private func completedTodayCard(_ session: WorkoutSession) -> some View {
        Button {
            workoutVM.showCompletedDetail = true
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "trophy.fill")
                    .font(.system(size: 24))
                    .foregroundStyle(Theme.primary)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Completed Today")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.textPrimary)
                    Text(session.name)
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.textSecondary)
                }

                Spacer()

                HStack(spacing: 12) {
                    completedStatPill(value: formatDuration(session.durationSeconds), icon: "clock")
                    completedStatPill(value: "\(session.totalSets)", icon: "checkmark.circle.fill")
                }

                Image(systemName: "chevron.right")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.textMuted)
            }
            .padding(Theme.paddingMedium)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cornerRadius)
                    .stroke(Theme.primary.opacity(0.15), lineWidth: 1.5)
            )
        }
    }

    private func completedStatPill(value: String, icon: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 11))
            Text(value)
                .font(.system(size: 12, weight: .medium))
        }
        .foregroundStyle(Theme.textSecondary)
    }

    private func formatDuration(_ seconds: Int) -> String {
        let minutes = seconds / 60
        let secs = seconds % 60
        return String(format: "%d:%02d", minutes, secs)
    }

    // MARK: - Workout Card

    private func workoutCard(_ plan: WorkoutPlan) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            // Title and info
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(plan.name)
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(Theme.textPrimary)

                    HStack(spacing: 12) {
                        Label("\(plan.durationMin) min", systemImage: "clock")
                        Label("\(plan.estimatedCalories) cal", systemImage: "flame.fill")
                        HStack(spacing: 2) {
                            ForEach(0..<plan.intensity, id: \.self) { _ in
                                Image(systemName: "bolt.fill")
                                    .font(.system(size: 10))
                            }
                        }
                    }
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.textSecondary)
                }
                Spacer()

                Button {
                    workoutVM.generateTodayWorkout(store: store)
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 16))
                        .foregroundStyle(Theme.primary)
                        .padding(8)
                        .background(Theme.primary.opacity(0.15))
                        .clipShape(Circle())
                }
            }

            // Exercise list
            VStack(spacing: 8) {
                ForEach(Array(plan.exercises.enumerated()), id: \.element.id) { index, exercise in
                    ExerciseCardView(exercise: exercise, index: index)
                }
            }

            // Start button
            Button {
                workoutVM.startWorkout()
            } label: {
                HStack {
                    Image(systemName: "play.fill")
                    Text("START WORKOUT")
                }
            }
            .buttonStyle(PrimaryButtonStyle())
        }
        .cardStyle()
    }

    private var loadingCard: some View {
        VStack(spacing: 12) {
            ProgressView()
                .tint(Theme.primary)
            Text("Generating your workout...")
                .font(.system(size: 14))
                .foregroundStyle(Theme.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(40)
        .cardStyle()
    }

    // MARK: - Quick Actions

    private var quickActionsRow: some View {
        HStack(spacing: 12) {
            quickActionButton(icon: "figure.run", label: "Cardio") {
                workoutVM.generateWorkout(style: .cardio, store: store)
            }
            quickActionButton(icon: "leaf.fill", label: "Recovery") {
                workoutVM.generateWorkout(style: .recovery, store: store)
            }
            quickActionButton(icon: "bolt.fill", label: "HIIT") {
                workoutVM.generateWorkout(style: .hiit, store: store)
            }
        }
    }

    private func quickActionButton(icon: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 20))
                    .foregroundStyle(Theme.primary)
                Text(label)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.textSecondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }

    // MARK: - Nutrition Summary

    private var nutritionSummaryCard: some View {
        Button {
            selectedTab = .nutrition
        } label: {
            HStack(spacing: 16) {
                MiniRingView(progress: nutritionVM.calorieProgress, color: Theme.primary, size: 48)

                VStack(alignment: .leading, spacing: 4) {
                    Text("Today's Nutrition")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.textPrimary)
                    Text("\(Int(nutritionVM.dailySummary.calories)) / \(Int(nutritionVM.goals.calories)) cal")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.textSecondary)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.textMuted)
            }
            .cardStyle()
        }
    }

    // MARK: - Discover Card

    private var discoverCard: some View {
        Button {
            showDiscover = true
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Discover Workouts")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(Theme.textPrimary)
                    Text("Browse styles & generate custom workouts")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.textSecondary)
                }
                Spacer()
                Image(systemName: "sparkles")
                    .font(.system(size: 24))
                    .foregroundStyle(Theme.primary)
            }
            .cardStyle()
        }
    }
}
