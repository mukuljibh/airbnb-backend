import _ from 'lodash';
import translate from '../../config/translate';
import mongoose from 'mongoose';
import { emailRegix } from '../../constant/regex.constant';
const ignorePattern =
   /(id|code|status|visibility|type|currency|message)/i;
const isISODate = (str: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*Z$/.test(str);
const urlRegex = /https?:\/\/[^\s"]+/gi;


export function extractStrings(obj, strings, positions, path) {
   for (const key in obj) {
      const value = obj[key];
      if (
         ignorePattern.test(key) ||
         typeof value != 'string' && typeof value != "object" ||
         isISODate(value) ||
         urlRegex.test(value) ||
         emailRegix.test(value) ||
         mongoose.isValidObjectId(value)
      ) {
         continue;
      }
      const currentPath = [...path, key];

      if (typeof value === 'string') {
         strings.push(value);
         positions.push([currentPath.join('.')]);
      } else if (typeof value === 'object' && obj[key] !== null) {
         extractStrings(value, strings, positions, currentPath);
      }
   }
}

export function insertStringsBack(obj, translatedStrings, positions) {
   const result = JSON.parse(JSON.stringify(obj));

   translatedStrings.forEach((value, i) => {
      _.set(result, positions[i][0], value);
   });
   return result;
}

export async function convertLanguage(language: string, data) {
   const stringsToTranslate = [];
   const stringPositions = [];
   const deepCpyData = JSON.parse(JSON.stringify(data));
   extractStrings(deepCpyData, stringsToTranslate, stringPositions, []);
   const translationTextLength = stringsToTranslate.length

   if (stringsToTranslate.length === 0) {
      return { result: data, length: translationTextLength }
   }

   try {
      // data = structuredClone(data);
      // const [translation] = await translate.translate(
      //    stringsToTranslate,
      //    language,
      // );

      // const translationPromises = stringsToTranslate.map(sentence => {
      //    return fetch("http://localhost:5000/translate", {
      //       method: "POST",
      //       body: JSON.stringify({
      //          q: sentence,
      //          source: "en",
      //          target: "hi",
      //          format: "text",
      //          alternatives: 0
      //       }),
      //       headers: { "Content-Type": "application/json" }
      //    })
      //       .then(res => res.json())
      //       .then(res => res.translatedText) // Convert response to JSON
      // });
      // const translations = await Promise.all(translationPromises);
      console.log(stringsToTranslate);

      const translation = stringsToTranslate.map(() => {
         return 'TRANSLATED';
      });
      const result = insertStringsBack(deepCpyData, translation, stringPositions);

      return { result, length: translationTextLength }
   } catch (err) {
      console.error('Translation error:', err);
      return { result: data, length: translationTextLength }

   }
}
