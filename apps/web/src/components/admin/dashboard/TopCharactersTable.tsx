'use client';

interface Character {
  id: string;
  name: string;
  avatarUrl: string | null;
  chatCount: number;
  creatorName: string;
}

export function TopCharactersTable({ characters }: { characters: Character[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">인기 캐릭터 TOP 10</h3>
      <div className="space-y-2">
        {characters.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">데이터 없음</p>
        )}
        {characters.map((c, i) => (
          <div key={c.id} className="flex items-center gap-3 py-1.5">
            <span className="w-5 text-xs font-bold text-gray-400 text-right">{i + 1}</span>
            <div className="w-7 h-7 rounded-full bg-gray-100 flex-shrink-0 overflow-hidden">
              {c.avatarUrl ? (
                <img src={c.avatarUrl} alt={c.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-400 to-blue-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
              <p className="text-xs text-gray-400 truncate">{c.creatorName}</p>
            </div>
            <span className="text-xs font-semibold text-gray-600">
              {c.chatCount.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
