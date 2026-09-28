import { Router } from 'express';
import { TrendsController } from './trends.controller.js';
import { authenticateJwt } from '../../middleware/auth.middleware.js';
import { requireModule } from '../../middleware/authorization.middleware.js';

const router = Router();
const controller = new TrendsController();

// Global protections for Trends
router.use(authenticateJwt);
router.use(requireModule('TRENDS'));

// 1. Unified Dashboard
router.get('/dashboard', controller.getDashboard);

// 2. Locations / Branches
router.get('/locations', controller.getLocations);

// 3. Category Tabs
router.get('/categories', controller.getCategories);

// 4. Series Options for Multi-Select Dropdown
router.get('/series', controller.getSeries);

// 5. Revenue Split Chart
router.get('/revenue-split', controller.getRevenueSplit);

// 6. Time-Series Trends Chart
router.get('/time-series', controller.getTimeSeries);
router.get('/trends', controller.getTimeSeries);

// Root route forwards to dashboard
router.get('/', controller.getDashboard);

export default router;
