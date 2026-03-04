import { useState, useCallback } from 'preact/hooks';
import { Router, Route, useLocation } from 'preact-iso';
import { BottomNav } from './components/BottomNav';
import { Home } from './screens/Home';
import { ActiveWorkout } from './screens/ActiveWorkout';
import { WorkoutComplete } from './screens/WorkoutComplete';
import { Progress } from './screens/Progress';
import { EquipmentScreen } from './screens/Equipment';
import { Coach } from './screens/Coach';
import { Discover } from './screens/Discover';
import { Nutrition } from './screens/Nutrition';
import { Profile } from './screens/Profile';
import { useEquipment, useTodayWorkout, useSessions, useChat, useProfile } from './hooks';
import { withBase } from './base';
import type { WorkoutSession, WorkoutPlan, WorkoutCriteria } from './types';

export function App() {
  const { route } = useLocation();
  const [activeWorkoutPlan, setActiveWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [completedSession, setCompletedSession] = useState<WorkoutSession | null>(null);
  const [pendingAdjustPlan, setPendingAdjustPlan] = useState<WorkoutPlan | null>(null);

  const { equipment, loading: equipLoading, toggle: toggleEquipment } = useEquipment();
  const { plan, loading: planLoading, regenerate, applyPlan } = useTodayWorkout(equipment);
  const { sessions, saveSession } = useSessions();
  const { messages, addMessage, clear: clearChat } = useChat();
  const { profile, updateProfile } = useProfile();

  const nav = useCallback((path: string) => route(withBase(path)), [route]);

  const startWorkout = useCallback(() => {
    if (plan) {
      setActiveWorkoutPlan(plan);
    }
  }, [plan]);

  const handleCompleteWorkout = useCallback(async (session: WorkoutSession) => {
    await saveSession(session);
    setActiveWorkoutPlan(null);
    setCompletedSession(session);
  }, [saveSession]);

  const handleDismissComplete = useCallback(() => {
    setCompletedSession(null);
    nav('/');
  }, [nav]);

  const handleCancelWorkout = useCallback(() => {
    setActiveWorkoutPlan(null);
  }, []);

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

  // Workout completion celebration screen
  if (completedSession) {
    return (
      <WorkoutComplete
        session={completedSession}
        onDismiss={handleDismissComplete}
      />
    );
  }

  // Active workout takes over the whole screen
  if (activeWorkoutPlan) {
    return (
      <ActiveWorkout
        plan={activeWorkoutPlan}
        onComplete={handleCompleteWorkout}
        onCancel={handleCancelWorkout}
      />
    );
  }

  return (
    <div class="h-full flex flex-col relative">
      <Router>
        <Route
          path={withBase('/')}
          component={Home}
          plan={plan}
          loading={planLoading || equipLoading}
          userName={profile?.name || 'User'}
          sessions={sessions}
          onStartWorkout={startWorkout}
          onRegenerate={handleRegenerate}
          onAdjustWithAI={handleAdjustWithAI}
          onUpdatePlan={applyPlan}
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
        />
        <Route
          path={withBase('/profile')}
          component={Profile}
          profile={profile}
          sessions={sessions}
          onUpdateProfile={updateProfile}
          onNavigateEquipment={() => nav('/equipment')}
        />
        <Route
          path={withBase('/equipment')}
          component={EquipmentScreen}
          equipment={equipment}
          onToggle={toggleEquipment}
        />
        <Route
          default
          component={Home}
          plan={plan}
          loading={planLoading || equipLoading}
          userName={profile?.name || 'User'}
          sessions={sessions}
          onStartWorkout={startWorkout}
          onRegenerate={handleRegenerate}
          onAdjustWithAI={handleAdjustWithAI}
          onUpdatePlan={applyPlan}
        />
      </Router>

      <BottomNav />
    </div>
  );
}
