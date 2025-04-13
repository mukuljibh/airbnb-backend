import express from 'express';
import othersUploadRoutes from './uploads/others.uploads.public.route';
import othersPrivacyPolicyRoutes from './privacy-policy/others.privacyPolicy';
import othersWebhookRoutes from './webhook/others.webhook.public.route';
import { changePropertyMetaValues } from '../../controllers/common/test/common.test.controller';
const router = express.Router();

router.use('/uploads', othersUploadRoutes);
router.use('/privacy-policies', othersPrivacyPolicyRoutes);
router.use('/webhook', othersWebhookRoutes);
router.post('/data', changePropertyMetaValues);
export default router;
