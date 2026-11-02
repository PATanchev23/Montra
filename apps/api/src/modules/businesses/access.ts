import type { MembershipRole } from '@montra/shared';
import type { FastifyRequest } from 'fastify';
import type { Db } from '../../db';
import { AppError } from '../../lib/app-error';
import { authOf } from '../../plugins/auth';

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

/**
 * Like requireMembership, but only an OWNER may continue: viewers get a 403.
 * Every route that changes a business's data starts here.
 */
export async function requireOwner(db: Db, userId: string, businessId: string): Promise<void> {
  const role = await requireMembership(db, userId, businessId);
  if (role !== 'OWNER') {
    throw new AppError(403, 'FORBIDDEN', 'Only the business owner can make changes.');
  }
}

/**
 * onRequest hook for routes under /businesses/:businessId that change data.
 * It runs before the body is read or validated, so a viewer always gets a
 * 403 (and an outsider a 404) without the server reading an upload or
 * reporting on the body's contents.
 */
export function ownerOnly(db: Db) {
  return async (request: FastifyRequest) => {
    const { businessId } = request.params as { businessId: string };
    await requireOwner(db, authOf(request).userId, businessId);
  };
}
