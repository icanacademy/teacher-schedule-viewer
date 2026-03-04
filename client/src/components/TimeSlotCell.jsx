import { useState, useRef, useEffect } from 'react';

function shortName(fullName) {
  const engMatch = fullName.match(/\(([^)]+)\)/);
  if (engMatch) return engMatch[1];
  const cleaned = fullName.replace(/\s*\[.*?\]\s*/, '').trim();
  const parts = cleaned.split(' ');
  if (parts.length >= 3) return parts.slice(1).join(' ');
  if (parts.length === 2) return parts[1];
  return cleaned;
}

function nickname(fullName) {
  const bracketMatch = fullName.match(/^\[([^\]]+)\]/);
  if (bracketMatch) return bracketMatch[1];
  return shortName(fullName);
}

function fmtTime(t) {
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'p' : 'a';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12}${ap}` : `${h12}:${String(m).padStart(2, '0')}${ap}`;
}

export default function TimeSlotCell({ slot, endTime, assignments, isAvailable, isLunch, colSpan = 1, slotCount = 1 }) {
  const [expanded, setExpanded] = useState(false);
  const popupRef = useRef(null);
  const hasAssignments = assignments && assignments.length > 0;

  // Close popup on outside click
  useEffect(() => {
    if (!expanded) return;
    const handler = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [expanded]);

  // Lunch break
  if (isLunch && !hasAssignments) {
    return (
      <td colSpan={colSpan} className="border border-gray-200 p-0 bg-amber-50">
        <div className="h-[46px] flex items-center justify-center">
          <span className="text-[10px] font-semibold text-amber-400">점심</span>
        </div>
      </td>
    );
  }

  // Not available
  if (!hasAssignments && !isAvailable) {
    return (
      <td
        colSpan={colSpan}
        className="border border-gray-200 p-0"
        style={{
          background: 'repeating-linear-gradient(-45deg, #e5e7eb, #e5e7eb 3px, #d1d5db 3px, #d1d5db 6px)',
        }}
      >
        <div className="h-[46px]" />
      </td>
    );
  }

  // Free
  if (!hasAssignments && isAvailable) {
    return (
      <td colSpan={colSpan} className="border border-gray-200 p-0 bg-white">
        <div className="h-[46px] flex items-center justify-center">
          <span className="text-[10px] font-semibold text-emerald-500">수업 없음</span>
        </div>
      </td>
    );
  }

  // Has assignments
  const a = assignments[0];
  const isOnline = a.source === 'online';
  const absentSet = new Set((a.absentStudents || []).map(s => s.toLowerCase()));
  const names = a.students.map(s => ({
    display: s,
    absent: absentSet.has(s.toLowerCase()),
  }));
  const absentCount = names.filter(n => n.absent).length;
  const allAbsent = names.length > 0 && absentCount === names.length;
  const hasSubstitute = !!a.substituteTeacher;
  const isNoClass = !!a.noClass;
  const isSubbing = !!a.isSubbing;
  const duration = slotCount * 30;
  const durationLabel = duration >= 60
    ? (duration % 60 === 0 ? `${duration / 60}hr` : `${Math.floor(duration / 60)}h${duration % 60}m`)
    : `${duration}m`;

  return (
    <td
      colSpan={colSpan}
      className="border border-gray-200 p-0 cursor-pointer overflow-hidden relative"
      onClick={() => setExpanded(!expanded)}
      title={`${a.students.join(', ')} | ${isOnline ? '온라인' : '교실 ' + (a.room || '?')}${a.subject ? ' | ' + a.subject : ''}${a.notes ? ' | ' + a.notes : ''}${absentCount > 0 ? ` | ${absentCount}명 결석` : ''}`}
    >
      <div
        className={`h-[46px] px-1.5 py-0.5 flex flex-col justify-center text-[11px] leading-[14px] overflow-hidden border-l-[3px] ${
          isNoClass ? 'bg-gray-50 border-gray-300'
          : isSubbing ? 'bg-orange-50 border-orange-400'
          : allAbsent ? 'bg-red-50/50 ' + (isOnline ? 'border-green-500' : 'border-blue-500')
          : 'bg-white ' + (isOnline ? 'border-green-500' : 'border-blue-500')
        } ${a.isSubstitute && !isSubbing ? 'ring-1 ring-inset ring-orange-300' : ''}`}
      >
        {isNoClass ? (
          <div className="text-[10px] font-semibold text-gray-800 text-center">수업 없음</div>
        ) : isSubbing ? (
          <>
            {/* Line 1: Student names for subbing slot */}
            <div className="font-bold truncate text-orange-700">
              {names.length > 0 ? names.map(n => n.display).join(', ') : <span className="text-gray-300 font-normal">--</span>}
            </div>
            {/* Line 2: Subbing for X */}
            <div className="truncate text-[10px] text-orange-400">
              {a.subbingFor} 대체
              {slotCount > 1 && <span className="ml-0.5">· {durationLabel}</span>}
            </div>
          </>
        ) : (
          <>
            {/* Line 1: Student names with absent indicator */}
            <div className={`font-bold truncate ${isOnline ? 'text-green-700' : 'text-blue-700'}`}>
              {names.length > 0 ? (
                names.map((n, i) => (
                  <span key={i}>
                    {i > 0 && ', '}
                    <span className={n.absent ? 'line-through opacity-40' : ''}>{n.display}</span>
                  </span>
                ))
              ) : (
                <span className="text-gray-300 font-normal">--</span>
              )}
            </div>
            {/* Line 2: Room/Online + subject + duration + attendance tags */}
            <div className={`truncate text-[10px] ${isOnline ? 'text-green-400' : 'text-blue-400'}`}>
              {isOnline ? '온라인' : `교실${a.room || '?'}`}
              {a.subject && <span className="ml-0.5">· {a.subject}</span>}
              {slotCount > 1 && <span className="ml-0.5">· {durationLabel}</span>}
              {a.isSubstitute && <span className="text-orange-400 ml-0.5">· 대체</span>}
              {hasSubstitute && <span className="text-orange-500 ml-0.5">· 대체: {nickname(a.substituteTeacher)}</span>}
              {absentCount > 0 && !allAbsent && (
                <span className="text-red-400 ml-0.5">· {absentCount}명 결석</span>
              )}
              {allAbsent && <span className="text-red-400 ml-0.5">· 전원 결석</span>}
            </div>
          </>
        )}
      </div>

      {/* Expanded popup */}
      {expanded && (
        <div
          ref={popupRef}
          className="absolute z-40 top-full left-0 bg-white border border-gray-300 rounded shadow-lg p-2.5 text-xs min-w-[200px] whitespace-normal"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold text-gray-800">
              {fmtTime(slot)} – {fmtTime(endTime)}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
              isOnline ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {isOnline ? '온라인' : `교실 ${a.room || '?'}`}
            </span>
          </div>
          {a.subject && <div className="text-gray-500 mb-1">{a.subject}</div>}
          {isSubbing && (
            <div className="text-orange-600 text-[10px] font-medium mb-1 flex items-center gap-1">
              <span className="bg-orange-100 px-1.5 py-0.5 rounded">{a.subbingFor} 대체 중</span>
            </div>
          )}
          {a.isSubstitute && !isSubbing && <div className="text-orange-500 text-[10px] font-medium mb-1">대체 교사</div>}
          {hasSubstitute && (
            <div className="text-orange-600 text-[10px] font-medium mb-1 flex items-center gap-1">
              <span className="bg-orange-100 px-1.5 py-0.5 rounded">대체: {a.substituteTeacher}</span>
            </div>
          )}
          {isNoClass && <div className="text-gray-400 text-[10px] font-medium mb-1">오늘 수업 없음</div>}
          <div className="space-y-0.5">
            {a.students.length > 0 ? (
              a.students.map((s, j) => {
                const isAbsent = absentSet.has(s.toLowerCase());
                return (
                  <div key={j} className={`font-medium flex items-center gap-1 ${isAbsent ? 'text-red-400 line-through' : 'text-gray-700'}`}>
                    {s}
                    {isAbsent && <span className="text-[9px] bg-red-100 text-red-500 px-1 rounded no-underline font-normal" style={{ textDecoration: 'none' }}>결석</span>}
                  </div>
                );
              })
            ) : (
              <div className="text-gray-400 italic">배정된 학생 없음</div>
            )}
          </div>
          {absentCount > 0 && (
            <div className="text-red-400 text-[10px] mt-1 pt-1 border-t border-gray-100">
              {a.students.length}명 중 {absentCount}명 결석
            </div>
          )}
          {a.notes && <div className="text-gray-400 italic mt-1.5 pt-1.5 border-t">{a.notes}</div>}
        </div>
      )}
    </td>
  );
}
