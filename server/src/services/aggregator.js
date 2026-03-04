import * as onlineApi from './onlineApi.js';
import * as offlineApi from './offlineApi.js';
import * as attendanceApi from './attendanceApi.js';
import { buildSlotMap, getCurrentTimeSlot, UNIFIED_SLOTS, HOUR_BLOCKS, availabilityToUnifiedSlots } from '../utils/timeSlots.js';
import { mergeTeachers } from '../utils/teacherMatcher.js';

// Cached data (refreshed as needed)
let onlineSlotMap = null;
let offlineSlotMap = null;
let offlineRoomMap = null;

async function ensureCachedData() {
  const promises = [];

  if (!onlineSlotMap) {
    promises.push(
      onlineApi.getTimeslots()
        .then(slots => { onlineSlotMap = buildSlotMap(slots); })
        .catch(() => { onlineSlotMap = {}; })
    );
  }

  if (!offlineSlotMap) {
    promises.push(
      offlineApi.getTimeslots()
        .then(slots => { offlineSlotMap = buildSlotMap(slots); })
        .catch(() => { offlineSlotMap = {}; })
    );
  }

  if (!offlineRoomMap) {
    promises.push(
      offlineApi.getRooms()
        .then(rooms => {
          offlineRoomMap = {};
          for (const r of rooms) {
            offlineRoomMap[r.id] = r.name;
          }
        })
        .catch(() => { offlineRoomMap = {}; })
    );
  }

  await Promise.all(promises);
}

/**
 * Convert assignments from one source into unified format
 */
function normalizeAssignments(assignments, source, slotMap, roomMap) {
  const teacherAssignments = new Map(); // teacherName -> assignments[]

  for (const a of assignments) {
    if (!a.is_active) continue;

    const slotInfo = slotMap[a.time_slot_id];
    if (!slotInfo) continue;

    const roomName = source === 'offline' && roomMap
      ? (roomMap[a.room_id] || `Room ${a.room_id}`)
      : null;

    const students = (a.students || []).map(s => {
      const parts = [s.name];
      if (s.english_name) parts.push(`(${s.english_name})`);
      return parts.join(' ');
    });

    for (const teacher of (a.teachers || [])) {
      const assignment = {
        source,
        startTime: slotInfo.startTime,
        endTime: slotInfo.endTime,
        timeSlotId: a.time_slot_id,
        room: roomName,
        students,
        subject: a.subject || null,
        isSubstitute: teacher.is_substitute || false,
        notes: a.notes || null,
      };

      const name = teacher.name;
      if (!teacherAssignments.has(name)) {
        teacherAssignments.set(name, []);
      }
      teacherAssignments.get(name).push(assignment);
    }
  }

  return teacherAssignments;
}

/**
 * Get all teachers' schedules for a single date
 */
export async function getTeacherSchedules(date) {
  await ensureCachedData();

  const sourceStatus = { online: 'ok', offline: 'ok' };

  // Fetch from both scheduling APIs + attendance APIs in parallel
  const [onlineResult, offlineResult, teacherAttendanceResult, studentAttendanceResult] = await Promise.allSettled([
    Promise.all([onlineApi.getTeachers(date), onlineApi.getAssignments(date)]),
    Promise.all([offlineApi.getTeachers(date), offlineApi.getAssignments(date)]),
    attendanceApi.getTeacherAttendance(date),
    attendanceApi.getAbsentStudents(date),
  ]);

  let onlineTeachers = [];
  let onlineAssignments = [];
  let offlineTeachers = [];
  let offlineAssignments = [];

  if (onlineResult.status === 'fulfilled') {
    [onlineTeachers, onlineAssignments] = onlineResult.value;
  } else {
    sourceStatus.online = 'error';
    console.error('Online API error:', onlineResult.reason?.message);
  }

  if (offlineResult.status === 'fulfilled') {
    [offlineTeachers, offlineAssignments] = offlineResult.value;
  } else {
    sourceStatus.offline = 'error';
    console.error('Offline API error:', offlineResult.reason?.message);
  }

  // Extract attendance data (gracefully handle failures)
  const { attendanceMap: teacherAttendanceMap, substituteMap } = teacherAttendanceResult.status === 'fulfilled'
    ? teacherAttendanceResult.value : { attendanceMap: {}, substituteMap: {} };
  const absentStudentSet = studentAttendanceResult.status === 'fulfilled'
    ? studentAttendanceResult.value : new Set();

  sourceStatus.attendance = (teacherAttendanceResult.status === 'fulfilled' || studentAttendanceResult.status === 'fulfilled')
    ? 'ok' : 'error';

  // Merge teacher lists
  const mergedTeachers = mergeTeachers(onlineTeachers, offlineTeachers);

  // Normalize assignments from both sources
  const onlineTeacherAssignments = normalizeAssignments(
    onlineAssignments, 'online', onlineSlotMap, null
  );
  const offlineTeacherAssignments = normalizeAssignments(
    offlineAssignments, 'offline', offlineSlotMap, offlineRoomMap
  );

  // Build final teacher list with merged assignments
  const teachers = [];

  for (const [, teacher] of mergedTeachers) {
    const normalizedName = teacher.name.toLowerCase().trim();
    const assignments = [
      ...(onlineTeacherAssignments.get(teacher.name) || []),
      ...(offlineTeacherAssignments.get(teacher.name) || []),
    ];

    // Also check by case-insensitive match
    for (const [name, assigns] of onlineTeacherAssignments) {
      if (name.toLowerCase().trim() === normalizedName && name !== teacher.name) {
        assignments.push(...assigns);
      }
    }
    for (const [name, assigns] of offlineTeacherAssignments) {
      if (name.toLowerCase().trim() === normalizedName && name !== teacher.name) {
        assignments.push(...assigns);
      }
    }

    // Sort assignments by start time
    assignments.sort((a, b) => a.startTime.localeCompare(b.startTime));

    // Enrich assignments with attendance data
    const teacherAtt = attendanceApi.findTeacherAttendance(teacher.name, teacherAttendanceMap);
    for (const assignment of assignments) {
      // Mark absent students
      assignment.absentStudents = assignment.students
        .filter(s => attendanceApi.isStudentAbsent(s, absentStudentSet));

      // Add substitute info for this time slot if teacher is absent/late
      if (teacherAtt && (teacherAtt.status === 'absent' || teacherAtt.status === 'late' || teacherAtt.hasUndertime)) {
        const slotData = teacherAtt.slotInfo[assignment.startTime];
        if (slotData) {
          assignment.substituteTeacher = slotData.substitute;
          assignment.noClass = slotData.noClass;
        }
      }
    }

    // Check if this teacher is subbing for someone else
    const subAssignments = attendanceApi.findSubstituteAssignments(teacher.name, substituteMap);
    const existingSlots = new Set(assignments.flatMap(a => {
      // Collect all 30-min slots this assignment covers
      const slots = [];
      const [sh, sm] = a.startTime.split(':').map(Number);
      const [eh, em] = a.endTime.split(':').map(Number);
      let cur = sh * 60 + sm;
      const end = eh * 60 + em;
      while (cur < end) {
        const h = Math.floor(cur / 60);
        const m = cur % 60;
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        cur += 30;
      }
      return slots;
    }));

    for (const sub of subAssignments) {
      for (const slot of sub.unifiedSlots) {
        if (existingSlots.has(slot)) continue; // don't override existing assignments
        existingSlots.add(slot);

        const [h, m] = slot.split(':').map(Number);
        const endMin = h * 60 + m + 30;
        const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;

        assignments.push({
          source: 'offline',
          startTime: slot,
          endTime,
          room: null,
          students: sub.students,
          subject: null,
          isSubstitute: true,
          isSubbing: true,
          subbingFor: sub.absentTeacher,
          notes: `Subbing for ${sub.absentTeacher}`,
          absentStudents: sub.students.filter(s => attendanceApi.isStudentAbsent(s, absentStudentSet)),
        });
      }
    }

    // Re-sort after adding sub assignments
    assignments.sort((a, b) => a.startTime.localeCompare(b.startTime));

    // Only include online availability if the teacher has online assignments today.
    // Otherwise their online "free" slots bleed into days they don't teach online.
    const hasOnlineAssignments = assignments.some(a => a.source === 'online');
    const onlineAvail = hasOnlineAssignments
      ? availabilityToUnifiedSlots(teacher.onlineAvailability || [], onlineSlotMap)
      : [];

    // For offline, fill gaps within the shift range so mid-shift breaks show as "free"
    const rawOfflineSlots = (teacher.offlineAvailability || []).map(Number).sort((a, b) => a - b);
    let filledOfflineSlots = rawOfflineSlots;
    if (rawOfflineSlots.length >= 2) {
      const min = rawOfflineSlots[0];
      const max = rawOfflineSlots[rawOfflineSlots.length - 1];
      filledOfflineSlots = [];
      for (let s = min; s <= max; s++) {
        filledOfflineSlots.push(s);
      }
    }
    const offlineAvail = availabilityToUnifiedSlots(filledOfflineSlots, offlineSlotMap);

    // Detect lunch: offline slots 1-4 are AM (8-12), slots 5-12 are PM (1-9)
    // If teacher has offline availability spanning both, 12:00-12:30 is lunch
    const hasAMSlot = rawOfflineSlots.some(id => id >= 1 && id <= 4);
    const hasPMSlot = rawOfflineSlots.some(id => id >= 5 && id <= 12);
    const lunchSlots = (hasAMSlot && hasPMSlot) ? ['12:00', '12:30'] : [];

    // Merge availability but exclude lunch slots (so they don't show as "free")
    const lunchSet = new Set(lunchSlots);
    const availableSlots = [...new Set([...onlineAvail, ...offlineAvail])]
      .filter(s => !lunchSet.has(s))
      .sort();

    teachers.push({
      name: teacher.name,
      type: teacher.type,
      assignments,
      availableSlots,
      lunchSlots,
      attendance: teacherAtt ? {
        status: teacherAtt.status,
        minutesLate: teacherAtt.minutesLate,
        hasUndertime: teacherAtt.hasUndertime,
      } : null,
    });
  }

  // Also add teachers who appear in assignments but not in teacher lists
  const knownNames = new Set([...mergedTeachers.values()].map(t => t.name.toLowerCase().trim()));

  for (const [name, assigns] of [...onlineTeacherAssignments, ...offlineTeacherAssignments]) {
    if (!knownNames.has(name.toLowerCase().trim())) {
      knownNames.add(name.toLowerCase().trim());
      const source = onlineTeacherAssignments.has(name) ? 'online' : 'offline';
      const sorted = assigns.sort((a, b) => a.startTime.localeCompare(b.startTime));
      teachers.push({
        name,
        type: source,
        assignments: sorted,
        availableSlots: [],
        lunchSlots: [],
      });
    }
  }

  // Sort teachers alphabetically
  teachers.sort((a, b) => a.name.localeCompare(b.name));

  return {
    date,
    currentSlot: getCurrentTimeSlot(),
    teachers,
    timeSlots: UNIFIED_SLOTS,
    hourBlocks: HOUR_BLOCKS,
    sourceStatus,
  };
}

/**
 * Get a single teacher's schedule for a date
 */
export async function getTeacherSchedule(teacherName, date) {
  const all = await getTeacherSchedules(date);
  const teacher = all.teachers.find(
    t => t.name.toLowerCase().trim() === teacherName.toLowerCase().trim()
  );
  return {
    date,
    currentSlot: all.currentSlot,
    teacher: teacher || { name: teacherName, type: 'unknown', assignments: [] },
    timeSlots: all.timeSlots,
    hourBlocks: all.hourBlocks,
    sourceStatus: all.sourceStatus,
  };
}

/**
 * Get a single teacher's schedule for a week
 */
export async function getTeacherWeekSchedule(teacherName, startDate) {
  // Fetch 7 days using date-range endpoints
  await ensureCachedData();

  const sourceStatus = { online: 'ok', offline: 'ok' };

  const [onlineResult, offlineResult] = await Promise.allSettled([
    onlineApi.getAssignmentsDateRange(startDate, 7),
    offlineApi.getAssignmentsDateRange(startDate, 7),
  ]);

  let onlineAssignments = [];
  let offlineAssignments = [];

  if (onlineResult.status === 'fulfilled') {
    onlineAssignments = onlineResult.value;
  } else {
    sourceStatus.online = 'error';
  }

  if (offlineResult.status === 'fulfilled') {
    offlineAssignments = offlineResult.value;
  } else {
    sourceStatus.offline = 'error';
  }

  // Group by date
  const days = {};
  const nameLC = teacherName.toLowerCase().trim();

  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate + 'T00:00:00');
    d.setDate(d.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${day}`;
    days[dateStr] = [];
  }

  // Process online assignments
  for (const a of onlineAssignments) {
    if (!a.is_active) continue;
    const hasTeacher = (a.teachers || []).some(
      t => t.name.toLowerCase().trim() === nameLC
    );
    if (!hasTeacher) continue;

    const slotInfo = onlineSlotMap[a.time_slot_id];
    if (!slotInfo) continue;

    const teacher = a.teachers.find(t => t.name.toLowerCase().trim() === nameLC);
    const students = (a.students || []).map(s => {
      const parts = [s.name];
      if (s.english_name) parts.push(`(${s.english_name})`);
      return parts.join(' ');
    });

    const dateKey = a.date;
    if (days[dateKey]) {
      days[dateKey].push({
        source: 'online',
        startTime: slotInfo.startTime,
        endTime: slotInfo.endTime,
        room: null,
        students,
        subject: a.subject || null,
        isSubstitute: teacher?.is_substitute || false,
        notes: a.notes || null,
      });
    }
  }

  // Process offline assignments
  for (const a of offlineAssignments) {
    if (!a.is_active) continue;
    const hasTeacher = (a.teachers || []).some(
      t => t.name.toLowerCase().trim() === nameLC
    );
    if (!hasTeacher) continue;

    const slotInfo = offlineSlotMap[a.time_slot_id];
    if (!slotInfo) continue;

    const teacher = a.teachers.find(t => t.name.toLowerCase().trim() === nameLC);
    const students = (a.students || []).map(s => {
      const parts = [s.name];
      if (s.english_name) parts.push(`(${s.english_name})`);
      return parts.join(' ');
    });

    const dateKey = a.date;
    if (days[dateKey]) {
      days[dateKey].push({
        source: 'offline',
        startTime: slotInfo.startTime,
        endTime: slotInfo.endTime,
        room: offlineRoomMap?.[a.room_id] || `Room ${a.room_id}`,
        students,
        subject: a.subject || null,
        isSubstitute: teacher?.is_substitute || false,
        notes: a.notes || null,
      });
    }
  }

  // Sort each day's assignments by time
  for (const dateKey of Object.keys(days)) {
    days[dateKey].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  return {
    teacherName,
    startDate,
    days,
    timeSlots: UNIFIED_SLOTS,
    hourBlocks: HOUR_BLOCKS,
    sourceStatus,
  };
}

/**
 * Get list of all known teachers
 */
export async function getAllTeachers(date) {
  await ensureCachedData();

  const sourceStatus = { online: 'ok', offline: 'ok' };

  const [onlineResult, offlineResult] = await Promise.allSettled([
    onlineApi.getTeachers(date),
    offlineApi.getTeachers(date),
  ]);

  let onlineTeachers = [];
  let offlineTeachers = [];

  if (onlineResult.status === 'fulfilled') {
    onlineTeachers = onlineResult.value;
  } else {
    sourceStatus.online = 'error';
  }

  if (offlineResult.status === 'fulfilled') {
    offlineTeachers = offlineResult.value;
  } else {
    sourceStatus.offline = 'error';
  }

  const merged = mergeTeachers(onlineTeachers, offlineTeachers);
  const teachers = [...merged.values()]
    .map(t => ({ name: t.name, type: t.type }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { teachers, sourceStatus };
}

/**
 * Check health of both upstream APIs
 */
export async function getStatus() {
  const [onlineResult, offlineResult] = await Promise.allSettled([
    onlineApi.healthCheck(),
    offlineApi.healthCheck(),
  ]);

  return {
    online: onlineResult.status === 'fulfilled' ? 'ok' : 'error',
    offline: offlineResult.status === 'fulfilled' ? 'ok' : 'error',
  };
}
