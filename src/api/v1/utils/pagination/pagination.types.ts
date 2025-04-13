export interface IPaginationAttributes {
   startIndex: number;
   endIndex: number;
   page: number;
   limit: number;
}

type page = {
   page: number;
   limit: number;
};

export type PaginationProps = {
   prev?: page;
   next?: page;
   totalPages: number;
   totalDocuments: number;
};
