import { NextFunction, Request, Response } from 'express';
import { ISessionUser } from '../../../models/user/types/user.model.types';
import { User } from '../../../models/user/user';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';

export async function updateUserAccountProfile(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const { profilePicture, firstName, lastName } = req.body;
   const sessionUser = req.user as ISessionUser;

   try {
      if (!firstName || !lastName || !profilePicture) {
         throw new ApiError(
            400,
            'First name, last name, and profile picture are required.',
         );
      }

      const adminUser = await User.findByIdAndUpdate(sessionUser._id, {
         firstName,
         lastName,
         profilePicture,
      });
      if (!adminUser) {
         throw new ApiError(502, 'something goes wrong');
      }
      res.status(200).json(
         new ApiResponse(200, 'Profile updated successfully'),
      );
   } catch (err) {
      next(err);
   }
}
