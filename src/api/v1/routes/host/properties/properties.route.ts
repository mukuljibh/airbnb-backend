import express from 'express';
import * as generalPropertyController from '../../../controllers/general/properties/properties.controller';
import * as dailyPriceController from '../../../controllers/general/properties/dailyprice.controller';

import createPages from '../../../middleware/pagination/pagination.middleware';
import * as commonPropertyMetaController from '../../../controllers/common/property/property.controller';
import { propertyPriceValidation } from '../../../validation/general/property/general.properties.validation';
import verifyRoutesAndAuthorizedRoles from '../../../middleware/authorization/verifyRoutesAndAuthorizedRoles';
import * as blockDatestController from '../../../controllers/general/properties/blockdates.controller'
const router = express.Router();

/* 
|--------------------------------------------------------------------------
| Property Metadata Routes
|--------------------------------------------------------------------------
| These routes provide metadata about properties, such as available amenities
| and property categories.
*/
router.get('/amenities', commonPropertyMetaController.getAllAmenitiesGroupByTag);
router.get(
   '/categories',
   commonPropertyMetaController.getCategories
);

/*
|--------------------------------------------------------------------------
| Property-Specific Operations
|--------------------------------------------------------------------------
| These routes handle operations on a single property, such as retrieving its 
| pricing, reviews, and full details.
*/

router.get(
   '/:propertyId/reviews',
   createPages,
   generalPropertyController.getPropertiesReviewsById,
);

router.post('/:propertyId/daily-prices', verifyRoutesAndAuthorizedRoles('host'), dailyPriceController.postPropertyDailyPrice)

router.patch('/:propertyId/daily-prices/:dailyPriceId', verifyRoutesAndAuthorizedRoles('host'), dailyPriceController.updatePropertyDailyPrice);

router.delete('/:propertyId/daily-prices/:dailyPriceId', verifyRoutesAndAuthorizedRoles('host'), dailyPriceController.deletePropertyDailyPrice);


/* 

|--------------------------------------------------------------------------
| Block property dates
|--------------------------------------------------------------------------
*/

// Get all blocks (guest + self) for a property
router.get(
   '/:propertyId/block-availability',
   verifyRoutesAndAuthorizedRoles('host'),
   blockDatestController.getSelfAndGuestBlocksByPropertyId,
);

// Create new block (self-book property)
router.post(
   '/:propertyId/block-availability',
   verifyRoutesAndAuthorizedRoles('host'),
   blockDatestController.selfBookProperty,
);

// Update a specific block
router.patch(
   '/:propertyId/block-availability/:reservationId',
   verifyRoutesAndAuthorizedRoles('host'),
   blockDatestController.updateSelfBlockedDates,
);

// Delete (unblock) a specific block
router.delete(
   '/:propertyId/block-availability/:reservationId',
   verifyRoutesAndAuthorizedRoles('host'),
   blockDatestController.unblockSelfBlockedDates,
);


/* 

|--------------------------------------------------------------------------
| Get Full Property Details
|--------------------------------------------------------------------------
| This dynamic route must be placed at the bottom to prevent conflicts 
| with other routes that have a similar pattern.
*/

router.get(
   '/:propertyId/calculate-price',
   propertyPriceValidation,
   generalPropertyController.getPropertiesPricingById,
);
router.get(
   '/:id',
   generalPropertyController.getFullPropertyByIdForHostAndUser
);

export default router;
