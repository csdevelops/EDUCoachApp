import React, { useState, useEffect } from 'react';
import { LayoutDashboard, FileEdit, CalendarDays, CheckSquare, Settings, LogOut, Menu, Moon, Sun, Trash2, Clock } from 'lucide-react';
import TemplateGenerator from './components/TemplateGenerator';
import Scheduler from './components/Scheduler';
import TaskManager from './components/TaskManager';
import { ViewState, Task, CustomSound, CalendarEvent, Activity, TaskPriority } from './types';

function App() {
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Lazy initialization for robust persistence (fixes race condition)
  const [tasks, setTasks] = useState<Task[]>(() => {
      const saved = localStorage.getItem('eduCoach_tasks');
      return saved ? JSON.parse(saved) : [];
  });

  const [events, setEvents] = useState<CalendarEvent[]>(() => {
      const saved = localStorage.getItem('eduCoach_events');
      if (saved) {
          try {
              return JSON.parse(saved).map((ev: any) => ({
                  ...ev,
                  start: new Date(ev.start),
                  end: new Date(ev.end)
              }));
          } catch (e) {
              console.error("Failed to parse events", e);
              return [];
          }
      }
      return [];
  });

  const [activities, setActivities] = useState<Activity[]>(() => {
      const saved = localStorage.getItem('eduCoach_activities');
      if (saved) {
          try {
              return JSON.parse(saved).map((act: any) => ({
                  ...act,
                  timestamp: new Date(act.timestamp)
              }));
          } catch (e) { console.error("Failed to parse activities", e); }
      }
      return [{
          id: 'welcome',
          description: 'Welcome back to EduCoach Pro!',
          timestamp: new Date(),
          type: 'system'
      }];
  });

  const [customSounds, setCustomSounds] = useState<CustomSound[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Handle Dark Mode
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Save to LocalStorage whenever data changes
  useEffect(() => {
      localStorage.setItem('eduCoach_events', JSON.stringify(events));
  }, [events]);

  useEffect(() => {
      localStorage.setItem('eduCoach_tasks', JSON.stringify(tasks));
  }, [tasks]);
  
  useEffect(() => {
      localStorage.setItem('eduCoach_activities', JSON.stringify(activities));
  }, [activities]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleAddCustomSound = (name: string, data: string) => {
    const newSound: CustomSound = {
      id: Date.now().toString(),
      name,
      data
    };
    setCustomSounds(prev => [...prev, newSound]);
  };

  const logActivity = (description: string, type: Activity['type']) => {
      const newActivity: Activity = {
          id: Date.now().toString(),
          description,
          timestamp: new Date(),
          type
      };
      setActivities(prev => [newActivity, ...prev].slice(0, 50)); // Keep last 50 items
  };

  const clearActivities = () => {
      if(window.confirm("Are you sure you want to clear your recent activity history?")) {
          setActivities([]);
      }
  };

  // Sync Task -> Calendar Event
  const handleTaskToSchedule = (task: Task) => {
    const start = new Date(task.dueDate);
    const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour duration
    
    const newEvent: CalendarEvent = {
        id: `evt-${task.id}`,
        title: task.title,
        start: start,
        end: end,
        type: 'admin', // Tasks are usually administrative
        description: 'Imported from Tasks',
        notifyEmail: false, // Disable alerts
        notifySms: false, // Disable alerts
        alertOffset: 0,
        hasAlerted: true, // Mark as alerted so it stays silent
        alertSound: 'none', // No sound
        alertRepeat: 'once'
    };
    
    setEvents(prev => [...prev, newEvent]);
  };

  // Sync Calendar Event -> Task
  const handleEventToTask = (event: CalendarEvent) => {
      const newTask: Task = {
          id: `task-${event.id}`,
          title: event.title,
          completed: false,
          dueDate: event.start.toISOString(),
          priority: TaskPriority.MEDIUM,
          notifyEmail: false, // Default to silent to avoid double alerts
          notifySms: false,
          alertEmail: '',
          alertMobile: '',
          alarmSound: 'none', // Default to silent
          hasAlerted: true,
          alertRepeat: 'once'
      };
      setTasks(prev => [...prev, newTask]);
  };

  const renderView = () => {
    switch(currentView) {
      case ViewState.TEMPLATES:
        return <TemplateGenerator onActivityLog={(desc) => logActivity(desc, 'template')} />;
      case ViewState.SCHEDULER:
        return (
            <Scheduler 
                events={events} 
                setEvents={setEvents} 
                customSounds={customSounds} 
                onAddCustomSound={handleAddCustomSound} 
                onActivityLog={(desc) => logActivity(desc, 'schedule')}
                onAddToTask={handleEventToTask} 
            />
        );
      case ViewState.TASKS:
        return <TaskManager tasks={tasks} setTasks={setTasks} customSounds={customSounds} onAddCustomSound={handleAddCustomSound} onActivityLog={(desc) => logActivity(desc, 'task')} onAddToSchedule={handleTaskToSchedule} />;
      case ViewState.DASHBOARD:
      default:
        return <Dashboard onNavigate={setCurrentView} tasks={tasks} events={events} activities={activities} onClearActivities={clearActivities} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors duration-300">
      
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-slate-900 dark:bg-slate-950 text-white transition-all duration-300 flex flex-col shadow-2xl z-10`}>
        <div className="p-6 flex items-center justify-between">
          {isSidebarOpen && <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">EduCoach</h1>}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white">
            <Menu className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-2">
          <NavButton 
            active={currentView === ViewState.DASHBOARD} 
            onClick={() => setCurrentView(ViewState.DASHBOARD)} 
            icon={<LayoutDashboard />} 
            label="Dashboard" 
            isOpen={isSidebarOpen} 
          />
          <NavButton 
            active={currentView === ViewState.TEMPLATES} 
            onClick={() => setCurrentView(ViewState.TEMPLATES)} 
            icon={<FileEdit />} 
            label="Coaching Sessions" 
            isOpen={isSidebarOpen} 
          />
          <NavButton 
            active={currentView === ViewState.SCHEDULER} 
            onClick={() => setCurrentView(ViewState.SCHEDULER)} 
            icon={<CalendarDays />} 
            label="Schedule" 
            isOpen={isSidebarOpen} 
          />
          <NavButton 
            active={currentView === ViewState.TASKS} 
            onClick={() => setCurrentView(ViewState.TASKS)} 
            icon={<CheckSquare />} 
            label="Tasks" 
            isOpen={isSidebarOpen} 
          />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className={`flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 ${!isSidebarOpen && 'justify-center'}`}>
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-pink-500 to-orange-400 flex items-center justify-center text-white font-bold">
              S
            </div>
            {isSidebarOpen && (
              <div className="overflow-hidden">
                <p className="text-sm font-medium text-white truncate">Scholar</p>
                <p className="text-xs text-slate-400 truncate">Pro Plan</p>
              </div>
            )}
          </div>
          {isSidebarOpen && (
              <button className="mt-4 w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors">
                  Upgrade to Premium
              </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header for mobile/layout context */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-8 shadow-sm z-0 transition-colors duration-300">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 capitalize">
            {currentView === ViewState.TEMPLATES ? 'Coaching Sessions' : currentView.toLowerCase().replace('_', ' ')}
          </h2>
          <div className="flex items-center gap-4">
             <button 
                onClick={toggleTheme} 
                className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-colors"
                title="Toggle Theme"
             >
                {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
             </button>
             <div className="w-px h-6 bg-slate-200 dark:bg-slate-700"></div>
             <button className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-colors">
                <Settings className="h-5 w-5" />
             </button>
             <button className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-colors">
                <LogOut className="h-5 w-5" />
             </button>
          </div>
        </header>

        {/* Viewport */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/50">
          {renderView()}
        </div>
      </main>
    </div>
  );
}

// --- Helper Components ---

const NavButton: React.FC<{active: boolean, onClick: () => void, icon: React.ReactNode, label: string, isOpen: boolean}> = ({active, onClick, icon, label, isOpen}) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200
      ${active 
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' 
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      } ${!isOpen && 'justify-center'}`}
  >
    {React.cloneElement(icon as React.ReactElement<any>, { size: 20 })}
    {isOpen && <span className="font-medium">{label}</span>}
  </button>
);

const Dashboard: React.FC<{
    onNavigate: (view: ViewState) => void, 
    tasks: Task[], 
    events: CalendarEvent[], 
    activities: Activity[],
    onClearActivities: () => void
}> = ({onNavigate, tasks, events, activities, onClearActivities}) => {
  const pendingCount = tasks.filter(t => !t.completed).length;
  
  // Calculate today's events
  const today = new Date();
  const todayEventsCount = events.filter(ev => 
    ev.start.getDate() === today.getDate() && 
    ev.start.getMonth() === today.getMonth() && 
    ev.start.getFullYear() === today.getFullYear()
  ).length;

  // Find next event
  const nextEvent = events
    .filter(ev => ev.start.getTime() > new Date().getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime())[0];

  const formatTime = (date: Date) => {
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
      
      if (diffInSeconds < 60) return 'Just now';
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} mins ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
      return date.toLocaleDateString();
  };

  const getActivityIcon = (type: Activity['type']) => {
      switch(type) {
          case 'template': return <FileEdit size={18} />;
          case 'schedule': return <CalendarDays size={18} />;
          case 'task': return <CheckSquare size={18} />;
          default: return <Clock size={18} />;
      }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Welcome back, Scholar!</h1>
        <p className="text-slate-500 dark:text-slate-400">You have {todayEventsCount} coaching sessions and {pendingCount} pending tasks today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div onClick={() => onNavigate(ViewState.TEMPLATES)} className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-200/50 dark:shadow-none cursor-pointer hover:scale-[1.02] transition-transform">
          <FileEdit className="h-8 w-8 mb-4 opacity-80" />
          <h3 className="text-xl font-bold mb-1">New Session</h3>
          <p className="text-indigo-100 text-sm">Draft a coaching session with AI sentence starters.</p>
        </div>
        
        <div onClick={() => onNavigate(ViewState.SCHEDULER)} className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-500 transition-colors group">
          <div className="flex justify-between items-start mb-4">
            <CalendarDays className="h-8 w-8 text-emerald-500" />
            <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold px-2 py-1 rounded">Today</span>
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Schedule</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            {nextEvent 
              ? `Next: ${nextEvent.title} at ${nextEvent.start.toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})}`
              : "No upcoming events today"}
          </p>
        </div>

        <div onClick={() => onNavigate(ViewState.TASKS)} className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-500 transition-colors group">
          <div className="flex justify-between items-start mb-4">
            <CheckSquare className="h-8 w-8 text-rose-500" />
            <span className="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-xs font-bold px-2 py-1 rounded">{pendingCount} Pending</span>
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Tasks</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{pendingCount > 0 ? `${pendingCount} tasks waiting for action` : "No pending tasks"}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Recent Activity</h3>
            {activities.length > 0 && (
                <button 
                    onClick={onClearActivities}
                    className="text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors flex items-center gap-2 text-xs font-medium"
                >
                    <Trash2 className="h-4 w-4" /> Clear History
                </button>
            )}
        </div>
        
        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {activities.length === 0 ? (
              <p className="text-center text-slate-400 dark:text-slate-500 py-8 italic">No recent activity recorded.</p>
          ) : (
            activities.map((item) => (
                <div key={item.id} className="flex items-center gap-4 p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0 animate-in fade-in slide-in-from-top-1">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center 
                    ${item.type === 'template' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300' :
                      item.type === 'task' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300' :
                      item.type === 'schedule' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300' :
                      'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}
                `}>
                    {getActivityIcon(item.type)}
                </div>
                <div>
                    <p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{item.description}</p>
                    <p className="text-xs text-slate-400">{formatTime(item.timestamp)}</p>
                </div>
                </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default App;