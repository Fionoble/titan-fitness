import SwiftUI

// MARK: - Set Grid View
/// Grid for logging sets during an active workout
struct SetGridView: View {
    let exerciseLog: ExerciseLog
    let exerciseTemplate: ExerciseTemplate?
    let onCompleteSet: (Int, Double?, Int?) -> Void

    @State private var weightInputs: [String] = []
    @State private var repInputs: [String] = []

    init(exerciseLog: ExerciseLog, exerciseTemplate: ExerciseTemplate?, onCompleteSet: @escaping (Int, Double?, Int?) -> Void) {
        self.exerciseLog = exerciseLog
        self.exerciseTemplate = exerciseTemplate
        self.onCompleteSet = onCompleteSet
    }

    var body: some View {
        VStack(spacing: 8) {
            // Header row
            HStack {
                Text("SET")
                    .frame(width: 40)
                Text("PREV")
                    .frame(width: 60)
                Text("LBS")
                    .frame(maxWidth: .infinity)
                Text("REPS")
                    .frame(maxWidth: .infinity)
                Text("")
                    .frame(width: 44)
            }
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(Theme.textMuted)

            ForEach(Array(exerciseLog.sets.enumerated()), id: \.offset) { index, setLog in
                SetRowView(
                    setNumber: index + 1,
                    setLog: setLog,
                    placeholderWeight: exerciseTemplate?.weight,
                    placeholderReps: exerciseTemplate?.reps,
                    onComplete: { weight, reps in
                        onCompleteSet(index, weight, reps)
                    }
                )
            }
        }
        .padding(12)
        .background(Theme.surfaceLight)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

// MARK: - Set Row View
struct SetRowView: View {
    let setNumber: Int
    let setLog: SetLog
    let placeholderWeight: Double?
    let placeholderReps: String?
    let onComplete: (Double?, Int?) -> Void

    @State private var weightText = ""
    @State private var repsText = ""

    var body: some View {
        HStack {
            // Set number
            Text("\(setNumber)")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(setLog.completed ? Theme.primary : Theme.textSecondary)
                .frame(width: 40)

            // Previous
            Text(placeholderWeight.map { "\(Int($0))" } ?? "-")
                .font(.system(size: 13))
                .foregroundStyle(Theme.textMuted)
                .frame(width: 60)

            // Weight input
            TextField("0", text: $weightText)
                .keyboardType(.decimalPad)
                .font(.system(size: 15, weight: .medium))
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.textPrimary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 6))
                .disabled(setLog.completed)

            // Reps input
            TextField(placeholderReps ?? "0", text: $repsText)
                .keyboardType(.numberPad)
                .font(.system(size: 15, weight: .medium))
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.textPrimary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 6))
                .disabled(setLog.completed)

            // Complete button
            Button {
                let weight = Double(weightText) ?? placeholderWeight
                let reps = Int(repsText) ?? parseReps(placeholderReps)
                onComplete(weight, reps)
            } label: {
                Image(systemName: setLog.completed ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22))
                    .foregroundStyle(setLog.completed ? Theme.primary : Theme.textMuted)
            }
            .frame(width: 44)
            .disabled(setLog.completed)
        }
        .onAppear {
            if let w = setLog.weight {
                weightText = String(Int(w))
            } else if let pw = placeholderWeight {
                weightText = String(Int(pw))
            }
            if let r = setLog.reps {
                repsText = String(r)
            }
        }
    }

    private func parseReps(_ reps: String?) -> Int? {
        guard let reps else { return nil }
        // Try to parse first number from string like "10-12" or "10"
        let digits = reps.components(separatedBy: CharacterSet.decimalDigits.inverted)
        return digits.compactMap { Int($0) }.first
    }
}
