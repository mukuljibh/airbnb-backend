import express from 'express';
import { getPrivacyPolicies } from '../../../controllers/admin/privacy-policy/privacyPolicy.controller';

const router = express.Router();

router.get('/', getPrivacyPolicies);

export default router;
