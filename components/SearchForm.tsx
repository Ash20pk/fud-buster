'use client';

import { useState } from 'react';
import { NewsResults } from './NewsResults';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ReloadIcon } from '@radix-ui/react-icons';

interface Message {
    type: string;
    steps?: {
        type: 'text' | 'tool_use';
        content: string;
    }[];
    content?: string;
}

interface Results {
    agent: Message[];
    tools: Message[];
}

export function SearchForm() {
    const [coinName, setCoinName] = useState('');
    const [results, setResults] = useState<Results>({ agent: [], tools: [] });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!coinName.trim()) return;

        setIsLoading(true);
        setError('');
        setResults({ agent: [], tools: [] });

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ coinName }),
            });

            if (!response.ok) throw new Error('Failed to analyze');
            if (!response.body) throw new Error('No response body');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            setResults(prev => {
                                if (data.type === 'agent') {
                                    return {
                                        ...prev,
                                        agent: [...prev.agent, data]
                                    };
                                } else if (data.type === 'tools') {
                                    return {
                                        ...prev,
                                        tools: [...prev.tools, data]
                                    };
                                }
                                return prev;
                            });
                        } catch (e) {
                            console.error('Failed to parse streaming data:', e);
                        }
                    }
                }
            }
        } catch (err) {
            setError('Failed to analyze. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            <form onSubmit={handleSubmit} className="flex gap-4 max-w-2xl mx-auto">
                <Input
                    type="text"
                    value={coinName}
                    onChange={(e) => setCoinName(e.target.value)}
                    placeholder="Enter cryptocurrency name (e.g., Bitcoin, Ethereum)"
                    className="flex-1"
                    disabled={isLoading}
                />
                <Button type="submit" disabled={isLoading || !coinName}>
                    {isLoading ? (
                        <>
                            <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                            Analyzing
                        </>
                    ) : (
                        'Analyze'
                    )}
                </Button>
            </form>

            {error && (
                <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {(results.agent.length > 0 || results.tools.length > 0) && (
                <NewsResults results={results} />
            )}
        </div>
    );
}