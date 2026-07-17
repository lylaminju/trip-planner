export type TripFormState = {
  name: string;
  destination: string;
  destinationSlug: string | null;
  destinationLatitude: number | null;
  destinationLongitude: number | null;
  startDate: string;
  endDate: string;
};
