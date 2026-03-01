import Foundation
import SwiftUI

// MARK: - Progress View Model
@Observable
final class ProgressViewModel {
    var sessions: [WorkoutSession] = []
    var personalRecords: [PersonalRecord] = []
    var weeklyVolume: [DailyVolume] = []
    var selectedWeekOffset = 0

    struct DailyVolume: Identifiable {
        let id = UUID()
        let date: Date
        let volume: Double
        let dayLabel: String
    }

    @MainActor
    func loadData(store: DataStore) {
        sessions = store.getAllSessions()
        personalRecords = store.getPersonalRecords()
        calculateWeeklyVolume(store: store)
    }

    @MainActor
    func calculateWeeklyVolume(store: DataStore) {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let weekStart = calendar.date(byAdding: .day, value: -6 + (selectedWeekOffset * 7), to: today)!

        weeklyVolume = (0..<7).map { dayOffset in
            let date = calendar.date(byAdding: .day, value: dayOffset, to: weekStart)!
            let nextDay = calendar.date(byAdding: .day, value: 1, to: date)!
            let daySessions = store.getSessionsByDateRange(start: date, end: nextDay)
            let totalVol = daySessions.reduce(0.0) { $0 + $1.totalVolume }

            let formatter = DateFormatter()
            formatter.dateFormat = "EEE"
            return DailyVolume(date: date, volume: totalVol, dayLabel: formatter.string(from: date))
        }
    }

    // MARK: - Computed

    var totalWorkouts: Int {
        sessions.count
    }

    var thisWeekWorkouts: Int {
        let calendar = Calendar.current
        let weekAgo = calendar.date(byAdding: .day, value: -7, to: Date())!
        return sessions.filter { $0.startedAt >= weekAgo }.count
    }

    var totalVolume: Double {
        sessions.reduce(0) { $0 + $1.totalVolume }
    }

    var consistencyPercentage: Double {
        // Percentage of days in last 4 weeks with a workout
        let calendar = Calendar.current
        let fourWeeksAgo = calendar.date(byAdding: .day, value: -28, to: Date())!
        let recentSessions = sessions.filter { $0.startedAt >= fourWeeksAgo }
        let uniqueDays = Set(recentSessions.map { calendar.startOfDay(for: $0.startedAt) })
        return Double(uniqueDays.count) / 28.0
    }

    var workoutDatesThisMonth: Set<Date> {
        let calendar = Calendar.current
        let startOfMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: Date()))!
        return Set(
            sessions
                .filter { $0.startedAt >= startOfMonth }
                .map { calendar.startOfDay(for: $0.startedAt) }
        )
    }

    var currentStreak: Int {
        let calendar = Calendar.current
        var streak = 0
        var checkDate = calendar.startOfDay(for: Date())

        while true {
            let nextDay = calendar.date(byAdding: .day, value: 1, to: checkDate)!
            let hasWorkout = sessions.contains { session in
                let sessionDay = calendar.startOfDay(for: session.startedAt)
                return sessionDay >= checkDate && sessionDay < nextDay
            }

            if hasWorkout {
                streak += 1
                checkDate = calendar.date(byAdding: .day, value: -1, to: checkDate)!
            } else if streak == 0 {
                // Check yesterday if today has no workout yet
                checkDate = calendar.date(byAdding: .day, value: -1, to: checkDate)!
                let hasYesterdayWorkout = sessions.contains { session in
                    let sessionDay = calendar.startOfDay(for: session.startedAt)
                    let nextD = calendar.date(byAdding: .day, value: 1, to: checkDate)!
                    return sessionDay >= checkDate && sessionDay < nextD
                }
                if hasYesterdayWorkout {
                    streak += 1
                    checkDate = calendar.date(byAdding: .day, value: -1, to: checkDate)!
                } else {
                    break
                }
            } else {
                break
            }
        }

        return streak
    }
}
