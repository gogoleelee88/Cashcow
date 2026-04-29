import type { FastifyPluginAsync } from 'fastify';
import { randomBytes } from 'crypto';
import { prisma } from '../../lib/prisma';
import { createAuditLog } from '../../lib/audit';
import { uploadBufferToStorage } from '../../services/storage.service';
import { logger } from '../../lib/logger';

function generateSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s가-힣ㄱ-ㅎㅏ-ㅣ-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 80) +
    '-' +
    Date.now().toString(36)
  );
}

export const postsAdminRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /admin/posts
  fastify.get<{ Querystring: { page?: string; limit?: string; status?: string; category?: string } }>(
    '/',
    async (request) => {
      const { page = '1', limit = '20', status, category } = request.query;
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};
      if (status && status !== 'ALL') where.status = status;
      if (category && category !== 'ALL') where.category = category;

      const [posts, total] = await Promise.all([
        prisma.post.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum,
          select: {
            id: true, slug: true, title: true, subtitle: true,
            bannerImageUrl: true, category: true, status: true,
            isPinned: true, isFeatured: true, viewCount: true,
            sendNotification: true, publishedAt: true, expiresAt: true,
            createdAt: true, updatedAt: true,
          },
        }),
        prisma.post.count({ where }),
      ]);

      return { success: true, data: { posts, total, page: pageNum, totalPages: Math.ceil(total / limitNum) } };
    }
  );

  // GET /admin/posts/:id
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const post = await prisma.post.findUnique({ where: { id: request.params.id } });
    if (!post) return reply.code(404).send({ success: false, error: '게시글을 찾을 수 없습니다' });
    return { success: true, data: post };
  });

  // POST /admin/posts
  fastify.post<{
    Body: {
      title: string;
      subtitle?: string;
      bannerImageUrl?: string;
      content: any;
      category?: string;
      isPinned?: boolean;
      isFeatured?: boolean;
      sendNotification?: boolean;
      publishedAt?: string;
      expiresAt?: string;
      status?: string;
    };
  }>('/', async (request, reply) => {
    const {
      title, subtitle, bannerImageUrl, content, category = 'NOTICE',
      isPinned = false, isFeatured = false, sendNotification = false,
      publishedAt, expiresAt, status = 'DRAFT',
    } = request.body;

    if (!title?.trim()) return reply.code(400).send({ success: false, error: '제목을 입력해주세요' });

    const slug = generateSlug(title);

    const post = await prisma.post.create({
      data: {
        slug, title, subtitle: subtitle ?? null,
        bannerImageUrl: bannerImageUrl ?? null,
        content, category, isPinned, isFeatured, sendNotification,
        status,
        publishedAt: status === 'PUBLISHED' ? (publishedAt ? new Date(publishedAt) : new Date()) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: request.userId,
      },
    });

    // 발행 + 알림 발송 요청 시
    if (status === 'PUBLISHED' && sendNotification) {
      const users = await prisma.user.findMany({ where: { isBanned: false }, select: { id: true } });
      const BATCH = 500;
      let sentCount = 0;
      for (let i = 0; i < users.length; i += BATCH) {
        const batch = users.slice(i, i + BATCH);
        await prisma.notification.createMany({
          data: batch.map((u) => ({
            userId: u.id,
            type: 'SYSTEM',
            title: `[공지] ${title}`,
            body: subtitle ?? '새로운 공지사항이 등록되었습니다.',
          })),
        });
        sentCount += batch.length;
      }
      await prisma.notificationBroadcast.create({
        data: { title: `[공지] ${title}`, body: subtitle ?? '', targetType: 'ALL', sentCount, sentBy: request.userId },
      });
    }

    await createAuditLog(request, { action: 'CREATE', entityType: 'Post', entityId: post.id, newData: { title, status } });
    return { success: true, data: post };
  });

  // PATCH /admin/posts/:id
  fastify.patch<{
    Params: { id: string };
    Body: {
      title?: string; subtitle?: string; bannerImageUrl?: string;
      content?: any; category?: string; isPinned?: boolean;
      isFeatured?: boolean; sendNotification?: boolean;
      publishedAt?: string; expiresAt?: string; status?: string;
    };
  }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const existing = await prisma.post.findUnique({ where: { id }, select: { id: true, status: true, title: true, subtitle: true, publishedAt: true, sendNotification: true } });
    if (!existing) return reply.code(404).send({ success: false, error: '게시글을 찾을 수 없습니다' });

    const {
      title, subtitle, bannerImageUrl, content, category,
      isPinned, isFeatured, sendNotification, publishedAt, expiresAt, status,
    } = request.body;

    const wasPublished = existing.status !== 'PUBLISHED';
    const nowPublishing = status === 'PUBLISHED' && wasPublished;

    const post = await prisma.post.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(subtitle !== undefined && { subtitle }),
        ...(bannerImageUrl !== undefined && { bannerImageUrl }),
        ...(content !== undefined && { content }),
        ...(category !== undefined && { category }),
        ...(isPinned !== undefined && { isPinned }),
        ...(isFeatured !== undefined && { isFeatured }),
        ...(sendNotification !== undefined && { sendNotification }),
        ...(status !== undefined && { status }),
        ...(status === 'PUBLISHED' && !existing.publishedAt && { publishedAt: publishedAt ? new Date(publishedAt) : new Date() }),
        ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
      },
    });

    // 신규 발행 + 알림 발송
    if (nowPublishing && (sendNotification ?? existing.sendNotification ?? false)) {
      const postTitle = title ?? existing.title;
      const postSubtitle = subtitle ?? existing.subtitle ?? '';
      const users = await prisma.user.findMany({ where: { isBanned: false }, select: { id: true } });
      const BATCH = 500;
      let sentCount = 0;
      for (let i = 0; i < users.length; i += BATCH) {
        const batch = users.slice(i, i + BATCH);
        await prisma.notification.createMany({
          data: batch.map((u) => ({
            userId: u.id, type: 'SYSTEM',
            title: `[공지] ${postTitle}`,
            body: postSubtitle || '새로운 공지사항이 등록되었습니다.',
          })),
        });
        sentCount += batch.length;
      }
      await prisma.notificationBroadcast.create({
        data: { title: `[공지] ${postTitle}`, body: postSubtitle, targetType: 'ALL', sentCount, sentBy: request.userId },
      });
    }

    await createAuditLog(request, { action: 'UPDATE', entityType: 'Post', entityId: id, newData: { status } });
    return { success: true, data: post };
  });

  // DELETE /admin/posts/:id
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const existing = await prisma.post.findUnique({ where: { id: request.params.id }, select: { id: true } });
    if (!existing) return reply.code(404).send({ success: false, error: '게시글을 찾을 수 없습니다' });
    await prisma.post.delete({ where: { id: request.params.id } });
    await createAuditLog(request, { action: 'DELETE', entityType: 'Post', entityId: request.params.id });
    return { success: true };
  });

  // POST /admin/posts/upload — 배너/본문 이미지 업로드
  fastify.post('/upload', async (request, reply) => {
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB

    let fileBuffer: Buffer | null = null;
    let mimetype = '';

    for await (const part of request.parts()) {
      if (part.type === 'file' && part.fieldname === 'file') {
        mimetype = part.mimetype;
        if (!ALLOWED.includes(mimetype)) {
          return reply.code(400).send({ success: false, error: 'JPG, PNG, WebP만 업로드할 수 있어요' });
        }
        fileBuffer = await part.toBuffer();
      }
    }

    if (!fileBuffer) return reply.code(400).send({ success: false, error: '파일을 선택해 주세요' });
    if (fileBuffer.length > MAX_SIZE) return reply.code(400).send({ success: false, error: '10MB 이하 파일만 업로드할 수 있어요' });

    const ext = mimetype.split('/')[1].replace('jpeg', 'jpg');
    const filename = `${request.userId}/${randomBytes(16).toString('hex')}.${ext}`;
    const folder = 'posts/banners';

    try {
      const url = await uploadBufferToStorage(fileBuffer, folder as any, filename, mimetype);
      logger.info({ userId: request.userId, size: fileBuffer.length }, 'Post banner uploaded');
      return { success: true, data: { url } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({ success: false, error: msg });
    }
  });
};
