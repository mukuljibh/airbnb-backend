import express from 'express';
import { getPrivacyPolicies } from '../../../controllers/admin/privacy-policy/admin.privacyPolicy.controller';

const router = express.Router();

router.get('/', getPrivacyPolicies);

export default router;
