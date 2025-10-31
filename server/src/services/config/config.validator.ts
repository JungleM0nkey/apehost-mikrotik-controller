/**
 * Configuration Validator
 *
 * Validates configuration objects against schemas
 */

import { ZodError } from 'zod';
import {
  AppConfigSchema,
  ServerConfigSchema,
  MikroTikConfigSchema,
  LLMConfigSchema,
  AssistantConfigSchema,
  UIConfigSchema,
  type ValidationResult,
  type ConfigSection,
} from './config.schema.js';

/**
 * Validate full application configuration
 */
export function validateConfig(config: unknown): ValidationResult {
  try {
    AppConfigSchema.parse(config);
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof ZodError) {
      // Add detailed logging to expose validation issues
      console.error('[ConfigValidator] Validation failed with errors:');

      // ZodError uses 'issues' not 'errors'
      if (error.issues && Array.isArray(error.issues)) {
        error.issues.forEach((err, index) => {
          console.error(`  ${index + 1}. Path: ${err.path?.join('.') || 'unknown'}, Message: ${err.message}, Code: ${err.code}`);
          if (err.code === 'invalid_type') {
            console.error(`     Expected: ${(err as any).expected}, Received: ${(err as any).received}`);
          }
        });

        const errors = error.issues.map((err) => {
          const path = (err.path || []).join('.');
          return `${path}: ${err.message}`;
        });
        console.error('[ConfigValidator] Invalid config object:', JSON.stringify(config, null, 2));
        return { valid: false, errors: errors.length > 0 ? errors : ['Validation failed'] };
      } else {
        console.error('[ConfigValidator] ZodError.issues is undefined or not an array');
        console.error('[ConfigValidator] Invalid config object:', JSON.stringify(config, null, 2));
        return { valid: false, errors: ['Validation failed: Unable to parse error details'] };
      }
    }
    console.error('[ConfigValidator] Non-Zod error:', error);
    return { valid: false, errors: [`Unknown validation error: ${error}`] };
  }
}

/**
 * Validate a specific configuration section
 */
export function validateSection(
  section: ConfigSection,
  data: unknown
): ValidationResult {
  try {
    switch (section) {
      case 'server':
        ServerConfigSchema.parse(data);
        break;
      case 'mikrotik':
        MikroTikConfigSchema.parse(data);
        break;
      case 'llm':
        LLMConfigSchema.parse(data);
        break;
      case 'assistant':
        AssistantConfigSchema.parse(data);
        break;
      case 'ui':
        UIConfigSchema.parse(data);
        break;
      default:
        return { valid: false, errors: [`Unknown section: ${section}`] };
    }
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof ZodError) {
      // Add detailed logging to expose validation issues
      console.error(`[ConfigValidator] Section '${section}' validation failed with errors:`);

      // ZodError uses 'issues' not 'errors'
      if (error.issues && Array.isArray(error.issues)) {
        error.issues.forEach((err, index) => {
          console.error(`  ${index + 1}. Path: ${err.path?.join('.') || 'unknown'}, Message: ${err.message}, Code: ${err.code}`);
          if (err.code === 'invalid_type') {
            console.error(`     Expected: ${(err as any).expected}, Received: ${(err as any).received}`);
          }
        });

        const errors = error.issues.map((err) => {
          const path = (err.path || []).join('.');
          return `${path}: ${err.message}`;
        });
        console.error(`[ConfigValidator] Invalid '${section}' data:`, JSON.stringify(data, null, 2));
        return { valid: false, errors: errors.length > 0 ? errors : ['Validation failed'] };
      } else {
        console.error(`[ConfigValidator] ZodError.issues is undefined or not an array`);
        console.error(`[ConfigValidator] Invalid '${section}' data:`, JSON.stringify(data, null, 2));
        return { valid: false, errors: ['Validation failed: Unable to parse error details'] };
      }
    }
    console.error(`[ConfigValidator] Non-Zod error in section '${section}':`, error);
    return { valid: false, errors: [`Unknown validation error: ${error}`] };
  }
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: string[]): string {
  if (errors.length === 0) {
    return 'No errors';
  }
  return errors.map((err, index) => `${index + 1}. ${err}`).join('\n');
}
