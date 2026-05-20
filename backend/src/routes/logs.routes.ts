import { Router } from 'express';
import {
  createLog,
  createLogFromText,
  deleteLog,
  getLatest,
  listLogs,
  updateLog,
} from '../controllers/logs.controller';
import { requireAuth } from '../middleware/auth.middleware';

export const logsRouter = Router();

logsRouter.use(requireAuth);
logsRouter.post('/', createLog);
logsRouter.post('/from-text', createLogFromText);
logsRouter.get('/', listLogs);
logsRouter.get('/latest', getLatest);
logsRouter.patch('/:id', updateLog);
logsRouter.delete('/:id', deleteLog);
