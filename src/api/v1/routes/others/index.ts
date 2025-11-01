import express from 'express';
import othersUploadRoutes from './uploads/uploads.route';
import othersPrivacyPolicyRoutes from './privacy-policy/privacyPolicy';
import othersWebhookRoutes from './webhook/webhook.route';
import othersNewsLetterRoutes from './newsLetter/newsLetter.route';
import { changePropertyMetaValues } from '../../controllers/common/test/common.test.controller';
import { sendQueryMessage } from '../../controllers/common/contact-us/contactUs.controller';
import commonHelpRoute from "./../others/help/help.route"
import rateLimit from 'express-rate-limit';
const contactFormLimiter = rateLimit({
   windowMs: 30 * 60 * 1000,
   max: 10,
   message: {
      message: `Dear User, you've reached the maximum number of submissions allowed in a short time. Please wait for 30 minutes before trying again. We appreciate your patience.`,
   },
});
const router = express.Router();

router.use('/uploads', othersUploadRoutes);
router.use('/privacy-policies', othersPrivacyPolicyRoutes);
router.use('/news-letter', othersNewsLetterRoutes);
router.use('/webhook', othersWebhookRoutes);
router.post('/contact-us', contactFormLimiter, sendQueryMessage);
router.use('/help', commonHelpRoute);
router.post('/data', changePropertyMetaValues);
export default router;
