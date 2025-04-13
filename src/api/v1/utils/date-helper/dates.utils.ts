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
