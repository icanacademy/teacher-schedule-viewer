import { useState, useEffect, useRef } from 'react';
import { useSchedule } from '../hooks/useSchedule.js';
import { todayPH, formatDate } from '../utils/time.js';
import DatePicker from './DatePicker.jsx';
import TeacherRow from './TeacherRow.jsx';

const TEACHER_COL = 140;
const SLOT_COL = 64;

/**
 * Get current Philippine time as { hours, minutes }
 */
function phNow() {
  const ph = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  return { hours: ph.getHours(), minutes: ph.getMinutes() };
}

/**
 * Calculate the pixel offset of the current time line within the grid.
 * Returns null if current time is outside the grid range.
 */
function nowLineOffset(hourBlocks) {
  const { hours, minutes } = phNow();
  const totalMin = hours * 60 + minutes;

  const allSlots = hourBlocks.flatMap(b => b.slots);
  if (allSlots.length === 0) return null;

  const [firstH, firstM] = allSlots[0].split(':').map(Number);
  const gridStart = firstH * 60 + firstM;
  const gridEnd = gridStart + allSlots.length * 30;

  if (totalMin < gridStart || totalMin > gridEnd) return null;

  const slotIndex = (totalMin - gridStart) / 30;
  return TEACHER_COL + slotIndex * SLOT_COL;
}

const FILTERS = [
  { key: 'combined', label: '전체' },
  { key: 'offline', label: '오프라인' },
  { key: 'online', label: '온라인' },
];

function applyFilter(teachers, filter) {
  if (filter === 'combined') return teachers;

  return teachers
    .filter(t => {
      // Keep teachers that have assignments or availability matching the filter
      if (filter === 'offline') return t.type === 'offline' || t.type === 'both';
      if (filter === 'online') return t.type === 'online' || t.type === 'both';
      return true;
    })
    .map(t => {
      // For "both" teachers, strip assignments from the other source
      const filtered = t.assignments.filter(a => a.source === filter);
      if (filtered.length === t.assignments.length) return t;
      return { ...t, assignments: filtered };
    });
}

export default function GridView() {
  const [date, setDate] = useState(todayPH());
  const [filter, setFilter] = useState('combined');
  const { data, isLoading, error } = useSchedule(date);
  const [lineOffset, setLineOffset] = useState(null);
  const containerRef = useRef(null);
  const isToday = date === todayPH();

  // Update line position every 30 seconds
  useEffect(() => {
    if (!isToday || !data) return;
    const update = () => setLineOffset(nowLineOffset(data.hourBlocks));
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [isToday, data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">스케줄 로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded">
        스케줄 로딩 오류: {error.message}
      </div>
    );
  }

  if (!data) return null;

  const { teachers: allTeachers, hourBlocks, sourceStatus } = data;
  const teachers = applyFilter(allTeachers, filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold">{formatDate(date)}</h2>
          <div className="flex gap-2 mt-1">
            {sourceStatus.online === 'ok' ? (
              <span className="text-xs text-green-600">온라인 API: OK</span>
            ) : (
              <span className="text-xs text-red-600">온라인 API: 오류</span>
            )}
            {sourceStatus.offline === 'ok' ? (
              <span className="text-xs text-blue-600">오프라인 API: OK</span>
            ) : (
              <span className="text-xs text-red-600">오프라인 API: 오류</span>
            )}
            {sourceStatus.attendance === 'ok' ? (
              <span className="text-xs text-purple-600">출석: OK</span>
            ) : (
              <span className="text-xs text-gray-400">출석: N/A</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  filter === f.key
                    ? f.key === 'offline' ? 'bg-blue-500 text-white'
                    : f.key === 'online' ? 'bg-green-500 text-white'
                    : 'bg-gray-700 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <DatePicker date={date} onChange={setDate} />
        </div>
      </div>

      {teachers.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          해당 날짜에 선생님이 없습니다.
        </div>
      ) : (
        <div ref={containerRef} className="overflow-auto max-h-[calc(100vh-180px)] border rounded-lg">
          {/* Wrapper matches the full table height so the time line spans everything */}
          <div className="relative">
            <table
              className="border-collapse text-sm"
              style={{ tableLayout: 'fixed', width: `${TEACHER_COL + hourBlocks.length * 2 * SLOT_COL}px` }}
            >
              <colgroup>
                <col style={{ width: `${TEACHER_COL}px` }} />
                {hourBlocks.flatMap((block) =>
                  block.slots.map((slot) => (
                    <col key={slot} style={{ width: `${SLOT_COL}px` }} />
                  ))
                )}
              </colgroup>
              <thead className="sticky top-0 z-20">
                <tr className="bg-gray-50">
                  <th
                    rowSpan={2}
                    className="border border-gray-200 px-2 py-2 text-left sticky left-0 bg-gray-50 z-30"
                  >
                    선생님
                  </th>
                  {hourBlocks.map((block) => (
                    <th
                      key={block.startTime}
                      colSpan={2}
                      className="border border-gray-200 px-1 py-1 text-center text-xs bg-gray-50"
                    >
                      {block.label}
                    </th>
                  ))}
                </tr>
                <tr className="bg-gray-50">
                  {hourBlocks.map((block) =>
                    block.slots.map((slot) => (
                      <th
                        key={slot}
                        className="border border-gray-200 px-0 py-0.5 text-center text-[10px] font-normal text-gray-400 bg-gray-50"
                      >
                        {slot.endsWith(':00') ? ':00' : ':30'}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {teachers.map((teacher) => (
                  <TeacherRow
                    key={teacher.name}
                    teacher={teacher}
                    hourBlocks={hourBlocks}
                  />
                ))}
              </tbody>
            </table>

            {/* Current time vertical line — spans full table height */}
            {isToday && lineOffset !== null && (
              <div
                className="absolute top-0 bottom-0 z-25 pointer-events-none"
                style={{ left: `${lineOffset}px` }}
              >
                <div className="w-[2px] h-full bg-red-500 opacity-70" />
                <div className="absolute top-0 -left-[3px] w-2 h-2 rounded-full bg-red-500" />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <span className="inline-block font-bold text-green-700 text-[10px]">Abc</span>
          온라인 수업
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block font-bold text-blue-700 text-[10px]">Abc</span>
          오프라인 수업
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 border border-gray-200 flex items-center justify-center text-[6px] text-emerald-500 font-bold">F</span>
          수업 없음
        </div>
        <div className="flex items-center gap-1">
          <span
            className="inline-block w-3 h-3 border border-gray-300"
            style={{ background: 'repeating-linear-gradient(-45deg, #e5e7eb, #e5e7eb 2px, #d1d5db 2px, #d1d5db 4px)' }}
          />
          근무 없음
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-0.5 h-3 bg-red-500" />
          현재 시간
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block line-through opacity-40 text-[10px] font-bold">Abc</span>
          학생 결석
        </div>
        <div className="flex items-center gap-1">
          <span className="px-1 py-0.5 text-[9px] font-bold rounded bg-red-100 text-red-600">결석</span>
          선생님 결석
        </div>
        <div className="flex items-center gap-1">
          <span className="text-orange-500 text-[10px] font-medium">대체</span>
          대체 교사
        </div>
        <div className="text-gray-400">셀을 클릭하면 상세 정보를 볼 수 있습니다</div>
      </div>
    </div>
  );
}
