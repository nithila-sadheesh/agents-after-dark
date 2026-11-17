/**
 * FO_LIVE_ACTIONS — the switch between the safe demo and the real end-to-end product.
 *
 * false (current): Fo is asked to research only (no calls, bookings or payments); Approve stays local; the robot is
 *   dispatched after ~25s even if Fo is still working (Fo replies can take minutes).
 * true: Fo is asked to actually arrange the errand (call the business, book the drop-off, get a quote) and to wait for
 *   approval before paying. A human's Approve click sends the authorization to Fo on the same conversation, and the
 *   robot is dispatched only after Fo confirms the booking. Requires a Wajo account with payment details set up.
 */
export const FO_LIVE_ACTIONS = false;

/** Max spend the user's approval authorizes Fo to pay (USD), sent with the approval when FO_LIVE_ACTIONS is on. */
export const FO_SPEND_CAP_USD = 60;

/** Heuristic: does a Fo reply confirm a booking? Gates robot dispatch when FO_LIVE_ACTIONS is on. */
export const BOOKING_CONFIRMED_RE = /\b(booked|confirmed|scheduled|reserved|all set|appointment (is )?set)\b/i;
