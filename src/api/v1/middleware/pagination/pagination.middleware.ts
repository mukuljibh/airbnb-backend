import { Request, Response, NextFunction } from 'express';

export default function parseQueryOptions(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const page = parseInt(req.query?.page as string) || 1;
   const limit = parseInt(req.query?.limit as string) || 10;
   const startIndex = (page - 1) * limit;
   const endIndex = page * limit;

   res.locals.pagination = { startIndex, endIndex, page, limit };


   const searchTerm = (req.query?.searchTerm as string) || '';
   const sortField = (req.query?.sortField as string) || 'createdAt';
   const sortOrder = req.query?.sortOrder === 'desc' ? 'desc' : 'asc';
   const sortDirection = sortOrder === 'desc' ? -1 : 1;

   res.locals.sort = {
      sortField,
      sortOrder,
      sortDirection,
   }
   res.locals.search = {
      searchTerm
   }


   next();
}
