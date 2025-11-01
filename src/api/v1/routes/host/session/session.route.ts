import express from 'express';

import * as sessionController from '../../../controllers/general/session/session.controller'
import { validateClientSource } from '../../../middleware/sessions/session.middleware';


const router = express.Router();

//--> validate SSO session(web)
// router.get('/validate', sessionController.validateSession)
router.get('/state', sessionController.getCurrentSessionState)

//--> create SSO Session(web)
// router.patch('/switch', sessionController.switchSession)

//--> switch session for native device single session is modified for native device.
router.patch('/switch-to-guest', validateClientSource('mobile'), sessionController.switchSessionRolesForNative)
router.patch('/init', sessionController.switchSessionRolesForNativeProtoType)


export default router