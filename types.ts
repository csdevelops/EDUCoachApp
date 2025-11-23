
export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  TEMPLATES = 'TEMPLATES',
  SCHEDULER = 'SCHEDULER',
  TASKS = 'TASKS',
  SETTINGS = 'SETTINGS'
}

export enum TaskPriority {
  HIGH = 'High',
  MEDIUM = 'Medium',
  LOW = 'Low'
}

export type AlertRepeat = 'once' | 'every_3' | 'every_5';

export interface CustomSound {
  id: string;
  name: string;
  data: string; // Base64 Data URI
}

export interface Activity {
  id: string;
  description: string;
  timestamp: Date;
  type: 'template' | 'schedule' | 'task' | 'system';
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  dueDate: string; // ISO Date string
  priority: TaskPriority;
  notifyEmail: boolean;
  notifySms: boolean;
  alertEmail?: string;
  alertMobile?: string;
  alarmSound: string; // Preset key or custom data URI
  hasAlerted: boolean;
  alertRepeat: AlertRepeat;
  lastAlertedAt?: number; // Timestamp of last alert
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: 'class' | 'meeting' | 'admin' | 'personal';
  description?: string;
  // Notification Props
  notifyEmail: boolean;
  notifySms: boolean;
  alertEmail?: string;
  alertMobile?: string;
  alertOffset: number; // Minutes before event to alert (0, 15, 30, 60)
  alertSound?: string; // 'chime' | 'beep' | 'bell' | custom_data_uri
  hasAlerted: boolean;
  alertRepeat: AlertRepeat;
  lastAlertedAt?: number; // Timestamp of last alert
  recurrenceRule?: 'daily' | 'weekly' | 'monthly';
}

export interface CoachingTemplate {
  id: string;
  title: string;
  content: string;
  type: string;
  createdAt: string;
}

export interface GeneratedContent {
  text: string;
}