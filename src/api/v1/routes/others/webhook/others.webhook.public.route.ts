import express from 'express';
import {
   handleConnectRedirect,
   handlePaymentRedirect,
} from '../../../controllers/general/reservation/general.reservation.controller';

const router = express.Router();

router.post(
   '/connect',
   express.raw({ type: 'application/json' }),
   handleConnectRedirect,
);

router.post(
   '/',
   express.raw({ type: 'application/json' }),
   handlePaymentRedirect,
);

export default router;
