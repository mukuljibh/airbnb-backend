import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import UploadLogs from '../../../../uploads/models/uploadLogs';

export const UploadMultiple = async (req, res, next) => {

   try {
      if (!req.files || req.files.length === 0) {
         throw new ApiError(400, 'Please provide files in multipart form-data');
      }

      let docs = []
      const fileUrls = req.files.map((file) => {
         const url = file.path
         docs.push({ url })
         return url
      });

      await UploadLogs.create(docs)

      return res.status(200).json(
         new ApiResponse(200, 'Files uploaded successfully', {
            fileUrls: fileUrls,
         }),
      );
   } catch (err) {
      next(err);
   }
};
export const UploadSingle = async (req, res, next) => {
   try {
      if (!req.file) {
         throw new ApiError(
            400,
            'Please provide only single file in multipart form-data',
         );
      }
      await UploadLogs.create({ url: req.file.path })

      res.status(200).json(
         new ApiResponse(200, 'file uploaded Successfully', {
            fileUrl: req.file.path,
         }),
      );
   } catch (err) {
      next(err);
   }
};
