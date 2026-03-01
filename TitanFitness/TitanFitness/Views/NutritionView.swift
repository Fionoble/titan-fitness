import SwiftUI

// MARK: - Nutrition View
struct NutritionView: View {
    let store: DataStore
    @Bindable var vm: NutritionViewModel
    @State private var showingGoalsEditor = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    headerSection
                    calorieRingSection
                    macrosSection
                    mealSections
                    addFoodButtons
                }
                .padding(.horizontal, Theme.paddingMedium)
                .padding(.bottom, 100)
            }
            .background(Theme.background)
            .navigationBarHidden(true)
            .onAppear {
                vm.loadData(store: store)
            }
            .sheet(isPresented: $vm.showingAddFood) {
                addFoodSheet
            }
            .sheet(isPresented: $vm.showingBarcode) {
                BarcodeScannerView(scannedCode: $vm.scannedBarcode, isPresented: $vm.showingBarcode)
                    .ignoresSafeArea()
            }
            .sheet(isPresented: $showingGoalsEditor) {
                goalsEditorSheet
            }
            .onChange(of: vm.scannedBarcode) { _, _ in
                Task {
                    await vm.handleBarcodeScan(store: store)
                }
            }
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        HStack {
            Text("Nutrition")
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(Theme.textPrimary)

            Spacer()

            Button {
                showingGoalsEditor = true
            } label: {
                Image(systemName: "gearshape.fill")
                    .font(.system(size: 16))
                    .foregroundStyle(Theme.textSecondary)
            }
        }
        .padding(.top, 20)
    }

    // MARK: - Calorie Ring

    private var calorieRingSection: some View {
        VStack(spacing: 16) {
            CalorieRingView(
                consumed: vm.dailySummary.calories,
                goal: vm.goals.calories,
                lineWidth: 14,
                size: 180
            )

            HStack(spacing: 24) {
                VStack(spacing: 2) {
                    Text("\(Int(vm.dailySummary.calories))")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(Theme.textPrimary)
                    Text("Consumed")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.textSecondary)
                }

                VStack(spacing: 2) {
                    Text("\(Int(vm.goals.calories))")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(Theme.textPrimary)
                    Text("Goal")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.textSecondary)
                }

                VStack(spacing: 2) {
                    Text("\(max(0, Int(vm.goals.calories - vm.dailySummary.calories)))")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(Theme.primary)
                    Text("Remaining")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.textSecondary)
                }
            }
        }
        .cardStyle()
    }

    // MARK: - Macros

    private var macrosSection: some View {
        VStack(spacing: 12) {
            Text("Macronutrients")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Theme.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)

            MacroBarView(label: "Protein", current: vm.dailySummary.protein, goal: vm.goals.protein, color: Theme.proteinColor)
            MacroBarView(label: "Carbs", current: vm.dailySummary.carbs, goal: vm.goals.carbs, color: Theme.carbsColor)
            MacroBarView(label: "Fat", current: vm.dailySummary.fat, goal: vm.goals.fat, color: Theme.fatColor)
        }
        .cardStyle()
    }

    // MARK: - Meal Sections

    private var mealSections: some View {
        VStack(spacing: 8) {
            ForEach(MealType.allCases) { meal in
                mealSection(meal)
            }
        }
    }

    private func mealSection(_ meal: MealType) -> some View {
        let entries = vm.dailySummary.entriesForMeal(meal)
        let mealCalories = vm.dailySummary.caloriesForMeal(meal)
        let isExpanded = vm.expandedMeals.contains(meal)

        return VStack(spacing: 0) {
            // Meal header
            Button {
                withAnimation {
                    if isExpanded {
                        vm.expandedMeals.remove(meal)
                    } else {
                        vm.expandedMeals.insert(meal)
                    }
                }
            } label: {
                HStack {
                    Image(systemName: meal.icon)
                        .font(.system(size: 16))
                        .foregroundStyle(Theme.primary)

                    Text(meal.label)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.textPrimary)

                    Spacer()

                    Text("\(Int(mealCalories)) cal")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Theme.textSecondary)

                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.textMuted)
                }
                .padding(12)
            }

            if isExpanded {
                VStack(spacing: 0) {
                    if entries.isEmpty {
                        Text("No entries yet")
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.textMuted)
                            .padding(.vertical, 12)
                    } else {
                        ForEach(entries, id: \.id) { entry in
                            foodEntryRow(entry)
                        }
                    }

                    // Add button for this meal
                    Button {
                        vm.selectedMealType = meal
                        vm.showingAddFood = true
                    } label: {
                        HStack {
                            Image(systemName: "plus.circle.fill")
                            Text("Add Food")
                        }
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Theme.primary)
                        .padding(.vertical, 8)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.bottom, 8)
            }
        }
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func foodEntryRow(_ entry: FoodEntry) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.name)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Theme.textPrimary)
                if let brand = entry.brand, !brand.isEmpty {
                    Text(brand)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.textMuted)
                }
            }

            Spacer()

            Text("\(Int(entry.totalCalories)) cal")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Theme.textSecondary)
        }
        .padding(.vertical, 6)
        .swipeActions(edge: .trailing) {
            Button(role: .destructive) {
                vm.deleteEntry(entry, store: store)
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
    }

    // MARK: - Add Food Buttons

    private var addFoodButtons: some View {
        HStack(spacing: 12) {
            Button {
                vm.showingAddFood = true
            } label: {
                VStack(spacing: 6) {
                    Image(systemName: "pencil")
                        .font(.system(size: 20))
                    Text("Manual")
                        .font(.system(size: 12, weight: .medium))
                }
                .foregroundStyle(Theme.primary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }

            Button {
                vm.showingBarcode = true
            } label: {
                VStack(spacing: 6) {
                    Image(systemName: "barcode.viewfinder")
                        .font(.system(size: 20))
                    Text("Scan")
                        .font(.system(size: 12, weight: .medium))
                }
                .foregroundStyle(Theme.primary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }

            Button {
                vm.showingAIQuickLog = true
                vm.showingAddFood = true
            } label: {
                VStack(spacing: 6) {
                    Image(systemName: "sparkles")
                        .font(.system(size: 20))
                    Text("AI Log")
                        .font(.system(size: 12, weight: .medium))
                }
                .foregroundStyle(Theme.primary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }
    }

    // MARK: - Add Food Sheet

    private var addFoodSheet: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 20) {
                        // Meal picker
                        Picker("Meal", selection: $vm.selectedMealType) {
                            ForEach(MealType.allCases) { meal in
                                Text(meal.label).tag(meal)
                            }
                        }
                        .pickerStyle(.segmented)

                        if vm.showingAIQuickLog {
                            // AI Quick Log
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Describe your food")
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(Theme.textPrimary)

                                TextField("e.g., grilled chicken breast with rice", text: $vm.aiQuickLogText)
                                    .textFieldStyle(.roundedBorder)
                                    .tint(Theme.primary)

                                Button {
                                    Task {
                                        await vm.aiQuickLog(store: store)
                                        vm.showingAddFood = false
                                    }
                                } label: {
                                    HStack {
                                        if vm.isAILoading {
                                            ProgressView()
                                                .tint(.black)
                                        } else {
                                            Image(systemName: "sparkles")
                                            Text("Estimate & Add")
                                        }
                                    }
                                }
                                .buttonStyle(PrimaryButtonStyle())
                                .disabled(vm.aiQuickLogText.isEmpty || vm.isAILoading)
                            }
                        } else {
                            // Manual entry
                            VStack(spacing: 12) {
                                formField("Food Name", text: $vm.foodName, keyboard: .default)
                                formField("Calories", text: $vm.foodCalories, keyboard: .decimalPad)
                                formField("Protein (g)", text: $vm.foodProtein, keyboard: .decimalPad)
                                formField("Carbs (g)", text: $vm.foodCarbs, keyboard: .decimalPad)
                                formField("Fat (g)", text: $vm.foodFat, keyboard: .decimalPad)
                                formField("Servings", text: $vm.foodServings, keyboard: .decimalPad)
                            }

                            Button {
                                vm.addManualEntry(store: store)
                                vm.showingAddFood = false
                            } label: {
                                Text("Add Food")
                            }
                            .buttonStyle(PrimaryButtonStyle())
                            .disabled(vm.foodName.isEmpty)
                        }

                        // Toggle between manual and AI
                        Button {
                            vm.showingAIQuickLog.toggle()
                        } label: {
                            Text(vm.showingAIQuickLog ? "Switch to Manual Entry" : "Use AI Quick Log")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundStyle(Theme.primary)
                        }
                    }
                    .padding(Theme.paddingMedium)
                }
            }
            .navigationTitle("Add Food")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        vm.showingAddFood = false
                        vm.showingAIQuickLog = false
                    }
                }
            }
        }
        .presentationDetents([.large])
    }

    private func formField(_ label: String, text: Binding<String>, keyboard: UIKeyboardType) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.textSecondary)
            TextField(label, text: text)
                .keyboardType(keyboard)
                .font(.system(size: 15))
                .padding(10)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .foregroundStyle(Theme.textPrimary)
                .tint(Theme.primary)
        }
    }

    // MARK: - Goals Editor Sheet

    private var goalsEditorSheet: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()

                VStack(spacing: 20) {
                    goalField("Calories", value: $vm.goals.calories, unit: "kcal")
                    goalField("Protein", value: $vm.goals.protein, unit: "g")
                    goalField("Carbs", value: $vm.goals.carbs, unit: "g")
                    goalField("Fat", value: $vm.goals.fat, unit: "g")

                    Spacer()
                }
                .padding(Theme.paddingMedium)
            }
            .navigationTitle("Daily Goals")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        vm.updateGoals(store: store)
                        showingGoalsEditor = false
                    }
                    .foregroundStyle(Theme.primary)
                }
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        showingGoalsEditor = false
                    }
                }
            }
        }
        .presentationDetents([.medium])
    }

    private func goalField(_ label: String, value: Binding<Double>, unit: String) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(Theme.textPrimary)

            Spacer()

            TextField("0", value: value, format: .number)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.textPrimary)
                .frame(width: 80)
                .tint(Theme.primary)

            Text(unit)
                .font(.system(size: 13))
                .foregroundStyle(Theme.textSecondary)
                .frame(width: 40, alignment: .leading)
        }
        .padding(12)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}
