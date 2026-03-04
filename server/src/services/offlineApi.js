import axios from 'axios';
import { OFFLINE_API_URL } from '../config.js';

const client = axios.create({
  baseURL: OFFLINE_API_URL,
  timeout: 5000,
});

export async function getTeachers(date) {
  const { data } = await client.get('/teachers', { params: { date } });
  return data;
}

export async function getTimeslots() {
  const { data } = await client.get('/timeslots');
  return data;
}

export async function getRooms() {
  const { data } = await client.get('/rooms');
  return data;
}

export async function getAssignments(date) {
  const { data } = await client.get('/assignments', { params: { date } });
  return data;
}

export async function getAssignmentsDateRange(startDate, daysCount) {
  const { data } = await client.get('/assignments/date-range', {
    params: { startDate, daysCount },
  });
  return data;
}

export async function healthCheck() {
  const { data } = await client.get('/timeslots');
  return !!data;
}
