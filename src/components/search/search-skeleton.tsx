export default function SearchSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-2 animate-pulse">
        <div className="flex-1 relative">
          <div className="w-full h-10 bg-gray-200 rounded-md"></div>
        </div>
        <div className="w-20 h-10 bg-gray-200 rounded-md"></div>
      </div>

      <div className="grid gap-4">
        {Array(5)
          .fill(0)
          .map((_, i) => (
            <div
              key={i}
              className="border border-gray-200 rounded-lg p-5 animate-pulse"
            >
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="flex gap-2 mb-3">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
                <div className="h-4 bg-gray-200 rounded w-20"></div>
                <div className="h-4 bg-gray-200 rounded w-16"></div>
              </div>
              <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          ))}
      </div>

      <div className="flex justify-center mt-8 animate-pulse">
        <div className="flex items-center gap-1">
          <div className="w-8 h-8 bg-gray-200 rounded-md"></div>
          <div className="w-8 h-8 bg-gray-200 rounded-md"></div>
          <div className="w-8 h-8 bg-gray-200 rounded-md"></div>
          <div className="w-8 h-8 bg-gray-200 rounded-md"></div>
          <div className="w-8 h-8 bg-gray-200 rounded-md"></div>
        </div>
      </div>
    </div>
  );
}
