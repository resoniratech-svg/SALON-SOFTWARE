import { Router } from 'express';
import { enquiriesController } from './enquiries.controller.js';
import { authenticateJwt } from '../../middleware/auth.middleware.js';

// Router 1: Enquiries
export const enquiryRouter = Router();
enquiryRouter.use(authenticateJwt);

enquiryRouter.get('/', enquiriesController.getEnquiries);
enquiryRouter.post('/', enquiriesController.createEnquiry);
enquiryRouter.get('/:id', enquiriesController.getEnquiryById);
enquiryRouter.put('/:id', enquiriesController.updateEnquiry);
enquiryRouter.delete('/:id', enquiriesController.deleteEnquiry);

// Follow-up sub-routes
enquiryRouter.patch('/:id/follow-up', enquiriesController.updateFollowUp);
enquiryRouter.post('/:id/follow-up', enquiriesController.createFollowUp);
enquiryRouter.post('/:id/follow-ups', enquiriesController.createFollowUp);
enquiryRouter.get('/:id/follow-ups', enquiriesController.getFollowUps);
enquiryRouter.put('/follow-ups/:followUpId', enquiriesController.updateFollowUpItem);

// Audit history timeline
enquiryRouter.get('/:id/history', enquiriesController.getEnquiryHistory);

// Router 2: Referrals & Referral Dashboard
export const referralRouter = Router();
referralRouter.use(authenticateJwt);

referralRouter.get('/dashboard', enquiriesController.getReferralDashboard);
referralRouter.get('/', enquiriesController.getReferrals);
referralRouter.post('/', enquiriesController.createReferral);
referralRouter.put('/:id', enquiriesController.updateReferral);
referralRouter.delete('/:id', enquiriesController.deleteReferral);
