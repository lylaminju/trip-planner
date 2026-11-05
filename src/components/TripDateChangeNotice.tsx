export function TripDateChangeNotice(props: {
  id: string;
  error: string | null;
  isChecking?: boolean;
  willShift?: boolean;
  onRetry?: () => void;
}) {
  const message =
    props.error ??
    (props.isChecking
      ? "Checking your itinerary…"
      : props.willShift
        ? "Your itinerary will move with the trip, keeping its day numbers and visit times."
        : null);

  if (!message) return null;

  return (
    <p
      id={props.id}
      className={
        props.error
          ? "error-text trip-create-date-limit"
          : "trip-create-field-note"
      }
      role={props.error ? "alert" : "status"}
    >
      {message}
      {props.onRetry && (
        <>
          {" "}
          <button type="button" onClick={props.onRetry}>
            Retry
          </button>
        </>
      )}
    </p>
  );
}
