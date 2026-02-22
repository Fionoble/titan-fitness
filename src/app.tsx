import { useState, useCallback } from 'preact/hooks';
import { BottomNav } from './components/BottomNav';
import { Home } from './screens/Home';
import { ActiveWorkout } from './screens/ActiveWorkout';
import { Progress } from './screens/Progress';
import { EquipmentScreen } from './screens/Equipment';
import { Coach } from './screens/Coach';
import { Discover } from './screens/Discover';
import { Profile } from './screens/Profile';
import { useEquipment, useTodayWorkout, useSessions, useChat, useProfile } from './hooks';
import type { WorkoutSession, WorkoutPlan, WorkoutCriteria } from './types';

export function App() {
  const [route, setRoute] = useState('/');
  const [activeWorkoutPlan, setActiveWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [pendingAdjustPlan, setPendingAdjustPlan] = useState<WorkoutPlan | null>(null);

  const { equipment, loading: equipLoading, toggle: toggleEquipment } = useEquipment();
  const { plan, loading: planLoading, regenerate, applyPlan } = useTodayWorkout(equipment);
  const { sessions, saveSession } = useSessions();
  const { messages, addMessage, clear: clearChat } = useChat();
  const { profile, updateProfile } = useProfile();

  const navigate = useCallback((path: string) => {
    setRoute(path);
  }, []);

  const startWorkout = useCallback(() => {
    if (plan) {
      setActiveWorkoutPlan(plan);
    }
  }, [plan]);

  const handleCompleteWorkout = useCallback(async (session: WorkoutSession) => {
    await saveSession(session);
    setActiveWorkoutPlan(null);
    setRoute('/progress');
  }, [saveSession]);

  const handleCancelWorkout = useCallback(() => {
    setActiveWorkoutPlan(null);
  }, []);

  const handleSelectStyle = useCallback(async (style: string) => {
    await regenerate(style);
    setRoute('/');
  }, [regenerate]);

  const handleApplyPlan = useCallback((newPlan: WorkoutPlan) => {
    applyPlan(newPlan);
    setRoute('/');
  }, [applyPlan]);

  const handleAdjustWithAI = useCallback(() => {
    if (plan) {
      setPendingAdjustPlan(plan);
      setRoute('/coach');
    }
  }, [plan]);

  const handleRegenerate = useCallback(async (style?: string, criteria?: WorkoutCriteria) => {
    await regenerate(style, criteria);
  }, [regenerate]);

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
      {/* Screen content */}
      {route === '/' && (
        <Home
          plan={plan}
          loading={planLoading || equipLoading}
          userName={profile?.name || 'User'}
          onStartWorkout={startWorkout}
          onRegenerate={handleRegenerate}
          onAdjustWithAI={handleAdjustWithAI}
        />
      )}
      {route === '/discover' && (
        <Discover
          equipment={equipment}
          onSelectStyle={handleSelectStyle}
        />
      )}
      {route === '/progress' && (
        <Progress sessions={sessions} />
      )}
      {route === '/coach' && (
        <Coach
          messages={messages}
          onSendMessage={addMessage}
          onReceiveMessage={addMessage}
          equipment={equipment}
          sessions={sessions}
          onApplyPlan={handleApplyPlan}
          onClearChat={clearChat}
          pendingAdjustPlan={pendingAdjustPlan}
          onClearPendingAdjust={() => setPendingAdjustPlan(null)}
        />
      )}
      {route === '/profile' && (
        <Profile
          profile={profile}
          sessions={sessions}
          onUpdateProfile={updateProfile}
          onNavigateEquipment={() => setRoute('/equipment')}
        />
      )}
      {route === '/equipment' && (
        <EquipmentScreen
          equipment={equipment}
          onToggle={toggleEquipment}
        />
      )}

      <BottomNav active={route} onNavigate={navigate} />
    </div>
  );
}
