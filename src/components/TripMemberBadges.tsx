import { DEFAULT_PROFILE_COLOR } from "@/lib/profile-colors";
import type { TripMemberSummary } from "@/lib/types";

const FALLBACK_MEMBER_NAME = "Traveler";

export type TripMemberBadgeSize = "lg" | "md" | "sm";

export function TripMemberBadges(props: {
  members: TripMemberSummary[];
  currentUserId: string;
  size: TripMemberBadgeSize;
  maxVisible: number;
}) {
  const otherMembers = props.members.filter(
    (member) => member.user_id !== props.currentUserId,
  );
  if (otherMembers.length === 0) {
    return null;
  }

  const visibleMembers = otherMembers.slice(0, props.maxVisible);
  const overflowCount = otherMembers.length - visibleMembers.length;
  const label = sharedWithLabel(otherMembers, props.maxVisible);

  return (
    <span
      className={`trip-member-badges trip-member-badges-${props.size}`}
      role="img"
      title={label}
      aria-label={label}
    >
      {visibleMembers.map((member) => (
        <span
          key={member.user_id}
          className="trip-member-badge"
          aria-hidden="true"
          style={{
            background: member.profile_color ?? DEFAULT_PROFILE_COLOR,
          }}
        >
          {memberDisplayName(member).slice(0, 1).toUpperCase()}
        </span>
      ))}
      {overflowCount > 0 && (
        <span
          className="trip-member-badge trip-member-badge-overflow"
          aria-hidden="true"
        >
          +{overflowCount}
        </span>
      )}
    </span>
  );
}

function sharedWithLabel(
  members: TripMemberSummary[],
  maxVisible: number,
): string {
  const names = members.slice(0, maxVisible).map(memberDisplayName);
  const overflowCount = members.length - names.length;
  if (overflowCount > 0) {
    return `Shared with ${names.join(", ")} and ${overflowCount} more`;
  }
  if (names.length === 1) {
    return `Shared with ${names[0]}`;
  }
  return `Shared with ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function memberDisplayName(member: TripMemberSummary): string {
  return member.username?.trim() || FALLBACK_MEMBER_NAME;
}
