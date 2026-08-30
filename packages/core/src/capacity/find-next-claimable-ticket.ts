import type { Ticket } from '../ticket.js';

const CLASS_OF_SERVICE_RANK: Record<Ticket['classOfService'], number> = {
  Expedite: 0,
  Standard: 1,
};

/**
 * BUILD_PLAN 6.1a-i's Expedite queue-*ordering* — `docs/decisions/BOARD-AND-CAPACITY-MODEL.md`
 * Decision 2's "jumps ahead of Standard work within its board status", picking one candidate out
 * of an already-fetched, already-eligible set (`listClaimableTickets`'s job, not this function's).
 *
 * Pure and synchronous, deliberately scoped apart from `evaluateWipLimit` (the WIP *cap*, a
 * different concern) — same "ordering has nothing to order until assignment exists" split
 * `classifyClassOfService` closes the other half of.
 *
 * Order: Expedite before Standard, then oldest `createdAt` first within a class, with a
 * deterministic tiebreak by `id` so two tickets created in the same instant don't yield a
 * flip-floppy pick across ticks.
 */
export function findNextClaimableTicket(
  tickets: readonly Ticket[],
): Ticket | null {
  if (tickets.length === 0) return null;

  const [best] = [...tickets].sort((a, b) => {
    const classOfServiceDelta =
      CLASS_OF_SERVICE_RANK[a.classOfService] -
      CLASS_OF_SERVICE_RANK[b.classOfService];
    if (classOfServiceDelta !== 0) return classOfServiceDelta;

    const createdAtDelta = a.createdAt.getTime() - b.createdAt.getTime();
    if (createdAtDelta !== 0) return createdAtDelta;

    return a.id.localeCompare(b.id);
  });

  return best;
}
