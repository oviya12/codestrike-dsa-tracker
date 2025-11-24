import React, { useState, useEffect } from 'react';
import { INITIAL_STATE, UserState, Platform, DailyLog, Goal } from './types';
import Dashboard from './components/Dashboard';
import Tracker from './components/Tracker';
import MissedTargetModal from './components/MissedTargetModal';
import CongratulationsModal from './components/CongratulationsModal';
import GoalManager from './components/GoalManager';
import ProblemTimer from './components/ProblemTimer'; 
import MotivatorModal from './components/MotivatorModal'; 
import HallOfExcusesModal from './components/HallOfExcusesModal';
import Auth from './components/Auth';
import { LayoutDashboard, Target, Code2, Trophy, Zap, Timer, X, Ghost, Menu, ChevronUp, LogOut, Loader2, Trash2, AlertTriangle } from 'lucide-react';

// Supabase Integration
import { supabase } from './lib/supabase';
import { fetchFullUserState, updateProfileStats, updateGoalProgress, addOrUpdateLog, updateGoalDetails, deleteAccount } from "./services/dbServices";
import { Session } from '@supabase/supabase-js';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const [state, setState] = useState<UserState>(INITIAL_STATE);
  
  // Separate counters for accurate tracking
  const [apiSolvedToday, setApiSolvedToday] = useState(0);
  const [manualSolvedToday, setManualSolvedToday] = useState(0);
  
  const [showMissedModal, setShowMissedModal] = useState(false);
  const [showCongratsModal, setShowCongratsModal] = useState(false);
  const [showMotivatorModal, setShowMotivatorModal] = useState(false); 
  const [showExcusesModal, setShowExcusesModal] = useState(false); 
  const [showTimer, setShowTimer] = useState(false); 
  const [currentView, setCurrentView] = useState<'dashboard' | 'goals'>('dashboard');
  const [showGuide, setShowGuide] = useState(false); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); 
  
  // Delete Account State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // --- Auth & Data Loading ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadUserData(session.user.id);
      else setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadUserData(session.user.id);
      else setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (userId: string) => {
    setLoading(true);
    const userState = await fetchFullUserState(userId);
    if (userState) {
      setState(userState);
      
      // Hydrate today's counters from the fetched logs
      const todayKey = new Date().toISOString().split('T')[0];
      const todayLog = userState.logs.find(l => l.date.startsWith(todayKey));
      
      if (todayLog) {
        setApiSolvedToday(todayLog.platformBreakdown[Platform.LeetCode] || 0);
        setManualSolvedToday(todayLog.solvedCount - (todayLog.platformBreakdown[Platform.LeetCode] || 0));
      } else {
        setApiSolvedToday(0);
        setManualSolvedToday(0);
      }
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setState(INITIAL_STATE);
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await deleteAccount();
      await supabase.auth.signOut();
      setState(INITIAL_STATE);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error("Failed to delete account:", error);
      alert("Failed to delete account. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  // --- Helpers ---
  
  /**
   * robustly calculates streak from logs
   */
  const calculateStreak = (logs: DailyLog[]): number => {
    // 1. Group logs by date to handle multiple entries per day (Manual + API)
    const activityMap = new Map<string, number>();
    logs.forEach(l => {
        const date = l.date.split('T')[0];
        activityMap.set(date, (activityMap.get(date) || 0) + l.solvedCount);
    });

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let currentStreak = 0;
    let checkDate = new Date(today);

    // Determine start point:
    // If we have activity today, streak includes today.
    // If not today, but we had activity yesterday, streak is still alive (just hasn't incremented for today yet).
    // If neither, streak is broken (0).

    if ((activityMap.get(todayStr) || 0) > 0) {
        // Active today
    } else if ((activityMap.get(yesterdayStr) || 0) > 0) {
        // Not active today yet, but active yesterday. Start checking from yesterday.
        checkDate.setDate(checkDate.getDate() - 1);
    } else {
        return 0; // Streak broken
    }

    // Count backwards
    while (true) {
        const dateStr = checkDate.toISOString().split('T')[0];
        if ((activityMap.get(dateStr) || 0) > 0) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }

    return currentStreak;
  };

  // Computed total for today
  const totalSolvedToday = apiSolvedToday + manualSolvedToday;
  const isTargetMet = totalSolvedToday >= state.dailyTarget;

  useEffect(() => {
    if (totalSolvedToday > 0 && totalSolvedToday < state.dailyTarget) {
       // Logic to track near-misses could go here
    }
  }, [totalSolvedToday, state.dailyTarget]);

  useEffect(() => {
    if (!loading && session) {
        const timer = setTimeout(() => setShowGuide(true), 1000);
        const autoDismiss = setTimeout(() => setShowGuide(false), 11000); 
        return () => {
            clearTimeout(timer);
            clearTimeout(autoDismiss);
        };
    }
  }, [loading, session]);

  // Handlers for manual updates (Other Platforms)
  const handleUpdateProgress = async (count: number) => {
    if (!session) return;

    const newManualCount = manualSolvedToday + count;
    const newTotalSolved = state.totalSolved + count;
    setManualSolvedToday(newManualCount);
    
    // Log Update
    const todayKey = new Date().toISOString();
    const logEntry: DailyLog = {
        date: todayKey,
        solvedCount: apiSolvedToday + newManualCount,
        platformBreakdown: { [Platform.LeetCode]: apiSolvedToday },
        missedTarget: false
    };

    // Construct new logs array for streak calc
    const updatedLogs = [
        ...state.logs.filter(l => !l.date.startsWith(todayKey.split('T')[0])), 
        logEntry
    ];

    // Calculate new Streak
    const newStreak = calculateStreak(updatedLogs);

    // DB Updates
    await updateProfileStats(session.user.id, { totalSolved: newTotalSolved, streak: newStreak });
    await addOrUpdateLog(session.user.id, logEntry);

    // Optimistic UI Updates
    const updatedGoals = state.goals.map(g => {
        if (g.type === 'SHORT_TERM' || g.type === 'LONG_TERM') {
            updateGoalProgress(g.id, g.progress + count);
            return { ...g, progress: g.progress + count };
        }
        return g;
    });

    const newState = {
        ...state,
        totalSolved: newTotalSolved,
        streak: newStreak, // Update streak in state
        goals: updatedGoals,
        logs: updatedLogs
    };
    setState(newState);

    // Check for celebration
    if (apiSolvedToday + newManualCount >= state.dailyTarget && totalSolvedToday < state.dailyTarget) {
        setShowCongratsModal(true);
    }
  };

  // Handler for API Sync (LeetCode)
  const handleSyncComplete = async (data: { logs: DailyLog[], totalSolved: number, solvedToday: number }) => {
    if (!session) return;

    setApiSolvedToday(data.solvedToday);

    // Merge Logic: Get existing manual logs (where LeetCode count is 0)
    const existingManualLogs = state.logs.filter(l => l.platformBreakdown[Platform.LeetCode] === 0);
    const manualTotal = existingManualLogs.reduce((sum, log) => sum + log.solvedCount, 0);
    const newTotalSolved = data.totalSolved + manualTotal;

    // Construct full log history for streak calc (API logs + Manual logs)
    const mergedLogs = [...data.logs, ...existingManualLogs];
    
    // Calculate Streak
    const streak = calculateStreak(mergedLogs);

    // Update DB
    await updateProfileStats(session.user.id, { totalSolved: newTotalSolved, streak });
    
    // Update today's log in DB
    const todayKey = new Date().toISOString();
    const todayLog = {
        date: todayKey,
        solvedCount: data.solvedToday + manualSolvedToday,
        platformBreakdown: { [Platform.LeetCode]: data.solvedToday },
        missedTarget: false
    };
    await addOrUpdateLog(session.user.id, todayLog);

    // Update Goals
    const updatedGoals = state.goals.map(g => {
        if (g.type === 'SHORT_TERM' || g.type === 'LONG_TERM') {
            updateGoalProgress(g.id, newTotalSolved);
            return { ...g, progress: newTotalSolved };
        }
        return g;
    });

    setState(prev => ({
        ...prev,
        totalSolved: newTotalSolved,
        streak: streak,
        goals: updatedGoals, 
        logs: mergedLogs, 
        lastSync: new Date().toISOString()
    }));

    if ((data.solvedToday + manualSolvedToday) >= state.dailyTarget && totalSolvedToday < state.dailyTarget) {
        setShowCongratsModal(true);
    }
  };

  const handleUpdateGoal = async (updatedGoal: Goal) => {
    if (!session) return;
    await updateGoalDetails(updatedGoal);
    setState(prev => ({
      ...prev,
      goals: prev.goals.map(g => g.id === updatedGoal.id ? updatedGoal : g)
    }));
  };

  const checkEndOfDay = () => {
    if (totalSolvedToday < state.dailyTarget) {
        setShowMissedModal(true);
    } else {
        setShowCongratsModal(true);
    }
  };

  const handleTargetAdjustment = async (deficit: number, reason: string) => {
    if (!session) return;
    
    const newTarget = state.dailyTarget + deficit;
    await updateProfileStats(session.user.id, { dailyTarget: newTarget });

    const todayKey = new Date().toISOString();
    const logEntry = {
        date: todayKey,
        solvedCount: totalSolvedToday,
        platformBreakdown: { [Platform.LeetCode]: apiSolvedToday },
        missedTarget: true,
        reasonForMiss: reason
    };
    await addOrUpdateLog(session.user.id, logEntry);

    setState(prev => {
        const newLogs = [...prev.logs];
        newLogs.push(logEntry);
        return {
          ...prev,
          dailyTarget: newTarget,
          logs: newLogs
        };
    });
    setShowMissedModal(false);
  };

  const handleCloseCongrats = async () => {
    setShowCongratsModal(false);
    if (state.dailyTarget > 3 && session) {
        await updateProfileStats(session.user.id, { dailyTarget: 3 });
        setState(prev => ({ ...prev, dailyTarget: 3 }));
    }
  };

  const handleNavClick = (view: 'dashboard' | 'goals') => {
    setCurrentView(view);
    setIsSidebarOpen(false);
  };

  // --- Render ---

  if (loading) {
      return (
          <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
              <Loader2 className="text-indigo-500 animate-spin" size={48} />
          </div>
      );
  }

  if (!session) {
      return <Auth />;
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-indigo-500/30">
      
      {/* MOBILE TOP BAR (Sticky) */}
      <div className="md:hidden sticky top-0 z-50 bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between shadow-md">
         <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-[#facc15] rounded-lg flex items-center justify-center text-slate-900 shadow-lg shadow-yellow-500/20">
                  <Code2 size={24} strokeWidth={2.5} />
             </div>
             <h1 className="text-xl font-bold text-white tracking-tight">CodeStrike</h1>
         </div>
         <button 
             onClick={() => setIsSidebarOpen(!isSidebarOpen)}
             className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg border border-slate-700 transition-colors"
         >
             {isSidebarOpen ? <ChevronUp size={24} /> : <Menu size={24} />}
         </button>
      </div>

      <div className="flex flex-col md:flex-row min-h-screen">
          
          {/* SIDEBAR NAVIGATION */}
          <aside className={`
            bg-slate-900 md:border-r border-slate-800 flex-shrink-0 z-40
            md:w-64 md:fixed md:inset-y-0 md:flex md:flex-col
            ${isSidebarOpen ? 'block w-full border-b' : 'hidden md:block'}
          `}>
            <div className="hidden md:flex p-6 border-b border-slate-800 justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#facc15] rounded-lg flex items-center justify-center text-slate-900 shadow-lg shadow-yellow-500/20">
                        <Code2 size={20} strokeWidth={2.5} />
                    </div>
                    <h1 className="text-xl font-bold text-white tracking-tight">CodeStrike</h1>
                </div>
            </div>
            
            <nav className="p-4 space-y-2 overflow-y-auto custom-scrollbar md:flex-1">
                <button 
                  onClick={() => handleNavClick('dashboard')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                    currentView === 'dashboard' 
                    ? 'bg-indigo-600/10 text-indigo-400 border-indigo-600/20' 
                    : 'text-slate-400 border-transparent hover:bg-slate-800'
                  }`}
                >
                    <LayoutDashboard size={20} />
                    <span className="font-medium">Dashboard</span>
                </button>
                <button 
                  onClick={() => handleNavClick('goals')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                    currentView === 'goals' 
                    ? 'bg-indigo-600/10 text-indigo-400 border-indigo-600/20' 
                    : 'text-slate-400 border-transparent hover:bg-slate-800'
                  }`}
                >
                    <Target size={20} />
                    <span className="font-medium">Goals</span>
                </button>

                <button 
                    onClick={() => {
                        setShowExcusesModal(true);
                        setIsSidebarOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-transparent text-purple-400 hover:bg-purple-500/10 hover:text-purple-300 transition-colors"
                >
                    <Ghost size={20} />
                    <span className="font-medium">Hall of Excuses</span>
                </button>

                <button 
                  onClick={() => {
                      setShowMotivatorModal(true);
                      setIsSidebarOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-transparent text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 transition-colors mt-4 group"
                >
                    <Zap size={20} className="group-hover:animate-pulse" />
                    <span className="font-medium">Feeling Low? </span>
                </button>
            </nav>

            {/* Bottom Actions */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/50 space-y-2">
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-sm"
                >
                    <LogOut size={16} />
                    <span>Sign Out</span>
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full flex items-center gap-3 px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors text-sm"
                >
                    <Trash2 size={16} />
                    <span>Delete Account</span>
                </button>
            </div>
          </aside>

          {/* MAIN CONTENT AREA */}
          <main className="flex-1 md:ml-64 p-4 sm:p-6 md:p-8 w-full min-w-0">
            
            <header className="flex flex-col md:flex-row justify-between gap-4 mb-6 md:mb-8">
                <div className="block">
                    <h2 className="text-xl md:text-2xl font-bold text-white">
                        {currentView === 'dashboard' ? 'DSA Tracker' : 'Goal Planning'}
                    </h2>
                    <p className="text-sm md:text-base text-slate-400 mt-1">
                        {currentView === 'dashboard' ? `Welcome back, ${session.user.email?.split('@')[0]}` : 'Set and edit your short and long term objectives.'}
                    </p>
                </div>
                
                <div className="flex items-center gap-2 sm:gap-3 justify-end w-full md:w-auto">
                    <div className="relative">
                        <button
                            onClick={() => {
                                setShowTimer(true);
                                setShowGuide(false);
                            }}
                            className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs sm:text-sm font-medium transition-all shadow-sm hover:shadow-md"
                        >
                            <Timer size={16} className="text-indigo-400" />
                            <span className="hidden sm:inline">Start Focus Timer</span>
                            <span className="sm:hidden">Timer</span>
                        </button>

                        {showGuide && (
                            <div className="absolute top-full mt-4 right-0 w-max bg-indigo-600 text-white text-base sm:text-lg font-bold py-4 px-6 sm:py-6 sm:px-8 rounded-2xl shadow-xl shadow-indigo-900/30 z-30 animate-in fade-in slide-in-from-top-2 duration-500">
                                <div className="absolute -top-2 right-8 w-4 h-4 bg-indigo-600 transform rotate-45"></div>
                                <div className="relative flex items-center gap-4">
                                    <span>Let's begin solving! 🚀</span>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setShowGuide(false); }} 
                                        className="text-indigo-200 hover:text-white transition-colors"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {isTargetMet ? (
                         <button 
                            onClick={() => setShowCongratsModal(true)}
                            className="flex items-center gap-2 px-3 py-2 sm:px-4 bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs sm:text-sm font-bold transition-colors hover:bg-emerald-600/20"
                        >
                            <Trophy size={16} className="text-yellow-400" />
                            <span className="hidden sm:inline">Target Achieved! 🌟</span>
                            <span className="sm:hidden">Success! 🌟</span>
                        </button>
                    ) : (
                        <button 
                            onClick={checkEndOfDay}
                            className="flex items-center gap-2 px-3 py-2 sm:px-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg text-xs sm:text-sm font-bold transition-all"
                        >
                            <span>I Give Up</span>
                            <span className="text-base sm:text-lg">😔</span>
                        </button>
                    )}
                </div>
            </header>

            {currentView === 'dashboard' ? (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8">
                    <div className="xl:col-span-2 space-y-6 md:space-y-8">
                        <Dashboard state={state} /> 
                    </div>
                    <div className="xl:col-span-1 space-y-6 md:space-y-8">
                        <Tracker onUpdate={handleUpdateProgress} onSyncComplete={handleSyncComplete} />
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-semibold text-white">Active Goals</h3>
                                <button 
                                    onClick={() => setCurrentView('goals')}
                                    className="text-xs text-indigo-400 hover:text-indigo-300"
                                >
                                    Manage
                                </button>
                            </div>
                            {state.goals.map(goal => (
                                <div key={goal.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border tracking-wider ${
                                            goal.type === 'LONG_TERM' 
                                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                                            : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                        }`}>
                                            {goal.type === 'LONG_TERM' ? 'LONG TERM' : 'SHORT TERM'}
                                        </span>
                                        <span className="text-[10px] text-slate-500">Due: {goal.deadline}</span>
                                    </div>
                                    <h4 className="text-slate-200 font-medium mb-3 text-sm">{goal.description}</h4>
                                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                                        <span>Progress</span>
                                        <span>{goal.progress} / {goal.targetCount}</span>
                                    </div>
                                    <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full ${goal.type === 'LONG_TERM' ? 'bg-purple-500' : 'bg-blue-500'}`}
                                            style={{ width: `${Math.min(100, (goal.progress / goal.targetCount) * 100)}%`}} 
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <GoalManager goals={state.goals} onUpdateGoal={handleUpdateGoal} />
            )}

            {/* Modals */}
            <ProblemTimer 
                isOpen={showTimer} 
                onClose={() => setShowTimer(false)} 
            />

            <MissedTargetModal 
                isOpen={showMissedModal} 
                onClose={() => setShowMissedModal(false)}
                onAdjustTarget={handleTargetAdjustment}
                state={state}
                problemsSolvedToday={totalSolvedToday}
            />

            <CongratulationsModal 
                isOpen={showCongratsModal}
                onClose={handleCloseCongrats}
                state={state}
                totalSolvedToday={totalSolvedToday}
            />

            <MotivatorModal 
                isOpen={showMotivatorModal}
                onClose={() => setShowMotivatorModal(false)}
            />

            <HallOfExcusesModal 
                isOpen={showExcusesModal} 
                onClose={() => setShowExcusesModal(false)} 
                logs={state.logs} 
            />

            {/* DELETE ACCOUNT CONFIRMATION MODAL */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-red-500/30 w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center">
                        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="text-red-500" size={32} />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">Delete Account?</h2>
                        <p className="text-slate-400 text-sm mb-6">
                            This action is <span className="text-red-400 font-bold">irreversible</span>. All your data, streaks, and logs will be permanently wiped.
                        </p>
                        
                        <div className="space-y-3">
                            <button 
                                onClick={handleDeleteAccount}
                                disabled={isDeleting}
                                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-red-900/20 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isDeleting ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />}
                                {isDeleting ? 'Deleting...' : 'Yes, Delete Everything'}
                            </button>
                            <button 
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={isDeleting}
                                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition-colors border border-slate-700"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
          </main>
      </div>
    </div>
  );
};

export default App;