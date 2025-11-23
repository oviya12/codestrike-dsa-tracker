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
import { LayoutDashboard, Target, Code2, Trophy, Zap, Timer, X, Ghost, Menu, ChevronDown, ChevronUp } from 'lucide-react';

const App: React.FC = () => {
  const [state, setState] = useState<UserState>(INITIAL_STATE);
  
  // Separate counters for accurate tracking
  const [apiSolvedToday, setApiSolvedToday] = useState(0);
  const [manualSolvedToday, setManualSolvedToday] = useState(0);
  
  const [showMissedModal, setShowMissedModal] = useState(false);
  const [showCongratsModal, setShowCongratsModal] = useState(false);
  const [showMotivatorModal, setShowMotivatorModal] = useState(false); // State for Motivator
  const [showExcusesModal, setShowExcusesModal] = useState(false); // State for Hall of Excuses
  const [showTimer, setShowTimer] = useState(false); // State for Timer Modal
  const [currentView, setCurrentView] = useState<'dashboard' | 'goals'>('dashboard');
  const [showGuide, setShowGuide] = useState(false); // State for Onboarding Guide
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile Sidebar State

  // Computed total for today
  const totalSolvedToday = apiSolvedToday + manualSolvedToday;
  const isTargetMet = totalSolvedToday >= state.dailyTarget;

  // Effect to check daily target status (Simulating end of day check or live updates)
  useEffect(() => {
    if (totalSolvedToday > 0 && totalSolvedToday < state.dailyTarget) {
       // In a real app, this might trigger on a timer or specific event. 
    }
  }, [totalSolvedToday, state.dailyTarget]);

  // Show onboarding guide on load
  useEffect(() => {
    const timer = setTimeout(() => setShowGuide(true), 1000);
    // Auto dismiss after 10 seconds to not be annoying
    const autoDismiss = setTimeout(() => setShowGuide(false), 11000); 
    return () => {
        clearTimeout(timer);
        clearTimeout(autoDismiss);
    };
  }, []);

  // Handlers for manual updates (Other Platforms)
  const handleUpdateProgress = (count: number) => {
    setManualSolvedToday(prev => prev + count);
    
    // Update Goals Progress
    const updatedGoals = state.goals.map(g => {
        if (g.type === 'SHORT_TERM' || g.type === 'LONG_TERM') {
            return { ...g, progress: g.progress + count };
        }
        return g;
    });

    const newState = {
        ...state,
        totalSolved: state.totalSolved + count,
        goals: updatedGoals,
        logs: [
            ...state.logs, 
            {
                date: new Date().toISOString(),
                solvedCount: count,
                platformBreakdown: { [Platform.LeetCode]: 0 }, // Manual Entry flag
                missedTarget: false
            }
        ]
    };
    
    setState(newState);

    // Auto-trigger celebration if they just crossed the line manually
    const newTotal = apiSolvedToday + manualSolvedToday + count;
    if (newTotal >= state.dailyTarget && totalSolvedToday < state.dailyTarget) {
        setShowCongratsModal(true);
    }
  };

  // Handler for API Sync (LeetCode)
  const handleSyncComplete = (data: { logs: DailyLog[], totalSolved: number, solvedToday: number }) => {
    setApiSolvedToday(data.solvedToday);

    // Calculate Streak based on logs
    let streak = 0;
    if (data.logs.length > 0) {
        const sortedLogs = [...data.logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        
        let hasActivityToday = sortedLogs[0].date.startsWith(today) && sortedLogs[0].solvedCount > 0;
        let currentIdx = hasActivityToday ? 0 : (sortedLogs[0].date.startsWith(yesterday) ? 0 : -1);

        if (currentIdx !== -1) {
             let expectedDate = new Date(sortedLogs[currentIdx].date);
             
             for (let i = currentIdx; i < sortedLogs.length; i++) {
                 const logDate = new Date(sortedLogs[i].date);
                 if (i === currentIdx) {
                     streak++;
                     continue;
                 }
                 const diffTime = Math.abs(expectedDate.getTime() - logDate.getTime());
                 const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                 if (diffDays === 1) {
                     streak++;
                     expectedDate = logDate;
                 } else {
                     break;
                 }
             }
        }
    }

    setState(prev => {
        // Filter to keep existing logs that are Manual entries (LeetCode count 0)
        const existingManualLogs = prev.logs.filter(l => 
            l.platformBreakdown[Platform.LeetCode] === 0
        );

        // Calculate total from manual logs (Historical + Today's manual logs)
        const manualTotal = existingManualLogs.reduce((sum, log) => sum + log.solvedCount, 0);
        const newTotalSolved = data.totalSolved + manualTotal;

        // Update Goals Progress based on the new total
        const updatedGoals = prev.goals.map(g => {
            if (g.type === 'SHORT_TERM' || g.type === 'LONG_TERM') {
                return { ...g, progress: newTotalSolved };
            }
            return g;
        });

        return {
            ...prev,
            totalSolved: newTotalSolved,
            streak: streak,
            goals: updatedGoals, 
            logs: [...data.logs, ...existingManualLogs], 
            lastSync: new Date().toISOString()
        };
    });

    // Auto-trigger celebration if sync pushed them over the line
    if ((data.solvedToday + manualSolvedToday) >= state.dailyTarget && totalSolvedToday < state.dailyTarget) {
        setShowCongratsModal(true);
    }
  };

  const handleUpdateGoal = (updatedGoal: Goal) => {
    setState(prev => ({
      ...prev,
      goals: prev.goals.map(g => g.id === updatedGoal.id ? updatedGoal : g)
    }));
  };

  // Simulate "End of Day" check with real values
  const checkEndOfDay = () => {
    // Trigger analysis if total (API + Manual) < Target
    if (totalSolvedToday < state.dailyTarget) {
        setShowMissedModal(true);
    } else {
        setShowCongratsModal(true);
    }
  };

  const handleTargetAdjustment = (deficit: number, reason: string) => {
    // Add the missed problems (deficit) to the daily target
    const todayKey = new Date().toISOString().split('T')[0];

    setState(prev => {
        // Update or Create a log entry for today to record the reason
        const newLogs = [...prev.logs];
        const existingLogIndex = newLogs.findIndex(l => l.date.startsWith(todayKey));

        if (existingLogIndex >= 0) {
            // Update existing log
            newLogs[existingLogIndex] = {
                ...newLogs[existingLogIndex],
                missedTarget: true,
                reasonForMiss: reason
            };
        } else {
            // Create new log for today
            newLogs.push({
                date: new Date().toISOString(),
                solvedCount: totalSolvedToday,
                platformBreakdown: { [Platform.LeetCode]: 0 },
                missedTarget: true,
                reasonForMiss: reason
            });
        }

        return {
          ...prev,
          dailyTarget: prev.dailyTarget + deficit,
          logs: newLogs
        };
    });
    setShowMissedModal(false);
  };

  const handleCloseCongrats = () => {
    setShowCongratsModal(false);
    // If the target was elevated (due to catch-up), reset it to default (3) for the next day/cycle
    if (state.dailyTarget > 3) {
        setState(prev => ({
            ...prev,
            dailyTarget: 3
        }));
    }
  };

  // Helper to close sidebar when clicking a nav item on mobile
  const handleNavClick = (view: 'dashboard' | 'goals') => {
    setCurrentView(view);
    setIsSidebarOpen(false); // Close mobile nav after click
  };

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
          {/* Desktop: Fixed Left | Mobile: Collapsible Top Block */}
          <aside className={`
            bg-slate-900 md:border-r border-slate-800 flex-shrink-0 z-40
            md:w-64 md:fixed md:inset-y-0 md:flex md:flex-col
            ${isSidebarOpen ? 'block w-full border-b' : 'hidden md:block'}
          `}>
            {/* Sidebar Header (Desktop Only) */}
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

            {/* Status Widget */}
            <div className="p-4 border-t border-slate-800">
                 <div className="bg-slate-800 rounded-lg p-4 shadow-inner border border-slate-700/50">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">STATUS</h4>
                    <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-slate-300 font-medium">Today</span>
                        <span className={`font-mono font-bold ${totalSolvedToday >= state.dailyTarget ? 'text-emerald-400' : 'text-orange-400'}`}>
                            {totalSolvedToday}/{state.dailyTarget}
                        </span>
                    </div>
                    <div className="w-full bg-slate-700 h-1.5 rounded-full mb-3 overflow-hidden">
                        <div 
                            className={`h-full rounded-full transition-all duration-500 ${totalSolvedToday >= state.dailyTarget ? 'bg-emerald-500' : 'bg-orange-500'}`}
                            style={{ width: `${Math.min(100, (totalSolvedToday / state.dailyTarget) * 100)}%`}} 
                        />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 font-medium border-t border-slate-700/50 pt-2">
                       <span>LC: {apiSolvedToday}</span>
                       <span>Other: {manualSolvedToday}</span>
                    </div>
                 </div>
            </div>
          </aside>

          {/* MAIN CONTENT AREA */}
          <main className="flex-1 md:ml-64 p-4 sm:p-6 md:p-8 w-full min-w-0">
            
            <header className="flex flex-col md:flex-row justify-between gap-4 mb-6 md:mb-8">
                {/* Page Title & Subtitle - Visible on ALL screen sizes */}
                <div className="block">
                    <h2 className="text-xl md:text-2xl font-bold text-white">
                        {currentView === 'dashboard' ? 'DSA Tracker' : 'Goal Planning'}
                    </h2>
                    <p className="text-sm md:text-base text-slate-400 mt-1">
                        {currentView === 'dashboard' ? 'Perhaps impress your goals today.' : 'Set and edit your short and long term objectives.'}
                    </p>
                </div>
                
                {/* Action Buttons (Timer / Give Up) */}
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
                    {/* Left Column: Stats & Charts */}
                    <div className="xl:col-span-2 space-y-6 md:space-y-8">
                        <Dashboard state={state} /> 
                    </div>
                    
                    {/* Right Column: Tools (Tracker, Goals) */}
                    <div className="xl:col-span-1 space-y-6 md:space-y-8">
                        <Tracker onUpdate={handleUpdateProgress} onSyncComplete={handleSyncComplete} />
                        
                        {/* Active Goals Summary (Read Only View) */}
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
          </main>
      </div>
    </div>
  );
};

export default App;