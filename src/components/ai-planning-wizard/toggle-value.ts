export function toggleValue<T>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}

export type InterestTagLists = {
  interest_tags: string[];
  avoid_interest_tags: string[];
};

/**
 * Advances one tag through the single-list tri-state cycle:
 * neutral → chosen → skipped → neutral. A tag is never in both lists.
 */
export function cycleInterestTag(
  lists: InterestTagLists,
  value: string,
): InterestTagLists {
  if (lists.interest_tags.includes(value)) {
    return {
      interest_tags: lists.interest_tags.filter((tag) => tag !== value),
      avoid_interest_tags: [...lists.avoid_interest_tags, value],
    };
  }
  if (lists.avoid_interest_tags.includes(value)) {
    return {
      interest_tags: lists.interest_tags,
      avoid_interest_tags: lists.avoid_interest_tags.filter(
        (tag) => tag !== value,
      ),
    };
  }
  return {
    interest_tags: [...lists.interest_tags, value],
    avoid_interest_tags: lists.avoid_interest_tags,
  };
}
