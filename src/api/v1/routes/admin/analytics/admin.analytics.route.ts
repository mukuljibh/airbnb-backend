import express from 'express';
import * as adminAnalyticsController from '../../../controllers/admin/analytics/admin.analytics.controller';
const router = express.Router();

router.get('/dashboard', adminAnalyticsController.getAdminDashboardAnalytic);

export default router;
