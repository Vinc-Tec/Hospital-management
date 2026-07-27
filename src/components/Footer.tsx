import { CopyrightLine } from './brand';

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-6">
      <div className="max-w-7xl mx-auto px-4 text-center">
        <CopyrightLine className="text-sm font-medium text-gray-300" />
      </div>
    </footer>
  );
}
