import Foundation

// MARK: - Workout Engine
/// Port of src/workout-engine.ts — full exercise database and workout generation
struct WorkoutEngine {

    // MARK: - Exercise Database (complete port from web app)

    static let exerciseDB: [String: [ExerciseDBEntry]] = [
        "dumbbells": [
            ExerciseDBEntry(name: "Dumbbell Bench Press", muscleGroup: "Chest", equipment: ["dumbbells", "bench"], defaultSets: 3, defaultReps: "10-12"),
            ExerciseDBEntry(name: "Dumbbell Shoulder Press", muscleGroup: "Shoulders", equipment: ["dumbbells"], defaultSets: 3, defaultReps: "10"),
            ExerciseDBEntry(name: "Dumbbell Row", muscleGroup: "Back", equipment: ["dumbbells"], defaultSets: 3, defaultReps: "12"),
            ExerciseDBEntry(name: "Dumbbell Curl", muscleGroup: "Biceps", equipment: ["dumbbells"], defaultSets: 3, defaultReps: "12"),
            ExerciseDBEntry(name: "Dumbbell Lateral Raise", muscleGroup: "Shoulders", equipment: ["dumbbells"], defaultSets: 3, defaultReps: "15"),
            ExerciseDBEntry(name: "Dumbbell Tricep Extension", muscleGroup: "Triceps", equipment: ["dumbbells"], defaultSets: 3, defaultReps: "12"),
            ExerciseDBEntry(name: "Dumbbell Goblet Squat", muscleGroup: "Quads", equipment: ["dumbbells"], defaultSets: 3, defaultReps: "12"),
            ExerciseDBEntry(name: "Dumbbell Lunges", muscleGroup: "Legs", equipment: ["dumbbells"], defaultSets: 3, defaultReps: "10 each"),
            ExerciseDBEntry(name: "Dumbbell Romanian Deadlift", muscleGroup: "Hamstrings", equipment: ["dumbbells"], defaultSets: 3, defaultReps: "10"),
            ExerciseDBEntry(name: "Dumbbell Fly", muscleGroup: "Chest", equipment: ["dumbbells", "bench"], defaultSets: 3, defaultReps: "12"),
            ExerciseDBEntry(name: "Dumbbell Pullover", muscleGroup: "Chest", equipment: ["dumbbells", "bench"], defaultSets: 3, defaultReps: "12"),
            ExerciseDBEntry(name: "Dumbbell Shrug", muscleGroup: "Traps", equipment: ["dumbbells"], defaultSets: 3, defaultReps: "15"),
            ExerciseDBEntry(name: "Dumbbell Front Raise", muscleGroup: "Shoulders", equipment: ["dumbbells"], defaultSets: 3, defaultReps: "12"),
            ExerciseDBEntry(name: "Dumbbell Hammer Curl", muscleGroup: "Biceps", equipment: ["dumbbells"], defaultSets: 3, defaultReps: "12"),
        ],
        "barbell": [
            ExerciseDBEntry(name: "Barbell Squat", muscleGroup: "Quads", equipment: ["barbell"], defaultSets: 4, defaultReps: "8"),
            ExerciseDBEntry(name: "Barbell Deadlift", muscleGroup: "Back", equipment: ["barbell"], defaultSets: 4, defaultReps: "6"),
            ExerciseDBEntry(name: "Barbell Bench Press", muscleGroup: "Chest", equipment: ["barbell", "bench"], defaultSets: 4, defaultReps: "8"),
            ExerciseDBEntry(name: "Barbell Overhead Press", muscleGroup: "Shoulders", equipment: ["barbell"], defaultSets: 3, defaultReps: "8"),
            ExerciseDBEntry(name: "Barbell Row", muscleGroup: "Back", equipment: ["barbell"], defaultSets: 4, defaultReps: "8"),
            ExerciseDBEntry(name: "Barbell Curl", muscleGroup: "Biceps", equipment: ["barbell"], defaultSets: 3, defaultReps: "10"),
            ExerciseDBEntry(name: "Barbell Hip Thrust", muscleGroup: "Glutes", equipment: ["barbell", "bench"], defaultSets: 3, defaultReps: "12"),
            ExerciseDBEntry(name: "Barbell Romanian Deadlift", muscleGroup: "Hamstrings", equipment: ["barbell"], defaultSets: 3, defaultReps: "10"),
        ],
        "kettlebells": [
            ExerciseDBEntry(name: "Kettlebell Swing", muscleGroup: "Full Body", equipment: ["kettlebells"], defaultSets: 4, defaultReps: "15"),
            ExerciseDBEntry(name: "Kettlebell Goblet Squat", muscleGroup: "Quads", equipment: ["kettlebells"], defaultSets: 3, defaultReps: "12"),
            ExerciseDBEntry(name: "Kettlebell Turkish Get-Up", muscleGroup: "Full Body", equipment: ["kettlebells"], defaultSets: 3, defaultReps: "5 each"),
            ExerciseDBEntry(name: "Kettlebell Clean & Press", muscleGroup: "Shoulders", equipment: ["kettlebells"], defaultSets: 3, defaultReps: "8 each"),
            ExerciseDBEntry(name: "Kettlebell Snatch", muscleGroup: "Full Body", equipment: ["kettlebells"], defaultSets: 3, defaultReps: "10 each"),
            ExerciseDBEntry(name: "Kettlebell Row", muscleGroup: "Back", equipment: ["kettlebells"], defaultSets: 3, defaultReps: "10 each"),
        ],
        "bodyweight": [
            ExerciseDBEntry(name: "Push-Ups", muscleGroup: "Chest", equipment: [], defaultSets: 3, defaultReps: "Failure"),
            ExerciseDBEntry(name: "Diamond Push-Ups", muscleGroup: "Triceps", equipment: [], defaultSets: 3, defaultReps: "Failure"),
            ExerciseDBEntry(name: "Decline Push-Ups", muscleGroup: "Upper Chest", equipment: [], defaultSets: 3, defaultReps: "Failure"),
            ExerciseDBEntry(name: "Bodyweight Squat", muscleGroup: "Quads", equipment: [], defaultSets: 3, defaultReps: "20"),
            ExerciseDBEntry(name: "Lunges", muscleGroup: "Legs", equipment: [], defaultSets: 3, defaultReps: "12 each"),
            ExerciseDBEntry(name: "Plank", muscleGroup: "Core", equipment: [], defaultSets: 3, defaultReps: "45s"),
            ExerciseDBEntry(name: "Mountain Climbers", muscleGroup: "Core", equipment: [], defaultSets: 3, defaultReps: "30s"),
            ExerciseDBEntry(name: "Burpees", muscleGroup: "Full Body", equipment: [], defaultSets: 3, defaultReps: "10"),
            ExerciseDBEntry(name: "Jump Squats", muscleGroup: "Legs", equipment: [], defaultSets: 3, defaultReps: "15"),
            ExerciseDBEntry(name: "Glute Bridge", muscleGroup: "Glutes", equipment: [], defaultSets: 3, defaultReps: "15"),
            ExerciseDBEntry(name: "Crunches", muscleGroup: "Core", equipment: [], defaultSets: 3, defaultReps: "20"),
            ExerciseDBEntry(name: "Bicycle Crunches", muscleGroup: "Core", equipment: [], defaultSets: 3, defaultReps: "20"),
            ExerciseDBEntry(name: "Leg Raises", muscleGroup: "Core", equipment: [], defaultSets: 3, defaultReps: "15"),
            ExerciseDBEntry(name: "Superman Hold", muscleGroup: "Back", equipment: [], defaultSets: 3, defaultReps: "30s"),
            ExerciseDBEntry(name: "Tricep Dips", muscleGroup: "Triceps", equipment: [], defaultSets: 3, defaultReps: "Failure"),
        ],
        "pull-up-bar": [
            ExerciseDBEntry(name: "Pull-Ups", muscleGroup: "Back", equipment: ["pull-up-bar"], defaultSets: 4, defaultReps: "Failure"),
            ExerciseDBEntry(name: "Chin-Ups", muscleGroup: "Biceps", equipment: ["pull-up-bar"], defaultSets: 3, defaultReps: "Failure"),
            ExerciseDBEntry(name: "Hanging Leg Raise", muscleGroup: "Core", equipment: ["pull-up-bar"], defaultSets: 3, defaultReps: "12"),
            ExerciseDBEntry(name: "Wide-Grip Pull-Ups", muscleGroup: "Back", equipment: ["pull-up-bar"], defaultSets: 3, defaultReps: "Failure"),
        ],
        "resistance-bands": [
            ExerciseDBEntry(name: "Band Pull-Apart", muscleGroup: "Shoulders", equipment: ["resistance-bands"], defaultSets: 3, defaultReps: "15"),
            ExerciseDBEntry(name: "Banded Squat", muscleGroup: "Quads", equipment: ["resistance-bands"], defaultSets: 3, defaultReps: "15"),
            ExerciseDBEntry(name: "Banded Row", muscleGroup: "Back", equipment: ["resistance-bands"], defaultSets: 3, defaultReps: "15"),
            ExerciseDBEntry(name: "Banded Lateral Walk", muscleGroup: "Glutes", equipment: ["resistance-bands"], defaultSets: 3, defaultReps: "12 each"),
            ExerciseDBEntry(name: "Banded Chest Press", muscleGroup: "Chest", equipment: ["resistance-bands"], defaultSets: 3, defaultReps: "15"),
        ],
        "yoga-mat": [
            ExerciseDBEntry(name: "Yoga Flow", muscleGroup: "Full Body", equipment: ["yoga-mat"], defaultSets: 1, defaultReps: "10 min"),
            ExerciseDBEntry(name: "Child's Pose", muscleGroup: "Back", equipment: ["yoga-mat"], defaultSets: 1, defaultReps: "60s"),
            ExerciseDBEntry(name: "Downward Dog", muscleGroup: "Full Body", equipment: ["yoga-mat"], defaultSets: 1, defaultReps: "60s"),
            ExerciseDBEntry(name: "Cat-Cow Stretch", muscleGroup: "Back", equipment: ["yoga-mat"], defaultSets: 1, defaultReps: "10"),
            ExerciseDBEntry(name: "Pigeon Pose", muscleGroup: "Hips", equipment: ["yoga-mat"], defaultSets: 1, defaultReps: "60s each"),
            ExerciseDBEntry(name: "Hip Flexor Stretch", muscleGroup: "Hips", equipment: ["yoga-mat"], defaultSets: 1, defaultReps: "45s each"),
        ],
        "foam-roller": [
            ExerciseDBEntry(name: "Foam Roll Quads", muscleGroup: "Quads", equipment: ["foam-roller"], defaultSets: 1, defaultReps: "60s"),
            ExerciseDBEntry(name: "Foam Roll IT Band", muscleGroup: "Legs", equipment: ["foam-roller"], defaultSets: 1, defaultReps: "60s each"),
            ExerciseDBEntry(name: "Foam Roll Back", muscleGroup: "Back", equipment: ["foam-roller"], defaultSets: 1, defaultReps: "60s"),
            ExerciseDBEntry(name: "Foam Roll Calves", muscleGroup: "Calves", equipment: ["foam-roller"], defaultSets: 1, defaultReps: "60s"),
        ],
        "jump-rope": [
            ExerciseDBEntry(name: "Jump Rope Intervals", muscleGroup: "Cardio", equipment: ["jump-rope"], defaultSets: 5, defaultReps: "60s on / 30s off"),
            ExerciseDBEntry(name: "Double Unders", muscleGroup: "Cardio", equipment: ["jump-rope"], defaultSets: 4, defaultReps: "30s"),
        ],
        "medicine-ball": [
            ExerciseDBEntry(name: "Medicine Ball Slam", muscleGroup: "Full Body", equipment: ["medicine-ball"], defaultSets: 3, defaultReps: "12"),
            ExerciseDBEntry(name: "Medicine Ball Russian Twist", muscleGroup: "Core", equipment: ["medicine-ball"], defaultSets: 3, defaultReps: "20"),
            ExerciseDBEntry(name: "Medicine Ball Woodchop", muscleGroup: "Core", equipment: ["medicine-ball"], defaultSets: 3, defaultReps: "10 each"),
        ],
        "ab-wheel": [
            ExerciseDBEntry(name: "Ab Wheel Rollout", muscleGroup: "Core", equipment: ["ab-wheel"], defaultSets: 3, defaultReps: "10"),
            ExerciseDBEntry(name: "Kneeling Ab Rollout", muscleGroup: "Core", equipment: ["ab-wheel"], defaultSets: 3, defaultReps: "12"),
        ],
    ]

    // MARK: - Style Configuration

    struct StyleConfig {
        let muscleGroups: [[String]]
        let exerciseCount: Int
        let durationMin: Int
        let calories: Int
    }

    static let styleConfig: [WorkoutStyle: StyleConfig] = [
        .strength: StyleConfig(muscleGroups: [["Chest", "Triceps"], ["Back", "Biceps"], ["Quads", "Hamstrings", "Glutes"], ["Shoulders", "Traps"]], exerciseCount: 5, durationMin: 50, calories: 350),
        .hypertrophy: StyleConfig(muscleGroups: [["Chest", "Shoulders"], ["Back", "Biceps"], ["Legs", "Quads", "Hamstrings"], ["Shoulders", "Triceps"]], exerciseCount: 6, durationMin: 55, calories: 380),
        .functional: StyleConfig(muscleGroups: [["Full Body"]], exerciseCount: 6, durationMin: 40, calories: 300),
        .hiit: StyleConfig(muscleGroups: [["Full Body", "Cardio"]], exerciseCount: 8, durationMin: 30, calories: 400),
        .cardio: StyleConfig(muscleGroups: [["Cardio", "Full Body"]], exerciseCount: 5, durationMin: 35, calories: 350),
        .recovery: StyleConfig(muscleGroups: [["Full Body", "Back", "Hips"]], exerciseCount: 8, durationMin: 30, calories: 100),
        .mobility: StyleConfig(muscleGroups: [["Full Body", "Hips", "Back"]], exerciseCount: 8, durationMin: 25, calories: 80),
        .power: StyleConfig(muscleGroups: [["Chest", "Shoulders"], ["Back", "Full Body"], ["Quads", "Glutes"]], exerciseCount: 5, durationMin: 45, calories: 400),
        .endurance: StyleConfig(muscleGroups: [["Full Body", "Cardio"]], exerciseCount: 6, durationMin: 45, calories: 320),
    ]

    // MARK: - Antagonist Pairs for Supersets

    static let antagonistPairs: [([String], [String])] = [
        (["Chest", "Upper Chest"], ["Back"]),
        (["Biceps"], ["Triceps"]),
        (["Quads"], ["Hamstrings"]),
        (["Shoulders"], ["Core"]),
    ]

    static let supersetStyles: Set<WorkoutStyle> = [.hypertrophy, .functional, .hiit, .endurance]

    // MARK: - Today's Style

    static func getTodayStyle(recentSessions: [WorkoutSession] = []) -> WorkoutStyle {
        let day = Calendar.current.component(.weekday, from: Date()) - 1 // 0=Sun
        let schedule: [WorkoutStyle] = [.strength, .hypertrophy, .functional, .strength, .hiit, .recovery, .mobility]
        return schedule[day % schedule.count]
    }

    // MARK: - Available Exercises

    static func getAvailableExercises(enabledEquipment: [Equipment], targetMuscles: [String]) -> [ExerciseDBEntry] {
        let enabledIds = Set(enabledEquipment.map(\.id))
        var pool: [ExerciseDBEntry] = []

        // Always include bodyweight
        if let bodyweight = exerciseDB["bodyweight"] {
            for ex in bodyweight {
                if targetMuscles.contains(where: { ex.muscleGroup.contains($0) || $0 == "Full Body" }) {
                    pool.append(ex)
                }
            }
        }

        for eqId in enabledIds {
            guard let exercises = exerciseDB[eqId] else { continue }
            for ex in exercises {
                let allEquipAvailable = ex.equipment.allSatisfy { enabledIds.contains($0) || $0.isEmpty }
                let muscleMatch = targetMuscles.contains(where: {
                    ex.muscleGroup.contains($0) || $0 == "Full Body" || ex.muscleGroup == "Full Body"
                })
                if allEquipAvailable && muscleMatch {
                    pool.append(ex)
                }
            }
        }

        return pool
    }

    // MARK: - Muscle Groups for Today

    static func getMuscleGroupsForToday(style: WorkoutStyle, recentSessions: [WorkoutSession]) -> [String] {
        guard let config = styleConfig[style] else { return ["Full Body"] }
        if config.muscleGroups.count == 1 { return config.muscleGroups[0] }

        let recentMuscles = Set(recentSessions.prefix(2).flatMap { session in
            session.exercises.map(\.muscleGroup)
        })

        var bestSplit = config.muscleGroups[0]
        var bestScore = -1

        for split in config.muscleGroups {
            let overlap = split.filter { recentMuscles.contains($0) }.count
            let score = split.count - overlap
            if score > bestScore {
                bestScore = score
                bestSplit = split
            }
        }

        return bestSplit
    }

    // MARK: - Generate Workout

    static func generateWorkout(
        enabledEquipment: [Equipment],
        style: WorkoutStyle,
        recentSessions: [WorkoutSession] = [],
        previousWeights: [String: Double] = [:]
    ) -> WorkoutPlan {
        guard let config = styleConfig[style] else {
            return WorkoutPlan(name: "Workout", style: style, exercises: [], durationMin: 30, estimatedCalories: 200, focus: "Full Body", equipmentUsed: [])
        }

        let targetMuscles = getMuscleGroupsForToday(style: style, recentSessions: recentSessions)
        let pool = getAvailableExercises(enabledEquipment: enabledEquipment, targetMuscles: targetMuscles)

        var selectedExercises: [ExerciseTemplate] = []
        var usedNames = Set<String>()
        let shuffled = pool.shuffled()

        for ex in shuffled {
            if selectedExercises.count >= config.exerciseCount { break }
            if usedNames.contains(ex.name) { continue }

            let prevWeight = previousWeights[ex.name.lowercased().trimmingCharacters(in: .whitespaces)]
            let restSeconds: Int
            switch style {
            case .hiit: restSeconds = 30
            case .recovery: restSeconds = 15
            default: restSeconds = 60
            }

            selectedExercises.append(ExerciseTemplate(
                name: ex.name,
                muscleGroup: ex.muscleGroup,
                equipment: ex.equipment,
                sets: ex.defaultSets,
                reps: ex.defaultReps,
                weight: prevWeight,
                restSeconds: restSeconds
            ))
            usedNames.insert(ex.name)
        }

        // Fill with bodyweight if needed
        if selectedExercises.count < config.exerciseCount, let bodyweight = exerciseDB["bodyweight"] {
            for ex in bodyweight.shuffled() {
                if selectedExercises.count >= config.exerciseCount { break }
                if usedNames.contains(ex.name) { continue }
                selectedExercises.append(ExerciseTemplate(
                    name: ex.name,
                    muscleGroup: ex.muscleGroup,
                    equipment: [],
                    sets: ex.defaultSets,
                    reps: ex.defaultReps,
                    restSeconds: 60
                ))
                usedNames.insert(ex.name)
            }
        }

        // Apply supersets
        let finalExercises = applySupersets(exercises: selectedExercises, style: style)

        let equipUsed = Array(Set(finalExercises.flatMap(\.equipment)))
        let focusLabel = targetMuscles.count > 2 ? "Full Body" : targetMuscles.joined(separator: " & ")
        let randomName = style.styleNames.randomElement() ?? "Workout"

        let intensity: Int
        switch style {
        case .recovery, .mobility: intensity = 1
        case .hiit, .power: intensity = 3
        default: intensity = 2
        }

        return WorkoutPlan(
            name: "\(focusLabel) \(randomName)",
            style: style,
            exercises: finalExercises,
            durationMin: config.durationMin,
            estimatedCalories: config.calories,
            focus: focusLabel,
            equipmentUsed: equipUsed,
            intensity: intensity
        )
    }

    // MARK: - Supersets

    static func applySupersets(exercises: [ExerciseTemplate], style: WorkoutStyle) -> [ExerciseTemplate] {
        guard supersetStyles.contains(style) else { return exercises }

        var result = exercises
        var paired = Set<Int>()
        var groupCount = 0
        let maxGroups = style == .hiit ? 1 : 2

        // HIIT circuit
        if style == .hiit {
            let circuitSize = min(4, max(3, result.count - 2))
            if result.count >= circuitSize + 1 {
                let groupLetter = String(UnicodeScalar(65 + groupCount)!)
                for i in 0..<circuitSize {
                    result[i].group = groupLetter
                    paired.insert(i)
                }
                return result
            }
        }

        // Antagonist pairing
        for (groupA, groupB) in antagonistPairs {
            if groupCount >= maxGroups { break }

            var idxA = -1
            var idxB = -1

            for i in 0..<result.count {
                if paired.contains(i) { continue }
                if idxA == -1 && groupA.contains(result[i].muscleGroup) { idxA = i }
                else if idxB == -1 && groupB.contains(result[i].muscleGroup) { idxB = i }
                if idxA != -1 && idxB != -1 { break }
            }

            if idxA != -1 && idxB != -1 {
                let groupLetter = String(UnicodeScalar(65 + groupCount)!)
                result[idxA].group = groupLetter
                result[idxB].group = groupLetter
                paired.insert(idxA)
                paired.insert(idxB)
                groupCount += 1
            }
        }

        guard groupCount > 0 else { return result }

        // Reorder so grouped exercises are adjacent
        var ordered: [ExerciseTemplate] = []
        var added = Set<Int>()

        for i in 0..<result.count {
            if added.contains(i) { continue }
            ordered.append(result[i])
            added.insert(i)

            if let group = result[i].group {
                for j in (i + 1)..<result.count {
                    if !added.contains(j) && result[j].group == group {
                        ordered.append(result[j])
                        added.insert(j)
                    }
                }
            }
        }

        return ordered
    }
}
