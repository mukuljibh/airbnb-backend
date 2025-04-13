import _ from 'lodash';
import mongoose from 'mongoose';
import { Price } from '../../../../models/price/price';
import { IProperty } from '../../../../models/property/types/property.model.types';
import { ISessionUser } from '../../../../models/user/types/user.model.types';
import { Request } from 'express';
import {
   IPropertyRules,
   PropertyRules,
} from '../../../../models/property/propertyRules';
import { IPricing } from '../../../../models/price/types/price.model.type';
import { ApiError } from '../../../../utils/error-handlers/ApiError';
import { deepFilterObject } from '../../../../utils/mutation/mutation.utils';
export async function storeCheckpointData(
   draft: IProperty,
   stage: number,
   req: Request,
) {
   const user = req.user as ISessionUser;
   switch (stage) {
      case 1: {
         const {
            availabilityWindow,
            propertyCategoryId,
            propertyTitle,
            experienceTags,
            propertyType,
            propertyGallery,
            propertyPlaceType,
            propertyCity,
            propertyState,
            propertyAddress,
            propertyCountry,
            propertyLandmark,
            propertyZipcode,
            propertyCoordinates,
            propertyDescription,
         } = req.body;

         const updatedData = deepFilterObject({
            hostId: user._id,
            category: new mongoose.Types.ObjectId(propertyCategoryId as string),
            title: propertyTitle,
            propertyType,
            experienceTags: experienceTags,
            propertyPlaceType,
            availabilityWindow,
            details: {
               ...draft?.details,
               description: propertyDescription,
            },

            gallery: propertyGallery,
            location: {
               ...draft?.location,
               city: propertyCity,
               state: propertyState,
               address: propertyAddress,
               country: propertyCountry,
               landmark: propertyLandmark,
               zipCode: propertyZipcode,
               coordinates: propertyCoordinates,
            },
         });
         Object.assign(draft, updatedData);

         break;
      }
      case 2: {
         const { beds, bedRooms, bathRooms, maxGuest, amenities } = req.body;
         const updatedData = deepFilterObject({
            details: {
               ...draft?.details,
               beds,
               bedRooms,
               bathRooms,
            },
            capacity: {
               maxGuest,
            },
            amenities,
         });
         Object.assign(draft, updatedData);
         break;
      }
      case 3: {
         const {
            pricePerNight,
            cleaningFees,
            serviceFees,
            weeklyRateDiscount,
            monthlyRateDiscount,
         } = req.body;
         const priceData = deepFilterObject({
            basePrice: {
               amount: pricePerNight,
               currency: 'INR',
            },
            additionalFees: {
               cleaning: cleaningFees,
               service: serviceFees,
               tax: 18,
            },
            lengthDiscounts: [
               {
                  minNights: 7,
                  discount: weeklyRateDiscount,
               },
               {
                  minNights: 30,
                  discount: monthlyRateDiscount,
               },
            ],
         });
         const price = await Price.findOneAndUpdate(
            { _id: draft.price || new mongoose.Types.ObjectId() },
            { $set: priceData },
            { new: true, upsert: true },
         );
         if (!draft.price) draft.price = price._id;
         break;
      }
      case 4: {
         const rulesId = draft.propertyRules || new mongoose.Types.ObjectId();
         const propertyRules = await PropertyRules.findOneAndUpdate(
            { _id: rulesId },
            req.body,
            { upsert: true, new: true },
         );
         if (!draft.propertyRules) draft.propertyRules = propertyRules._id;
         break;
      }

      case 5: {
         if (!draft.propertyRules) {
            throw new ApiError(
               500,
               'Something went wrong no property rules id sets in stage 4',
            );
         }
         const { generalNote, nearByAttractionNote } = req.body;
         const partialData1 = _.omit(req.body, [
            'generalNote',
            'nearByAttractionNote',
         ]);
         const partialData2 = deepFilterObject({
            notes: {
               generalNote,
               nearByAttractionNote,
            },
         });
         const updateData = {
            ...partialData1,
            ...partialData2,
         };

         await PropertyRules.findOneAndUpdate(
            { _id: draft.propertyRules },
            updateData,
         );

         break;
      }

      case 6: {
         const { documents } = req.body;
         draft.verification.documents = documents;
         draft.verification.status = 'open';
         break;
      }
      default:
         console.log('Invalid stage.');
   }
   // ✅ Instead of modifying `draft` and saving it, update the DB directly
   // await Property.findOneAndUpdate(
   //    { _id: draft._id },
   //    { $set: updatedData },
   //    { new: true },
   // );
}

export async function generateDraftOrPropertyCheckpoints(
   property: IProperty,
   price: IPricing,
   rules: IPropertyRules,
) {
   const checkPoints = [
      {
         data: {
            stage: 1,
            propertyTitle: property?.title,
            propertyType: property?.propertyType,
            propertyCategoryId: property?.category,
            propertyDescription: property?.details?.description,
            experienceTags: property.experienceTags,
            propertyCountry: property?.location?.country,
            propertyState: property?.location?.state,
            propertyCity: property?.location?.city,
            propertyLandmark: property?.location?.landmark,
            propertyAddress: property?.location?.address,
            propertyZipcode: property?.location?.zipCode,
            propertyCoordinates: property?.location?.coordinates,
            propertyGallery: property?.gallery,
            propertyPlaceType: property?.propertyPlaceType,
            availabilityWindow: property?.availabilityWindow,
         },
      },
      {
         data: {
            stage: 2,
            ..._.pick(property.details, ['beds', 'bathRooms', 'bedRooms']),
            maxGuest: property?.capacity?.maxGuest,
            amenities: property?.amenities,
         },
      },

      {
         data: {
            stage: 3,
            pricePerNight: price?.basePrice?.amount,
            cleaningFees: price?.additionalFees?.cleaning,
            serviceFees: price?.additionalFees?.service,
            weeklyRateDiscount: price?.lengthDiscounts?.[0]?.discount,
            monthlyRateDiscount: price?.lengthDiscounts?.[1]?.discount,
         },
      },
      {
         data: {
            stage: 4,
            ..._.pick(rules, [
               'housingRules',
               'safetyAndProperty',
               'cancellationPolicy',
               'checkInTime',
               'checkOutTime',
            ]),
         },
      },
      {
         data: {
            stage: 5,
            ..._.pick(rules, [
               'isPetAllowed',
               'isHaveSelfCheckin',
               'isHaveInstantBooking',
            ]),
            ...rules?.notes,
         },
      },
      {
         data: {
            stage: 6,
            ...property.verification,
         },
      },
   ];
   return checkPoints;
}
