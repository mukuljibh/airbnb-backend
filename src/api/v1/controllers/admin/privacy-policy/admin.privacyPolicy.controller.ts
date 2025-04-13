import { Request, Response, NextFunction } from 'express';
import { PrivacyPolicy } from '../../../models/policies/PrivacyPolicy';
import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import { validateObjectId } from '../../../utils/mongo-helper/mongo.utils';

export async function postPrivacyPolicies(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const { title, type, body } = req.body;

      await PrivacyPolicy.findOneAndUpdate(
         { type },
         { body, title },
         { upsert: true, new: true },
      );
      res.status(201).json({ message: 'Privacy policy created successfully' });
   } catch (err) {
      console.log(err);
      next(err);
   }
}

export async function updatePolicyDetails(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const policyId = validateObjectId(req.params.policyId);
      const { title, type, body } = req.body;
      const privacyPolicy = await PrivacyPolicy.findOneAndUpdate(
         { _id: policyId },
         { title, type, body },
      );
      if (!privacyPolicy) {
         throw new ApiError(400, 'No policy found to update');
      }

      res.status(201).json({ message: 'Privacy policy created successfully' });
   } catch (err) {
      console.log(err);
      next(err);
   }
}

export async function getPrivacyPolicies(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const { type } = req.query;
      let policy;
      if (
         ![
            'privacyPolicy',
            'termsConditions',
            'refundPolicy',
            'bookingCancellationPolicy',
            'all',
         ].includes(type as string)
      ) {
         {
            throw new ApiError(
               400,
               `type must be one 'privacyPolicy',
            'termsConditions',
            'refundPolicy',
            'bookingCancellationPolicy'`,
            );
         }
      }
      if (type == 'all') {
         policy = await PrivacyPolicy.find();
      } else {
         policy = await PrivacyPolicy.findOne({ type });
      }

      res.status(201).json(
         new ApiResponse(200, 'policies fetched successfully', policy),
      );
   } catch (err) {
      next(err);
   }
}
