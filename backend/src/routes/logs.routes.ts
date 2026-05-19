import { Router } from 'express';
import { createLog, deleteLog, getLatest, listLogs, updateLog } from '../controllers/logs.controller';
import { requireAuth } from '../middleware/auth.middleware';

export const logsRouter = Router();

logsRouter.use(requireAuth);
logsRouter.post('/', createLog);
logsRouter.get('/', listLogs);
logsRouter.get('/latest', getLatest);
logsRouter.patch('/:id', updateLog);
logsRouter.delete('/:id', deleteLog);
