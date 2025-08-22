import { v4 as uuidv4 } from 'uuid';

/**
 * UUID utility functions
 */

/**
 * Generate a new UUID using the uuid library
 */
export function generateUUID(): string {
  return uuidv4();
}

/**
 * Generate a temporary ID for optimistic updates
 * These IDs are prefixed to distinguish them from real UUIDs
 */
export function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
