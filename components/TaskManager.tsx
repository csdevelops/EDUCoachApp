import React, { useState, useEffect, useRef } from 'react';
import { Task, TaskPriority, AlertRepeat, CustomSound } from '../types';
import { parseSmartDate } from '../utils/smartParser';
import { CheckCircle2, Circle, Trash2, Plus, Mail, Smartphone, Volume2, Edit2, Save, X, Bell, Play, Upload, Mic, Square, Repeat, Check, Calendar, Clock, PlusCircle, List, Type, ArrowUp, ArrowDown, AlertCircle } from 'lucide-react';

interface TaskManagerProps {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  customSounds: CustomSound[];
  onAddCustomSound: (name: string, data: string) => void;
  onActivityLog?: (description: string) => void;
  onAddToSchedule?: (task: Task) => void;
}

const TaskManager: React.FC<TaskManagerProps> = ({ tasks, setTasks, customSounds, onAddCustomSound, onActivityLog, onAddToSchedule }) => {
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Bulk Mode State
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');

  // Sorting State
  const [sortBy, setSortBy] = useState<'date' | 'priority'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Form State
  const [editForm, setEditForm] = useState<{
    title: string;
    dueDate: string;
    priority: TaskPriority;
    notifyEmail: boolean;
    notifySms: boolean;
    alertEmail: string;
    alertMobile: string;
    alarmSound: string;
    alertRepeat: AlertRepeat;
  }>({
    title: '',
    dueDate: '',
    priority: TaskPriority.MEDIUM,
    notifyEmail: false,
    notifySms: false,
    alertEmail: '',
    alertMobile: '',
    alarmSound: 'chime',
    alertRepeat: 'once'
  });

  // Audio Refs & Recording State
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  
  // Custom Sound Naming
  const [tempSound, setTempSound] = useState<{data: string, name: string} | null>(null);

  useEffect(() => {
    audioRefs.current = {
      chime: new Audio('https://actions.google.com/sounds/v1/alarms/bugle_tune.ogg'),
      beep: new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg'),
      bell: new Audio('https://actions.google.com/sounds/v1/alarms/medium_bell_ringing_near.ogg'),
    };
  }, []);

  // Reminder Check Loop
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      
      // 1. Identify tasks that need alerting
      const tasksToAlert = tasks.filter(t => {
        if (t.completed) return false;
        const due = new Date(t.dueDate).getTime();
        if (due > now) return false;

        // Check Logic
        if (t.alertRepeat === 'once') {
            return !t.hasAlerted;
        } else {
            // Recurring logic
            if (!t.hasAlerted) return true; // First time
            const interval = t.alertRepeat === 'every_3' ? 3 * 60000 : 5 * 60000;
            const lastAlert = t.lastAlertedAt || 0;
            return (now - lastAlert) >= interval;
        }
      });

      if (tasksToAlert.length > 0) {
        // 2. Trigger Side Effects
        const task = tasksToAlert[0]; // Handle one at a time to avoid alert overlapping chaos
        playAlarm(task.alarmSound);
        showNotification(task);

        // 3. Update State
        setTasks(prevTasks => prevTasks.map(t => {
            if (t.id === task.id) {
                return { 
                    ...t, 
                    hasAlerted: true,
                    lastAlertedAt: now
                };
            }
            return t;
        }));
      }
    }, 2000); // Check every 2 seconds

    return () => clearInterval(interval);
  }, [tasks, setTasks]);

  const playAlarm = (sound: string) => {
    if (sound === 'none') return;

    if (['chime', 'beep', 'bell'].includes(sound)) {
        const audio = audioRefs.current[sound];
        if (audio) {
            audio.currentTime = 0;
            audio.play().catch(e => console.warn("Audio play blocked until interaction", e));
        }
    } else {
        // Handle custom sound (data URI)
        try {
            const audio = new Audio(sound);
            audio.play().catch(e => console.warn(e));
        } catch (e) {
            console.error("Error playing custom sound", e);
            // Fallback
            audioRefs.current['beep']?.play();
        }
    }
  };

  const playPreview = (soundSrc?: string) => {
      const sound = soundSrc || editForm.alarmSound;
      if (sound === 'none') return;

      if (['chime', 'beep', 'bell'].includes(sound)) {
          audioRefs.current[sound]?.play().catch(e => console.warn(e));
      } else if (sound) {
          const audio = new Audio(sound);
          audio.play().catch(e => console.warn(e));
      }
  };

  const showNotification = (task: Task) => {
    const lines = [`🔔 Reminder: ${task.title}`];
    if (task.alertRepeat !== 'once') {
        lines.push(`(Repeating ${task.alertRepeat.replace('_', ' ')} minutes)`);
    }
    
    if (task.notifyEmail) {
        lines.push(`📧 Simulated Email sent to: ${task.alertEmail || 'Scholar (Default)'}`);
    }
    if (task.notifySms) {
        lines.push(`📱 Simulated SMS sent to: ${task.alertMobile || 'Registered Mobile'}`);
    }
    
    setTimeout(() => {
        alert(lines.join('\n'));
    }, 100);
  };

  // -- Recording Handlers --
  const startRecording = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        audioChunksRef.current = [];

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
            const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onloadend = () => {
                // Set Temp Sound for Naming
                setTempSound({ data: reader.result as string, name: 'My Recording' });
            };
            reader.readAsDataURL(blob);
            stream.getTracks().forEach(track => track.stop());
        };

        recorder.start();
        setIsRecording(true);
    } catch (err) {
        alert("Could not access microphone. Please ensure permissions are granted.");
        console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
    }
  };

  // -- Upload Handler --
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setTempSound({ data: reader.result as string, name: file.name.split('.')[0] || 'Custom Sound' });
        };
        reader.readAsDataURL(file);
    }
  };

  const saveCustomSound = () => {
      if (tempSound) {
          onAddCustomSound(tempSound.name, tempSound.data);
          setEditForm(prev => ({ ...prev, alarmSound: tempSound.data }));
          setTempSound(null);
      }
  }

  const discardCustomSound = () => {
      setTempSound(null);
  }

  // -- CRUD Actions --

  const toggleComplete = (id: string) => {
    const task = tasks.find(t => t.id === id);
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    if (onActivityLog && task) {
         onActivityLog(task.completed ? `Unmarked task: ${task.title}` : `Completed task: ${task.title}`);
    }
  };

  const deleteTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    setTasks(tasks.filter(t => t.id !== id));
    if (onActivityLog && task) onActivityLog(`Deleted task: ${task.title}`);
  };

  const clearCompleted = () => {
    const count = tasks.filter(t => t.completed).length;
    setTasks(tasks.filter(t => !t.completed));
    if (onActivityLog && count > 0) onActivityLog(`Cleared ${count} completed tasks`);
  };

  // -- Sorting Logic --
  
  const toggleSort = (type: 'date' | 'priority') => {
      if (sortBy === type) {
          // Toggle order
          setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
      } else {
          setSortBy(type);
          // Defaults: Date->Asc(Soonest), Priority->Desc(High first)
          setSortOrder(type === 'date' ? 'asc' : 'desc');
      }
  };

  const sortedTasks = [...tasks].sort((a, b) => {
      if (sortBy === 'date') {
          const dateA = new Date(a.dueDate).getTime();
          const dateB = new Date(b.dueDate).getTime();
          return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      } else {
          const priorityMap = { [TaskPriority.HIGH]: 3, [TaskPriority.MEDIUM]: 2, [TaskPriority.LOW]: 1 };
          const valA = priorityMap[a.priority];
          const valB = priorityMap[b.priority];
          return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
  });

  // -- Modal / Form Logic --

  const openNewTaskModal = () => {
    setEditingId(null);
    setIsBulkMode(false);
    setBulkText('');
    
    // Default to 5 mins from now
    const now = new Date();
    const defaultDate = new Date(now.getTime() + 5 * 60000);
    // Adjust to local ISO string for input
    const localIso = new Date(defaultDate.getTime() - (defaultDate.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);

    setEditForm({
      title: '',
      dueDate: localIso,
      priority: TaskPriority.MEDIUM,
      notifyEmail: false,
      notifySms: false,
      alertEmail: '',
      alertMobile: '',
      alarmSound: 'chime',
      alertRepeat: 'once'
    });
    setTempSound(null);
    setIsModalOpen(true);
  };

  const openEditTaskModal = (task: Task) => {
    setEditingId(task.id);
    setIsBulkMode(false); // Can't bulk edit existing
    
    const date = new Date(task.dueDate);
    const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
    const dateString = localDate.toISOString().slice(0, 16);

    setEditForm({
      title: task.title,
      dueDate: dateString,
      priority: task.priority,
      notifyEmail: task.notifyEmail,
      notifySms: task.notifySms,
      alertEmail: task.alertEmail || '',
      alertMobile: task.alertMobile || '',
      alarmSound: task.alarmSound,
      alertRepeat: task.alertRepeat
    });
    setTempSound(null);
    setIsModalOpen(true);
  };

  const handleSave = (addAnother: boolean = false) => {
    const defaultDueDate = new Date(editForm.dueDate);

    // -- Bulk Create Logic --
    if (!editingId && isBulkMode) {
        if (!bulkText.trim()) {
            alert("Please enter at least one task.");
            return;
        }

        const lines = bulkText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        const newTasks: Task[] = lines.map((line, idx) => {
             // Use Smart Parser to extract date/time info from line
             const { title: cleanTitle, date: parsedDate } = parseSmartDate(line, defaultDueDate);
             
             return {
                id: Date.now().toString() + '-' + idx,
                title: cleanTitle || 'Untitled Task',
                completed: false,
                dueDate: parsedDate.toISOString(),
                priority: editForm.priority,
                notifyEmail: editForm.notifyEmail,
                notifySms: editForm.notifySms,
                alertEmail: editForm.alertEmail,
                alertMobile: editForm.alertMobile,
                alarmSound: editForm.alarmSound,
                hasAlerted: false,
                alertRepeat: editForm.alertRepeat
             };
        });

        setTasks(prev => [...prev, ...newTasks]);
        if (onActivityLog) onActivityLog(`Added ${newTasks.length} tasks from bulk list`);
        
        // Sync to Schedule
        if (onAddToSchedule) {
            newTasks.forEach(t => onAddToSchedule(t));
        }

        setIsModalOpen(false);
        return;
    }

    // -- Standard Single Logic --
    if (!editForm.title.trim() && !isBulkMode) {
        alert("Task title is required");
        return;
    }
    
    if (editingId) {
        // Update existing
        setTasks(tasks.map(t => {
            if (t.id === editingId) {
                const isDueDateChanged = defaultDueDate.toISOString() !== t.dueDate;
                return {
                    ...t,
                    title: editForm.title,
                    dueDate: defaultDueDate.toISOString(),
                    priority: editForm.priority,
                    notifyEmail: editForm.notifyEmail,
                    notifySms: editForm.notifySms,
                    alertEmail: editForm.alertEmail,
                    alertMobile: editForm.alertMobile,
                    alarmSound: editForm.alarmSound,
                    alertRepeat: editForm.alertRepeat,
                    hasAlerted: isDueDateChanged && defaultDueDate > new Date() ? false : t.hasAlerted,
                    lastAlertedAt: isDueDateChanged ? undefined : t.lastAlertedAt
                };
            }
            return t;
        }));
        if (onActivityLog) onActivityLog(`Updated task: ${editForm.title}`);
        if (!addAnother) setIsModalOpen(false);
    } else {
        // Create new
        const newTask: Task = {
            id: Date.now().toString(),
            title: editForm.title,
            completed: false,
            dueDate: defaultDueDate.toISOString(),
            priority: editForm.priority,
            notifyEmail: editForm.notifyEmail,
            notifySms: editForm.notifySms,
            alertEmail: editForm.alertEmail,
            alertMobile: editForm.alertMobile,
            alarmSound: editForm.alarmSound,
            hasAlerted: false,
            alertRepeat: editForm.alertRepeat
        };
        setTasks(prev => [...prev, newTask]);
        if (onActivityLog) onActivityLog(`Added task: ${editForm.title}`);

        // Sync to Schedule
        if (onAddToSchedule) {
            onAddToSchedule(newTask);
        }

        if (addAnother) {
            // Reset title but keep other settings for rapid entry
            setEditForm(prev => ({
                ...prev,
                title: ''
            }));
        } else {
            setIsModalOpen(false);
        }
    }
  };

  const hasCompletedTasks = tasks.some(t => t.completed);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 min-h-[600px] flex flex-col">
        {/* Header */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-8 gap-4">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="text-emerald-500" /> Tasks & Reminders
            </h2>
            
            <div className="flex flex-wrap items-center gap-3">
                {/* Sort Controls */}
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                    <button 
                        onClick={() => toggleSort('date')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${sortBy === 'date' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                    >
                        <Clock className="h-3 w-3" /> Date
                    </button>
                    <button 
                        onClick={() => toggleSort('priority')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${sortBy === 'priority' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                    >
                        <AlertCircle className="h-3 w-3" /> Priority
                    </button>
                    <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                    <button 
                        onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                        className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-slate-500 dark:text-slate-400 transition-colors"
                        title={sortOrder === 'asc' ? "Ascending" : "Descending"}
                    >
                        {sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                    </button>
                </div>

                {hasCompletedTasks && (
                    <button 
                        onClick={clearCompleted}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 dark:text-rose-400 dark:bg-rose-900/20 dark:hover:bg-rose-900/40 rounded-lg transition-colors"
                    >
                        <Trash2 className="h-4 w-4" /> Clear Done
                    </button>
                )}
                <button 
                    onClick={openNewTaskModal}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-md"
                >
                    <Plus className="h-5 w-5" /> New Task
                </button>
            </div>
        </div>

        {/* Task List */}
        <div className="space-y-3 flex-1">
          {tasks.length === 0 && (
            <div className="text-center py-16 flex flex-col items-center">
                <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-full mb-4">
                    <CheckCircle2 className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                </div>
                <p className="text-slate-500 dark:text-slate-400 font-medium">No tasks yet.</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Click "New Task" to organize your day.</p>
            </div>
          )}
          
          {sortedTasks.map(task => (
            <div 
              key={task.id} 
              className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group ${
                task.completed 
                    ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 opacity-60' 
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800'
              }`}
            >
                <div className="flex items-start sm:items-center gap-4">
                    <button onClick={() => toggleComplete(task.id)} className="mt-1 sm:mt-0 flex-shrink-0">
                        {task.completed ? (
                            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                        ) : (
                            <Circle className="h-6 w-6 text-slate-300 dark:text-slate-600 hover:text-indigo-500 transition-colors" />
                        )}
                    </button>
                    <div>
                        <h3 className={`font-medium text-lg ${task.completed ? 'line-through text-slate-500 dark:text-slate-600' : 'text-slate-800 dark:text-slate-200'}`}>
                            {task.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                            <span className={`px-2 py-0.5 rounded-full font-medium ${
                                task.priority === TaskPriority.HIGH ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' : 
                                task.priority === TaskPriority.MEDIUM ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            }`}>
                                {task.priority}
                            </span>
                            <span className="flex items-center gap-1">
                                Due: {new Date(task.dueDate).toLocaleString([], {month: 'short', day: 'numeric', hour: 'numeric', minute:'2-digit'})}
                            </span>
                            
                            {(task.notifyEmail || task.notifySms) && (
                                <div className="flex gap-2 ml-2 border-l pl-2 border-slate-200 dark:border-slate-700">
                                    {task.notifyEmail && <Mail className="h-3 w-3 text-indigo-500" />}
                                    {task.notifySms && <Smartphone className="h-3 w-3 text-indigo-500" />}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                        onClick={() => openEditTaskModal(task)}
                        className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-full"
                        title="Edit Task"
                    >
                        <Edit2 className="h-5 w-5" />
                    </button>

                    <button 
                        onClick={() => deleteTask(task.id)}
                        className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-full"
                        title="Delete Task"
                    >
                        <Trash2 className="h-5 w-5" />
                    </button>
                </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-700">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900 shrink-0">
              <h3 className="font-bold text-slate-800 dark:text-white text-lg">
                {editingId ? 'Edit Task' : 'New Task'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-slate-500 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                
                {/* Entry Mode Toggle (Only for New Tasks) */}
                {!editingId && (
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg mb-2">
                        <button 
                            onClick={() => setIsBulkMode(false)}
                            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${!isBulkMode ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                        >
                            <Type className="h-4 w-4" /> Single Task
                        </button>
                        <button 
                            onClick={() => setIsBulkMode(true)}
                            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${isBulkMode ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                        >
                            <List className="h-4 w-4" /> Bulk List
                        </button>
                    </div>
                )}

                {/* Title or Bulk Text Input */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {isBulkMode ? "Task List (One per line)" : "Task Title"}
                  </label>
                  
                  {isBulkMode ? (
                      <textarea 
                        autoFocus
                        value={bulkText}
                        onChange={(e) => setBulkText(e.target.value)}
                        className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono h-32 resize-none transition-all focus:bg-slate-800 focus:text-white dark:bg-slate-700 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        placeholder={'1. Grade Biology Papers (Tomorrow 5pm)\n2. Call Mrs. Smith (Friday 2pm)\n3. Prepare Lesson Plan'}
                      />
                  ) : (
                      <input 
                        type="text" 
                        autoFocus
                        value={editForm.title}
                        onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                        className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-lg transition-all focus:bg-slate-800 focus:text-white dark:bg-slate-700 dark:text-white"
                        placeholder="e.g., Grade Biology Papers"
                      />
                  )}
                  {isBulkMode && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Tip: You can type 'Tomorrow', 'Monday', '5pm' directly in the list.</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Date */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{isBulkMode ? "Default Due Date" : "Due Date & Time"}</label>
                      <div className="relative">
                          <Clock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                          <input 
                            type="datetime-local" 
                            value={editForm.dueDate}
                            onChange={(e) => setEditForm({...editForm, dueDate: e.target.value})}
                            className="w-full pl-9 pr-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-slate-800 focus:text-white dark:bg-slate-700 dark:text-white"
                          />
                      </div>
                    </div>

                    {/* Priority */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                      <select 
                        value={editForm.priority}
                        onChange={(e) => setEditForm({...editForm, priority: e.target.value as TaskPriority})}
                        className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-slate-700 transition-all focus:bg-slate-800 focus:text-white dark:text-white"
                      >
                        {Object.values(TaskPriority).map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                </div>

                {/* Notifications & Alerts */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                        <Bell className="h-4 w-4 text-indigo-500" />
                        <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">Alerts & Notifications</span>
                    </div>
                    
                    {/* Repeat */}
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                        <label className="flex items-center gap-2 min-w-[120px] text-sm text-slate-700 dark:text-slate-300">
                            <Repeat className="h-4 w-4 text-slate-400" />
                            Repeat Alert:
                        </label>
                        <select 
                            value={editForm.alertRepeat}
                            onChange={e => setEditForm({...editForm, alertRepeat: e.target.value as AlertRepeat})}
                            className="flex-1 text-sm p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-slate-800 focus:text-white dark:text-white"
                        >
                            <option value="once">Once (No Repeat)</option>
                            <option value="every_3">Every 3 Minutes</option>
                            <option value="every_5">Every 5 Minutes</option>
                        </select>
                    </div>

                    {/* Email */}
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                        <label className="flex items-center gap-2 min-w-[120px] cursor-pointer">
                            <input 
                                type="checkbox"
                                checked={editForm.notifyEmail}
                                onChange={e => setEditForm({...editForm, notifyEmail: e.target.checked})}
                                className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">Email Alert</span>
                        </label>
                        {editForm.notifyEmail && (
                            <div className="flex-1 relative w-full animate-in fade-in slide-in-from-left-2">
                                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <input 
                                    type="email"
                                    value={editForm.alertEmail}
                                    onChange={e => setEditForm({...editForm, alertEmail: e.target.value})}
                                    placeholder="Enter email address"
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-slate-800 focus:text-white dark:bg-slate-700 dark:text-white"
                                />
                            </div>
                        )}
                    </div>

                    {/* SMS */}
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                        <label className="flex items-center gap-2 min-w-[120px] cursor-pointer">
                            <input 
                                type="checkbox"
                                checked={editForm.notifySms}
                                onChange={e => setEditForm({...editForm, notifySms: e.target.checked})}
                                className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">Text Alert</span>
                        </label>
                        {editForm.notifySms && (
                            <div className="flex-1 relative w-full animate-in fade-in slide-in-from-left-2">
                                <Smartphone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <input 
                                    type="tel"
                                    value={editForm.alertMobile}
                                    onChange={e => setEditForm({...editForm, alertMobile: e.target.value})}
                                    placeholder="Enter mobile number"
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-slate-800 focus:text-white dark:bg-slate-700 dark:text-white"
                                />
                            </div>
                        )}
                    </div>
                    
                    {/* Sound Selection */}
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                         <div className="flex justify-between items-center mb-2">
                             <label className="text-xs text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1">
                                 <Volume2 className="h-3 w-3" /> Alarm Sound
                             </label>
                             <button type="button" onClick={() => playPreview(tempSound ? tempSound.data : undefined)} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 text-xs font-medium flex items-center gap-1">
                                 <Play className="h-3 w-3" /> Preview
                             </button>
                         </div>
                         
                         {tempSound ? (
                             <div className="flex flex-col gap-2 bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded border border-indigo-100 dark:border-indigo-800 animate-in fade-in">
                                 <label className="text-xs font-bold text-indigo-800 dark:text-indigo-300">Name your custom sound:</label>
                                 <input 
                                     type="text" 
                                     value={tempSound.name}
                                     onChange={(e) => setTempSound({ ...tempSound, name: e.target.value })}
                                     className="text-sm p-1.5 rounded border border-indigo-200 dark:border-indigo-700 w-full bg-white dark:bg-slate-800 dark:text-white"
                                     placeholder="e.g., My Voice Note"
                                     autoFocus
                                 />
                                 <div className="flex gap-2 mt-1">
                                     <button 
                                         onClick={saveCustomSound}
                                         className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700"
                                     >
                                         <Check className="h-3 w-3" /> Save Sound
                                     </button>
                                     <button 
                                         onClick={discardCustomSound}
                                         className="flex items-center justify-center gap-1 px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs rounded hover:bg-slate-300 dark:hover:bg-slate-600"
                                     >
                                         <X className="h-3 w-3" />
                                     </button>
                                 </div>
                             </div>
                         ) : (
                             <div className="flex flex-col gap-3">
                                 <select
                                     value={editForm.alarmSound}
                                     onChange={(e) => setEditForm({...editForm, alarmSound: e.target.value})}
                                     className="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-slate-800 focus:text-white dark:text-white"
                                 >
                                     <option value="none">None (Silent)</option>
                                     <optgroup label="Presets" className="dark:bg-slate-800">
                                         <option value="chime">Chime</option>
                                         <option value="beep">Beep</option>
                                         <option value="bell">Bell</option>
                                     </optgroup>
                                     {customSounds.length > 0 && (
                                         <optgroup label="My Sounds" className="dark:bg-slate-800">
                                             {customSounds.map(sound => (
                                                 <option key={sound.id} value={sound.data}>{sound.name}</option>
                                             ))}
                                         </optgroup>
                                     )}
                                 </select>

                                 <div className="grid grid-cols-2 gap-2">
                                     <button 
                                         type="button"
                                         onClick={() => fileInputRef.current?.click()}
                                         className="flex items-center justify-center gap-2 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors"
                                     >
                                         <Upload className="h-3 w-3" /> Upload File
                                     </button>
                                     <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />

                                     <button 
                                         type="button"
                                         onClick={isRecording ? stopRecording : startRecording}
                                         className={`flex items-center justify-center gap-2 py-2 border rounded text-xs font-medium transition-colors ${
                                             isRecording 
                                             ? 'bg-rose-100 border-rose-300 text-rose-700 animate-pulse dark:bg-rose-900/30 dark:border-rose-800 dark:text-rose-400' 
                                             : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                                         }`}
                                     >
                                         {isRecording ? <Square className="h-3 w-3 fill-current" /> : <Mic className="h-3 w-3" />}
                                         {isRecording ? 'Stop Recording' : 'Record Voice'}
                                     </button>
                                 </div>
                             </div>
                         )}
                    </div>
                </div>

            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-col sm:flex-row justify-end gap-3 shrink-0">
               <button 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                
                {/* Save & Add Another (Only for New Single Tasks) */}
                {!editingId && !isBulkMode && (
                     <button 
                        onClick={() => handleSave(true)}
                        className="px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                     >
                        <PlusCircle className="h-4 w-4" /> Save & Add Another
                     </button>
                )}

                <button 
                  onClick={() => handleSave(false)}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Save className="h-4 w-4" /> {isBulkMode ? "Add All Tasks" : "Save Task"}
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskManager;