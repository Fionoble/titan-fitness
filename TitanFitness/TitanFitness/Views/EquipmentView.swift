import SwiftUI
import SwiftData

// MARK: - Equipment View
struct EquipmentView: View {
    let store: DataStore
    @Environment(\.dismiss) private var dismiss
    @State private var equipment: [Equipment] = []

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 20) {
                        infoCard

                        ForEach(EquipmentCategory.allCases, id: \.rawValue) { category in
                            categorySection(category)
                        }
                    }
                    .padding(.horizontal, Theme.paddingMedium)
                    .padding(.bottom, 40)
                }
            }
            .navigationTitle("Equipment")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        dismiss()
                    }
                    .foregroundStyle(Theme.primary)
                }
            }
            .onAppear {
                store.initDefaultEquipment()
                equipment = store.getAllEquipment()
            }
        }
    }

    // MARK: - Info Card

    private var infoCard: some View {
        HStack(spacing: 12) {
            Image(systemName: "info.circle.fill")
                .font(.system(size: 20))
                .foregroundStyle(Theme.primary)

            Text("Toggle the equipment you have at home. Workouts will only use exercises matching your gear.")
                .font(.system(size: 13))
                .foregroundStyle(Theme.textSecondary)
        }
        .padding(12)
        .background(Theme.primary.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding(.top, 8)
    }

    // MARK: - Category Section

    private func categorySection(_ category: EquipmentCategory) -> some View {
        let items = equipment.filter { $0.category == category }
        guard !items.isEmpty else { return AnyView(EmptyView()) }

        return AnyView(
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 8) {
                    Image(systemName: category.icon)
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.primary)
                    Text(category.label)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(Theme.textPrimary)
                }

                VStack(spacing: 8) {
                    ForEach(items, id: \.id) { item in
                        equipmentRow(item)
                    }
                }
            }
        )
    }

    private func equipmentRow(_ item: Equipment) -> some View {
        HStack(spacing: 12) {
            Image(systemName: item.icon)
                .font(.system(size: 18))
                .foregroundStyle(item.enabled ? Theme.primary : Theme.textMuted)
                .frame(width: 36, height: 36)
                .background(item.enabled ? Theme.primary.opacity(0.15) : Theme.surfaceLight)
                .clipShape(RoundedRectangle(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 2) {
                Text(item.name)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Theme.textPrimary)
                Text(item.descriptionText)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.textSecondary)
            }

            Spacer()

            Toggle("", isOn: Binding(
                get: { item.enabled },
                set: { _ in
                    store.toggleEquipment(item)
                    equipment = store.getAllEquipment()
                }
            ))
            .tint(Theme.primary)
            .labelsHidden()
        }
        .padding(12)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
