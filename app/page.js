import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">
          Music School Dashboard
        </h1>
        <p className="text-gray-600 mb-8">
          Streamlined lesson management for tutors
        </p>
        <Link
          href="/dashboard"
          className="inline-block px-8 py-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-lg font-medium"
        >
          Enter Dashboard
        </Link>
      </div>
    </div>
  );
}
