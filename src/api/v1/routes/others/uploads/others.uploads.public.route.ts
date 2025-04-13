import express from 'express';
import { upload } from '../../../../uploads/multer';
import {
   UploadMultiple,
   UploadSingle,
} from '../../../controllers/common/uploads/common.upload.controller';

const router = express.Router();

router.post('/single', upload.single('file'), UploadSingle);
router.post('/multiple', upload.array('files'), UploadMultiple);

export default router;
