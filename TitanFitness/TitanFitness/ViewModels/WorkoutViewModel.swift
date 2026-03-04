import Foundation
import SwiftData
import SwiftUI

// MARK: - Workout View Model
@Observable
final class WorkoutViewModel {
    var currentPlan: WorkoutPlan?
    var isWorkoutActive = false
    var currentExerciseIndex = 0
    var exerciseLogs: [ExerciseLog] = []
    var restTimerSeconds = 0
    var restTimerActive = false
    var workoutStartTime: Date?
    var elapsedSeconds = 0

    // Completed workout state
    var todayCompletedSession: WorkoutSession?
    var showCompletedDetail = false

    private var restTimer: Timer?
    private var elapsedTimer: Timer?

    // MARK: - Generate Today's Workout

    @MainActor
    func generateTodayWorkout(store: DataStore) {
        let equipment = store.getEnabledEquipment()
        let recentSessions = store.getRecentSessions(limit: 5)
        let previousWeights = store.getPreviousWeights()
        let style = WorkoutEngine.getTodayStyle(recentSessions: recentSessions)

        let plan = WorkoutEngine.generateWorkout(
            enabledEquipment: equipment,
            style: style,
            recentSessions: recentSessions,
            previousWeights: previousWeights
        )

        store.savePlan(plan)
        currentPlan = plan
    }

    @MainActor
    func generateWorkout(style: WorkoutStyle, store: DataStore) {
        let equipment = store.getEnabledEquipment()
        let recentSessions = store.getRecentSessions(limit: 5)
        let previousWeights = store.getPreviousWeights()

        let plan = WorkoutEngine.generateWorkout(
            enabledEquipment: equipment,
            style: style,
            recentSessions: recentSessions,
            previousWeights: previousWeights
        )

        store.savePlan(plan)
        currentPlan = plan
    }

    @MainActor
    func loadLatestPlan(store: DataStore) {
        if currentPlan == nil {
            currentPlan = store.getLatestPlan()
        }
        // Generate fresh plan if none exists or it is from a previous day
        if currentPlan == nil || !Calendar.current.isDateInToday(currentPlan?.generatedAt ?? .distantPast) {
            generateTodayWorkout(store: store)
        }
        loadTodaySession(store: store)
    }

    @MainActor
    func loadTodaySession(store: DataStore) {
        let today = Calendar.current.startOfDay(for: Date())
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: today)!
        let todaySessions = store.getSessionsByDateRange(start: today, end: tomorrow)
        todayCompletedSession = todaySessions.first { $0.completedAt != nil }
    }

    // MARK: - Completed Workout Display Logic

    var planIsNewerThanSession: Bool {
        guard let session = todayCompletedSession,
              let completedAt = session.completedAt,
              let plan = currentPlan else { return false }
        return plan.generatedAt > completedAt
    }

    var showInlineCompletion: Bool {
        todayCompletedSession != nil && !planIsNewerThanSession
    }

    var showCompletedCard: Bool {
        todayCompletedSession != nil && planIsNewerThanSession
    }

    // MARK: - Start Workout

    func startWorkout() {
        guard let plan = currentPlan else { return }

        isWorkoutActive = true
        currentExerciseIndex = 0
        workoutStartTime = Date()
        elapsedSeconds = 0

        // Initialize exercise logs from plan
        exerciseLogs = plan.exercises.map { exercise in
            let sets = (0..<exercise.sets).map { i in
                SetLog(setNumber: i + 1, weight: exercise.weight, reps: nil, completed: false)
            }
            return ExerciseLog(
                exerciseId: exercise.id,
                exerciseName: exercise.name,
                muscleGroup: exercise.muscleGroup,
                sets: sets
            )
        }

        // Start elapsed timer
        elapsedTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.elapsedSeconds += 1
            }
        }
    }

    // MARK: - Complete Set

    func completeSet(exerciseIndex: Int, setIndex: Int, weight: Double?, reps: Int?) {
        guard exerciseIndex < exerciseLogs.count,
              setIndex < exerciseLogs[exerciseIndex].sets.count else { return }

        exerciseLogs[exerciseIndex].sets[setIndex].weight = weight
        exerciseLogs[exerciseIndex].sets[setIndex].reps = reps
        exerciseLogs[exerciseIndex].sets[setIndex].completed = true

        // Start rest timer
        if let plan = currentPlan, exerciseIndex < plan.exercises.count {
            let restSeconds = plan.exercises[exerciseIndex].restSeconds ?? 60
            startRestTimer(seconds: restSeconds)
        }
    }

    // MARK: - Rest Timer

    func startRestTimer(seconds: Int) {
        restTimerSeconds = seconds
        restTimerActive = true
        restTimer?.invalidate()
        restTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] timer in
            Task { @MainActor in
                guard let self else { timer.invalidate(); return }
                if self.restTimerSeconds > 0 {
                    self.restTimerSeconds -= 1
                } else {
                    self.restTimerActive = false
                    timer.invalidate()
                }
            }
        }
    }

    func skipRestTimer() {
        restTimerActive = false
        restTimerSeconds = 0
        restTimer?.invalidate()
    }

    // MARK: - Finish Workout

    @MainActor
    func finishWorkout(store: DataStore) {
        elapsedTimer?.invalidate()
        restTimer?.invalidate()
        restTimerActive = false

        guard let plan = currentPlan else { return }

        let totalVolume = exerciseLogs.reduce(0.0) { total, exerciseLog in
            total + exerciseLog.sets.reduce(0.0) { setTotal, setLog in
                guard setLog.completed else { return setTotal }
                return setTotal + (setLog.weight ?? 0) * Double(setLog.reps ?? 0)
            }
        }

        let totalSets = exerciseLogs.reduce(0) { $0 + $1.sets.filter(\.completed).count }

        // Check for personal records
        var prCount = 0
        for exerciseLog in exerciseLogs {
            for setLog in exerciseLog.sets where setLog.completed {
                if let weight = setLog.weight, let reps = setLog.reps {
                    let existing = store.getRecordForExercise(exerciseLog.exerciseName)
                    if existing == nil || weight > (existing?.weight ?? 0) {
                        let pr = PersonalRecord(
                            exerciseName: exerciseLog.exerciseName,
                            weight: weight,
                            reps: reps
                        )
                        store.savePersonalRecord(pr)
                        prCount += 1
                    }
                }
            }
        }

        let session = WorkoutSession(
            planId: plan.id,
            name: plan.name,
            style: plan.style,
            startedAt: workoutStartTime ?? Date(),
            completedAt: Date(),
            durationSeconds: elapsedSeconds,
            exercises: exerciseLogs,
            totalVolume: totalVolume,
            totalSets: totalSets,
            personalRecords: prCount
        )

        store.saveSession(session)
        todayCompletedSession = session
        isWorkoutActive = false
        currentExerciseIndex = 0
        exerciseLogs = []
    }

    // MARK: - Computed Properties

    var completionPercentage: Double {
        let totalSets = exerciseLogs.reduce(0) { $0 + $1.sets.count }
        guard totalSets > 0 else { return 0 }
        let completedSets = exerciseLogs.reduce(0) { $0 + $1.sets.filter(\.completed).count }
        return Double(completedSets) / Double(totalSets)
    }

    var formattedElapsedTime: String {
        let minutes = elapsedSeconds / 60
        let seconds = elapsedSeconds % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}
