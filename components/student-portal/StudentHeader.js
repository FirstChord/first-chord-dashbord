export default function StudentHeader({ student }) {
  return (
    <div className="bg-white rounded-2xl p-6 text-center mb-6 shadow-lg">
      <div className="text-4xl mb-2">🎵</div>
      <h1 className="text-3xl font-bold text-gray-800 mb-2">
        Hi {student.name}!
      </h1>
      <p className="text-lg text-gray-600">
        Welcome to your music dashboard
      </p>
      <div className="mt-4 text-sm text-gray-500">
        Your tutor: Finn
      </div>
    </div>
  );
}