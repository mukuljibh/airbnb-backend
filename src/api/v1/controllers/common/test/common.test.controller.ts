import { NextFunction, Response, Request } from 'express';
import { Property } from '../../../models/property/property';

export async function changePropertyMetaValues(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   try {
      const properties = await Property.find({});
      const uniquePremiumPropertyNames = [
         'Zephyrcrest Haven',
         'Luminara Summit Estate',
         'Astralis Retreat',
         'Obsidian Mirage Villa',
         'Ethereon Sky Manor',
         'Arcadia Zenith',
         'Solstice Ember Chateau',
         'Vellichor Ridge Escape',
         'Halcyon Tide Sanctuary',
         'Celestara Grand Pavilion',
         'Echelon Nebula',
         'Aetherhaven Serenity Lodge',
         'Prism Cove Oasis',
         'Moonveil Lux Retreat',
         'Polaris Ascend Villa',
         'Zenora Horizon Estate',
         'Sablecrest Ocean Manor',
         'Veridien Mirage Cliffside',
         'Aureus Pinnacle',
         'Orinthia Twilight Haven',
         'Nocturne Pearl Residence',
         'Mythos Aether Abode',
         'Lucent Ember Waterfront',
         'Eldoria Sky Loft',
         'Astridora Golden Heights',
         'Solaris Crest Estate',
         'Serephine Starlit Manor',
         'Drakonis Summit',
         'Nebuluxe Opal Sanctuary',
         'Velaris Moonbay Retreat',
         'Lyricon Chateau',
         'Eonspire Grand Hideaway',
         'Azura Solace Estate',
         'Eldwyn Horizon Pavilion',
         'Mystralis Ocean Mirage',
         'Zenithus Regal Manor',
         'Calidora Twilight Escape',
         'Aeloria Luxe Cove',
         'Eclipsis Emerald Ridge',
         'Ardent Sky Villa',
         'Harmonia Sapphire Bay',
         'Obscura Starlight Loft',
         'Astralis Radiance Lodge',
         'Onyx Seraph Retreat',
         'Ivoryspire Summit Hideaway',
         'Vespera Goldcrest Estate',
         'Nova Haven Chateau',
         'Etherealis Midnight Cove',
         'Ambrosia Horizon Manor',
      ];

      const bulkUpdates = properties.map((property, index) => ({
         updateOne: {
            filter: { _id: property._id },
            update: { $set: { title: uniquePremiumPropertyNames[index] } },
         },
      }));

      await Property.bulkWrite(bulkUpdates);
      res.status(200).json('data exported');
   } catch (err) {
      next(err);
   }
}
