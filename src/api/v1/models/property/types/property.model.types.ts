import { Document, Types } from 'mongoose';
import { IPricing } from '../../price/types/price.model.type';
import { ICheckPoint } from '../../user/draft/draft';

interface IVerificationDocument {
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

// Define the verification structure
interface IVerification {
   status: 'open' | 'pending' | 'verified' | 'rejected' | 'required_action';
   reason?: string;
   documents: IVerificationDocument[];
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
   gallery: { url: string; caption: string; isPrimary: boolean }[];
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

   status: 'active' | 'inactive';
   amenities: Types.ObjectId[];
   availability: Types.ObjectId;
   totalLikes?: number;
   location: {
      regionId?: string;
      address?: string;
      city?: string;
      zipCode?: string;
      country?: string;
      state?: string;
      landmark?: string;
      coordinates: {
         latitude: number;
         longitude: number;
      };
   };
   createdAt: Date;
   updatedAt: Date;
   updateAvgRating(): Promise<void>;
   checkAvailableDate(checkIn: Date, checkOut: Date): Promise<boolean>;
}
