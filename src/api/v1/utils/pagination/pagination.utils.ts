import { IPaginationAttributes, PaginationProps } from './pagination.types';

export function formatPaginationResponse<T>(
   result: T,
   totalDocuments: number,
   pagination: IPaginationAttributes,
) {
   const { page, limit, startIndex, endIndex, } = pagination;
   const totalPages = Math.ceil(totalDocuments / limit);
   const paginationResult: PaginationProps = {
      totalPages,
      totalDocuments,
      current: { page, limit },
   };

   if (startIndex >= totalDocuments) {
      return {
         pagination: paginationResult,
         result: [],
      };
   }

   if (startIndex > 0) {
      paginationResult.prev = { page: page - 1, limit };
   }
   if (endIndex < totalDocuments) {
      paginationResult.next = { page: page + 1, limit };
   }
   paginationResult.totalPages = totalPages;
   paginationResult.totalDocuments = totalDocuments;
   return {
      pagination: paginationResult,
      result: result,
   };
}
