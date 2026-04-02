import { useState, useCallback } from 'preact/hooks';
import { Router, Route, useLocation } from 'preact-iso';
import { BottomNav } from './components/BottomNav';
import { WorkoutBanner } from './components/WorkoutBanner';
import { Home } from './screens/Home';
import { ActiveWorkout } from './screens/ActiveWorkout';
import { WorkoutComplete } from './screens/WorkoutComplete';
import { Progress } from './screens/Progress';
import { EquipmentScreen } from './screens/Equipment';
import { Coach } from './screens/Coach';
import { Discover } from './screens/Discover';
import { Nutrition } from './screens/Nutrition';
import { Profile } from './screens/Profile';
import { ProgramDetail } from './screens/ProgramDetail';
import { useEquipment, useTodayWorkout, useSessions, useChat, useProfile, useWeightHistory, useWorkoutProgram, useActiveWorkout } from './hooks';
import { useAITaskByType } from './ai-tasks';
import { withBase, stripBase } from './base';
import { Icon } from './components/Icon';
import type { WorkoutSession, WorkoutPlan, WorkoutCriteria } from './types';

export function App() {
  const { route, path } = useLocation();
  const [completedSession, setCompletedSession] = useState<WorkoutSession | null>(null);
  const [pendingAdjustPlan, setPendingAdjustPlan] = useState<WorkoutPlan | null>(null);

  const { equipment, loading: equipLoading, toggle: toggleEquipment } = useEquipment();
  const { plan, loading: planLoading, regenerate, applyPlan } = useTodayWorkout(equipment);
  const { sessions, saveSession, updateSession, deleteSession: removeSession, startWorkoutFromSession, loadAll: loadAllSessions } = useSessions();
  const { messages, addMessage, clear: clearChat } = useChat();
  const { profile, updateProfile } = useProfile();
  const { entries: weightHistory, addEntry: addWeight, removeEntry: removeWeight } = useWeightHistory();
  const { program, loading: programLoading, todayPlan: todayProgramDay, generateProgram, clearProgram, updateProgram } = useWorkoutProgram(equipment);
  const {
    activeWorkout,
    isActive: workoutIsActive,
    showResume,
    resumeWorkout,
    dismissResume,
    startWorkout,
    updateWorkoutState,
    saveNow,
    completeWorkout,
    cancelWorkout,
  } = useActiveWorkout();

  const nav = useCallback((path: string) => route(withBase(path)), [route]);

  const handleStartWorkout = useCallback(async (sourcePlan?: WorkoutPlan) => {
    const targetPlan = sourcePlan || plan;
    if (targetPlan) {
      await startWorkout(targetPlan);
      nav('/workout');
    }
  }, [plan, startWorkout, nav]);

  const handleCompleteWorkout = useCallback(async (session: WorkoutSession) => {
    await saveSession(session);
    await completeWorkout();
    setCompletedSession(session);
  }, [saveSession, completeWorkout]);

  const handleDismissComplete = useCallback(() => {
    setCompletedSession(null);
    nav('/');
  }, [nav]);

  const handleCancelWorkout = useCallback(async () => {
    await cancelWorkout();
    nav('/');
  }, [cancelWorkout, nav]);

  const handleSelectStyle = useCallback(async (style: string) => {
    await regenerate(style);
    nav('/');
  }, [regenerate, nav]);

  const handleApplyPlan = useCallback((newPlan: WorkoutPlan) => {
    applyPlan(newPlan);
    nav('/');
  }, [applyPlan, nav]);

  const handleAdjustWithAI = useCallback(() => {
    if (plan) {
      setPendingAdjustPlan(plan);
      nav('/coach');
    }
  }, [plan, nav]);

  const handleRegenerate = useCallback(async (style?: string, criteria?: WorkoutCriteria) => {
    await regenerate(style, criteria);
  }, [regenerate]);

  const handleStartProgramWorkout = useCallback(async (programPlan: WorkoutPlan) => {
    await startWorkout(programPlan);
    nav('/workout');
  }, [startWorkout, nav]);

  const handleStartFromHistory = useCallback(async (session: WorkoutSession) => {
    const historyPlan = startWorkoutFromSession(session);
    await startWorkout(historyPlan);
    nav('/workout');
  }, [startWorkoutFromSession, startWorkout, nav]);

  // Hooks must be called before any conditional returns
  const workoutGenTask = useAITaskByType('workout-gen');
  const isGeneratingWorkout = workoutGenTask?.status === 'running';

  const currentPath = stripBase(path);
  const showBanner = workoutIsActive && currentPath !== '/workout';


  // Workout completion celebration screen
  if (completedSession) {
    return (
      <WorkoutComplete
        session={completedSession}
        onDismiss={handleDismissComplete}
      />
    );
  }

  return (
    <div class="h-full flex flex-col relative">
      {/* Resume workout prompt */}
      {showResume && activeWorkout && (
        <div class="fixed inset-0 z-[200] flex items-center justify-center">
          <div class="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
          <div class="relative bg-surface-dark rounded-2xl p-6 max-w-[340px] w-full mx-4 border border-primary/20 shadow-2xl">
            <div class="text-center mb-5">
              <div class="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-4">
                <Icon name="fitness_center" class="text-primary text-3xl" />
              </div>
              <h3 class="text-lg font-bold text-white mb-1">Resume Workout?</h3>
              <p class="text-sm text-slate-400 mb-1">
                You have an unfinished workout:
              </p>
              <p class="text-sm font-semibold text-primary">{activeWorkout.plan.name}</p>
            </div>
            <div class="flex gap-3">
              <button
                onClick={dismissResume}
                class="flex-1 py-3 rounded-xl bg-surface-darker text-slate-300 font-semibold text-sm"
              >
                Discard
              </button>
              <button
                onClick={() => {
                  resumeWorkout();
                  nav('/workout');
                }}
                class="flex-1 py-3 rounded-xl bg-primary text-bg-dark font-bold text-sm flex items-center justify-center gap-2"
              >
                <Icon name="play_arrow" class="text-lg" />
                Resume
              </button>
            </div>
          </div>
        </div>
      )}

      <Router>
        <Route
          path={withBase('/')}
          component={Home}
          plan={plan}
          loading={planLoading || equipLoading}
          userName={profile?.name || 'User'}
          sessions={sessions}
          onStartWorkout={() => handleStartWorkout()}
          onRegenerate={handleRegenerate}
          onAdjustWithAI={handleAdjustWithAI}
          onUpdatePlan={applyPlan}
          workoutMode={profile?.workoutMode || 'daily'}
          program={program}
          programLoading={programLoading}
          todayProgramDay={todayProgramDay}
          onGenerateProgram={generateProgram}
          onClearProgram={clearProgram}
          onStartProgramWorkout={handleStartProgramWorkout}
          activeWorkout={activeWorkout}
          workoutIsActive={workoutIsActive}
          onResumeWorkout={() => nav('/workout')}
        />
        <Route
          path={withBase('/workout')}
          component={ActiveWorkout}
          activeWorkout={activeWorkout}
          onComplete={handleCompleteWorkout}
          onNavigateBack={() => nav('/')}
          onUpdateState={updateWorkoutState}
          onSaveNow={saveNow}
          onEndWorkout={handleCancelWorkout}
        />
        <Route
          path={withBase('/discover')}
          component={Discover}
          equipment={equipment}
          onSelectStyle={handleSelectStyle}
        />
        <Route
          path={withBase('/nutrition')}
          component={Nutrition}
          profile={profile}
        />
        <Route
          path={withBase('/progress')}
          component={Progress}
          sessions={sessions}
          onLoadAll={loadAllSessions}
          onUpdateSession={updateSession}
          onDeleteSession={removeSession}
          onStartFromSession={handleStartFromHistory}
        />
        <Route
          path={withBase('/coach')}
          component={Coach}
          messages={messages}
          onSendMessage={addMessage}
          onReceiveMessage={addMessage}
          equipment={equipment}
          sessions={sessions}
          onApplyPlan={handleApplyPlan}
          onClearChat={clearChat}
          pendingAdjustPlan={pendingAdjustPlan}
          onClearPendingAdjust={() => setPendingAdjustPlan(null)}
          profile={profile}
          onUpdateProfile={updateProfile}
        />
        <Route
          path={withBase('/profile')}
          component={Profile}
          profile={profile}
          sessions={sessions}
          onUpdateProfile={updateProfile}
          onNavigateEquipment={() => nav('/equipment')}
          weightHistory={weightHistory}
          onAddWeight={addWeight}
          onRemoveWeight={removeWeight}
        />
        <Route
          path={withBase('/equipment')}
          component={EquipmentScreen}
          equipment={equipment}
          onToggle={toggleEquipment}
          onBack={() => nav('/profile')}
        />
        <Route
          path={withBase('/program')}
          component={ProgramDetail}
          program={program}
          currentDay={todayProgramDay?.dayNumber || 1}
          onStartWorkout={handleStartProgramWorkout}
          onClearProgram={clearProgram}
          onUpdateProgram={updateProgram}
          equipment={equipment}
        />
        <Route
          default
          component={Home}
          plan={plan}
          loading={planLoading || equipLoading}
          userName={profile?.name || 'User'}
          sessions={sessions}
          onStartWorkout={() => handleStartWorkout()}
          onRegenerate={handleRegenerate}
          onAdjustWithAI={handleAdjustWithAI}
          onUpdatePlan={applyPlan}
          workoutMode={profile?.workoutMode || 'daily'}
          program={program}
          programLoading={programLoading}
          todayProgramDay={todayProgramDay}
          onGenerateProgram={generateProgram}
          onClearProgram={clearProgram}
          onStartProgramWorkout={handleStartProgramWorkout}
          activeWorkout={activeWorkout}
          workoutIsActive={workoutIsActive}
          onResumeWorkout={() => nav('/workout')}
        />
      </Router>

      {/* Hide bottom chrome during active workout */}
      {stripBase(path) !== '/workout' && (
        <>
          {/* Floating banner when workout is active */}
          {showBanner && activeWorkout && (
            <WorkoutBanner
              activeWorkout={activeWorkout}
              onResume={() => nav('/workout')}
              onEnd={handleCancelWorkout}
            />
          )}

          {/* Global AI workout generation indicator */}
          {isGeneratingWorkout && (
            <div class={`fixed ${showBanner ? 'bottom-[calc(120px+var(--pwa-bottom-nudge,0px))]' : 'bottom-[calc(70px+var(--pwa-bottom-nudge,0px))]'} left-0 right-0 z-50 flex justify-center pointer-events-none`}>
              <div class="max-w-[430px] w-full px-4">
                <div class="bg-surface-dark/95 backdrop-blur-sm border border-primary/20 rounded-xl px-4 py-2.5 flex items-center gap-3 shadow-lg shadow-black/30 pointer-events-auto">
                  <div class="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin shrink-0" />
                  <div class="flex-1 min-w-0">
                    <span class="text-sm font-medium text-white">Generating workout...</span>
                  </div>
                  <Icon name="fitness_center" class="text-primary text-lg shrink-0" />
                </div>
              </div>
            </div>
          )}

          <BottomNav />
        </>
      )}
    </div>
  );
}
