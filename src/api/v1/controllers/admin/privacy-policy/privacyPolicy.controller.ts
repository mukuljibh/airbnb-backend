import { Request, Response, NextFunction } from 'express';
import PrivacyPolicy from '../../../models/policies/PrivacyPolicy';
import { ApiResponse } from '../../../utils/error-handlers/ApiResponse';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import { validateObjectId } from '../../../utils/mongo-helper/mongo.utils';

export async function postPrivacyPolicies(
   req: Request,
   res: Response,
) {
   const { title, type, body } = req.body;

   const validTypes = [
      'privacyPolicy',
      'termsConditions',
      'refundPolicy',
      'bookingCancellationPolicy',
   ];

   if (!validTypes.includes(type)) {
      throw new ApiError(
         400,
         `Invalid type "${type}". Allowed types are: ${validTypes.join(', ')}.`
      );
   }

   const existingPolicy = await PrivacyPolicy.findOne({ type });
   if (existingPolicy) {
      throw new ApiError(
         400,
         `A policy with type "${type}" already exists. Please update the existing one instead of creating a new one.`
      );
   }

   await PrivacyPolicy.create({ body, title, type });

   return res.json(new ApiResponse(201, 'Policy created successfully'))

}


export async function updatePolicyDetails(
   req: Request,
   res: Response,
) {

   const policyId = validateObjectId(req.params.policyId);
   const { title, type, body } = req.body;
   const privacyPolicy = await PrivacyPolicy.findOneAndUpdate(
      { _id: policyId },
      { title, type, body },
   );
   if (!privacyPolicy) {
      throw new ApiError(404, 'No policy found to update');
   }
   return res.json(new ApiResponse(200, 'Privacy policy updated successfully'))

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
