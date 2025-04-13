import express from 'express';
import * as generalPropertyController from '../../../controllers/general/properties/general.properties.controller';
import createPages from '../../../middleware/pagination/createPages';
import * as commonPropertyMetaController from '../../../controllers/common/propertyMeta/common.property.meta.controller';
import * as commonPropertyController from '../../../controllers/common/property/common.property.controller';
import { propertyPriceValidation } from '../../../validation/general/property/general.properties.validation';

const router = express.Router();

/* 
|--------------------------------------------------------------------------
| Property Metadata Routes
|--------------------------------------------------------------------------
| These routes provide metadata about properties, such as available amenities
| and property categories.
*/
router.get('/amenities', commonPropertyMetaController.getAllAmenities);
router.get('/categories', commonPropertyMetaController.getCategories);

/* 
|--------------------------------------------------------------------------
| Property Search & Discovery Routes
|--------------------------------------------------------------------------
| These routes handle property searches, filtering, and exploration.
*/
router.get('/search', generalPropertyController.propertySearch);
router.get(
   '/filter-property',
   createPages,
   generalPropertyController.getFilterProperties,
);
router.get('/explore-stays', generalPropertyController.getExploreStays);
router.get(
   '/trending-stays',
   generalPropertyController.getTrendingStaysThisWeek,
);

router.get('/recommended-stays', generalPropertyController.getRecommendedStays);

/* 
|--------------------------------------------------------------------------
| Property-Specific Operations
|--------------------------------------------------------------------------
| These routes handle operations on a single property, such as retrieving its 
| pricing, reviews, and full details.
*/
router.get(
   '/:propertyId/calculate-price',
   propertyPriceValidation,
   generalPropertyController.getPropertiesPricingById,
);
router.get(
   '/:propertyId/reviews',
   createPages,
   generalPropertyController.getPropertiesReviewsById,
);

/* 
|--------------------------------------------------------------------------
| Get Full Property Details
|--------------------------------------------------------------------------
| This dynamic route must be placed at the bottom to prevent conflicts 
| with other routes that have a similar pattern.
*/
router.get('/:id', commonPropertyController.getFullPropertyById);

export default router;
