import {
  importFileFormatSchema,
  importSourceSchema,
  importStatusSchema,
  membershipRoleSchema,
  onboardingStepSchema,
  transactionTypeSchema,
} from '@montra/shared';
import { describe, expect, it } from 'vitest';
import {
  ImportFileFormat,
  ImportSource,
  ImportStatus,
  MembershipRole,
  OnboardingStep,
  TransactionType,
} from '../src/generated/prisma/enums';

// The shared contracts restate the database enums so the frontend never
// depends on Prisma. These checks fail if the two drift apart.
describe('shared contracts match the database enums', () => {
  it.each([
    ['MembershipRole', membershipRoleSchema.options, MembershipRole],
    ['TransactionType', transactionTypeSchema.options, TransactionType],
    ['ImportSource', importSourceSchema.options, ImportSource],
    ['ImportStatus', importStatusSchema.options, ImportStatus],
    ['ImportFileFormat', importFileFormatSchema.options, ImportFileFormat],
  ])('%s', (_name, shared, database) => {
    expect([...shared].sort()).toEqual(Object.values(database).sort());
  });

  it('OnboardingStep, in the same order', () => {
    expect(onboardingStepSchema.options).toEqual(Object.values(OnboardingStep));
  });
});
