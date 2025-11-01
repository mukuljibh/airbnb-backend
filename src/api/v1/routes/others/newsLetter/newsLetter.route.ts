import express from 'express';
import * as commonNewsLetterController from '../../../controllers/common/news-letter/newsLetter.controller';
const router = express.Router();

router.post('/subscribe', commonNewsLetterController.subscribeNewsLetter);
router.patch('/unsubscribe', commonNewsLetterController.unSubscribeNewsLetter);

export default router;
