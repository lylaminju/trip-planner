export type TripFormState = {
  name: string;
  destination: string;
  destinationSlug: string | null;
  destinationLatitude: number | null;
  destinationLongitude: number | null;
  destinationCountryCodes: string[] | null;
  destinationPhotoData: string | null;
  destinationPhotoAttribution: string | null;
  startDate: string;
  endDate: string;
};
