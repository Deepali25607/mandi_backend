import { ValueTransformer } from 'typeorm';

/**
 * Postgres `numeric`/`decimal` columns are returned as strings by the driver.
 * This transformer keeps money/quantity values as JS numbers on the entity
 * while preserving decimal precision in storage.
 */
export const NumericTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) =>
    value === null || value === undefined ? value : parseFloat(value),
};
