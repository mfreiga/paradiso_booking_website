// Shared by the booking form (maxLength) and createBooking (server check).
export const BOOKING_LIMITS = { name: 100, email: 254, phone: 40, note: 500 } as const;

/** Max characters in a review comment. */
export const REVIEW_COMMENT_MAX = 1000;
