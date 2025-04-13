import mongoose, { Document } from 'mongoose';
import { BillingProps } from '../../reservation/billing';

interface ISeasonalRate {
   name: string; // e.g., "Summer", "Winter", "Peak", "Off-peak"
   startDate?: Date;
   endDate?: Date;
   multiplier: number; // e.g., 1.5 for 50% increase
}

interface ILengthDiscount {
   minNights: number;
   discount: number; // Percentage discount
}

interface IEarlyBirdDiscount {
   daysInAdvance: number;
   discount: number; // Percentage discount
}

interface ILastMinuteDiscount {
   withinDays: number;
   discount: number; // Percentage discount
}

interface IAdditionalFees {
   cleaning: number;
   service: number;
   tax: number; // Percentage
}

interface ISpecialDate {
   date: Date;
   multiplier: number;
   description: string;
}

interface ICapacity {
   adult: {
      base: number;
      max: number;
   };
   child: {
      base: number;
      max: number;
   };
}
type FeeType = 'fixed' | 'percentage' | 'per_person';

interface ICapacityRules {
   adult: {
      type: FeeType;
      limit: number;
      value: number;
   };
   child: {
      type: FeeType;
      limit: number;
      value: number;
   };
}
interface IPrice {
   amount: number;
   currency: 'INR' | 'USD' | 'GBP' | 'EUR';
}
export interface IBilling {
   numberOfNights: number;
   pricePerNight: number;
   totalbasePrice: number;
   discounts: number;
   priceAfterDiscounts: number;
   additionalFees: { cleaning: number; service: number; tax: number };
   totalPrice: number;
   currency: string;
   selectedDates: {
      checkIn: Date;
      checkOut: Date;
   };
   guest: {
      child: number;
      adult: number;
   };
}
export interface IPricing extends Document {
   _id: mongoose.Types.ObjectId;
   propertyId: mongoose.Types.ObjectId;
   basePrice: IPrice;
   old_price: IPrice;
   capacity: ICapacity;
   capacityFeesRules: ICapacityRules;
   seasonalRates: ISeasonalRate[];
   lengthDiscounts: ILengthDiscount[];
   earlyBirdDiscount: IEarlyBirdDiscount;
   lastMinuteDiscount: ILastMinuteDiscount;
   additionalFees: IAdditionalFees;
   specialDates: ISpecialDate[];
   weekendMultiplier: number;
   calculateBasePprice(checkIn: Date, checkOut: Date): number;
   calculateDiscount(basePrice: number, numberOfNights: number): number;
   calculateTotalPrice(
      checkIn: Date | string,
      checkOut: Date | string,
      childCount: number | 0,
      adultCount: number | 1,
      userId?: string,
      promoCode?: string,
   ): Promise<BillingProps>;
}
