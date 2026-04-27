import { Router } from 'express';
import { createLog, getLatest, listLogs } from '../controllers/logs.controller';
import { requireAuth } from '../middleware/auth.middleware';

export const logsRouter = Router();

logsRouter.use(requireAuth);
logsRouter.post('/', createLog);
logsRouter.get('/', listLogs);
logsRouter.get('/latest', getLatest);
