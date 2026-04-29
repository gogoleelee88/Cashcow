import type { FastifyPluginAsync } from 'fastify';
import { prismaRead } from '../lib/prisma';

export const postsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/posts — 공개 목록 (PUBLISHED만)
  fastify.get<{ Querystring: { page?: string; limit?: string; category?: string } }>(
    '/',
    async (request) => {
      const { page = '1', limit = '12', category } = request.query;
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      const now = new Date();
      const where: any = {
        status: 'PUBLISHED',
        publishedAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      };
      if (category && category !== 'ALL') where.category = category;

      const [posts, total] = await Promise.all([
        prismaRead.post.findMany({
          where,
          orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
          skip,
          take: limitNum,
          select: {
            id: true, slug: true, title: true, subtitle: true,
            bannerImageUrl: true, category: true, isPinned: true,
            isFeatured: true, viewCount: true, publishedAt: true,
          },
        }),
        prismaRead.post.count({ where }),
      ]);

      return { success: true, data: { posts, total, page: pageNum, totalPages: Math.ceil(total / limitNum) } };
    }
  );

  // GET /api/posts/featured — 슬라이더용 (isFeatured=true)
  fastify.get('/featured', async () => {
    const now = new Date();
    const posts = await prismaRead.post.findMany({
      where: {
        status: 'PUBLISHED',
        isFeatured: true,
        publishedAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
      take: 10,
      select: {
        id: true, slug: true, title: true, subtitle: true,
        bannerImageUrl: true, category: true,
      },
    });
    return { success: true, data: posts };
  });

  // GET /api/posts/:slug — 상세
  fastify.get<{ Params: { slug: string } }>('/:slug', async (request, reply) => {
    const now = new Date();
    const post = await prismaRead.post.findFirst({
      where: {
        slug: request.params.slug,
        status: 'PUBLISHED',
        publishedAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
    if (!post) return reply.code(404).send({ success: false, error: '게시글을 찾을 수 없습니다' });

    // 조회수 비동기 증가
    prismaRead.post.update({ where: { id: post.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

    return { success: true, data: post };
  });
};
