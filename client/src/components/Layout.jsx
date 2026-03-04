import { NavLink, Outlet } from 'react-router-dom';
import { useStatus } from '../hooks/useSchedule.js';

export default function Layout() {
  const { data: status } = useStatus();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 flex items-center justify-between h-12">
          <div className="flex items-center gap-6">
            <h1 className="font-bold text-indigo-700">ICAN 스케줄 뷰어</h1>
            <div className="flex gap-1">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded text-sm font-medium ${
                    isActive ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
                  }`
                }
              >
                전체 보기
              </NavLink>
              <NavLink
                to="/search"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded text-sm font-medium ${
                    isActive ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
                  }`
                }
              >
                검색
              </NavLink>
            </div>
          </div>
          {status && (
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className={`inline-block w-2 h-2 rounded-full ${status.online === 'ok' ? 'bg-green-500' : 'bg-red-500'}`} />
                온라인
              </span>
              <span className="flex items-center gap-1">
                <span className={`inline-block w-2 h-2 rounded-full ${status.offline === 'ok' ? 'bg-blue-500' : 'bg-red-500'}`} />
                오프라인
              </span>
            </div>
          )}
        </div>
      </nav>
      <main className="max-w-[1400px] mx-auto px-4 py-4">
        <Outlet />
      </main>
    </div>
  );
}
