import express from 'express';
import * as generalAnalyticsController from '../../../controllers/general/analytics/analytics.controller';
const router = express.Router();

router.get('/dashboard', generalAnalyticsController.getHostDashboardAnalytic);

router.get('/revenue', generalAnalyticsController.getRevenueDashboardAnalytic);

router.get(
   '/calender-insights/:propertyId',
   generalAnalyticsController.getTransactionsInsights,
);
export default router;
