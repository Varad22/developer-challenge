export interface Movie {
  id: number;
  title: string;
  year: number;
  addedBy: string;
  ratingCount: number;
  average: number;
  myRating: number;
}

export interface ChainEvent {
  name: "MovieAdded" | "MovieRated";
  data: Record<string, string>;
}
