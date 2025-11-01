import { ClientSession, Document, Types } from 'mongoose';
import { IPricing } from '../../price/types/price.model.type';
import { ICheckPoint } from '../../user/draft/draft';
import mongoose from 'mongoose';
import { PROPERTY_STATUS, VERIFICATION_STATUS } from '../propertyAttributes/propertyAttributes';

export interface IVerificationDocument {
   publicId: string;
   documentType:
   | 'rental agreement'
   | 'land registry document'
   | 'electricity bill'
   | 'water bill'
   | 'property tax receipt'
   | 'property deed'
   | 'gas bill';
   documentUrl: string;
}

interface IGallery {
   publicId: string,
   url: string; caption: string;
   isPrimary: boolean
}

interface ILocation {
   regionId?: string;
   address?: string;
   city?: string;
   zipCode?: string;
   country?: string;
   state?: string;
   landmark?: string;
   coordinates?: {
      latitude: number;
      longitude: number;
   };
   locationGeo: GeoJSONPoint
};
// Define the verification structure
interface IVerification {
   status: 'open' | 'pending' | 'verified' | 'rejected' | 'required_action';
   lastStatus: 'open' | 'pending' | 'verified' | 'rejected' | 'required_action';
   reason?: string;
   documents: IVerificationDocument[];
}

interface IInactivatedBy {

   userId: mongoose.Types.ObjectId,
   role: "host" | "admin"
   reason: string,
   timestamp: Date

}

interface GeoJSONPoint {
   type: 'Point';
   coordinates: [number, number]; // [longitude, latitude]
}
export interface IProperty extends Document {
   _id: Types.ObjectId;
   hostId: Types.ObjectId;
   category: Types.ObjectId;
   title: string;
   price: IPricing | Types.ObjectId;
   avgRating: number;
   propertyRules: Types.ObjectId;
   thumbnail: string;
   propertyPlaceType: 'any' | 'room' | 'entire-room';
   propertyType:
   | 'hotel'
   | 'resort'
   | 'apartment'
   | 'house'
   | 'condo'
   | 'townhouse'
   | 'villa';
   name?: string;
   gallery: IGallery[];
   rating?: number;
   capacity: {
      maxGuest: number;
      adult?: number;
      child?: number;
   };
   isBookable: boolean;
   verification: IVerification;
   availabilityWindow: number;

   checkPoints: ICheckPoint[];
   visibility: 'draft' | 'published';
   isReady: boolean;
   details: {
      description?: string;
      beds?: number;
      bedRooms?: number;
      bathRooms?: number;
      lotSize?: number;
      type?: string;
      perks?: string[];
      Languages?: string;
   };
   draftStage: 1 | 2 | 3 | 4 | 5 | 6;
   isDraft: boolean;
   tags?: ('Superhost' | 'Popular' | 'Featured' | 'New')[];
   experienceTags?: [
      'beach' | 'culture' | 'ski' | 'family' | 'wellnessAndRelaxation',
   ];
   status: PropertyStatusType;
   statusMeta?: {
      previousStatus: PropertyStatusType,
      newStatus: PropertyStatusType
      changedBy: {
         userId: mongoose.Types.ObjectId,
         role: 'admin' | 'user' | 'system'
      }
      timestamp: Date,
      reason: string
   }[],

   amenities: Types.ObjectId[];
   availability: Types.ObjectId;
   recheckingDate: Date;
   inactivatedBy: IInactivatedBy;
   totalLikes?: number;
   location: ILocation;

   hasPendingSensitiveUpdates: boolean;

   deletionRequestedAt: Date,
   createdAt: Date;
   updatedAt: Date;
   deletedAt: Date;
   updateAvgRating(): Promise<void>;
   checkAvailableDate(checkIn: Date, checkOut: Date): Promise<boolean>;
   modifyStatus(
      status: PropertyStatusType,
      role: 'host' | 'admin',
      userId: mongoose.Types.ObjectId,
      reason: string,
   ): Promise<{
      hasOperationSuccess: false,
      status: 'active' | 'inactive'
   }>;
   markPropertyAsDeleted({ session }: { session: ClientSession }): Promise<boolean>
}


export interface IPropertyRules extends Document {
   _id: Types.ObjectId;
   housingRules?: string;
   cancellationPolicy?: {
      type: 'flexible' | 'moderate' | 'strict' | 'non-refundable';
      description?: string;
   };
   safetyAndProperty?: string;
   isHaveSelfCheckin?: boolean;
   isHaveInstantBooking?: boolean;
   isPetAllowed: boolean;
   notes?: {
      generalNote?: string;
      nearByAttractionNote?: string;
   };
   checkInTime: string;
   checkOutTime: string;
   safetyConsideration?: {
      category: string;
      details: string;
   }[];
}


type valueOf<T> = T[keyof T];

type VerificationType = valueOf<typeof VERIFICATION_STATUS>;

export type PropertyStatusType = valueOf<typeof PROPERTY_STATUS>;

type IUpdateFieldsType = Array<'gallery' | 'location' | 'documents'>;

export type PropertyUpdateStatus = Exclude<VerificationType, 'open' | 'required_action'>;

export interface IPropertyPendingUpdates extends Document {

   propertyId: mongoose.Types.ObjectId;

   userId: mongoose.Types.ObjectId;

   gallery: IGallery[];

   location: ILocation;

   documents: [IVerificationDocument]

   status: PropertyUpdateStatus,

   rejectedReason: string

   verifiedAt: Date;

   rejectedAt: Date;

   requestAt: Date;

   hostRemark: string;
   rejectedFields: IUpdateFieldsType;

   adminRemark: string;

   isUserBannerDismissed: boolean,

   remark: string;

   changedFields: IUpdateFieldsType;
}

