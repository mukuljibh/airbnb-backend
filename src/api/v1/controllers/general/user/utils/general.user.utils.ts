import { Response } from 'express';
import { generateExpTime } from '../../../../utils/date-helper/dates.utils';
import { ExpirationProps } from '../../../../utils/date-helper/dates.types';
import { Property } from '../../../../models/property/property';
import { PipelineStage } from 'mongoose';
import { User } from '../../../../models/user/user';
import { UserMinimalDetailType } from '../../../../utils/aggregation-pipelines/agregation.utils';

export function generateNormalCookies<T>(
   res: Response,
   sessionName: string,
   payload: T,
   exp: ExpirationProps,
   flag?: boolean,
): void {
   // Create JWT token with expiration in seconds
   const expirationDuration = generateExpTime(exp);
   res.cookie(sessionName, payload, {
      expires: expirationDuration,
      httpOnly: flag || true,
      secure: process.env.ENVIRONMENT === 'PROD',
      sameSite: process.env.ENVIRONMENT === 'PROD' ? 'none' : 'lax',
   });
}

export type sortFieldType = 'createdAt' | 'pricePerNight' | 'title' | 'address';

export async function createPropertyDraftQuery(
   query: { searchTerm: string; sortField: sortFieldType; sortOrder: string },
   user: UserMinimalDetailType,
   pagesAttr,
   visibility?: 'draft' | 'published',
   status?: 'active' | 'inactive',
   verificationStatus?: 'verified' | 'rejected' | 'required_action',
) {
   const { searchTerm, sortField, sortOrder } = query;
   const dbUser = await User.findById(user._id);
   const sortDirection = sortOrder === 'desc' ? -1 : 1;
   const isUserAdmin = user.role.includes('admin');
   const filter: Record<string, unknown> = {};

   if (!isUserAdmin) {
      filter.hostId = dbUser._id;
      if (verificationStatus) {
         filter['verification.status'] = verificationStatus;
      }
   }

   // filter.visibility = 'draft';
   if (visibility) filter.visibility = visibility;
   if (isUserAdmin) {
      if (verificationStatus) {
         filter['verification.status'] = verificationStatus;
      } else {
         filter['verification.status'] = {
            $in: ['pending', 'required_action', 'rejected', 'verified'],
         };
      }
   }
   if (status !== null && status !== undefined) filter.status = status;
   if (searchTerm && searchTerm.trim() !== '') {
      filter.$or = [
         { title: { $regex: searchTerm, $options: 'i' } },
         { 'address.country': { $regex: searchTerm, $options: 'i' } },
         { 'address.state': { $regex: searchTerm, $options: 'i' } },
         { 'address.city': { $regex: searchTerm, $options: 'i' } },
         { 'address.pincode': { $regex: searchTerm, $options: 'i' } },
      ];
   }
   const aggregationPipeline: PipelineStage[] = [
      { $match: filter },
      {
         $lookup: {
            from: 'prices',
            localField: 'price',
            foreignField: '_id',
            as: 'priceData',
         },
      },
      { $unwind: { path: '$priceData', preserveNullAndEmptyArrays: true } },
      {
         $lookup: {
            from: 'users',
            localField: 'hostId',
            foreignField: '_id',
            as: 'hostData',
         },
      },
      { $unwind: { path: '$hostData', preserveNullAndEmptyArrays: true } },
   ];
   aggregationPipeline.push({
      $project: {
         title: 1,
         thumbnail: 1,
         visibility: 1,
         hostId: isUserAdmin ? '$hostData._id' : undefined,
         updatedAt: 1,
         createdAt: 1,
         pricePerNight: '$priceData.basePrice.amount',
         status: 1,
         location: 1,
         isBookable: 1,
         verification: 1,
         'user.email': '$hostData.email',
         'user.firstName': '$hostData.firstName',
         'user.lastName': '$hostData.lastName',
         'user.address': '$hostData.address',
         'user.profilePicture': '$hostData.profilePicture',
      },
   });
   if (sortField === 'address') {
      aggregationPipeline.push({
         $addFields: {
            addressFirstChar: {
               $toLower: { $substrCP: ['$location.address', 0, 1] },
            },
         },
      });
      aggregationPipeline.push({ $sort: { addressFirstChar: sortDirection } });
   } else if (sortField === 'title') {
      aggregationPipeline.push({
         $addFields: {
            titleFirstChar: {
               $toLower: { $substrCP: ['$title', 0, 1] },
            },
         },
      });
      aggregationPipeline.push({ $sort: { titleFirstChar: sortDirection } });
   } else if (sortField == 'pricePerNight') {
      aggregationPipeline.push({ $sort: { pricePerNight: sortDirection } });
   } else if (sortField == 'createdAt') {
      aggregationPipeline.push({ $sort: { createdAt: sortDirection } });
   } else {
      aggregationPipeline.push({ $sort: { createdAt: -1, updatedAt: -1 } });
   }
   aggregationPipeline.push(
      { $skip: pagesAttr.startIndex },
      { $limit: pagesAttr.limit },
   );

   const property = await Property.aggregate(aggregationPipeline);
   const totalCount = await Property.countDocuments(filter);

   return {
      totalCount,
      property,
   };
}
