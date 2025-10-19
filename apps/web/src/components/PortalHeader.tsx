// components/PortalHeader.tsx - Header for supplier portal

interface PortalHeaderProps {
  supplierName: string
  hostCompanyName: string
  onLogout?: () => void
}

export default function PortalHeader({ supplierName, hostCompanyName, onLogout }: PortalHeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Company Info */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 bg-green-600 rounded-lg flex items-center justify-center">
                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <div className="text-lg font-semibold text-gray-900">
                Carbon Recycling
              </div>
              <div className="text-sm text-gray-500">
                Supplier Portal
              </div>
            </div>
          </div>

          {/* Supplier Info */}
          <div className="hidden md:flex items-center space-x-8">
            <div className="text-center">
              <div className="text-sm font-medium text-gray-900">Reporting to</div>
              <div className="text-sm text-gray-500">{hostCompanyName}</div>
            </div>
            
            <div className="h-6 border-l border-gray-300"></div>
            
            <div className="text-center">
              <div className="text-sm font-medium text-gray-900">Logged in as</div>
              <div className="text-sm text-gray-500">{supplierName}</div>
            </div>

            {onLogout && (
              <>
                <div className="h-6 border-l border-gray-300"></div>
                <button
                  onClick={onLogout}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Logout
                </button>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button className="text-gray-500 hover:text-gray-700">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile info (hidden by default, would show when mobile menu is opened) */}
        <div className="md:hidden border-t border-gray-200 py-3 space-y-2">
          <div className="text-sm">
            <span className="font-medium">Reporting to:</span> {hostCompanyName}
          </div>
          <div className="text-sm">
            <span className="font-medium">Logged in as:</span> {supplierName}
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              className="text-sm text-red-600 hover:text-red-700 transition-colors"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </header>
  )
}