export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates an AWS IAM Role ARN.
 * Expected format: arn:aws:iam::<12-digit-account-id>:role/<role-name>
 */
export function validateRoleArn(arn: string): ValidationResult {
  try {
    const pattern = /^arn:aws:iam::\d{12}:role\/[\w+=,.@\-\/]+$/;
    if (pattern.test(arn)) {
      return { valid: true };
    }
    return {
      valid: false,
      error: 'Invalid Role ARN format. Expected: arn:aws:iam::<12-digit-account-id>:role/<role-name>',
    };
  } catch {
    return {
      valid: false,
      error: 'Invalid Role ARN format. Expected: arn:aws:iam::<12-digit-account-id>:role/<role-name>',
    };
  }
}

/**
 * Validates a GCP project ID.
 * Must be 6–30 chars, lowercase letters/digits/hyphens, start with a letter.
 */
export function validateGcpProjectId(id: string): ValidationResult {
  try {
    const pattern = /^[a-z][a-z0-9\-]{4,28}[a-z0-9]$/;
    if (pattern.test(id)) {
      return { valid: true };
    }
    return {
      valid: false,
      error: 'Invalid GCP project ID. Must be 6–30 characters, start with a lowercase letter, and contain only lowercase letters, digits, and hyphens.',
    };
  } catch {
    return {
      valid: false,
      error: 'Invalid GCP project ID. Must be 6–30 characters, start with a lowercase letter, and contain only lowercase letters, digits, and hyphens.',
    };
  }
}

/**
 * Validates a GCP service account email.
 * Expected format: <name>@<project>.iam.gserviceaccount.com
 */
export function validateSaEmail(email: string): ValidationResult {
  try {
    const pattern = /^[a-zA-Z0-9\-]+@[a-zA-Z0-9\-]+\.iam\.gserviceaccount\.com$/;
    if (pattern.test(email)) {
      return { valid: true };
    }
    return {
      valid: false,
      error: 'Invalid service account email. Expected format: <name>@<project>.iam.gserviceaccount.com',
    };
  } catch {
    return {
      valid: false,
      error: 'Invalid service account email. Expected format: <name>@<project>.iam.gserviceaccount.com',
    };
  }
}
