export const parseSmartDate = (input: string, baseDate: Date): { title: string, date: Date, hasTime: boolean, hasDate: boolean } => {
  let text = input;
  const now = new Date();
  
  // Default result to the provided baseDate (form selection)
  let finalDate = new Date(baseDate);
  
  let hasDate = false;
  let hasTime = false;

  // --- 1. Clean Numbering/Bullets (e.g. "1.", "-", "a)") ---
  text = text.replace(/^(\d+[\.\)]|\-|\*|[a-z][\.\)])\s+/i, '');

  // --- 2. Detect "Tomorrow" / "Tmwr" ---
  const tomorrowMatch = text.match(/\b(tomorrow|tmrw)\b/i);
  if (tomorrowMatch) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    finalDate.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    hasDate = true;
    text = text.replace(tomorrowMatch[0], '');
  }

  // --- 3. Detect "Today" ---
  const todayMatch = text.match(/\b(today)\b/i);
  if (todayMatch) {
    const d = new Date();
    finalDate.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    hasDate = true;
    text = text.replace(todayMatch[0], '');
  }

  // --- 4. Detect Days of Week (e.g. "on Monday", "next Friday") ---
  const dayMatch = text.match(/\b(on\s+)?(mon|tue|wed|thu|fri|sat|sun)(day|s|es)?\b/i);
  if (dayMatch) {
    const dayStr = dayMatch[2].toLowerCase(); // mon, tue...
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const targetDayIndex = days.indexOf(dayStr);
    
    if (targetDayIndex !== -1) {
        const currentDayIndex = now.getDay();
        let daysToAdd = targetDayIndex - currentDayIndex;
        
        // If daysToAdd is negative (e.g. Today is Fri, target Mon), it means day passed this week.
        // Assume user means "next Monday".
        if (daysToAdd <= 0 && !text.match(/last/i)) {
             daysToAdd += 7;
        }
        
        const d = new Date();
        d.setDate(d.getDate() + daysToAdd);
        finalDate.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
        hasDate = true;
    }
    text = text.replace(dayMatch[0], '');
  }

  // --- 5. Detect Time ---
  // Matches: "5pm", "5:30pm", "at 5", "at 5:30", "17:00"
  const timeMatch = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?|(\d{1,2}):(\d{2})\b/i);

  if (timeMatch) {
    let hours = 0;
    let minutes = 0;
    let meridian = null;

    if (timeMatch[4]) {
        // 24h format (HH:MM) from second group
        hours = parseInt(timeMatch[4]);
        minutes = parseInt(timeMatch[5]);
    } else {
        // 12h format or "at X"
        hours = parseInt(timeMatch[1]);
        minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
        meridian = timeMatch[3] ? timeMatch[3].toLowerCase().replace(/\./g, '') : null;

        if (meridian === 'pm' && hours < 12) hours += 12;
        if (meridian === 'am' && hours === 12) hours = 0;
        
        // Heuristic: "at 2" -> 2pm, "at 9" -> 9am. 
        // If no meridian, assume PM for 1-6, AM for 7-11?
        // Simple rule: if < 7 and no meridian, add 12 (afternoon).
        if (!meridian && hours < 7) hours += 12;
    }

    if (hours >= 0 && hours < 24) {
        finalDate.setHours(hours, minutes, 0, 0);
        hasTime = true;
    }
    
    text = text.replace(timeMatch[0], '');
  }

  // --- 6. Cleanup Title ---
  const cleanTitle = text.replace(/\s+/g, ' ').trim().replace(/^[-*,.]\s*/, '');

  return {
      title: cleanTitle || input,
      date: finalDate,
      hasTime,
      hasDate
  };
};