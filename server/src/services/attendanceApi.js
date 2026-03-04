import axios from 'axios';
import { TEACHER_ATTENDANCE_API_URL, STUDENT_ATTENDANCE_API_URL } from '../config.js';

const teacherClient = axios.create({
  baseURL: TEACHER_ATTENDANCE_API_URL,
  timeout: 5000,
});

const studentClient = axios.create({
  baseURL: STUDENT_ATTENDANCE_API_URL,
  timeout: 5000,
});

/**
 * Attendance 2-hour slots mapped to unified 30-min slot ranges.
 */
const ATTENDANCE_SLOT_RANGES = {
  '8am - 10am':  ['08:00', '08:30', '09:00', '09:30'],
  '10am - 12pm': ['10:00', '10:30', '11:00', '11:30'],
  '1pm - 3pm':   ['13:00', '13:30', '14:00', '14:30'],
  '3pm - 5pm':   ['15:00', '15:30', '16:00', '16:30'],
  '5pm - 7pm':   ['17:00', '17:30', '18:00', '18:30'],
  '7pm - 9pm':   ['19:00', '19:30', '20:00', '20:30'],
};

/**
 * Extract teacher nickname from "[Nick] Full Name" format.
 */
function extractNickname(fullName) {
  const match = fullName.match(/^\[([^\]]+)\]/);
  return match ? match[1].trim() : null;
}

/**
 * Extract the name part without the bracket nickname.
 */
function extractCleanName(fullName) {
  return fullName.replace(/^\[[^\]]+\]\s*/, '').trim();
}

/**
 * Fetch teacher attendance for a date.
 * Returns { attendanceMap, substituteMap }
 *   attendanceMap: lowercase teacher name → { status, minutesLate, slotInfo }
 *   substituteMap: lowercase sub teacher name → [{ unifiedSlots, absentTeacher, students }]
 */
export async function getTeacherAttendance(date) {
  try {
    const { data } = await teacherClient.get(`/attendance/${date}`);

    if (!data || !Array.isArray(data.attendance)) return { attendanceMap: {}, substituteMap: {} };

    const attendanceMap = {};
    const substituteMap = {};

    for (const record of data.attendance) {
      const nickname = extractNickname(record.teacher_name);
      const cleanName = extractCleanName(record.teacher_name);
      const displayName = nickname || cleanName;

      // Build slot-level info from classAssignments + undertimeClassAssignments
      const slotInfo = {};
      const allAssignments = [
        ...(record.classAssignments || []),
        ...(record.undertimeClassAssignments || []),
      ];

      for (const ca of allAssignments) {
        const unifiedSlots = ATTENDANCE_SLOT_RANGES[ca.class_slot];
        if (!unifiedSlots) continue;

        for (const slot of unifiedSlots) {
          slotInfo[slot] = {
            substitute: ca.substitute_teacher_name || null,
            noClass: ca.no_class || ca.noClass || false,
          };
        }

        // Build substitute map: who is subbing where
        if (ca.substitute_teacher_name && unifiedSlots) {
          const subNick = extractNickname(ca.substitute_teacher_name);
          const subClean = extractCleanName(ca.substitute_teacher_name);
          const subKeys = [
            subNick?.toLowerCase(),
            subClean?.toLowerCase(),
            ca.substitute_teacher_name.toLowerCase().trim(),
          ].filter(Boolean);

          // Students may be objects {id, name} or strings
          const studentNames = (ca.students || []).map(s =>
            typeof s === 'string' ? s : (s.name || '')
          ).filter(Boolean);

          const subEntry = {
            unifiedSlots,
            absentTeacher: displayName,
            students: studentNames,
          };

          for (const key of subKeys) {
            if (!substituteMap[key]) substituteMap[key] = [];
            substituteMap[key].push(subEntry);
          }
        }
      }

      const entry = {
        status: record.status,
        minutesLate: record.minutes_late || 0,
        hasUndertime: record.has_undertime || false,
        slotInfo,
      };

      // Store by both nickname and clean name for flexible matching
      if (nickname) {
        attendanceMap[nickname.toLowerCase()] = entry;
      }
      if (cleanName) {
        attendanceMap[cleanName.toLowerCase()] = entry;
      }
      // Also store by full original name
      attendanceMap[record.teacher_name.toLowerCase().trim()] = entry;
    }

    return { attendanceMap, substituteMap };
  } catch (err) {
    console.error('Teacher attendance API error:', err.message);
    return { attendanceMap: {}, substituteMap: {} };
  }
}

/**
 * Find substitute assignments for a teacher.
 */
export function findSubstituteAssignments(teacherName, substituteMap) {
  if (!teacherName || !substituteMap) return [];

  const nameLower = teacherName.toLowerCase().trim();

  // Direct match
  if (substituteMap[nameLower]) return substituteMap[nameLower];

  // Fuzzy match
  for (const [key, value] of Object.entries(substituteMap)) {
    if (nameLower.includes(key) || key.includes(nameLower)) {
      return value;
    }
  }

  return [];
}

/**
 * Fetch student attendance for a date.
 * Returns a Set of lowercase student names that are absent.
 */
export async function getAbsentStudents(date) {
  try {
    const { data } = await studentClient.get(`/attendance/${date}`);

    if (!data || !Array.isArray(data.attendance)) return new Set();

    const absentSet = new Set();
    for (const record of data.attendance) {
      if (record.status === 'absent') {
        absentSet.add(record.student_name.toLowerCase().trim());
      }
    }

    return absentSet;
  } catch (err) {
    console.error('Student attendance API error:', err.message);
    return new Set();
  }
}

/**
 * Find a teacher's attendance record by matching their name against
 * the attendance map (tries multiple matching strategies).
 */
export function findTeacherAttendance(teacherName, attendanceMap) {
  if (!teacherName || !attendanceMap) return null;

  const nameLower = teacherName.toLowerCase().trim();

  // Direct match
  if (attendanceMap[nameLower]) return attendanceMap[nameLower];

  // Try matching against all keys
  for (const [key, value] of Object.entries(attendanceMap)) {
    // Check if teacher name contains the attendance key or vice versa
    if (nameLower.includes(key) || key.includes(nameLower)) {
      return value;
    }
  }

  return null;
}

/**
 * Check if a student name matches any absent student.
 * Handles format "Korean Name (English Name)" from the scheduling system.
 */
export function isStudentAbsent(studentDisplayName, absentSet) {
  if (!studentDisplayName || !absentSet || absentSet.size === 0) return false;

  const lower = studentDisplayName.toLowerCase().trim();

  // Direct match
  if (absentSet.has(lower)) return true;

  // Try just the Korean name part (before any parenthetical)
  const koreanName = lower.replace(/\s*\(.*?\)\s*$/, '').trim();
  if (absentSet.has(koreanName)) return true;

  // Try just the English name part (inside parentheses)
  const engMatch = lower.match(/\(([^)]+)\)/);
  if (engMatch && absentSet.has(engMatch[1].trim())) return true;

  // Partial match: check if any absent student name is contained
  for (const absent of absentSet) {
    if (lower.includes(absent) || absent.includes(koreanName)) {
      return true;
    }
  }

  return false;
}
