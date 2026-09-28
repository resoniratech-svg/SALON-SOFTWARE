import { Router } from 'express';
import { whatsappController } from './whatsapp.controller.js';
import { authenticateJwt } from '../../middleware/auth.middleware.js';

export const whatsappRouter = Router();
whatsappRouter.use(authenticateJwt);

whatsappRouter.get('/conversations', whatsappController.getConversations);
whatsappRouter.get('/conversations/:id/messages', whatsappController.getMessages);
whatsappRouter.get('/chat', whatsappController.getConversations);
whatsappRouter.get('/chat/:id/messages', whatsappController.getMessages);
whatsappRouter.post('/messages', whatsappController.sendMessage);
whatsappRouter.post('/send', whatsappController.sendMessage);
whatsappRouter.get('/history', whatsappController.getHistory);
