import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

export async function fetchSchedule(date) {
  const { data } = await api.get('/schedule', { params: { date } });
  return data;
}

export async function fetchTeachers(date) {
  const { data } = await api.get('/teachers', { params: { date } });
  return data;
}

export async function fetchTeacherSchedule(name, date) {
  const { data } = await api.get(`/teacher/${encodeURIComponent(name)}`, { params: { date } });
  return data;
}

export async function fetchTeacherWeek(name, startDate) {
  const { data } = await api.get(`/teacher/${encodeURIComponent(name)}/week`, { params: { startDate } });
  return data;
}

export async function fetchStatus() {
  const { data } = await api.get('/status');
  return data;
}
