import { SearchForm } from '@/components/SearchForm';

export default function Home() {
  return (
      <main className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-8">
              Crypto FUD Buster
            </h1>
            <p className="text-xl text-gray-600 mb-12">
              Analyze news and detect FUD for any cryptocurrency
            </p>
          </div>
          <SearchForm />
        </div>
      </main>
  );
}