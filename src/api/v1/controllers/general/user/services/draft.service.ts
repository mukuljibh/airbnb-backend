import _ from 'lodash';
import mongoose from 'mongoose';
import { Price } from '../../../../models/price/price';
import { IProperty, IVerificationDocument } from '../../../../models/property/types/property.model.types';
import { IUser } from '../../../../models/user/types/user.model.types';

import {
   PropertyRules,
} from '../../../../models/property/propertyRules';
import { IPropertyRules } from '../../../../models/property/types/property.model.types';
import { IPricing } from '../../../../models/price/types/price.model.type';
import { ApiError } from '../../../../utils/error-handlers/ApiError';
import { deepFilterObject } from '../../../../utils/mutation/mutation.utils';
import { ClientSession } from 'mongoose';
import { getCountryCodeFromGoogleAPI } from '../../../../utils/currency/currency.utils';
import { syncAndDeleteFiles } from '../../../../../uploads/services/upload.service';


interface IDraftStoreCheckPoint {
   draft: IProperty,
   payload: any,
   session: ClientSession,
   userDetails: IUser

}
export async function storeCheckpointData(options: IDraftStoreCheckPoint) {

   const { draft, payload, session, userDetails } = options

   const { stage } = payload

   const { _id: userId } = userDetails

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
         } = payload;

         //delete files from cloudinary when old file does match with new file recieved from client.
         //return updated orginal structure 
         const updatedPropertyGallery = await syncAndDeleteFiles({ existingFiles: draft.gallery, incomingFiles: propertyGallery, session })

         const updatedData = deepFilterObject({
            hostId: userId,
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

            gallery: updatedPropertyGallery,
            location: {
               city: propertyCity ?? draft?.location?.city,
               state: propertyState ?? draft?.location?.state,
               address: propertyAddress ?? draft?.location?.address,
               country: propertyCountry ?? draft?.location?.country,
               landmark: propertyLandmark ?? draft?.location?.landmark,
               zipCode: propertyZipcode ?? draft?.location?.zipCode,
               coordinates: propertyCoordinates ?? draft?.location?.coordinates,
            }

         });

         if (draft.visibility == "draft") {
            const { propertyCountry } = payload
            const query = propertyCountry || draft?.location?.country
            const currencyCode = await getCountryCodeFromGoogleAPI(query)

            const priceId = draft?.price || new mongoose.Types.ObjectId()
            await Price.findOneAndUpdate(
               { _id: priceId },
               {
                  $set: {
                     "basePrice.currency": currencyCode,
                     propertyId: draft._id
                  }
               },
               { upsert: true },
            )
            draft.price = priceId
         }

         Object.assign(draft, updatedData);

         break;
      }
      case 2: {
         const { beds, bedRooms, bathRooms, maxGuest, amenities } = payload;
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
         } = payload

         const priceData = deepFilterObject({
            propertyId: draft._id,
            'basePrice.amount': pricePerNight,
            additionalFees: {
               cleaning: cleaningFees,
               service: serviceFees,
            },
            lengthDiscounts: [
               {
                  minNights: weeklyRateDiscount ? 7 : undefined,
                  discount: weeklyRateDiscount,
               },
               {
                  minNights: monthlyRateDiscount ? 30 : undefined,
                  discount: monthlyRateDiscount
               },
            ],
         })


         await Price.findOneAndUpdate(
            { _id: draft.price },
            { $set: priceData },
         ).session(session);

         break;
      }
      case 4: {
         const rulesId = draft.propertyRules || new mongoose.Types.ObjectId();
         const propertyRules = await PropertyRules.findOneAndUpdate(
            { _id: rulesId },
            payload,
            { upsert: true, new: true },
         ).session(session);
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
         const { generalNote, nearByAttractionNote } = payload;
         const partialData1 = _.omit(payload, [
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
         ).session(session);

         break;
      }

      case 6: {
         const { documents: incomingFiles } = payload;
         const existingFiles = draft?.verification?.documents

         const updatedDraftDoc = await syncAndDeleteFiles({ existingFiles, incomingFiles, session })

         draft.verification.documents = updatedDraftDoc as IVerificationDocument[];
         draft.verification.status = 'open';
         break;
      }
      default:
         console.log('Invalid stage.');
   }

}

export function generateDraftOrPropertyCheckpoints(
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
            currency: price?.basePrice?.currency,
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

