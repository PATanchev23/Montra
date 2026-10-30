import type { MembershipRole } from '@montra/shared';
import type { Db } from '../../db';
import { AppError } from '../../lib/app-error';

/**
 * The caller's role in a business, or a 404. Every business-scoped route
 * starts here. Outsiders get the same answer whether or not the business
 * exists, so ids cannot be probed.
 */
export async function requireMembership(
  db: Db,
  userId: string,
  businessId: string,
): Promise<MembershipRole> {
  const membership = await db.membership.findUnique({
    where: { userId_businessId: { userId, businessId } },
    select: { role: true },
  });
  if (!membership) throw new AppError(404, 'NOT_FOUND', 'Business not found.');
  return membership.role;
}
