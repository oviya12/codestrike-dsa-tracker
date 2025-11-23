import React, { useMemo } from 'react';
import { UserState, DailyLog } from '../types';
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Target, Flame, Trophy, Activity, Calendar as CalendarIcon } from 'lucide-react';

interface Props {
  state: UserState;
}

const ContributionHeatmap: React.FC<{ logs: DailyLog[] }> = ({ logs }) => {
  // Generate last 365 days (approx 52 weeks)
  const calendarData = useMemo(() => {
    const weeks = 53; // Slightly more than a year to ensure full coverage
    const daysToRender = weeks * 7;
    
    // Calculate start date (Sunday approx 1 year ago)
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - (weeks * 7) + 1); // Go back weeks
    // Align to previous Sunday
    const dayOfWeek = start.getDay(); 
    start.setDate(start.getDate() - dayOfWeek);

    // Map logs for O(1) access
    // Normalize dates to YYYY-MM-DD
    const logMap = new Map<string, number>();
    logs.forEach(l => {
        const key = l.date.split('T')[0];
        logMap.set(key, (logMap.get(key) || 0) + l.solvedCount);
    });

    const data = [];
    let current = new Date(start);

    for (let i = 0; i < daysToRender; i++) {
        const dateKey = current.toISOString().split('T')[0];
        // Don't show future dates
        const isFuture = current > today;
        
        data.push({
            date: dateKey,
            count: isFuture ? -1 : (logMap.get(dateKey) || 0),
            isFuture
        });
        current.setDate(current.getDate() + 1);
    }
    return data;
  }, [logs]);

  const getIntensityClass = (count: number, isFuture: boolean) => {
    if (isFuture) return 'bg-transparent border-none'; // Invisible for future
    if (count === 0) return 'bg-slate-800/50 hover:bg-slate-700/50';
    if (count <= 2) return 'bg-emerald-900 hover:bg-emerald-800';
    if (count <= 4) return 'bg-emerald-700 hover:bg-emerald-600';
    if (count <= 6) return 'bg-emerald-500 hover:bg-emerald-400';
    return 'bg-emerald-400 hover:bg-emerald-300';
  };

  return (
    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-900/20">
                    <CalendarIcon size={20} />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                    <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">Yearly Activity</span>
                    <span className="text-xs font-medium text-slate-400">
                        (Aim For <span className="text-emerald-400 font-bold glow-sm">Green Forest</span>, Not an Empty Land!)
                    </span>
                </div>
            </h3>
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-700/50 self-start sm:self-center">
                <span>Less</span>
                <div className="flex gap-1">
                    <div className="w-3 h-3 rounded-sm bg-slate-800/50 border border-slate-700" />
                    <div className="w-3 h-3 rounded-sm bg-emerald-900" />
                    <div className="w-3 h-3 rounded-sm bg-emerald-700" />
                    <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                    <div className="w-3 h-3 rounded-sm bg-emerald-400" />
                </div>
                <span>More</span>
            </div>
        </div>

        <div className="overflow-x-auto pb-2 custom-scrollbar">
            <div className="min-w-[700px]">
                {/* Grid Container */}
                <div 
                    className="grid gap-1" 
                    style={{ 
                        gridTemplateRows: 'repeat(7, 1fr)', 
                        gridAutoFlow: 'column',
                        height: '140px'
                    }}
                >
                    {calendarData.map((day) => (
                        <div 
                            key={day.date}
                            className={`w-3 h-3 rounded-sm transition-colors duration-200 border border-white/5 ${getIntensityClass(day.count, day.isFuture)}`}
                            title={!day.isFuture ? `${day.date}: ${day.count} problems` : ''}
                        />
                    ))}
                </div>
                <div className="flex justify-between text-xs text-slate-500 mt-2 px-1 font-mono">
                    <span>Jan</span>
                    <span>Mar</span>
                    <span>May</span>
                    <span>Jul</span>
                    <span>Sep</span>
                    <span>Nov</span>
                    <span>Dec</span>
                </div>
            </div>
        </div>
    </div>
  );
};

const Dashboard: React.FC<Props> = ({ state }) => {
  
  const chartData = useMemo(() => {
    const data = [];
    const today = new Date();
    
    // Generate exactly last 7 days to show true consistency (including 0s)
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        
        // Match the key format used in scraperService (YYYY-MM-DD)
        const dateKey = d.toISOString().split('T')[0];
        
        // Filter all logs that match this date string (to include both API and Manual logs)
        const logsForDay = state.logs.filter(l => l.date.startsWith(dateKey));
        
        // Sum up the solved counts from all matching logs
        const totalSolvedForDay = logsForDay.reduce((sum, log) => sum + log.solvedCount, 0);
        
        data.push({
            name: d.toLocaleDateString('en-US', { weekday: 'short' }), // e.g., Mon
            fullDate: dateKey,
            solved: totalSolvedForDay,
            target: state.dailyTarget
        });
    }
    return data;
  }, [state.logs, state.dailyTarget]);

  return (
    <div className="space-y-6">
      {/* Stats Row - 2 Columns on Mobile, 4 on Desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Daily Streak */}
        <div className="bg-slate-800 p-3 sm:p-5 rounded-xl border border-slate-700 shadow-sm">
            <div className="flex justify-between items-start">
                <div className="min-w-0">
                    <p className="text-slate-400 text-[10px] sm:text-sm font-medium truncate">Daily Streak</p>
                    <h3 className="text-xl sm:text-3xl font-bold text-white mt-1">
                        {state.streak} <span className="text-xs sm:text-lg text-slate-500 font-normal">days</span>
                    </h3>
                </div>
                <div className="p-1.5 sm:p-2 bg-orange-500/20 rounded-lg text-orange-400 shrink-0 ml-2">
                    <Flame className="w-4 h-4 sm:w-6 sm:h-6" />
                </div>
            </div>
        </div>

        {/* Total Solved */}
        <div className="bg-slate-800 p-3 sm:p-5 rounded-xl border border-slate-700 shadow-sm">
            <div className="flex justify-between items-start">
                <div className="min-w-0">
                    <p className="text-slate-400 text-[10px] sm:text-sm font-medium truncate">Total Solved</p>
                    <h3 className="text-xl sm:text-3xl font-bold text-white mt-1">{state.totalSolved}</h3>
                </div>
                <div className="p-1.5 sm:p-2 bg-indigo-500/20 rounded-lg text-indigo-400 shrink-0 ml-2">
                    <Trophy className="w-4 h-4 sm:w-6 sm:h-6" />
                </div>
            </div>
        </div>

        {/* Daily Target */}
        <div className="bg-slate-800 p-3 sm:p-5 rounded-xl border border-slate-700 shadow-sm">
            <div className="flex justify-between items-start">
                <div className="min-w-0">
                    <p className="text-slate-400 text-[10px] sm:text-sm font-medium truncate">Daily Target</p>
                    <h3 className="text-xl sm:text-3xl font-bold text-white mt-1">{state.dailyTarget}</h3>
                </div>
                <div className="p-1.5 sm:p-2 bg-emerald-500/20 rounded-lg text-emerald-400 shrink-0 ml-2">
                    <Target className="w-4 h-4 sm:w-6 sm:h-6" />
                </div>
            </div>
        </div>

        {/* Short Term Goal */}
        <div className="bg-slate-800 p-3 sm:p-5 rounded-xl border border-slate-700 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start relative z-10">
                <div className="min-w-0">
                    <p className="text-slate-400 text-[10px] sm:text-sm font-medium truncate">Short Term Goal</p>
                    <h3 className="text-xl sm:text-3xl font-bold text-white mt-1">
                        {state.goals[0]?.targetCount > 0 
                            ? Math.round((state.goals[0]?.progress / state.goals[0]?.targetCount) * 100) 
                            : 0}%
                    </h3>
                </div>
                <div className="p-1.5 sm:p-2 bg-blue-500/20 rounded-lg text-blue-400 shrink-0 ml-2">
                    <Activity className="w-4 h-4 sm:w-6 sm:h-6" />
                </div>
            </div>
            <div className="w-full bg-slate-700 h-1 sm:h-1.5 rounded-full mt-2 sm:mt-3 overflow-hidden relative z-10">
                <div 
                    className="bg-blue-500 h-full rounded-full" 
                    style={{ width: `${state.goals[0]?.targetCount > 0 ? (state.goals[0]?.progress / state.goals[0]?.targetCount) * 100 : 0}%`}} 
                />
            </div>
        </div>
      </div>

      {/* Weekly Consistency Chart */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-6">Weekly Consistency (Make sure it is not declining )</h3>
        <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorSolved" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} strokeOpacity={0.4} />
                    <XAxis 
                        dataKey="name" 
                        stroke="#94a3b8" 
                        tick={{fill: '#94a3b8', fontSize: 12}}
                        axisLine={false}
                        tickLine={false}
                        dy={10}
                    />
                    <YAxis 
                        stroke="#94a3b8" 
                        tick={{fill: '#94a3b8', fontSize: 12}}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                    />
                    <Tooltip 
                        cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }}
                        contentStyle={{ 
                            backgroundColor: '#0f172a', 
                            borderColor: '#334155', 
                            borderRadius: '12px',
                            color: '#fff',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
                        }}
                        itemStyle={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 500 }}
                        labelStyle={{ color: '#94a3b8', marginBottom: '8px', fontSize: '12px' }}
                    />
                    {/* Gradient Area for Solved Problems */}
                    <Area 
                        type="monotone" 
                        dataKey="solved" 
                        stroke="#6366f1" 
                        strokeWidth={3} 
                        fillOpacity={1} 
                        fill="url(#colorSolved)" 
                        activeDot={{ r: 6, strokeWidth: 0, fill: '#818cf8', stroke: '#fff', strokeOpacity: 0.5 }}
                    />
                    {/* Dashed Line for Target */}
                    <Line 
                        type="step" 
                        dataKey="target" 
                        stroke="#fbbf24" 
                        strokeDasharray="6 6" 
                        strokeWidth={3}
                        strokeOpacity={0.9}
                        dot={false}
                        activeDot={false}
                        name="Daily Target"
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
      </div>

      {/* Yearly Activity Heatmap */}
      <ContributionHeatmap logs={state.logs} />
    </div>
  );
};

export default Dashboard;