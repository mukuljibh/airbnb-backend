import moment from 'moment-timezone';
import { ExpirationProps } from './dates.types';

export function generateExpTime(exp: ExpirationProps) {
   const matches = exp.match(/^(\d+)([a-zA-Z]+)$/);
   if (!matches) {
      throw new Error('Invalid expiration format');
   }
   const value = parseInt(matches[1], 10);
   const unit = matches[2];
   let expirationTimeInMs: number;
   if (unit === 's') {
      expirationTimeInMs = value * 1000;
   } else if (unit === 'm') {
      expirationTimeInMs = value * 60 * 1000;
   } else if (unit === 'h') {
      expirationTimeInMs = value * 60 * 60 * 1000;
   } else if (unit === 'd') {
      expirationTimeInMs = value * 24 * 60 * 60 * 1000;
   } else {
      throw new Error('Unsupported expiration unit');
   }

   const expirationDate = new Date(Date.now() + expirationTimeInMs);
   return expirationDate;
}

export function generateMilliSeconds(exp: ExpirationProps) {
   const matches = exp.match(/^(\d+)([a-zA-Z]+)$/);
   if (!matches) {
      throw new Error('Invalid expiration format');
   }
   const value = parseInt(matches[1], 10);
   const unit = matches[2];
   let ms: number;
   if (unit === 's') {
      ms = 1000;
   } else if (unit === 'm') {
      ms = value * 60 * 1000;
   } else if (unit === 'h') {
      ms = value * 60 * 60 * 1000;
   } else if (unit === 'd') {
      ms = value * 24 * 60 * 60 * 1000;
   } else {
      throw new Error('Unsupported expiration unit');
   }

   return ms;
}

export function convertDateInFutureInSecond(duration: ExpirationProps) {
   const timeUnits = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
   };

   const regex = /(\d+)([a-zA-Z]+)/;
   const match = duration.match(regex);

   if (match && timeUnits[match[2]]) {
      const value = parseInt(match[1], 10);
      const unit = match[2];
      return value * timeUnits[unit];
   } else {
      throw new Error('Invalid duration format');
   }
}
export function logISTTimeStamp(date?: Date) {
   const time = date ? moment(date) : moment();
   return time.tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
}


export const formatDateRange = (checkIn, checkOut, guestCount) => {
   const inDate = new Date(checkIn);
   const outDate = new Date(checkOut);
   const sameMonth = inDate.getMonth() === outDate.getMonth();
   const sameYear = inDate.getFullYear() === outDate.getFullYear();

   const optionsIn = { month: "long", day: "numeric" };
   const optionsOut = sameMonth && sameYear
      ? { day: "numeric" }
      : { month: "long", day: "numeric", year: "numeric" };

   const checkInFormatted = inDate.toLocaleDateString("en-US", optionsIn as unknown);
   const checkOutFormatted = outDate.toLocaleDateString("en-US", optionsOut as unknown);
   const year = outDate.getFullYear();
   const guestText = `${guestCount} guest${guestCount > 1 ? "s" : ""}`;

   return `${checkInFormatted} – ${checkOutFormatted}, ${year}, ${guestText}`;
};


export function formatDate(date: Date | string, showWeekday = false) {
   const formatString = showWeekday ? "ddd, MMM D, YYYY" : "MMM D, YYYY";
   return moment(date).format(formatString);
}


export function concatTwoDates(checkInDate: Date, checkOutDate: Date) {



   const checkInMoment = moment(checkInDate, "YYYY-MM-DD");
   const checkOutMoment = moment(checkOutDate, "YYYY-MM-DD");

   // Airbnb style: "Jun 9 – 14, 2024"
   const formattedDateRange = `${checkInMoment.format("MMM D")} – ${checkOutMoment.format("D, YYYY")}`;

   console.log(formattedDateRange);
   return formattedDateRange
}