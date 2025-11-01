// import { getCachedData, setCachedData, generateCacheKey } from './utils/caching.middleware.utils';
// import { convertLanguage } from '../../utils/translate/translate.utils';

// interface CacheOptions {
//    routePath?: string;
//    customCacheKey?: string;
//    enableCache?: boolean;
// }

// export function cacheableRoute(
//    handler,
//    options: CacheOptions = {}
// ) {
//    return async (req, res, next) => {
//       const { routePath, customCacheKey, enableCache = false } = options;

//       if (!enableCache) {
//          return handler(req, res, next);
//       }

//       let translationLength;
//       const filters = { ...req.query, ...req.params };

//       const language = req.headers?.language || 'hi';
//       const cacheKey =
//          customCacheKey ||
//          generateCacheKey(language, req.baseUrl, routePath, filters);

//       const cached = getCachedData(cacheKey);
//       if (cached) {
//          console.log('cache hit:', cacheKey);
//          return res.json(cached);
//       }

//       const originalJson = res.json.bind(res);
//       res.json = async (body) => {
//          let data = body;

//          if (language !== 'Eng') {
//             const { result, length } = await convertLanguage('hi', body);
//             data = result;
//             translationLength = length;
//             if (translationLength > 0) {
//                setCachedData(cacheKey, data);
//             } else {
//                console.log('cache miss (translation length 0)');
//             }
//          } else {
//             setCachedData(cacheKey, data);
//          }

//          return originalJson(data);
//       };

//       await handler(req, res, next);
//    };
// }
