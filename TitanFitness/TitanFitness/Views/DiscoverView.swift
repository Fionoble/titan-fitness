import SwiftUI

// MARK: - Discover View
struct DiscoverView: View {
    let store: DataStore
    @Bindable var workoutVM: WorkoutViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 16) {
                        Text("Choose a workout style and we'll generate a plan tailored to your equipment.")
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.textSecondary)
                            .frame(maxWidth: .infinity, alignment: .leading)

                        LazyVGrid(columns: [
                            GridItem(.flexible(), spacing: 12),
                            GridItem(.flexible(), spacing: 12)
                        ], spacing: 12) {
                            ForEach(WorkoutStyle.allCases) { style in
                                styleCard(style)
                            }
                        }
                    }
                    .padding(.horizontal, Theme.paddingMedium)
                    .padding(.bottom, 40)
                }
            }
            .navigationTitle("Discover")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") {
                        dismiss()
                    }
                    .foregroundStyle(Theme.textSecondary)
                }
            }
        }
    }

    private func styleCard(_ style: WorkoutStyle) -> some View {
        Button {
            workoutVM.generateWorkout(style: style, store: store)
            dismiss()
        } label: {
            VStack(alignment: .leading, spacing: 10) {
                Image(systemName: style.icon)
                    .font(.system(size: 24))
                    .foregroundStyle(Color(hex: style.color))

                Text(style.label)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Theme.textPrimary)

                Text(style.description)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.textSecondary)
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(Color(hex: style.color).opacity(0.2), lineWidth: 1)
            )
        }
    }
}
