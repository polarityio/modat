'use strict';

/**
 * Validate that required string options are non-empty.
 *
 * @param {Object} errorMessages  Map of optionKey → error message string
 * @param {Object} options        Polarity options object (values may be wrapped)
 * @returns {Array}               Array of { key, message } error objects
 */
function validateStringOptions(errorMessages, options) {
  return Object.entries(errorMessages).reduce((errors, [key, message]) => {
    const val = options[key];
    const rawValue = val && typeof val === 'object' ? val.value : val;
    if (!rawValue || (typeof rawValue === 'string' && rawValue.trim().length === 0)) {
      errors.push({ key, message });
    }
    return errors;
  }, []);
}

module.exports = { validateStringOptions };
