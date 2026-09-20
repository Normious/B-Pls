/**
 * Barcode check-digit validation for EAN/UPC/ISBN.
 * Returns { valid: boolean, type: string, normalized: string }.
 */

/**
 * Validate an EAN-13 or UPC-A (12/13 digits) using modulo-10.
 */
function validateEAN(code) {
  const digits = code.split('').map(Number);
  const checkDigit = digits.pop();
  let sum = 0;

  // EAN: multiply alternately by 1 and 3, starting from the right
  for (let i = digits.length - 1, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3) {
    sum += digits[i] * weight;
  }

  const expected = (10 - (sum % 10)) % 10;
  return expected === checkDigit;
}

/**
 * Validate UPC-E (8 digits) by expanding to UPC-A.
 */
function expandUPCE(code) {
  // UPC-E → UPC-A expansion
  const d = code.split('').map(Number);
  const [n, m1, m2, m3, m4, m5, m6, check] = d;

  let manufacturer, product;
  if (m6 === 0 || m6 === 1 || m6 === 2) {
    manufacturer = `${m1}${m2}${m6}00`;
    product = `00${m3}${m4}${m5}`;
  } else if (m6 === 3) {
    manufacturer = `${m1}${m2}${m3}00`;
    product = `000${m4}${m5}`;
  } else if (m6 === 4) {
    manufacturer = `${m1}${m2}${m3}${m4}0`;
    product = `0000${m5}`;
  } else {
    manufacturer = `${m1}${m2}${m3}${m4}${m5}`;
    product = `0000${m6}`;
  }

  return `${n}${manufacturer}${product}${check}`;
}

export function validateBarcode(code) {
  if (typeof code !== 'string' && typeof code !== 'number') {
    return { valid: false, type: 'unknown', reason: 'not_a_string' };
  }

  const raw = String(code).trim();
  if (!/^\d+$/.test(raw)) {
    return { valid: false, type: 'unknown', reason: 'non_numeric', normalized: raw };
  }

  // ISBN-10 (10 digits, last may be X)
  if (raw.length === 10) {
    const body = raw.slice(0, 9);
    const check = raw[9];
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += (10 - i) * parseInt(body[i]);
    }
    const remainder = (11 - (sum % 11)) % 11;
    const expected = remainder === 10 ? 'X' : String(remainder);
    const valid = expected === check.toUpperCase();
    return { valid, type: 'isbn10', normalized: raw.toUpperCase() };
  }

  // EAN-13 / ISBN-13
  if (raw.length === 13) {
    const isISBN = raw.startsWith('978') || raw.startsWith('979');
    return {
      valid: validateEAN(raw),
      type: isISBN ? 'isbn13' : 'ean13',
      normalized: raw,
    };
  }

  // EAN-8
  if (raw.length === 8) {
    // Could be UPC-E or EAN-8. Try EAN-8 first.
    const eanValid = validateEAN(raw);
    if (eanValid) {
      return { valid: true, type: 'ean8', normalized: raw };
    }
    // Try UPC-E
    const upcA = expandUPCE(raw);
    const upcValid = validateEAN(upcA);
    return {
      valid: upcValid,
      type: upcValid ? 'upce' : 'ean8',
      normalized: raw,
    };
  }

  // UPC-A (12 digits)
  if (raw.length === 12) {
    return { valid: validateEAN(raw), type: 'upca', normalized: raw };
  }

  return {
    valid: false,
    type: 'unknown',
    reason: 'unsupported_length',
    normalized: raw,
  };
}

export function isValidBarcode(code) {
  return validateBarcode(code).valid;
}
