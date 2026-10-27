// Digits, spaces, and common phone punctuation. Formats vary too much to
// validate further.
export const PHONE_PATTERN = /^[0-9+()\-.\s]*$/;
export const PHONE_PATTERN_MESSAGE = "Use digits, spaces, and + ( ) - . only.";
