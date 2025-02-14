import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, Wallet } from 'lucide-react';

interface Address {
  networkId?: string;
  id?: string;
  model?: string;
  key?: string;
  address?: string;
}

interface WalletInfo {
  walletId: string;
  addresses: Address[];
}

interface HeaderProps {
  walletInfo: WalletInfo;
}

const Header = ({ walletInfo }: HeaderProps) => {
  const router = useRouter();

  const handleDisconnect = () => {
    localStorage.removeItem('walletId');
    localStorage.removeItem('addresses');
    router.push('/');
  };

  // Helper function to get displayable address string
  const getDisplayAddress = (address: Address): string => {
    if (typeof address === 'string') return address;
    if (address.address) return address.address;
    if (address.id) return address.id;
    return 'Unknown Address';
  };

  return (
    <header className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-900">
              Crypto FUD Buster
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center space-x-2">
                  <Wallet className="h-4 w-4" />
                  <span>Wallet</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Wallet Details</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="p-2">
                  <div className="space-y-2">
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Wallet ID
                      </label>
                      <p className="text-sm truncate">{walletInfo.walletId}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Addresses
                      </label>
                      {walletInfo.addresses.map((address, index) => (
                        <p key={index} className="text-sm truncate">
                          {getDisplayAddress(address)}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 cursor-pointer"
                  onClick={handleDisconnect}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Disconnect Wallet
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;