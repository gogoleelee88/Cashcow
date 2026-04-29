'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { adminApi } from '../../../../../lib/admin-api';
import { PostForm } from '../../PostForm';

export default function EditPostPage() {
  const params = useParams();
  const id = params?.id as string;
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.get(`/posts/${id}`).then(res => {
      setPost(res.data.data);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-6 text-gray-400 text-sm">로딩 중...</div>;
  if (!post) return <div className="p-6 text-gray-400 text-sm">글을 찾을 수 없습니다</div>;

  return <PostForm initialData={post} />;
}
