import { useTeacherWeek } from '../hooks/useSchedule.js';
import { getWeekDates, getDayName, formatDate, formatTime, getMonday } from '../utils/time.js';
import StatusBadge from './StatusBadge.jsx';

export default function TeacherDetail({ teacher, date }) {
  const startDate = getMonday(date);
  const { data, isLoading, error } = useTeacherWeek(teacher.name, startDate);

  if (isLoading) {
    return <div className="text-gray-500 py-4">주간 스케줄 로딩 중...</div>;
  }

  if (error) {
    return <div className="text-red-600 py-4">오류: {error.message}</div>;
  }

  if (!data) return null;

  const weekDates = getWeekDates(startDate);

  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-lg font-bold">{teacher.name}</h3>
        <StatusBadge type={teacher.type} />
      </div>

      <div className="text-sm text-gray-500 mb-3">
        {formatDate(startDate)} 주간
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {weekDates.slice(0, 6).map((dateStr) => {
          const dayAssignments = data.days[dateStr] || [];
          const dayName = getDayName(dateStr);
          const isSunday = new Date(dateStr + 'T00:00:00').getDay() === 0;

          if (isSunday) return null;

          return (
            <div key={dateStr} className="border rounded p-2">
              <div className="font-medium text-sm mb-2 text-gray-700">
                {dayName} {dateStr.slice(5)}
              </div>
              {dayAssignments.length === 0 ? (
                <div className="text-xs text-gray-400 py-2">수업 없음</div>
              ) : (
                <>
                  <div className="text-[10px] text-gray-400 mb-1">
                    {dayAssignments.length}개 수업
                    {' '}({formatTime(dayAssignments[0].startTime)} - {formatTime(dayAssignments[dayAssignments.length - 1].endTime)})
                  </div>
                  <div className="space-y-1.5">
                    {dayAssignments.map((a, i) => (
                      <div
                        key={i}
                        className={`text-xs p-1.5 rounded ${
                          a.source === 'online'
                            ? 'bg-green-50 border border-green-200'
                            : 'bg-blue-50 border border-blue-200'
                        } ${a.isSubstitute ? 'ring-1 ring-orange-300' : ''}`}
                      >
                        <div className="font-medium">
                          {formatTime(a.startTime)} - {formatTime(a.endTime)}
                        </div>
                        <div className="text-gray-600 mt-0.5">
                          {a.source === 'online' ? '온라인' : `교실 ${a.room || '?'}`}
                          {a.isSubstitute && ' (대체)'}
                        </div>
                        {a.subject && (
                          <div className="text-gray-500">{a.subject}</div>
                        )}
                        {a.students.map((s, j) => (
                          <div key={j} className="text-gray-400 truncate">{s}</div>
                        ))}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
