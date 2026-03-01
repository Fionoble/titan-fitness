import SwiftUI

// MARK: - Coach View
struct CoachView: View {
    let store: DataStore
    @State private var vm = CoachViewModel()
    @FocusState private var isInputFocused: Bool

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()

                VStack(spacing: 0) {
                    // Header
                    headerSection

                    if !AIService.shared.isConfigured {
                        apiKeyPrompt
                    } else {
                        // Messages
                        messagesSection

                        // Quick Actions
                        if vm.messages.isEmpty {
                            quickActionsSection
                        }

                        // Input
                        inputSection
                    }
                }
            }
            .navigationBarHidden(true)
            .onAppear {
                vm.loadMessages(store: store)
            }
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        HStack {
            Text("AI Coach")
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(Theme.textPrimary)

            Spacer()

            if !vm.messages.isEmpty {
                Button {
                    vm.clearChat(store: store)
                } label: {
                    Image(systemName: "trash")
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.textSecondary)
                        .padding(8)
                        .background(Theme.surface)
                        .clipShape(Circle())
                }
            }
        }
        .padding(.horizontal, Theme.paddingMedium)
        .padding(.top, 20)
        .padding(.bottom, 8)
    }

    // MARK: - API Key Prompt

    private var apiKeyPrompt: some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "bubble.left.and.bubble.right.fill")
                .font(.system(size: 48))
                .foregroundStyle(Theme.primary.opacity(0.5))

            Text("Set Up AI Coach")
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(Theme.textPrimary)

            Text("Add your Anthropic or OpenAI API key in\nProfile settings to chat with Titan AI")
                .font(.system(size: 14))
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)

            Spacer()
        }
        .frame(maxWidth: .infinity)
        .padding(Theme.paddingMedium)
    }

    // MARK: - Messages

    private var messagesSection: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 12) {
                    if vm.messages.isEmpty {
                        welcomeMessage
                    }

                    ForEach(vm.messages, id: \.id) { message in
                        messageBubble(message)
                            .id(message.id)
                    }

                    if vm.isLoading {
                        HStack {
                            typingIndicator
                            Spacer()
                        }
                        .padding(.horizontal, Theme.paddingMedium)
                        .id("loading")
                    }
                }
                .padding(.vertical, 12)
            }
            .onChange(of: vm.messages.count) { _, _ in
                withAnimation {
                    proxy.scrollTo(vm.messages.last?.id ?? "loading", anchor: .bottom)
                }
            }
        }
    }

    private var welcomeMessage: some View {
        VStack(spacing: 12) {
            Image(systemName: "bolt.fill")
                .font(.system(size: 32))
                .foregroundStyle(Theme.primary)

            Text("Hey! I'm Titan, your AI coach.")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.textPrimary)

            Text("Ask me about workouts, form tips, recovery, or anything fitness-related.")
                .font(.system(size: 14))
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(24)
    }

    private func messageBubble(_ message: ChatMessage) -> some View {
        let isUser = message.role == .user

        return HStack {
            if isUser { Spacer(minLength: 60) }

            VStack(alignment: isUser ? .trailing : .leading, spacing: 4) {
                Text(message.content)
                    .font(.system(size: 15))
                    .foregroundStyle(isUser ? .black : Theme.textPrimary)
                    .padding(12)
                    .background(isUser ? Theme.primary : Theme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 16))

                Text(message.timestamp.formatted(date: .omitted, time: .shortened))
                    .font(.system(size: 10))
                    .foregroundStyle(Theme.textMuted)
            }

            if !isUser { Spacer(minLength: 60) }
        }
        .padding(.horizontal, Theme.paddingMedium)
    }

    private var typingIndicator: some View {
        HStack(spacing: 4) {
            ForEach(0..<3, id: \.self) { index in
                Circle()
                    .fill(Theme.textMuted)
                    .frame(width: 6, height: 6)
                    .opacity(0.7)
            }
        }
        .padding(12)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    // MARK: - Quick Actions

    private var quickActionsSection: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(vm.quickActions, id: \.label) { action in
                    Button {
                        Task {
                            await vm.sendQuickAction(action.prompt, store: store)
                        }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: action.icon)
                                .font(.system(size: 12))
                            Text(action.label)
                                .font(.system(size: 13, weight: .medium))
                        }
                        .foregroundStyle(Theme.primary)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(Theme.primary.opacity(0.12))
                        .clipShape(RoundedRectangle(cornerRadius: 20))
                    }
                }
            }
            .padding(.horizontal, Theme.paddingMedium)
        }
        .padding(.bottom, 8)
    }

    // MARK: - Input

    private var inputSection: some View {
        HStack(spacing: 8) {
            TextField("Ask Titan...", text: $vm.inputText, axis: .vertical)
                .font(.system(size: 15))
                .foregroundStyle(Theme.textPrimary)
                .padding(12)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 20))
                .tint(Theme.primary)
                .lineLimit(1...4)
                .focused($isInputFocused)

            Button {
                Task {
                    await vm.sendMessage(store: store)
                }
            } label: {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 32))
                    .foregroundStyle(vm.inputText.isEmpty ? Theme.textMuted : Theme.primary)
            }
            .disabled(vm.inputText.isEmpty || vm.isLoading)
        }
        .padding(.horizontal, Theme.paddingMedium)
        .padding(.vertical, 8)
        .background(Theme.background)
    }
}
