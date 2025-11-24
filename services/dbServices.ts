import { supabase } from '../lib/supabase';
import { UserState, DailyLog, Goal, Platform } from '../types';

// --- Mappers ---

const mapLogFromDB = (log: any): DailyLog => ({
  date: log.date,
  solvedCount: log.solved_count,
  platformBreakdown: log.platform_breakdown || { [Platform.LeetCode]: 0 },
  missedTarget: log.missed_target,
  reasonForMiss: log.reason_for_miss
});

const mapGoalFromDB = (goal: any): Goal => ({
  id: goal.id,
  type: goal.type as any,
  description: goal.description,
  targetCount: goal.target_count,
  progress: goal.progress,
  deadline: goal.deadline,
  unit: goal.unit
});

// --- Actions ---

export const fetchFullUserState = async (userId: string): Promise<UserState | null> => {
  try {
    // 1. Fetch Profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
        return null;
    }

    // 2. Fetch Goals
    const { data: goals } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId);

    // 3. Fetch Logs
    const { data: logs } = await supabase
      .from('logs')
      .select('*')
      .eq('user_id', userId);

    return {
      dailyTarget: profile.daily_target,
      streak: profile.streak,
      totalSolved: profile.total_solved,
      lastSync: new Date().toISOString(),
      goals: (goals || []).map(mapGoalFromDB),
      logs: (logs || []).map(mapLogFromDB)
    };
  } catch (error) {
    console.error("Error fetching user state:", error);
    return null;
  }
};

export const updateProfileStats = async (userId: string, updates: { totalSolved?: number, streak?: number, dailyTarget?: number }) => {
  const dbUpdates: any = {};
  if (updates.totalSolved !== undefined) dbUpdates.total_solved = updates.totalSolved;
  if (updates.streak !== undefined) dbUpdates.streak = updates.streak;
  if (updates.dailyTarget !== undefined) dbUpdates.daily_target = updates.dailyTarget;

  const { error } = await supabase.from('profiles').update(dbUpdates).eq('id', userId);
  if (error) console.error("Error updating profile:", error);
};

export const updateGoalProgress = async (goalId: string, progress: number) => {
  const { error } = await supabase.from('goals').update({ progress }).eq('id', goalId);
  if (error) console.error("Error updating goal:", error);
};

export const updateGoalDetails = async (goal: Goal) => {
    const { error } = await supabase.from('goals').update({
        description: goal.description,
        target_count: goal.targetCount,
        deadline: goal.deadline
    }).eq('id', goal.id);
    if (error) console.error("Error updating goal details:", error);
};

export const addOrUpdateLog = async (userId: string, log: DailyLog) => {
  // Check if log exists for this date
  const { data: existing } = await supabase
    .from('logs')
    .select('id')
    .eq('user_id', userId)
    .eq('date', log.date.split('T')[0]) // Match YYYY-MM-DD
    .single();

  if (existing) {
    const { error } = await supabase.from('logs').update({
        solved_count: log.solvedCount,
        platform_breakdown: log.platformBreakdown,
        missed_target: log.missedTarget,
        reason_for_miss: log.reasonForMiss
    }).eq('id', existing.id);
    if (error) console.error("Error updating log:", error);
  } else {
    const { error } = await supabase.from('logs').insert({
        user_id: userId,
        date: log.date.split('T')[0],
        solved_count: log.solvedCount,
        platform_breakdown: log.platformBreakdown,
        missed_target: log.missedTarget,
        reason_for_miss: log.reasonForMiss
    });
    if (error) console.error("Error inserting log:", error);
  }
};

export const deleteAccount = async () => {
  const { error } = await supabase.rpc('delete_user_account');
  if (error) throw error;
};

// --- Security & Recovery Actions ---

export const updateSecurityQnA = async (userId: string, question: string, answer: string) => {
  const { error } = await supabase
    .from('profiles')
    .update({
      security_question: question,
      security_answer: answer
    })
    .eq('id', userId);

  if (error) console.error("Error updating security Q&A:", error);
  return error;
};

export const getSecurityQuestion = async (email: string) => {
  // Calls the RPC function 'get_security_question' we created in SQL
  const { data, error } = await supabase.rpc('get_security_question', {
    email_input: email
  });
  if (error) throw error;
  return data; // Returns the question string or null
};

export const resetPasswordViaSecurity = async (email: string, answer: string, newPassword: string) => {
  // Calls the RPC function 'reset_password_via_security_answer'
  const { data, error } = await supabase.rpc('reset_password_via_security_answer', {
    email_input: email,
    answer_input: answer,
    new_password_input: newPassword
  });
  if (error) throw error;
  return data; // Returns boolean (true if success, false if failed)
};