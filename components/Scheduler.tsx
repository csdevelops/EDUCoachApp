import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CalendarEvent, AlertRepeat, CustomSound, Task } from '../types';
import { parseSmartDate } from '../utils/smartParser';
import { ChevronLeft, ChevronRight, Plus, Clock, Calendar, X, Trash2, Save, AlignLeft, Bell, Mail, Smartphone, Volume2, Play, Upload, Mic, Square, CheckCircle2, Repeat, Check, RotateCw, Loader2, List, Type } from 'lucide-react';

// Updated to 24 Hours
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface SchedulerProps {
  events: CalendarEvent[];
  setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
  customSounds: CustomSound[];
  onAddCustomSound: (name: string, data: string) => void;
  onActivityLog?: (description: string) => void;
  onAddToTask?: (event: CalendarEvent) => void;
}

const Scheduler: React.FC<SchedulerProps> = ({ events, setEvents, customSounds, onAddCustomSound, onActivityLog, onAddToTask }) => {
  // -- State --
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  
  // Bulk Mode State
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  
  // Save Animation State
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Audio & Recording
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Custom Sound Naming
  const [tempSound, setTempSound] = useState<{data: string, name: string} | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    date: '', // YYYY-MM-DD
    startTime: '09:00',
    endTime: '10:00',
    type: 'class' as 'class' | 'meeting' | 'admin' | 'personal',
    description: '',
    notifyEmail: false,
    notifySms: false,
    alertEmail: '',
    alertMobile: '',
    alertOffset: 0, // 0 = At time, 15 = 15m before, etc.
    alertSound: 'chime' as string, // 'chime' | 'beep' | 'bell' | 'none' | custom_data_uri
    alertRepeat: 'once' as AlertRepeat,
    recurrenceRule: 'none' as 'none' | 'daily' | 'weekly' | 'monthly',
    recurrenceEndDate: ''
  });

  // Init Audio
  useEffect(() => {
    audioRefs.current = {
      chime: new Audio('https://actions.google.com/sounds/v1/alarms/bugle_tune.ogg'),
      beep: new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg'),
      bell: new Audio('https://actions.google.com/sounds/v1/alarms/medium_bell_ringing_near.ogg'),
    };
  }, []);

  // -- Alert Logic --
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      
      const eventsToAlert = events.filter(ev => {
        // Calculate Trigger Time
        const triggerTime = new Date(ev.start.getTime() - (ev.alertOffset * 60000)).getTime();
        
        // Valid window: Trigger time has passed, but event hasn't ended significantly (e.g. < 2 hours ago)
        const isValidWindow = now >= triggerTime && (now - ev.end.getTime() < 7200000);
        
        if (!isValidWindow) return false;

        // Check Logic
        if (ev.alertRepeat === 'once') {
          return !ev.hasAlerted;
        } else {
          // Recurring Logic
          if (!ev.hasAlerted) return true; // First time
          
          const interval = ev.alertRepeat === 'every_3' ? 3 * 60000 : 5 * 60000;
          const lastAlert = ev.lastAlertedAt || 0;
          return (now - lastAlert) >= interval;
        }
      });

      if (eventsToAlert.length > 0) {
        eventsToAlert.forEach(ev => {
            // Play Sound if not 'none'
            const sound = ev.alertSound || 'chime';
            if (sound !== 'none') {
                if (['chime', 'beep', 'bell'].includes(sound)) {
                    audioRefs.current[sound]?.play().catch(console.warn);
                } else {
                    const audio = new Audio(sound);
                    audio.play().catch(console.warn);
                }
            }

           // Show Alerts
           let msg = `📅 Event Reminder: ${ev.title}`;
           if (ev.alertOffset > 0) msg += ` (In ${ev.alertOffset} mins)`;
           else msg += ` (Starting Now)`;
           
           if (ev.alertRepeat !== 'once') msg += `\n(Repeating ${ev.alertRepeat.replace('_', ' ')} minutes)`;

           if (ev.notifyEmail) msg += `\n📧 Email sent to: ${ev.alertEmail || 'Scholar'}`;
           if (ev.notifySms) msg += `\n📱 SMS sent to: ${ev.alertMobile || 'Mobile'}`;

           setTimeout(() => alert(msg), 100);
        });

        // Update State
        setEvents(prev => prev.map(ev => {
           if (eventsToAlert.find(a => a.id === ev.id)) {
             return { 
               ...ev, 
               hasAlerted: true,
               lastAlertedAt: now
             };
           }
           return ev;
        }));
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [events, setEvents]);

  // -- Helpers --

  const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0); // Normalize to midnight to include all events for the start day
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  };

  const addDays = (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  // Fixed: Use local time components to avoid UTC shifts
  const toISODate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const toTimeString = (date: Date) => {
    return date.toTimeString().slice(0, 5);
  };

  const formatHourLabel = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
  }

  // -- Computed --

  const weekStart = getStartOfWeek(currentDate);
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const currentWeekEvents = useMemo(() => {
    return events.filter(event => {
      return event.start >= weekStart && event.start < addDays(weekStart, 7);
    });
  }, [events, weekStart]);

  // -- Handlers --

  const handlePrevWeek = () => setCurrentDate(addDays(currentDate, -7));
  const handleNextWeek = () => setCurrentDate(addDays(currentDate, 7));
  const handleToday = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    setCurrentDate(now);
  };

  const handleJumpToDate = (e: React.ChangeEvent<HTMLInputElement>) => {
      if(e.target.value) {
          // Parse YYYY-MM-DD as local date to prevent timezone shifts
          const [year, month, day] = e.target.value.split('-').map(Number);
          // Month is 0-indexed in JS Date
          setCurrentDate(new Date(year, month - 1, day));
      }
  }

  const handleManualSave = () => {
      if (saveStatus !== 'idle') return; // Prevent spamming

      setSaveStatus('saving');
      
      // 1.5 seconds buffering animation
      setTimeout(() => {
          setSaveStatus('saved');
          if (onActivityLog) onActivityLog("Manually saved calendar changes");

          // 2 seconds success checkmark then reset
          setTimeout(() => {
              setSaveStatus('idle');
          }, 2000);
      }, 1500);
  };

  const handleClearAllEvents = () => {
      if (events.length === 0) return;
      
      // Strong confirmation to ensure user intent
      if (window.confirm("WARNING: You are about to delete ALL events from your schedule. \n\nThis action cannot be undone. Are you sure?")) {
          setEvents([]);
          if (onActivityLog) onActivityLog("Cleared all events from schedule");
      }
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
          setFormData(prev => ({ ...prev, alertSound: tempSound.data }));
          setTempSound(null);
      }
  }

  const discardCustomSound = () => {
      setTempSound(null);
  }

  const playPreview = (soundSrc?: string) => {
      const sound = soundSrc || formData.alertSound;
      if (sound === 'none') return;

      if (['chime', 'beep', 'bell'].includes(sound)) {
          audioRefs.current[sound]?.play().catch(e => console.warn(e));
      } else if (sound) {
          const audio = new Audio(sound);
          audio.play().catch(e => console.warn(e));
      }
  };

  const openNewEventModal = (date?: Date, hour?: number) => {
    setEditingEventId(null);
    setIsBulkMode(false);
    setBulkText('');
    
    const defaultDate = date ? toISODate(date) : toISODate(new Date());
    const defaultStart = hour !== undefined ? `${hour.toString().padStart(2, '0')}:00` : '09:00';
    const defaultEnd = hour !== undefined ? `${(hour + 1).toString().padStart(2, '0')}:00` : '10:00';

    setFormData({
      title: '',
      date: defaultDate,
      startTime: defaultStart,
      endTime: defaultEnd,
      type: 'meeting',
      description: '',
      notifyEmail: false,
      notifySms: false,
      alertEmail: '',
      alertMobile: '',
      alertOffset: 15,
      alertSound: 'chime',
      alertRepeat: 'once',
      recurrenceRule: 'none',
      recurrenceEndDate: ''
    });
    setTempSound(null);
    setIsModalOpen(true);
  };

  const openEditEventModal = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEventId(event.id);
    setIsBulkMode(false); // Can't bulk edit
    
    setFormData({
      title: event.title,
      date: toISODate(event.start),
      startTime: toTimeString(event.start),
      endTime: toTimeString(event.end),
      type: event.type as any,
      description: event.description || '',
      notifyEmail: event.notifyEmail,
      notifySms: event.notifySms,
      alertEmail: event.alertEmail || '',
      alertMobile: event.alertMobile || '',
      alertOffset: event.alertOffset,
      alertSound: event.alertSound || 'chime',
      alertRepeat: event.alertRepeat || 'once',
      recurrenceRule: event.recurrenceRule || 'none',
      recurrenceEndDate: '' // Reset for edit
    });
    setTempSound(null);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    // 1. Basic Validation
    if ((!isBulkMode && !formData.title) || (isBulkMode && !bulkText)) {
      alert("Please provide an event title or a list of events.");
      return;
    }

    if (!formData.date || !formData.startTime || !formData.endTime) {
      alert("Please fill in date and time fields.");
      return;
    }

    // Calculate default start/end based on form
    const formStartDateTime = new Date(`${formData.date}T${formData.startTime}`);
    const formEndDateTime = new Date(`${formData.date}T${formData.endTime}`);
    
    // Calculate duration of default slot to apply to bulk items
    const defaultDurationMs = formEndDateTime.getTime() - formStartDateTime.getTime();

    if (formEndDateTime <= formStartDateTime) {
      alert("End time must be after start time.");
      return;
    }

    if (formData.recurrenceRule !== 'none' && !formData.recurrenceEndDate) {
        alert("Please specify an end date for the recurring event.");
        return;
    }

    let allGeneratedEvents: CalendarEvent[] = [];

    // 2. Prepare Tasks/Events
    if (!editingEventId && isBulkMode) {
        const lines = bulkText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        if (lines.length === 0) {
             alert("Please enter at least one valid event.");
             return;
        }
        
        lines.forEach((line, idx) => {
            // Smart Parse line
            const { title: cleanTitle, date: parsedStart, hasTime } = parseSmartDate(line, formStartDateTime);
            
            // Calculate end time: 
            // If smart parser found a specific start time, use default duration from form.
            // If smart parser used default form time, still use default duration.
            const parsedEnd = new Date(parsedStart.getTime() + defaultDurationMs);

            // Push event (No recurrence supported in bulk mode for now to keep logic sane)
            allGeneratedEvents.push({
                id: Date.now().toString() + '-' + idx + '-' + Math.random().toString(36).substr(2, 5),
                start: parsedStart,
                end: parsedEnd,
                title: cleanTitle || 'Untitled Event',
                type: formData.type,
                description: formData.description,
                notifyEmail: formData.notifyEmail,
                notifySms: formData.notifySms,
                alertEmail: formData.alertEmail,
                alertMobile: formData.alertMobile,
                alertOffset: formData.alertOffset,
                alertSound: formData.alertSound,
                alertRepeat: formData.alertRepeat,
                hasAlerted: false,
                lastAlertedAt: undefined
            });
        });
        
    } else {
        // Single Event Logic (supports recurrence)
        const titles = [formData.title];
        
        titles.forEach((title, idx) => {
            const baseEventPayload = {
                title: title,
                type: formData.type,
                description: formData.description,
                notifyEmail: formData.notifyEmail,
                notifySms: formData.notifySms,
                alertEmail: formData.alertEmail,
                alertMobile: formData.alertMobile,
                alertOffset: formData.alertOffset,
                alertSound: formData.alertSound,
                alertRepeat: formData.alertRepeat,
                hasAlerted: false,
                lastAlertedAt: undefined,
                recurrenceRule: formData.recurrenceRule !== 'none' ? formData.recurrenceRule : undefined
            };

            if (formData.recurrenceRule !== 'none' && formData.recurrenceEndDate) {
                const endDate = new Date(formData.recurrenceEndDate);
                endDate.setHours(23, 59, 59, 999);

                let currentStart = new Date(formStartDateTime);
                let currentEnd = new Date(formEndDateTime);
                let count = 0;
                
                while (currentStart <= endDate && count < 365) {
                    allGeneratedEvents.push({
                        id: Date.now().toString() + '-' + idx + '-' + count + '-' + Math.random().toString(36).substr(2, 5),
                        start: new Date(currentStart),
                        end: new Date(currentEnd),
                        ...baseEventPayload
                    });

                    if (formData.recurrenceRule === 'daily') {
                        currentStart.setDate(currentStart.getDate() + 1);
                        currentEnd.setDate(currentEnd.getDate() + 1);
                    } else if (formData.recurrenceRule === 'weekly') {
                        currentStart.setDate(currentStart.getDate() + 7);
                        currentEnd.setDate(currentEnd.getDate() + 7);
                    } else if (formData.recurrenceRule === 'monthly') {
                        currentStart.setMonth(currentStart.getMonth() + 1);
                        currentEnd.setMonth(currentEnd.getMonth() + 1);
                    }
                    count++;
                }
            } else {
                // Single Instance
                allGeneratedEvents.push({
                    id: editingEventId || (Date.now().toString() + '-' + idx + '-' + Math.random().toString(36).substr(2, 5)),
                    start: formStartDateTime,
                    end: formEndDateTime,
                    ...baseEventPayload
                });
            }
        });
    }

    // 3. Update State using Functional Updates for safety
    if (editingEventId) {
      // Edit Mode (Updates single event, or replaces it with recurrence series)
      if (formData.recurrenceRule !== 'none') {
         setEvents(prev => [...prev.filter(ev => ev.id !== editingEventId), ...allGeneratedEvents]);
         if (onActivityLog) onActivityLog(`Updated event to recurring series: ${formData.title}`);
      } else {
         setEvents(prev => prev.map(ev => ev.id === editingEventId ? allGeneratedEvents[0] : ev));
         if (onActivityLog) onActivityLog(`Updated event: ${formData.title}`);
      }
    } else {
      // Create Mode (Single or Bulk)
      setEvents(prev => [...prev, ...allGeneratedEvents]);
      
      // SYNC TO TASKS
      if (onAddToTask) {
          allGeneratedEvents.forEach(evt => onAddToTask(evt));
      }

      if (isBulkMode) {
          if (onActivityLog) onActivityLog(`Added ${allGeneratedEvents.length} events via bulk list`);
      } else if (allGeneratedEvents.length > 1) {
           if (onActivityLog) onActivityLog(`Added recurring schedule (${allGeneratedEvents.length} events): ${formData.title}`);
      } else {
           if (onActivityLog) onActivityLog(`Added to schedule: ${formData.title}`);
      }
    }
    
    setIsModalOpen(false);
  };

  const handleDelete = () => {
    if (editingEventId) {
      setEvents(prev => prev.filter(ev => ev.id !== editingEventId));
      setIsModalOpen(false);
      if (onActivityLog) onActivityLog(`Deleted event: ${formData.title}`);
    }
  };

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'class': return 'bg-indigo-100 border-indigo-500 text-indigo-800 dark:bg-indigo-900/50 dark:border-indigo-400 dark:text-indigo-100';
      case 'meeting': return 'bg-emerald-100 border-emerald-500 text-emerald-800 dark:bg-emerald-900/50 dark:border-emerald-400 dark:text-emerald-100';
      case 'admin': return 'bg-amber-100 border-amber-500 text-amber-800 dark:bg-amber-900/50 dark:border-amber-400 dark:text-amber-100';
      case 'personal': return 'bg-rose-100 border-rose-500 text-rose-800 dark:bg-rose-900/50 dark:border-rose-400 dark:text-rose-100';
      default: return 'bg-slate-100 border-slate-500 text-slate-800 dark:bg-slate-700 dark:border-slate-500 dark:text-slate-200';
    }
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-6 max-w-full overflow-hidden dark:text-slate-100">
      {/* Header & Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
            {weekStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Week of {weekStart.getDate()} - {addDays(weekStart, 6).getDate()}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-1">
            <button onClick={handlePrevWeek} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"><ChevronLeft className="h-5 w-5" /></button>
            <button onClick={handleToday} className="px-3 py-1 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 rounded">Week</button>
            <button onClick={handleNextWeek} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"><ChevronRight className="h-5 w-5" /></button>
          </div>

          {/* Jump to Date */}
          <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-4 w-4 text-slate-400"/>
              </div>
              <input 
                type="date" 
                className="pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm text-slate-600 dark:text-slate-200 transition-colors focus:bg-slate-800 focus:text-white"
                onChange={handleJumpToDate}
                value={toISODate(currentDate)}
              />
          </div>

          <button 
            onClick={handleClearAllEvents}
            disabled={events.length === 0}
            className={`
                px-3 py-2.5 rounded-lg transition-colors flex items-center gap-2 font-medium text-sm border
                ${events.length === 0 
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-700 cursor-not-allowed' 
                    : 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/50'}
            `}
            title="Delete All Events"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Delete All</span>
          </button>

          <button 
            onClick={handleManualSave}
            disabled={saveStatus !== 'idle'}
            className={`
                px-4 py-2.5 rounded-lg shadow-md transition-all flex items-center gap-2 font-medium text-sm min-w-[150px] justify-center
                ${saveStatus === 'saved' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-emerald-600 hover:bg-emerald-700'}
                text-white
            `}
            title="Save and update calendar"
          >
             {saveStatus === 'saving' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : saveStatus === 'saved' ? (
                <Check className="h-4 w-4" />
            ) : (
                <Save className="h-4 w-4" />
            )}
            
            <span className="hidden sm:inline">
                {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save Changes'}
            </span>
          </button>

          <button 
            onClick={() => openNewEventModal()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg shadow-md transition-colors flex items-center gap-2 font-medium text-sm"
          >
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add Event</span>
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col min-h-0">
        
        {/* Week Header */}
        <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr_1fr_1fr_1fr] border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 divide-x divide-slate-200 dark:divide-slate-700">
          <div className="p-3 text-center text-slate-400 dark:text-slate-500">
            <Clock className="h-5 w-5 mx-auto" />
          </div>
          {weekDays.map((day, i) => {
            const isToday = toISODate(day) === toISODate(new Date());
            return (
              <div key={i} className={`p-3 text-center ${isToday ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : ''}`}>
                <div className={`text-xs uppercase font-bold tracking-wider ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}>
                  {DAYS[day.getDay()]}
                </div>
                <div className={`text-xl font-light ${isToday ? 'text-indigo-700 dark:text-indigo-300 font-semibold' : 'text-slate-800 dark:text-slate-200'}`}>
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Scrollable Time Grid */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
          <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr_1fr_1fr_1fr] divide-x divide-slate-200 dark:divide-slate-700">
            
            {/* Time Column */}
            <div className="bg-slate-50 dark:bg-slate-900/50">
              {HOURS.map(hour => (
                <div key={hour} style={{ height: '80px' }} className="text-xs text-slate-400 dark:text-slate-500 font-medium flex items-start justify-center pt-2 border-b border-slate-100 dark:border-slate-800">
                  {formatHourLabel(hour)}
                </div>
              ))}
            </div>

            {/* Days Columns */}
            {weekDays.map((day, dayIndex) => {
              const dayEvents = currentWeekEvents.filter(ev => 
                ev.start.getDate() === day.getDate() && 
                ev.start.getMonth() === day.getMonth() &&
                ev.start.getFullYear() === day.getFullYear()
              );

              return (
                <div key={dayIndex} className="relative bg-white dark:bg-slate-800">
                  {HOURS.map(hour => (
                    <div 
                        key={hour} 
                        style={{ height: '80px' }}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer border-b border-slate-50 dark:border-slate-700/50 last:border-0"
                        onClick={() => openNewEventModal(day, hour)}
                    />
                  ))}

                  {dayEvents.map(ev => {
                    const startHour = ev.start.getHours();
                    const startMin = ev.start.getMinutes();
                    const endHour = ev.end.getHours();
                    const endMin = ev.end.getMinutes();
                    
                    const topOffset = ((startHour * 60) + startMin) * (80 / 60);
                    
                    let effectiveEndTotalMins = (endHour * 60) + endMin;
                    const startTotalMins = (startHour * 60) + startMin;
                    
                    const isNextDay = ev.end.getDate() !== ev.start.getDate() || 
                                      ev.end.getMonth() !== ev.start.getMonth() || 
                                      ev.end.getFullYear() !== ev.start.getFullYear();
                    
                    if (isNextDay || effectiveEndTotalMins < startTotalMins) {
                        effectiveEndTotalMins = 24 * 60; 
                    }

                    const durationMins = effectiveEndTotalMins - startTotalMins;
                    const height = durationMins * (80 / 60);

                    return (
                      <div
                        key={ev.id}
                        onClick={(e) => openEditEventModal(ev, e)}
                        className={`absolute left-1 right-1 rounded border-l-4 p-1.5 cursor-pointer shadow-sm hover:shadow-md transition-all z-10 text-xs overflow-hidden ${getTypeStyles(ev.type)}`}
                        style={{ top: `${topOffset}px`, height: `${Math.max(height, 24)}px` }}
                      >
                        <div className="font-bold truncate leading-tight">{ev.title}</div>
                        <div className="truncate opacity-90">{formatTime(ev.start)} - {formatTime(ev.end)}</div>
                        {(ev.notifyEmail || ev.notifySms) && (
                            <div className="absolute bottom-1 right-1 opacity-50">
                                <Bell className="h-3 w-3" />
                            </div>
                        )}
                         {ev.alertRepeat !== 'once' && (
                            <div className="absolute bottom-1 right-4 opacity-50">
                                <Repeat className="h-3 w-3" />
                            </div>
                        )}
                         {ev.recurrenceRule && (
                             <div className="absolute bottom-1 right-7 opacity-50">
                                 <RotateCw className="h-3 w-3" />
                             </div>
                         )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-700">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900 shrink-0">
              <h3 className="font-bold text-slate-800 dark:text-white text-lg">
                {editingEventId ? 'Edit Event' : 'New Event'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-slate-500 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
              
              {/* Bulk Mode Toggle (Only for New Events) */}
              {!editingEventId && (
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg mb-2">
                        <button 
                            onClick={() => setIsBulkMode(false)}
                            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${!isBulkMode ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                        >
                            <Type className="h-4 w-4" /> Single Event
                        </button>
                        <button 
                            onClick={() => setIsBulkMode(true)}
                            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${isBulkMode ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                        >
                            <List className="h-4 w-4" /> Bulk List
                        </button>
                    </div>
                )}

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {isBulkMode ? "Event List (One per line)" : "Event Title"}
                </label>
                
                {isBulkMode ? (
                     <textarea 
                        autoFocus
                        value={bulkText}
                        onChange={(e) => setBulkText(e.target.value)}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-slate-800 focus:text-white dark:text-white resize-none h-24 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm font-mono"
                        placeholder={'1. Math Class (Mon 10am)\n2. Staff Meeting (Tomorrow 2pm)'}
                      />
                ) : (
                    <input 
                      type="text" 
                      autoFocus
                      value={formData.title}
                      onChange={e => setFormData({...formData, title: e.target.value})}
                      placeholder="e.g., Staff Meeting"
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-slate-800 focus:text-white dark:text-white"
                    />
                )}
                {isBulkMode && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Tip: You can type days/times directly in the list.</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{isBulkMode ? "Default Date" : "Date"}</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/>
                        <input 
                            type="date"
                            value={formData.date}
                            onChange={e => setFormData({...formData, date: e.target.value})}
                            className="w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-slate-800 focus:text-white dark:text-white"
                        />
                    </div>
                 </div>

                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{isBulkMode ? "Default Start" : "Start Time"}</label>
                    <input 
                        type="time"
                        value={formData.startTime}
                        onChange={e => setFormData({...formData, startTime: e.target.value})}
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-slate-800 focus:text-white dark:text-white"
                    />
                 </div>

                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{isBulkMode ? "Default End" : "End Time"}</label>
                    <input 
                        type="time"
                        value={formData.endTime}
                        onChange={e => setFormData({...formData, endTime: e.target.value})}
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-slate-800 focus:text-white dark:text-white"
                    />
                 </div>
              </div>
              
              {/* Recurrence Options */}
              <div className="grid grid-cols-2 gap-4">
                  <div className={formData.recurrenceRule !== 'none' ? "" : "col-span-2"}>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Repeat Event</label>
                      <div className="relative">
                          <RotateCw className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                          <select 
                             value={formData.recurrenceRule}
                             onChange={(e) => setFormData({...formData, recurrenceRule: e.target.value as any})}
                             className="w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-slate-800 focus:text-white dark:text-white"
                             disabled={isBulkMode}
                          >
                              <option value="none">None</option>
                              <option value="daily">Daily</option>
                              <option value="weekly">Weekly</option>
                              <option value="monthly">Monthly</option>
                          </select>
                      </div>
                  </div>
                  {formData.recurrenceRule !== 'none' && (
                      <div className="animate-in fade-in slide-in-from-left-2">
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Repeat End Date</label>
                          <input 
                            type="date" 
                            value={formData.recurrenceEndDate}
                            onChange={(e) => setFormData({...formData, recurrenceEndDate: e.target.value})}
                            className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-slate-800 focus:text-white dark:text-white"
                          />
                      </div>
                  )}
              </div>

              <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
                  <div className="flex gap-2">
                      {(['class', 'meeting', 'admin', 'personal'] as const).map(type => (
                          <button
                            key={type}
                            onClick={() => setFormData({...formData, type})}
                            className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg border transition-all ${
                                formData.type === type 
                                ? getTypeStyles(type).replace('bg-', 'bg-opacity-100 bg-').replace('text-', 'text-white bg-').replace('dark:text-', 'dark:text-white bg-') + ' shadow-md'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                            }`}
                          >
                              {type}
                          </button>
                      ))}
                  </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description (Optional)</label>
                <div className="relative">
                    <AlignLeft className="absolute left-3 top-3 h-4 w-4 text-slate-400"/>
                    <textarea 
                        value={formData.description}
                        onChange={e => setFormData({...formData, description: e.target.value})}
                        placeholder="Add details here..."
                        className="w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-20 transition-all focus:bg-slate-800 focus:text-white dark:text-white"
                    />
                </div>
              </div>

              {/* Notifications Section */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex justify-between items-center">
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1">
                        <Bell className="h-3 w-3" /> Alerts & Reminders
                    </label>
                    <select 
                        value={formData.alertOffset} 
                        onChange={(e) => setFormData({...formData, alertOffset: Number(e.target.value)})}
                        className="text-xs p-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 dark:text-slate-200"
                    >
                        <option value={0}>At time of event</option>
                        <option value={15}>15 mins before</option>
                        <option value={30}>30 mins before</option>
                        <option value={60}>1 hour before</option>
                    </select>
                </div>
                
                <div className="space-y-3">
                    {/* Alert Repetition */}
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                        <label className="flex items-center gap-2 min-w-[100px] text-sm text-slate-700 dark:text-slate-300">
                            <Repeat className="h-4 w-4 text-slate-400" />
                            Alert Repeat:
                        </label>
                        <select 
                            value={formData.alertRepeat}
                            onChange={e => setFormData({...formData, alertRepeat: e.target.value as AlertRepeat})}
                            className="flex-1 text-sm p-1.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-slate-800 focus:text-white dark:text-white"
                        >
                            <option value="once">Once (No Repeat)</option>
                            <option value="every_3">Every 3 Minutes</option>
                            <option value="every_5">Every 5 Minutes</option>
                        </select>
                    </div>

                    {/* Email Config */}
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                        <label className="flex items-center gap-2 min-w-[100px] cursor-pointer">
                            <input 
                                type="checkbox"
                                checked={formData.notifyEmail}
                                onChange={e => setFormData({...formData, notifyEmail: e.target.checked})}
                                className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">Email</span>
                        </label>
                        {formData.notifyEmail && (
                            <div className="flex-1 relative w-full">
                                <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                <input 
                                    type="email"
                                    value={formData.alertEmail}
                                    onChange={e => setFormData({...formData, alertEmail: e.target.value})}
                                    placeholder="Alert Email Address"
                                    className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-slate-800 focus:text-white dark:bg-slate-800 dark:text-white"
                                />
                            </div>
                        )}
                    </div>

                    {/* SMS Config */}
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                        <label className="flex items-center gap-2 min-w-[100px] cursor-pointer">
                            <input 
                                type="checkbox"
                                checked={formData.notifySms}
                                onChange={e => setFormData({...formData, notifySms: e.target.checked})}
                                className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">SMS</span>
                        </label>
                        {formData.notifySms && (
                            <div className="flex-1 relative w-full">
                                <Smartphone className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                <input 
                                    type="tel"
                                    value={formData.alertMobile}
                                    onChange={e => setFormData({...formData, alertMobile: e.target.value})}
                                    placeholder="Mobile Number"
                                    className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-slate-800 focus:text-white dark:bg-slate-800 dark:text-white"
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-xs text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1">
                            <Volume2 className="h-3 w-3" /> Alert Sound
                        </label>
                        <button type="button" onClick={() => playPreview(tempSound ? tempSound.data : undefined)} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 text-xs font-medium flex items-center gap-1">
                            <Play className="h-3 w-3" /> Preview
                        </button>
                    </div>
                    
                    {tempSound ? (
                        <div className="flex flex-col gap-2 bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded border border-indigo-100 dark:border-indigo-800">
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
                            <div className="flex gap-2">
                                <select
                                    value={formData.alertSound}
                                    onChange={(e) => setFormData({...formData, alertSound: e.target.value})}
                                    className="flex-1 p-2 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-slate-800 focus:text-white dark:text-white"
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
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                {/* Upload */}
                                <button 
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center justify-center gap-2 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors"
                                >
                                    <Upload className="h-3 w-3" /> Upload File
                                </button>
                                <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />

                                {/* Record */}
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
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end gap-3 shrink-0">
               <button 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                {editingEventId && (
                   <button 
                      onClick={handleDelete}
                      className="px-4 py-2 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-900/50 rounded-lg font-medium transition-colors"
                    >
                      Delete
                    </button>
                )}
                <button 
                  onClick={handleSave}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-md transition-all flex items-center gap-2"
                >
                  <Save className="h-4 w-4" /> {editingEventId ? 'Save Changes' : (isBulkMode ? 'Add Events' : 'Add Event')}
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Scheduler;