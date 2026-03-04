import StatusBadge from './StatusBadge.jsx';
import TimeSlotCell from './TimeSlotCell.jsx';

/**
 * Build a merge key for an assignment.
 * Same key = same class = can be merged.
 */
function mergeKey(assignments) {
  if (!assignments || assignments.length === 0) return null;
  return assignments
    .map(a => {
      const students = [...a.students].sort().join('|');
      return `${a.source}::${a.room || ''}::${students}::${a.subject || ''}`;
    })
    .sort()
    .join('///');
}

/**
 * When a slot has both real assignments (with students) and empty
 * placeholders (no students), keep only the real ones so they
 * don't interfere with merging or display.
 */
function effectiveAssignments(assigns) {
  if (!assigns || assigns.length === 0) return [];
  const withStudents = assigns.filter(a => a.students.length > 0);
  return withStudents.length > 0 ? withStudents : assigns;
}

/**
 * Get all 30-min unified slots that an assignment covers.
 * e.g. offline 08:00-09:00 → ["08:00", "08:30"]
 */
function coveredSlots(assignment) {
  const slots = [];
  const [sh, sm] = assignment.startTime.split(':').map(Number);
  const [eh, em] = assignment.endTime.split(':').map(Number);
  let cur = sh * 60 + sm;
  const end = eh * 60 + em;
  while (cur < end) {
    const h = Math.floor(cur / 60);
    const m = cur % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    cur += 30;
  }
  return slots;
}

export default function TeacherRow({ teacher, hourBlocks }) {
  // Expand assignments into every 30-min slot they cover
  const assignmentsByTime = {};
  for (const a of teacher.assignments) {
    for (const slot of coveredSlots(a)) {
      if (!assignmentsByTime[slot]) {
        assignmentsByTime[slot] = [];
      }
      assignmentsByTime[slot].push(a);
    }
  }

  const availableSet = new Set(teacher.availableSlots || []);
  const lunchSet = new Set(teacher.lunchSlots || []);
  const allSlots = hourBlocks.flatMap(b => b.slots);

  // Classify each slot into a type for merging
  function classifySlot(slot) {
    const assigns = effectiveAssignments(assignmentsByTime[slot] || []);
    const hasAssign = assigns.length > 0;
    const isAvail = availableSet.has(slot);
    const isLunch = lunchSet.has(slot) && !hasAssign;

    if (hasAssign) return { type: 'class', key: mergeKey(assigns), assigns, isAvail, isLunch: false };
    if (isLunch) return { type: 'lunch', key: 'lunch', assigns: [], isAvail: false, isLunch: true };
    if (isAvail) return { type: 'free', key: 'free', assigns: [], isAvail: true, isLunch: false };
    return { type: 'unavailable', key: 'unavailable', assigns: [], isAvail: false, isLunch: false };
  }

  // Walk through slots and merge consecutive ones with the same identity
  const spans = [];
  let i = 0;
  while (i < allSlots.length) {
    const slot = allSlots[i];
    const info = classifySlot(slot);

    // Look ahead for consecutive matching slots
    let spanLen = 1;
    while (i + spanLen < allSlots.length) {
      const nextInfo = classifySlot(allSlots[i + spanLen]);
      if (nextInfo.type === info.type && nextInfo.key === info.key) {
        spanLen++;
      } else {
        break;
      }
    }

    const startTime = allSlots[i];
    const lastSlot = allSlots[i + spanLen - 1];
    const [lh, lm] = lastSlot.split(':').map(Number);
    const endMin = lh * 60 + lm + 30;
    const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;

    spans.push({
      key: `${slot}-${spanLen}`,
      slot: startTime,
      endTime,
      assignments: info.assigns,
      isAvailable: info.isAvail,
      isLunch: info.isLunch,
      colSpan: spanLen,
      slotCount: spanLen,
    });

    i += spanLen;
  }

  // Count unique classes
  const uniqueClasses = new Set();
  for (const span of spans) {
    if (span.assignments.length > 0) {
      uniqueClasses.add(mergeKey(span.assignments));
    }
  }

  const busyTimes = new Set(teacher.assignments.flatMap(a => coveredSlots(a)));
  const freeCount = (teacher.availableSlots || []).filter(s => !busyTimes.has(s)).length;
  const freeHours = Math.floor(freeCount / 2);
  const freeHalf = freeCount % 2;

  return (
    <tr>
      <td className={`border border-gray-200 px-2 py-1 sticky left-0 z-10 whitespace-nowrap ${
        teacher.attendance?.status === 'absent' ? 'bg-red-50' : 'bg-white'
      }`}>
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-sm">{teacher.name}</span>
          <StatusBadge type={teacher.type} />
        </div>
        <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1.5">
          <span>
            {uniqueClasses.size}개 수업
            {freeCount > 0 && (
              <span className="text-emerald-500 ml-1">
                {freeHours > 0 ? `${freeHours}` : ''}{freeHalf ? (freeHours > 0 ? '.5' : '0.5') : ''}시간 여유
              </span>
            )}
          </span>
          {teacher.attendance?.status === 'absent' && (
            <span className="px-1 py-0 text-[9px] font-bold rounded bg-red-100 text-red-600">결석</span>
          )}
          {teacher.attendance?.status === 'late' && (
            <span className="px-1 py-0 text-[9px] font-bold rounded bg-yellow-100 text-yellow-700">
              지각{teacher.attendance.minutesLate > 0 ? ` ${teacher.attendance.minutesLate}분` : ''}
            </span>
          )}
          {teacher.attendance?.hasUndertime && teacher.attendance?.status !== 'absent' && (
            <span className="px-1 py-0 text-[9px] font-bold rounded bg-orange-100 text-orange-600">조퇴</span>
          )}
        </div>
      </td>
      {spans.map((span) => (
        <TimeSlotCell
          key={span.key}
          slot={span.slot}
          endTime={span.endTime}
          assignments={span.assignments}
          isAvailable={span.isAvailable}
          isLunch={span.isLunch}
          colSpan={span.colSpan}
          slotCount={span.slotCount}
        />
      ))}
    </tr>
  );
}
