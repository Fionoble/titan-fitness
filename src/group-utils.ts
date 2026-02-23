import type { Exercise } from './types';

export type GroupType = 'standalone' | 'superset' | 'triset' | 'circuit';

export interface ExerciseGroup {
  groupId: string;
  exercises: Exercise[];
  type: GroupType;
}

export function groupExercises(exercises: Exercise[]): ExerciseGroup[] {
  const groups: ExerciseGroup[] = [];
  const groupMap = new Map<string, Exercise[]>();
  const ungrouped: Exercise[] = [];

  for (const ex of exercises) {
    if (ex.group) {
      const list = groupMap.get(ex.group) || [];
      list.push(ex);
      groupMap.set(ex.group, list);
    } else {
      ungrouped.push(ex);
    }
  }

  // Build groups in order of first appearance
  const seen = new Set<string>();
  for (const ex of exercises) {
    if (ex.group && !seen.has(ex.group)) {
      seen.add(ex.group);
      const members = groupMap.get(ex.group)!;
      const type: GroupType =
        members.length === 1 ? 'standalone' :
        members.length === 2 ? 'superset' :
        members.length === 3 ? 'triset' : 'circuit';
      groups.push({ groupId: ex.group, exercises: members, type });
    } else if (!ex.group) {
      groups.push({ groupId: ex.id, exercises: [ex], type: 'standalone' });
    }
  }

  return groups;
}

export function groupLabel(type: GroupType): string {
  switch (type) {
    case 'superset': return 'Superset';
    case 'triset': return 'Tri-Set';
    case 'circuit': return 'Circuit';
    default: return '';
  }
}
