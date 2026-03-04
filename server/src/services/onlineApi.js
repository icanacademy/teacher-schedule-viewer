import axios from 'axios';
import { ONLINE_API_URL } from '../config.js';

const client = axios.create({
  baseURL: ONLINE_API_URL,
  timeout: 5000,
});

// The online app uses fixed 2024 dates as a weekly template:
// Monday=2024-01-01, Tuesday=2024-01-02, ..., Sunday=2024-01-07
const TEMPLATE_DATES = {
  1: '2024-01-01', // Monday
  2: '2024-01-02', // Tuesday
  3: '2024-01-03', // Wednesday
  4: '2024-01-04', // Thursday
  5: '2024-01-05', // Friday
  6: '2024-01-06', // Saturday
  0: '2024-01-07', // Sunday
};

/**
 * Convert a real date (e.g. 2026-02-18) to the online app's
 * template date based on day of week.
 */
function toTemplateDate(realDate) {
  const d = new Date(realDate + 'T00:00:00');
  const dow = d.getDay(); // 0=Sun, 1=Mon, ...
  return TEMPLATE_DATES[dow];
}

export async function getTeachers(date) {
  const templateDate = toTemplateDate(date);
  const { data } = await client.get('/teachers', { params: { date: templateDate } });
  return data;
}

export async function getTimeslots() {
  const { data } = await client.get('/timeslots');
  return data;
}

export async function getAssignments(date) {
  const templateDate = toTemplateDate(date);
  const { data } = await client.get('/assignments', { params: { date: templateDate } });
  return data;
}

export async function getAssignmentsDateRange(startDate, daysCount) {
  // Fetch each day individually using template dates
  const allAssignments = [];
  for (let i = 0; i < daysCount; i++) {
    const d = new Date(startDate + 'T00:00:00');
    d.setDate(d.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const realDate = `${y}-${m}-${day}`;
    const templateDate = toTemplateDate(realDate);

    try {
      const { data } = await client.get('/assignments', { params: { date: templateDate } });
      // Tag each assignment with the real date so the aggregator can group by day
      for (const a of data) {
        allAssignments.push({ ...a, date: realDate });
      }
    } catch {
      // skip failed day
    }
  }
  return allAssignments;
}

export async function healthCheck() {
  const { data } = await client.get('/timeslots');
  return !!data;
}
