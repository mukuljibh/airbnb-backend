export interface PropertyGallery {
   url: string;
   caption: string;
   isPrimary: boolean;
}

export interface Checkpoints {
   type:
      | 'checkpoint1'
      | 'checkpoint2'
      | 'checkpoint3'
      | 'checkpoint4'
      | 'checkpoint5';
   // Checkpoint1 properties
   propertyTitle: string;
   propertyType: string;
   propertyDescription: string;
   propertyCity: string;
   propertyCategoryId: string | null;
   propertyAddress: string;
   propertyState: string;
   propertyLandmark: string;
   propertyZipcode: string;
   propertyGallery: PropertyGallery[];
   propertyCountry: string;
   propertyAvailabilityDates: {
      startDate: string;
      endDate: string;
   };
   propertyPlaceType: 'any' | 'room' | 'entire-home';
   propertyCoordinates: {
      longitude: string;
      latitude: string;
   };
   // Checkpoint2 properties
   noOfBedroom?: number;
   noOfBathroom?: number;
   noOfBed?: number;
   maxGuest?: number;
   amenities?: string[];
   // Checkpoint3 properties
   pricePerNight: number;
   cleaningFees: number;
   weeklyRateDiscount: number;
   serviceFees: number;
   monthlyRateDiscount: number;
   capacity: number;
   // Checkpoint4 properties
   houseRule: string;
   cancellationPolicy: {
      type: 'flexible' | 'moderate' | 'strict' | 'non-refundable';
      description: string;
   };
   safetyAndProperty: string;
   checkIn: string;
   checkOut: string;
   // Checkpoint5 properties
   isPetAllowed?: boolean;
   isHaveSelfCheckin?: boolean;
   isHaveInstantBooking?: boolean;
   noteForGuest?: string;
   nearByAttractionNote?: string;
}

export type DraftReturnType = {
   title: string;
   address: string;
   pricePerNight: number;
   status: 'active' | 'inactive' | 'draft';
};
