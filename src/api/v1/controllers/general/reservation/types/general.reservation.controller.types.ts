import { IUser } from '../../../../models/user/types/user.model.types';
import { IProperty } from '../../../../models/property/types/property.model.types';
import { IReservation } from '../../../../models/reservation/types/reservation.model.types';
import { IPropertyRules } from '../../../../models/property/types/property.model.types';
import { DocumentType } from '@typegoose/typegoose';

export type TypePopulatedProperty = DocumentType<IProperty> & {
   propertyRules: IPropertyRules;
};

export type TypeRefundMeta = {
   user?: IUser;
   property?: TypePopulatedProperty;
   reservation?: IReservation;
   reason?: string;
   cancelledBy: string
   isInstantBooking: boolean;
};
