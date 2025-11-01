import mongoose from 'mongoose';

export function omit<T>(obj: T, ...props) {
   const result = { ...obj };
   props.forEach(function (prop) {
      delete result[prop];
   });
   return result;
}

export function pick<T>(obj: T, ...props) {
   return props.reduce(function (result, prop) {
      result[prop] = obj[prop];
      return result;
   }, {});
}

export function deepFilterObject(obj) {
   if (!obj || typeof obj !== 'object' || mongoose.isValidObjectId(obj))
      return obj;

   // Handling arrays
   if (Array.isArray(obj)) {
      return obj
         .map((item) => deepFilterObject(item))
         .filter(
            (item) =>
               item !== undefined &&
               item !== '' &&
               !(typeof item === 'object' && Object.keys(item).length === 0),
         );
   }

   // Process object recursively
   return Object.entries(obj).reduce((result, [key, value]) => {
      // Skiping undefined and empty string values
      if (
         value === undefined ||
         (typeof value == 'string' && value.trim() === '')
      ) {
         return result;
      }
      // recursive process nested objects and arrays
      if (typeof value === 'object' && value !== null) {
         const filteredValue = deepFilterObject(value);

         // Only add the property if the filtered result isn't empty
         if (Object.keys(filteredValue).length > 0) {
            result[key] = filteredValue;
         }
      } else {
         // Add non-object values directly in the accumulated result
         result[key] = value;
      }

      return result;
   }, {});
}

export function makeFirstLetterUpperCase(sentence: string) {
   const sentenceArray = sentence.split(' ');

   return sentenceArray.reduce((acc, item) => {
      return `${acc}${item.charAt(0).toUpperCase() + item.slice(1)} `;
   }, '');
}
