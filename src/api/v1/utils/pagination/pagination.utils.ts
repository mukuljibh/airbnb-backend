import { IPaginationAttributes, PaginationProps } from './pagination.types';

export function formatPaginationResponse<T>(
   result: T,
   totalDocuments: number,
   pagination: IPaginationAttributes,
) {
   const { page, limit } = pagination;
   const totalPages = Math.ceil(totalDocuments / limit);

   if ((page - 1) * limit >= totalDocuments) {
      return {
         pagination: { totalPages, totalDocuments },
         result: [],
      };
   }

   const paginationResult: PaginationProps = {
      totalPages,
      totalDocuments,
   };
   if (pagination.startIndex > 0) {
      paginationResult.prev = { page: page - 1, limit };
   }
   if (pagination.endIndex < totalDocuments) {
      paginationResult.next = { page: page + 1, limit };
   }
   paginationResult.totalPages = totalPages;
   paginationResult.totalDocuments = totalDocuments;
   return {
      pagination: paginationResult,
      result: result,
   };
}
