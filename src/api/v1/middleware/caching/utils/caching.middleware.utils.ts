// import cache from '../../../config/cache';
// import crypto from 'crypto';
// import stringify from 'fast-json-stable-stringify';


// export function generateCacheKey(
//     language: string,
//     route: string,
//     method: string,
//     filters: object,
// ) {
//     const hash = crypto
//         .createHash('md5')
//         .update(stringify(filters))
//         .digest('hex');
//     return `${language}:${method}:${route}:${hash}`;
// }

// export function getCachedData(key: string) {
//     return cache.get(key) || null;
// }
// export function setCachedData(key, data) {
//     return cache.set(key, data) || null;
// }

// export function getCacheKey(
//     language: string,
//     route: string,
//     method: string,
//     filters: object,
// ) {
//     const hash = crypto
//         .createHash('md5')
//         .update(stringify(filters))
//         .digest('hex');
//     return `${language}:${method}:${route}:${hash}`;
// }

// export function deleteCachedByPrefix(prefix: string) {
//     let count = 0;
//     for (const key of cache.keys()) {
//       if (key.startsWith(prefix)) {
//         cache.delete(key);
//         count++;
//       }
//     }
//     return count;
//   }

