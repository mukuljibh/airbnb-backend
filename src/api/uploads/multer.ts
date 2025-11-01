import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { cloudinary } from './cloudinary';
import { v4 as uuidv4 } from 'uuid';
import { ApiError } from '../v1/utils/error-handlers/ApiError';
import { filePayloadValidator } from './validation/uploads.validation';
import { validatePayload } from '../v1/rtc/middleware/validatePayload';
import { ContextType, getFolderAndTagNameBasedOnContext } from './helpers/uploads.helper';

const storage = new CloudinaryStorage({
   cloudinary,
   params: async (req, file) => { // Add file parameter here
      try {
         const { context } = req.query;

         const { valid, errors, data: verifiedData } = await validatePayload(req.query, filePayloadValidator);

         if (!valid) {
            throw new ApiError(400, 'err', errors);
         }

         const { tags, folderName } = getFolderAndTagNameBasedOnContext(context as ContextType, verifiedData);

         const ext = file.originalname.split('.').pop()?.toLowerCase() || '';
         let publicId = `${uuidv4()}`; // Include extension in public_id

         // Determine resource type
         let resourceType: 'auto' | 'image' | 'video' | 'raw' = 'auto';
         const documentFormats = ['docx', 'doc', 'txt', 'pdf', 'xlsx', 'ppt', 'zip'];

         if (documentFormats.includes(ext)) {
            resourceType = 'raw';
         }

         if (resourceType === 'raw') {
            publicId += `.${ext}`
         }


         return {
            folder: `uploads${folderName}`,
            // allowed_formats: [
            //    'jpg', 'png', 'jpeg', 'gif', 'ico', 'svg',
            //    'mp4', 'avi', 'mov', 'mkv', 'webm',
            //    'webp', 'pdf', 'avif', 'docx', 'doc' // Add document formats
            // ],
            resource_type: resourceType,
            public_id: publicId,
            tags: tags,
            flags: documentFormats.includes(ext) ? 'attachment' : undefined
         };

      } catch (error) {
         console.error('Error during Multer storage setup:', error);
         throw error;
      }
   },
});

const upload = multer({
   storage,
   limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
   },
});

export { upload };