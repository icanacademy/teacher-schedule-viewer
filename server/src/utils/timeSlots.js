// Unified 30-minute timeline from 7:00 to 21:30
// Online: 30 x 30-min slots (7:00-22:00)
// Offline: 12 x 1-hour slots (8:00-21:00, lunch break 12:00-13:00)

const UNIFIED_SLOTS = [];
for (let h = 7; h < 22; h++) {
  UNIFIED_SLOTS.push(`${String(h).padStart(2, '0')}:00`);
  UNIFIED_SLOTS.push(`${String(h).padStart(2, '0')}:30`);
}
// 30 slots: "07:00", "07:30", "08:00", ..., "21:30"

export { UNIFIED_SLOTS };

// 1-hour display blocks for the grid (each has two 30-min sub-slots)
export const HOUR_BLOCKS = [];
for (let h = 7; h < 22; h++) {
  HOUR_BLOCKS.push({
    label: formatHour(h),
    startTime: `${String(h).padStart(2, '0')}:00`,
    endTime: `${String(h + 1).padStart(2, '0')}:00`,
    slots: [
      `${String(h).padStart(2, '0')}:00`,
      `${String(h).padStart(2, '0')}:30`,
    ],
  });
}

function formatHour(h) {
  if (h === 0 || h === 12) return `12${h === 0 ? 'AM' : 'PM'}`;
  return h > 12 ? `${h - 12}PM` : `${h}AM`;
}

/**
 * Parse a time string like "8:00", "08:00:00", "8AM" into "HH:MM"
 */
function parseTime(timeStr) {
  if (!timeStr) return null;
  // Handle HH:MM:SS or HH:MM format
  const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    return `${String(parseInt(match[1])).padStart(2, '0')}:${match[2]}`;
  }
  return null;
}

/**
 * Build a map from slot ID → unified time slots for a given system's timeslots response
 */
export function buildSlotMap(timeslots) {
  const map = {};
  for (const slot of timeslots) {
    const startTime = parseTime(slot.start_time);
    const endTime = parseTime(slot.end_time);
    if (!startTime || !endTime) continue;

    // Find all unified 30-min slots that fall within this slot
    const unifiedSlots = [];
    for (const us of UNIFIED_SLOTS) {
      if (us >= startTime && us < endTime) {
        unifiedSlots.push(us);
      }
    }
    map[slot.id] = {
      startTime,
      endTime,
      unifiedSlots,
      name: slot.name,
    };
  }
  return map;
}

/**
 * Get the current unified time slot based on Philippine time (UTC+8)
 */
export function getCurrentTimeSlot() {
  const now = new Date();
  // Convert to Philippine time
  const phTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  const h = phTime.getHours();
  const m = phTime.getMinutes();
  const currentTime = `${String(h).padStart(2, '0')}:${m < 30 ? '00' : '30'}`;

  if (UNIFIED_SLOTS.includes(currentTime)) {
    return currentTime;
  }
  return null; // Outside schedule hours
}

/**
 * Convert an array of slot IDs from a specific system into unified time strings.
 * e.g. offline slot ID 1 (8AM-9AM) → ["08:00", "08:30"]
 */
export function availabilityToUnifiedSlots(slotIds, slotMap) {
  const unified = new Set();
  for (const id of slotIds) {
    const info = slotMap[id];
    if (info) {
      for (const us of info.unifiedSlots) {
        unified.add(us);
      }
    }
  }
  return [...unified].sort();
}

/**
 * Get current Philippine time info
 */
export function getPhilippineTime() {
  const now = new Date();
  const phTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  return {
    hours: phTime.getHours(),
    minutes: phTime.getMinutes(),
    formatted: `${String(phTime.getHours()).padStart(2, '0')}:${String(phTime.getMinutes()).padStart(2, '0')}`,
  };
}
