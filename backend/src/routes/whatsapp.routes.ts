import { Router, urlencoded } from 'express';
import { whatsappWebhook } from '../controllers/whatsapp.controller';

export const whatsappRouter = Router();

// Twilio posts application/x-www-form-urlencoded. We mount the parser locally
// so the rest of the API stays JSON-only.
whatsappRouter.post('/whatsapp', urlencoded({ extended: false }), whatsappWebhook);
