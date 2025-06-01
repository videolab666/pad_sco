export default function Loading() {
  return (
    <div className="flex items-center justify-center h-screen w-screen bg-black text-white">
      <div className="text-center">
        <div className="mb-4 text-xl">Загрузка...</div>
        <div className="w-16 h-16 border-4 border-gray-300 border-t-white rounded-full animate-spin mx-auto"></div>
      </div>
    </div>
  )
}
