import { prisma } from './prisma';
import { Prisma, type AuditAction } from '@prisma/client';
import type { FastifyRequest } from 'fastify';

interface AuditOptions {
  action: AuditAction;
  entityType: string;
  entityId: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
}

export async function createAuditLog(
  request: FastifyRequest,
  opts: AuditOptions
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: request.userId ?? null,
        action: opts.action,
        entityType: opts.entityType,
        entityId: opts.entityId,
        oldData: opts.oldData ? (opts.oldData as Prisma.InputJsonValue) : undefined,
        newData: opts.newData ? (opts.newData as Prisma.InputJsonValue) : undefined,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      },
    });
  } catch {
    // audit log 실패가 본 요청을 막지 않도록 silently fail
  }
}
