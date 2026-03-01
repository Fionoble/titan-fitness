import SwiftUI
import Charts

// MARK: - Progress View (renamed to avoid SwiftUI conflict)
struct WorkoutProgressView: View {
    let store: DataStore
    @State private var vm = ProgressViewModel()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    headerSection
                    statsRow
                    consistencyRing
                    volumeChart
                    calendarStrip
                    workoutHistory
                }
                .padding(.horizontal, Theme.paddingMedium)
                .padding(.bottom, 100)
            }
            .background(Theme.background)
            .navigationBarHidden(true)
            .onAppear {
                vm.loadData(store: store)
            }
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        HStack {
            Text("Progress")
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(Theme.textPrimary)
            Spacer()
        }
        .padding(.top, 20)
    }

    // MARK: - Stats Row

    private var statsRow: some View {
        HStack(spacing: 12) {
            statCard(value: "\(vm.totalWorkouts)", label: "Workouts", icon: "flame.fill")
            statCard(value: "\(vm.thisWeekWorkouts)", label: "This Week", icon: "calendar")
            statCard(value: "\(vm.currentStreak)", label: "Day Streak", icon: "bolt.fill")
        }
    }

    private func statCard(value: String, label: String, icon: String) -> some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundStyle(Theme.primary)
            Text(value)
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(Theme.textPrimary)
            Text(label)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Theme.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Consistency Ring

    private var consistencyRing: some View {
        VStack(spacing: 12) {
            Text("Consistency")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Theme.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)

            HStack(spacing: 24) {
                CalorieRingView(
                    consumed: vm.consistencyPercentage * 100,
                    goal: 100,
                    lineWidth: 10,
                    size: 100
                )

                VStack(alignment: .leading, spacing: 8) {
                    Text("\(Int(vm.consistencyPercentage * 100))%")
                        .font(.system(size: 32, weight: .bold))
                        .foregroundStyle(Theme.primary)
                    Text("of days active\nin the last 4 weeks")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.textSecondary)
                }

                Spacer()
            }
        }
        .cardStyle()
    }

    // MARK: - Volume Chart

    private var volumeChart: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Weekly Volume")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Theme.textPrimary)
                Spacer()
                Text("\(Int(vm.weeklyVolume.reduce(0) { $0 + $1.volume })) lbs")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.primary)
            }

            if #available(iOS 17.0, *) {
                Chart(vm.weeklyVolume) { item in
                    BarMark(
                        x: .value("Day", item.dayLabel),
                        y: .value("Volume", item.volume)
                    )
                    .foregroundStyle(Theme.primary)
                    .cornerRadius(4)
                }
                .chartYAxis {
                    AxisMarks(position: .leading) { _ in
                        AxisValueLabel()
                            .foregroundStyle(Theme.textMuted)
                    }
                }
                .chartXAxis {
                    AxisMarks { _ in
                        AxisValueLabel()
                            .foregroundStyle(Theme.textSecondary)
                    }
                }
                .frame(height: 180)
            }
        }
        .cardStyle()
    }

    // MARK: - Calendar Strip

    private var calendarStrip: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("This Month")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Theme.textPrimary)

            let calendar = Calendar.current
            let today = Date()
            let startOfMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: today))!
            let daysInMonth = calendar.range(of: .day, in: .month, for: today)!.count

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 7), spacing: 4) {
                // Day headers
                ForEach(["S", "M", "T", "W", "T", "F", "S"], id: \.self) { day in
                    Text(day)
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Theme.textMuted)
                        .frame(height: 20)
                }

                // Empty cells for offset
                let firstWeekday = calendar.component(.weekday, from: startOfMonth) - 1
                ForEach(0..<firstWeekday, id: \.self) { _ in
                    Color.clear.frame(height: 32)
                }

                // Day cells
                ForEach(1...daysInMonth, id: \.self) { day in
                    let date = calendar.date(byAdding: .day, value: day - 1, to: startOfMonth)!
                    let hasWorkout = vm.workoutDatesThisMonth.contains(calendar.startOfDay(for: date))
                    let isToday = calendar.isDateInToday(date)

                    ZStack {
                        if hasWorkout {
                            Circle()
                                .fill(Theme.primary)
                                .frame(width: 28, height: 28)
                        } else if isToday {
                            Circle()
                                .stroke(Theme.primary, lineWidth: 1.5)
                                .frame(width: 28, height: 28)
                        }

                        Text("\(day)")
                            .font(.system(size: 12, weight: hasWorkout ? .bold : .regular))
                            .foregroundStyle(hasWorkout ? .black : (isToday ? Theme.primary : Theme.textSecondary))
                    }
                    .frame(height: 32)
                }
            }
        }
        .cardStyle()
    }

    // MARK: - Workout History

    private var workoutHistory: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recent Workouts")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Theme.textPrimary)

            if vm.sessions.isEmpty {
                Text("No workouts yet. Start your first workout!")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.textSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
            } else {
                ForEach(vm.sessions.prefix(10), id: \.id) { session in
                    sessionRow(session)
                }
            }
        }
        .cardStyle()
    }

    private func sessionRow(_ session: WorkoutSession) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(session.name)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.textPrimary)

                HStack(spacing: 8) {
                    Text(session.startedAt.formatted(date: .abbreviated, time: .omitted))
                    Text("\(session.durationSeconds / 60) min")
                    Text("\(Int(session.totalVolume)) lbs")
                }
                .font(.system(size: 12))
                .foregroundStyle(Theme.textSecondary)
            }

            Spacer()

            if session.personalRecords > 0 {
                HStack(spacing: 2) {
                    Image(systemName: "trophy.fill")
                    Text("\(session.personalRecords)")
                }
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Color(hex: "eab308"))
            }
        }
        .padding(.vertical, 8)
    }
}
