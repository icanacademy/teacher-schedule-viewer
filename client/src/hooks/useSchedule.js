import { useQuery } from '@tanstack/react-query';
import { fetchSchedule, fetchTeachers, fetchTeacherWeek, fetchStatus } from '../services/api.js';

export function useSchedule(date) {
  return useQuery({
    queryKey: ['schedule', date],
    queryFn: () => fetchSchedule(date),
    refetchInterval: 60000,
    enabled: !!date,
  });
}

export function useTeachers(date) {
  return useQuery({
    queryKey: ['teachers', date],
    queryFn: () => fetchTeachers(date),
    enabled: !!date,
  });
}

export function useTeacherWeek(name, startDate) {
  return useQuery({
    queryKey: ['teacherWeek', name, startDate],
    queryFn: () => fetchTeacherWeek(name, startDate),
    enabled: !!name && !!startDate,
  });
}

export function useStatus() {
  return useQuery({
    queryKey: ['status'],
    queryFn: fetchStatus,
    refetchInterval: 30000,
  });
}
