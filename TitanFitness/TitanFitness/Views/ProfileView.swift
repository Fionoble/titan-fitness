import SwiftUI

// MARK: - Profile View
struct ProfileView: View {
    let store: DataStore
    @State private var vm = ProfileViewModel()
    @State private var showEquipment = false
    @State private var showExportSheet = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    headerSection
                    avatarSection
                    statsSection
                    aiConfigSection
                    actionsSection
                }
                .padding(.horizontal, Theme.paddingMedium)
                .padding(.bottom, 100)
            }
            .background(Theme.background)
            .navigationBarHidden(true)
            .onAppear {
                vm.loadProfile(store: store)
            }
            .sheet(isPresented: $showEquipment) {
                EquipmentView(store: store)
            }
            .sheet(isPresented: $showExportSheet) {
                exportSheet
            }
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        HStack {
            Text("Profile")
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(Theme.textPrimary)
            Spacer()
        }
        .padding(.top, 20)
    }

    // MARK: - Avatar

    private var avatarSection: some View {
        VStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(Theme.primary.opacity(0.15))
                    .frame(width: 80, height: 80)

                Image(systemName: "person.fill")
                    .font(.system(size: 36))
                    .foregroundStyle(Theme.primary)
            }

            if vm.isEditingName {
                HStack {
                    TextField("Name", text: $vm.nameField)
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(Theme.textPrimary)
                        .multilineTextAlignment(.center)
                        .tint(Theme.primary)
                        .padding(8)
                        .background(Theme.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 8))

                    Button {
                        vm.saveName(store: store)
                    } label: {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(Theme.primary)
                    }
                }
                .padding(.horizontal, 40)
            } else {
                Button {
                    vm.isEditingName = true
                } label: {
                    HStack(spacing: 6) {
                        Text(vm.profile.name)
                            .font(.system(size: 20, weight: .bold))
                            .foregroundStyle(Theme.textPrimary)
                        Image(systemName: "pencil")
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.textMuted)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }

    // MARK: - Stats

    private var statsSection: some View {
        VStack(spacing: 12) {
            Text("Body Stats")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Theme.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)

            VStack(spacing: 8) {
                statRow(label: "Weight", value: $vm.weightField, unit: "lbs") {
                    vm.saveWeight(store: store)
                }
                statRow(label: "Height", value: $vm.heightField, unit: "in") {
                    vm.saveHeight(store: store)
                }
                statRow(label: "Age", value: $vm.ageField, unit: "yrs") {
                    vm.saveAge(store: store)
                }
            }

            // Injuries
            VStack(alignment: .leading, spacing: 8) {
                Text("Injuries / Limitations")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Theme.textSecondary)

                TextField("e.g., lower back pain, knee injury", text: $vm.injuriesField, axis: .vertical)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.textPrimary)
                    .lineLimit(2...4)
                    .padding(10)
                    .background(Theme.surfaceLight)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .tint(Theme.primary)
                    .onChange(of: vm.injuriesField) { _, _ in
                        vm.saveInjuries(store: store)
                    }
            }
        }
        .cardStyle()
    }

    private func statRow(label: String, value: Binding<String>, unit: String, onSave: @escaping () -> Void) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(Theme.textPrimary)

            Spacer()

            TextField("--", text: value)
                .keyboardType(.numberPad)
                .multilineTextAlignment(.trailing)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.textPrimary)
                .frame(width: 60)
                .tint(Theme.primary)
                .onChange(of: value.wrappedValue) { _, _ in
                    onSave()
                }

            Text(unit)
                .font(.system(size: 13))
                .foregroundStyle(Theme.textSecondary)
                .frame(width: 30, alignment: .leading)
        }
        .padding(12)
        .background(Theme.surfaceLight)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    // MARK: - AI Config

    private var aiConfigSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("AI Configuration")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Theme.textPrimary)

            // Provider picker
            Picker("Provider", selection: $vm.selectedProvider) {
                ForEach(AIProvider.allCases) { provider in
                    Text(provider.label).tag(provider)
                }
            }
            .pickerStyle(.segmented)

            // API Key
            VStack(alignment: .leading, spacing: 4) {
                Text("API Key")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.textSecondary)

                SecureField("Enter your API key", text: $vm.apiKeyField)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.textPrimary)
                    .padding(10)
                    .background(Theme.surfaceLight)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .tint(Theme.primary)
            }

            Button {
                vm.saveAIConfig()
            } label: {
                Text("Save API Key")
            }
            .buttonStyle(PrimaryButtonStyle())

            if AIService.shared.isConfigured {
                HStack(spacing: 6) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Theme.primary)
                    Text("API key configured")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.primary)
                }
            }
        }
        .cardStyle()
    }

    // MARK: - Actions

    private var actionsSection: some View {
        VStack(spacing: 8) {
            actionButton(icon: "dumbbell.fill", label: "Equipment Setup", color: Theme.primary) {
                showEquipment = true
            }

            actionButton(icon: "square.and.arrow.up", label: "Export Data", color: Theme.textSecondary) {
                vm.exportAllData(store: store)
                showExportSheet = true
            }
        }
    }

    private func actionButton(icon: String, label: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 16))
                    .foregroundStyle(color)
                    .frame(width: 32)

                Text(label)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Theme.textPrimary)

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.textMuted)
            }
            .padding(14)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }

    // MARK: - Export Sheet

    private var exportSheet: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()

                ScrollView {
                    Text(vm.exportData)
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundStyle(Theme.textPrimary)
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .navigationTitle("Export Data")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Copy") {
                        UIPasteboard.general.string = vm.exportData
                    }
                    .foregroundStyle(Theme.primary)
                }
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        showExportSheet = false
                    }
                }
            }
        }
    }
}
