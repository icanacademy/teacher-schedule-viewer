import 'dotenv/config';

export const ONLINE_API_URL = process.env.ONLINE_API_URL || 'http://localhost:4488/api';
export const OFFLINE_API_URL = process.env.OFFLINE_API_URL || 'http://localhost:5555/api';
export const TEACHER_ATTENDANCE_API_URL = process.env.TEACHER_ATTENDANCE_API_URL || 'http://localhost:3001/api';
export const STUDENT_ATTENDANCE_API_URL = process.env.STUDENT_ATTENDANCE_API_URL || 'http://localhost:3002/api';
export const PORT = process.env.PORT || 5001;
