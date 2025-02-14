'use client';

import { useEffect, useState } from 'react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandLoading,
  CommandEmpty,
  CommandItem
} from '@/components/ui/command';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

export function SearchDialog({
  onAnalysisSelected
}: {
  onAnalysisSelected: (result: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSelect = async () => {
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coinName: debouncedQuery })
      });
      
      const analysis = await response.json();
      onAnalysisSelected(analysis);
      setOpen(false);
    } catch (error) {
      console.error('Analysis failed:', error);
    }
  };

  return (
    <>
      <Button 
        variant="outline" 
        onClick={() => setOpen(true)}
        className="text-muted-foreground flex gap-2"
      >
        <Search className="h-4 w-4" />
        Search assets...
        <kbd className="ml-2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search crypto assets..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandItem onSelect={handleSelect}>
            Analyze "{debouncedQuery}"
          </CommandItem>
        </CommandList>
      </CommandDialog>
    </>
  );
}
