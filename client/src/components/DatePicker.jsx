import { todayPH } from '../utils/time.js';

export default function DatePicker({ date, onChange }) {
  function shiftDay(offset) {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + offset);
    onChange(d.toISOString().split('T')[0]);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => shiftDay(-1)}
        className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 text-sm font-medium"
      >
        &larr;
      </button>
      <input
        type="date"
        value={date}
        onChange={(e) => onChange(e.target.value)}
        className="border rounded px-2 py-1 text-sm"
      />
      <button
        onClick={() => shiftDay(1)}
        className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 text-sm font-medium"
      >
        &rarr;
      </button>
      <button
        onClick={() => onChange(todayPH())}
        className="px-2 py-1 rounded bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-sm font-medium"
      >
        오늘
      </button>
    </div>
  );
}
