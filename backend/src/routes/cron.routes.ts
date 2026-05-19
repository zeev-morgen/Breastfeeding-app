import { Router } from 'express';
import { checkReminders } from '../controllers/cron.controller';

export const cronRouter = Router();

cronRouter.get('/check-reminders', checkReminders);
