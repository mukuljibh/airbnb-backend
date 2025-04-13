import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import { ApiError } from '../../../utils/error-handlers/ApiError';

export const UploadMultiple = async (req, res, next) => {
   try {
      if (!req.files || req.files.length === 0) {
         throw new ApiError(400, 'Please provide files in multipart form-data');
      }
      const fileUrls = req.files.map((file) => file.path);
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

      res.status(200).json(
         new ApiResponse(200, 'file uploaded Successfully', {
            fileUrl: req.file.path,
         }),
      );
   } catch (err) {
      next(err);
   }
};
