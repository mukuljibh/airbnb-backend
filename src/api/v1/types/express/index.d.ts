// types/express/index.d.ts
import { Currencies } from 'country-to-currency';
import { IPaginationAttributes } from '../../utils/pagination/pagination.types';
import 'express';
import { SessionRequestOrigin, SessionUserOptions } from '../../utils/cookies/cookies.utils';
import { ISessionUser } from '../../models/user/types/user.model.types';
import { DeviceType, Role } from '../session/session';
import { PassportSession } from '../session/session';

export interface IRealTimeSessionOptions {
    hasSession: boolean
    requestOrigin: SessionRequestOrigin | null,
    role: Role | null,
    isForged: boolean,
    needsRefresh: boolean,
    deviceType: DeviceType,
    cookieScope: string,
}
declare module 'express-serve-static-core' {
    interface Locals {
        pagination?: IPaginationAttributes
        sort?: SortOptions
        search?: SearchOptions;
        currency: Lowercase<Currencies>
        language?: string
        locale?: string,
        sessionOptions: SessionUserOptions & IRealTimeSessionOptions
    }
    interface Request {
        user?: ISessionUser,

    }
}

/* eslint-disable @typescript-eslint/no-empty-object-type */
declare module "express-session" {
    interface SessionData extends PassportSession { }
}

export interface SortOptions {
    sortField: string;
    sortOrder: 'asc' | 'desc';
    sortDirection: 1 | -1;
}

export interface SearchOptions {
    searchTerm: string;
}
export type SearchSortOptions = SortOptions & SearchOptions