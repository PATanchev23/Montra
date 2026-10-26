import { membershipRoleSchema, onboardingStepSchema } from '@montra/shared';
import { describe, expect, it } from 'vitest';
import { MembershipRole, OnboardingStep } from '../src/generated/prisma/enums';

// The shared contracts restate the database enums so the frontend never
// depends on Prisma. These checks fail if the two drift apart.
describe('shared contracts match the database enums', () => {
  it('MembershipRole', () => {
    expect([...membershipRoleSchema.options].sort()).toEqual(Object.values(MembershipRole).sort());
  });

  it('OnboardingStep, in the same order', () => {
    expect(onboardingStepSchema.options).toEqual(Object.values(OnboardingStep));
  });
});
