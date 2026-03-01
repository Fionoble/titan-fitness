import SwiftUI
import SwiftData

// MARK: - Content View
struct ContentView: View {
    @State private var selectedTab: TabItem = .home
    @State private var workoutVM = WorkoutViewModel()
    @State private var nutritionVM = NutritionViewModel()

    private let store = DataStore.shared

    var body: some View {
        ZStack(alignment: .bottom) {
            // Tab Content
            Group {
                switch selectedTab {
                case .home:
                    HomeView(
                        store: store,
                        workoutVM: workoutVM,
                        nutritionVM: nutritionVM,
                        selectedTab: $selectedTab
                    )
                case .nutrition:
                    NutritionView(store: store, vm: nutritionVM)
                case .progress:
                    WorkoutProgressView(store: store)
                case .coach:
                    CoachView(store: store)
                case .profile:
                    ProfileView(store: store)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            // Custom Tab Bar
            tabBar
        }
        .preferredColorScheme(.dark)
        .onAppear {
            store.initDefaultEquipment()
        }
    }

    // MARK: - Tab Bar

    private var tabBar: some View {
        HStack {
            ForEach(TabItem.allCases) { tab in
                tabButton(tab)
            }
        }
        .padding(.horizontal, 8)
        .padding(.top, 8)
        .padding(.bottom, 4)
        .background(
            Theme.surface
                .shadow(color: .black.opacity(0.3), radius: 10, y: -4)
        )
    }

    private func tabButton(_ tab: TabItem) -> some View {
        Button {
            withAnimation(.easeInOut(duration: 0.15)) {
                selectedTab = tab
            }
        } label: {
            VStack(spacing: 4) {
                Image(systemName: tab.icon)
                    .font(.system(size: 20))
                    .foregroundStyle(selectedTab == tab ? Theme.primary : Theme.textMuted)

                Text(tab.label)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(selectedTab == tab ? Theme.primary : Theme.textMuted)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 4)
        }
    }
}
