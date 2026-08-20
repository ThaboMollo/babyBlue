export declare const ADULT_RETENTION_YEARS = 6;
export declare const MINOR_RETAIN_UNTIL_AGE = 21;
export interface RetentionInput {
    dob: string | null;
    lastActivity: string | null;
    now?: Date;
}
export interface RetentionResult {
    retainUntil: string | null;
    eligible: boolean;
    reason: string;
}
/**
 * Compute the earliest date a patient's record may be hard-deleted, and
 * whether that date has passed. Conservative when data is missing: with no
 * recorded activity we can't date the window, so deletion is not eligible.
 */
export declare function computeRetention(input: RetentionInput): RetentionResult;
//# sourceMappingURL=retention.d.ts.map