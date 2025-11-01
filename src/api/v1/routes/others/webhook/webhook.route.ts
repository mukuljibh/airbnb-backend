import express from 'express';
import {
   handleConnectRedirect,
   handlePaymentRedirect,
} from '../../../controllers/general/reservation/reservation.controller';
import { logObject } from '../../../config/logger/logger';
import crypto from 'crypto'
import { ApiError } from '../../../utils/error-handlers/ApiError';
const router = express.Router();

//test@12345
router.post('/razorpay', express.raw({ type: 'application/json' }), (req, res) => {

   const signature = req.headers['x-razorpay-signature'];
   const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

   const body = req.body instanceof Buffer ? req.body : Buffer.from(JSON.stringify(req.body));

   const expected = crypto.createHmac('sha256', secret)
      .update(body)
      .digest('hex');

   if (expected === signature) {
      const payload = JSON.parse(body.toString());
      logObject(payload, 'razorpay webhook payload', 'info')
      console.dir(payload, { depth: null })
      res.status(200).send('ok');
   } else {
      throw new ApiError(400, 'Invalid signature')
   }
});



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
