import { useState, useMemo } from 'react';
import { useTeachers } from '../hooks/useSchedule.js';
import { todayPH } from '../utils/time.js';
import DatePicker from './DatePicker.jsx';
import StatusBadge from './StatusBadge.jsx';
import TeacherDetail from './TeacherDetail.jsx';

export default function SearchView() {
  const [date, setDate] = useState(todayPH());
  const [search, setSearch] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const { data, isLoading } = useTeachers(date);

  const teachers = data?.teachers || [];

  const filtered = useMemo(() => {
    if (!search.trim()) return teachers;
    const q = search.toLowerCase().trim();
    return teachers.filter((t) => t.name.toLowerCase().includes(q));
  }, [teachers, search]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-lg font-semibold">선생님 검색</h2>
        <DatePicker date={date} onChange={setDate} />
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="선생님 이름 입력..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>

      {isLoading ? (
        <div className="text-gray-500">선생님 목록 로딩 중...</div>
      ) : (
        <div className="flex gap-4">
          <div className="w-64 shrink-0">
            <div className="border rounded-lg overflow-hidden bg-white">
              <div className="px-3 py-2 bg-gray-50 text-xs text-gray-500 font-medium">
                {filtered.length}명의 선생님
              </div>
              <div className="max-h-[600px] overflow-y-auto">
                {filtered.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => setSelectedTeacher(t)}
                    className={`w-full text-left px-3 py-2 text-sm border-b border-gray-100 hover:bg-indigo-50 flex items-center justify-between ${
                      selectedTeacher?.name === t.name ? 'bg-indigo-50 font-medium' : ''
                    }`}
                  >
                    <span>{t.name}</span>
                    <StatusBadge type={t.type} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1">
            {selectedTeacher ? (
              <TeacherDetail teacher={selectedTeacher} date={date} />
            ) : (
              <div className="text-center py-12 text-gray-400">
                선생님을 선택하면 주간 스케줄을 볼 수 있습니다
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
