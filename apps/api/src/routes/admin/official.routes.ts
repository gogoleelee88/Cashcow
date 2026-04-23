import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma';
import { createAuditLog } from '../../lib/audit';
import { encrypt, decrypt } from '../../lib/encryption';

export const officialRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /admin/official/characters — 전체 캐릭터 목록 (featured 관리)
  fastify.get<{
    Querystring: { page?: string; limit?: string; search?: string; featured?: string; category?: string };
  }>('/characters', async (request) => {
    const { page = '1', limit = '25', search, featured, category } = request.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = { isOfficial: true };
    if (featured === 'true') where.isFeatured = true;
    if (featured === 'false') where.isFeatured = false;
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { creator: { username: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [characters, total] = await Promise.all([
      prisma.character.findMany({
        where,
        orderBy: [{ isFeatured: 'desc' }, { chatCount: 'desc' }],
        skip,
        take: limitNum,
        select: {
          id: true, name: true, avatarUrl: true, category: true,
          chatCount: true, likeCount: true, isFeatured: true, isActive: true,
          visibility: true, ageRating: true, createdAt: true,
          creator: { select: { id: true, username: true, displayName: true } },
        },
      }),
      prisma.character.count({ where }),
    ]);

    return {
      success: true,
      data: { characters, total, page: pageNum, totalPages: Math.ceil(total / limitNum) },
    };
  });

  // PATCH /admin/official/characters/:id/featured
  fastify.patch<{ Params: { id: string }; Body: { isFeatured: boolean } }>(
    '/characters/:id/featured',
    async (request, reply) => {
      const { id } = request.params;
      const { isFeatured } = request.body;

      const updated = await prisma.character.update({
        where: { id },
        data: { isFeatured },
        select: { id: true, name: true, isFeatured: true },
      });

      await createAuditLog(request, {
        action: 'UPDATE',
        entityType: 'Character',
        entityId: id,
        newData: { isFeatured },
      });

      return { success: true, data: updated };
    }
  );

  // PATCH /admin/official/characters/:id/active
  fastify.patch<{ Params: { id: string }; Body: { isActive: boolean } }>(
    '/characters/:id/active',
    async (request, reply) => {
      const { id } = request.params;
      const { isActive } = request.body;

      const updated = await prisma.character.update({
        where: { id },
        data: { isActive },
        select: { id: true, name: true, isActive: true },
      });

      await createAuditLog(request, {
        action: 'UPDATE',
        entityType: 'Character',
        entityId: id,
        newData: { isActive },
      });

      return { success: true, data: updated };
    }
  );

  // GET /admin/official/stories
  fastify.get<{
    Querystring: { page?: string; limit?: string; search?: string; status?: string };
  }>('/stories', async (request) => {
    const { page = '1', limit = '25', search, status } = request.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = { isOfficial: true };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { author: { username: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [stories, total] = await Promise.all([
      prisma.story.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        select: {
          id: true, title: true, coverUrl: true, status: true,
          chatCount: true, likeCount: true, isFeatured: true, createdAt: true,
          author: { select: { id: true, username: true, displayName: true } },
        },
      }),
      prisma.story.count({ where }),
    ]);

    return {
      success: true,
      data: { stories, total, page: pageNum, totalPages: Math.ceil(total / limitNum) },
    };
  });

  // PATCH /admin/official/stories/:id/featured
  fastify.patch<{ Params: { id: string }; Body: { isFeatured: boolean } }>(
    '/stories/:id/featured',
    async (request) => {
      const { id } = request.params;
      const { isFeatured } = request.body;

      const updated = await prisma.story.update({
        where: { id },
        data: { isFeatured },
        select: { id: true, title: true, isFeatured: true },
      });

      await createAuditLog(request, {
        action: 'UPDATE',
        entityType: 'Story',
        entityId: id,
        newData: { isFeatured },
      });

      return { success: true, data: updated };
    }
  );

  // GET /admin/official/characters/:id — 단일 캐릭터 조회 (edit용)
  fastify.get<{ Params: { id: string } }>('/characters/:id', async (request, reply) => {
    const { id } = request.params;
    const character = await prisma.character.findUnique({
      where: { id },
      select: {
        id: true, name: true, description: true, detailDescription: true,
        systemPromptEncrypted: true, systemPromptIv: true,
        greeting: true, exampleDialogues: true,
        avatarUrl: true, backgroundUrl: true,
        category: true, tags: true, visibility: true, ageRating: true,
        language: true, model: true, temperature: true, maxTokens: true,
        memoryEnabled: true, commentDisabled: true, isFeatured: true, isActive: true,
        creator: { select: { id: true, username: true, displayName: true } },
      },
    });
    if (!character) return reply.status(404).send({ success: false, error: '캐릭터를 찾을 수 없습니다' });

    let systemPrompt = '';
    try { systemPrompt = decrypt(character.systemPromptEncrypted, character.systemPromptIv); } catch { /* silent */ }

    const { systemPromptEncrypted, systemPromptIv, ...safe } = character;
    return { success: true, data: { ...safe, systemPrompt } };
  });

  // POST /admin/official/characters — 공식 캐릭터 생성
  fastify.post<{
    Body: {
      name: string; description: string; detailDescription?: string;
      systemPrompt: string; greeting: string;
      category: string; tags?: string[]; visibility?: string; ageRating?: string;
      language?: string; model?: string; temperature?: number; maxTokens?: number;
      memoryEnabled?: boolean; commentDisabled?: boolean;
    };
  }>('/characters', async (request, reply) => {
    const { systemPrompt, ...rest } = request.body;
    if (!rest.name || !rest.description || !systemPrompt || !rest.greeting || !rest.category) {
      return reply.status(400).send({ success: false, error: '필수 항목을 모두 입력하세요' });
    }

    const { encrypted, iv } = encrypt(systemPrompt);
    const character = await prisma.character.create({
      data: {
        name: rest.name,
        description: rest.description,
        detailDescription: rest.detailDescription ?? null,
        systemPromptEncrypted: encrypted,
        systemPromptIv: iv,
        greeting: rest.greeting,
        category: rest.category as any,
        tags: rest.tags ?? [],
        visibility: (rest.visibility ?? 'PUBLIC') as any,
        ageRating: (rest.ageRating ?? 'ALL') as any,
        language: rest.language ?? 'ko',
        model: rest.model ?? 'claude-haiku-3',
        temperature: rest.temperature ?? 0.8,
        maxTokens: rest.maxTokens ?? 1024,
        memoryEnabled: rest.memoryEnabled ?? true,
        commentDisabled: rest.commentDisabled ?? false,
        isFeatured: false,
        isOfficial: true,
        creatorId: request.userId!,
      },
      select: { id: true, name: true, createdAt: true },
    });

    await createAuditLog(request, { action: 'CREATE', entityType: 'Character', entityId: character.id, newData: { name: character.name } });
    return reply.code(201).send({ success: true, data: character });
  });

  // PATCH /admin/official/characters/:id — 공식 캐릭터 수정
  fastify.patch<{
    Params: { id: string };
    Body: {
      name?: string; description?: string; detailDescription?: string;
      systemPrompt?: string; greeting?: string;
      category?: string; tags?: string[]; visibility?: string; ageRating?: string;
      language?: string; model?: string; temperature?: number; maxTokens?: number;
      memoryEnabled?: boolean; commentDisabled?: boolean;
    };
  }>('/characters/:id', async (request, reply) => {
    const { id } = request.params;
    const { systemPrompt, ...rest } = request.body;

    const updateData: Record<string, unknown> = { ...rest };
    if (systemPrompt !== undefined) {
      const { encrypted, iv } = encrypt(systemPrompt);
      updateData.systemPromptEncrypted = encrypted;
      updateData.systemPromptIv = iv;
    }
    if (rest.category) updateData.category = rest.category;
    if (rest.visibility) updateData.visibility = rest.visibility;
    if (rest.ageRating) updateData.ageRating = rest.ageRating;

    const updated = await prisma.character.update({
      where: { id },
      data: updateData as any,
      select: { id: true, name: true, updatedAt: true },
    });

    await createAuditLog(request, { action: 'UPDATE', entityType: 'Character', entityId: id, newData: rest });
    return { success: true, data: updated };
  });

  // DELETE /admin/official/characters/:id — 소프트 삭제
  fastify.delete<{ Params: { id: string } }>('/characters/:id', async (request) => {
    const { id } = request.params;
    await prisma.character.update({ where: { id }, data: { isActive: false } });
    await createAuditLog(request, { action: 'DELETE', entityType: 'Character', entityId: id, newData: { isActive: false } });
    return { success: true };
  });

  // GET /admin/official/stories/:id — 단일 스토리 조회 (edit용)
  fastify.get<{ Params: { id: string } }>('/stories/:id', async (request, reply) => {
    const { id } = request.params;
    const story = await prisma.story.findUnique({
      where: { id },
      select: {
        id: true, title: true, description: true, coverUrl: true,
        systemPromptEncrypted: true, systemPromptIv: true,
        greeting: true, category: true, tags: true, ageRating: true,
        visibility: true, status: true, language: true, isFeatured: true, isActive: true,
        author: { select: { id: true, username: true, displayName: true } },
        chapters: { select: { id: true, title: true, content: true, order: true, isPublished: true, createdAt: true }, orderBy: { order: 'asc' } },
      },
    });
    if (!story) return reply.status(404).send({ success: false, error: '스토리를 찾을 수 없습니다' });

    let systemPrompt = '';
    try { systemPrompt = decrypt(story.systemPromptEncrypted, story.systemPromptIv); } catch { /* silent */ }

    const { systemPromptEncrypted, systemPromptIv, ...safe } = story;
    return { success: true, data: { ...safe, systemPrompt } };
  });

  // POST /admin/official/stories — 공식 스토리 생성
  fastify.post<{
    Body: {
      title: string; description: string; systemPrompt: string; greeting: string;
      category?: string; tags?: string[]; ageRating?: string; visibility?: string;
      language?: string; status?: string;
    };
  }>('/stories', async (request, reply) => {
    const { systemPrompt, ...rest } = request.body;
    if (!rest.title || !rest.description || !systemPrompt || !rest.greeting) {
      return reply.status(400).send({ success: false, error: '필수 항목을 모두 입력하세요' });
    }

    const { encrypted, iv } = encrypt(systemPrompt);
    const story = await prisma.story.create({
      data: {
        title: rest.title,
        description: rest.description,
        systemPromptEncrypted: encrypted,
        systemPromptIv: iv,
        greeting: rest.greeting,
        category: (rest.category ?? 'OTHER') as any,
        tags: rest.tags ?? [],
        ageRating: (rest.ageRating ?? 'ALL') as any,
        visibility: (rest.visibility ?? 'PUBLIC') as any,
        status: (rest.status ?? 'DRAFT') as any,
        language: rest.language ?? 'ko',
        isOfficial: true,
        authorId: request.userId!,
      },
      select: { id: true, title: true, createdAt: true },
    });

    await createAuditLog(request, { action: 'CREATE', entityType: 'Story', entityId: story.id, newData: { title: story.title } });
    return reply.code(201).send({ success: true, data: story });
  });

  // PATCH /admin/official/stories/:id — 공식 스토리 수정
  fastify.patch<{
    Params: { id: string };
    Body: {
      title?: string; description?: string; systemPrompt?: string; greeting?: string;
      category?: string; tags?: string[]; ageRating?: string; visibility?: string;
      status?: string; language?: string;
    };
  }>('/stories/:id', async (request) => {
    const { id } = request.params;
    const { systemPrompt, ...rest } = request.body;

    const updateData: Record<string, unknown> = { ...rest };
    if (systemPrompt !== undefined) {
      const { encrypted, iv } = encrypt(systemPrompt);
      updateData.systemPromptEncrypted = encrypted;
      updateData.systemPromptIv = iv;
    }

    const updated = await prisma.story.update({
      where: { id },
      data: updateData as any,
      select: { id: true, title: true, updatedAt: true },
    });

    await createAuditLog(request, { action: 'UPDATE', entityType: 'Story', entityId: id, newData: rest });
    return { success: true, data: updated };
  });

  // GET /admin/official/stories/:id/chapters
  fastify.get<{ Params: { id: string } }>('/stories/:id/chapters', async (request) => {
    const { id } = request.params;
    const chapters = await prisma.storyChapter.findMany({
      where: { storyId: id },
      orderBy: { order: 'asc' },
      select: { id: true, title: true, content: true, order: true, isPublished: true, createdAt: true },
    });
    return { success: true, data: { chapters } };
  });

  // POST /admin/official/stories/:id/chapters
  fastify.post<{
    Params: { id: string };
    Body: { title: string; content: string; order?: number; isPublished?: boolean };
  }>('/stories/:id/chapters', async (request, reply) => {
    const { id } = request.params;
    const { title, content, order, isPublished } = request.body;

    const lastChapter = await prisma.storyChapter.findFirst({ where: { storyId: id }, orderBy: { order: 'desc' }, select: { order: true } });
    const nextOrder = order ?? (lastChapter ? lastChapter.order + 1 : 1);

    const chapter = await prisma.storyChapter.create({
      data: { storyId: id, title, content, order: nextOrder, isPublished: isPublished ?? false },
      select: { id: true, title: true, order: true, isPublished: true, createdAt: true },
    });

    await createAuditLog(request, { action: 'CREATE', entityType: 'StoryChapter', entityId: chapter.id, newData: { title, storyId: id } });
    return reply.code(201).send({ success: true, data: chapter });
  });

  // PATCH /admin/official/stories/:id/chapters/:chapterId
  fastify.patch<{
    Params: { id: string; chapterId: string };
    Body: { title?: string; content?: string; order?: number; isPublished?: boolean };
  }>('/stories/:id/chapters/:chapterId', async (request) => {
    const { chapterId } = request.params;
    const { title, content, order, isPublished } = request.body;

    const updated = await prisma.storyChapter.update({
      where: { id: chapterId },
      data: { ...(title !== undefined && { title }), ...(content !== undefined && { content }), ...(order !== undefined && { order }), ...(isPublished !== undefined && { isPublished }) },
      select: { id: true, title: true, order: true, isPublished: true, updatedAt: true },
    });
    return { success: true, data: updated };
  });

  // DELETE /admin/official/stories/:id/chapters/:chapterId
  fastify.delete<{ Params: { id: string; chapterId: string } }>('/stories/:id/chapters/:chapterId', async (request) => {
    const { chapterId } = request.params;
    await prisma.storyChapter.delete({ where: { id: chapterId } });
    await createAuditLog(request, { action: 'DELETE', entityType: 'StoryChapter', entityId: chapterId, newData: {} });
    return { success: true };
  });

  // PATCH /admin/official/stories/:id/status
  fastify.patch<{ Params: { id: string }; Body: { status: string } }>(
    '/stories/:id/status',
    async (request, reply) => {
      const { id } = request.params;
      const { status } = request.body;

      const validStatuses = ['DRAFT', 'PUBLISHED', 'HIDDEN', 'DELETED'];
      if (!validStatuses.includes(status)) {
        return reply.status(400).send({ success: false, error: '유효하지 않은 상태입니다' });
      }

      const updated = await prisma.story.update({
        where: { id },
        data: { status: status as 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'DELETED' },
        select: { id: true, title: true, status: true },
      });

      await createAuditLog(request, {
        action: 'UPDATE',
        entityType: 'Story',
        entityId: id,
        newData: { status },
      });

      return { success: true, data: updated };
    }
  );
};
