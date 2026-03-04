import { Router } from 'express';
import * as aggregator from '../services/aggregator.js';

const router = Router();

// Health check
router.get('/status', async (req, res) => {
  try {
    const status = await aggregator.getStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// All teachers' schedules for a date
router.get('/schedule', async (req, res) => {
  try {
    const date = req.query.date || todayPH();
    const data = await aggregator.getTeacherSchedules(date);
    res.json(data);
  } catch (err) {
    console.error('GET /schedule error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Single teacher's schedule for a date
router.get('/teacher/:name', async (req, res) => {
  try {
    const date = req.query.date || todayPH();
    const data = await aggregator.getTeacherSchedule(req.params.name, date);
    res.json(data);
  } catch (err) {
    console.error('GET /teacher/:name error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Single teacher's weekly schedule
router.get('/teacher/:name/week', async (req, res) => {
  try {
    const startDate = req.query.startDate || todayPH();
    const data = await aggregator.getTeacherWeekSchedule(req.params.name, startDate);
    res.json(data);
  } catch (err) {
    console.error('GET /teacher/:name/week error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// List all known teachers
router.get('/teachers', async (req, res) => {
  try {
    const date = req.query.date || todayPH();
    const data = await aggregator.getAllTeachers(date);
    res.json(data);
  } catch (err) {
    console.error('GET /teachers error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

function todayPH() {
  const now = new Date();
  const ph = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  const y = ph.getFullYear();
  const m = String(ph.getMonth() + 1).padStart(2, '0');
  const d = String(ph.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default router;
