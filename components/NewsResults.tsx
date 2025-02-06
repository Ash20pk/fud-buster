'use client';

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';

interface Message {
    type: string;
    steps?: {
        type: 'text' | 'tool_use';
        content: string;
    }[];
    content?: string;
}

interface NewsResultsProps {
    results: {
        agent: Message[];
        tools: Message[];
    };
}

export function NewsResults({ results }: NewsResultsProps) {
    // Initialize with empty arrays if undefined
    const agent = results?.agent || [];
    const tools = results?.tools || [];

    const renderMessage = (message: Message | undefined, index: number) => {
        if (!message) return null;

        if (Array.isArray(message.steps)) {
            return message.steps.map((step, stepIndex) => (
                <div key={`${index}-${stepIndex}`} className="space-y-2">
                    <Badge 
                        variant={step.type === 'tool_use' ? 'secondary' : 'outline'}
                    >
                        {step.type === 'tool_use' ? 'Tool Usage' : `Analysis ${index + 1}`}
                    </Badge>
                    <div className="text-sm text-gray-600 prose prose-sm max-w-none">
                        <ReactMarkdown>{step.content}</ReactMarkdown>
                    </div>
                </div>
            ));
        }
        
        if (message.content) {
            return (
                <div className="space-y-2">
                    <Badge variant="outline">
                        {message.type === 'tools' ? 'Tool Output' : 'Analysis'} {index + 1}
                    </Badge>
                    <div className="text-sm text-gray-600 prose prose-sm max-w-none">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6">
            <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
                {/* Agent Analysis Stream */}
                <Card>
                    <CardHeader>
                        <CardTitle>FUD Analysis</CardTitle>
                        <CardDescription>
                            Real-time analysis of cryptocurrency FUD patterns
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                            <div className="space-y-4">
                                {agent.map((message, index) => (
                                    <div key={index} className="space-y-2">
                                        {renderMessage(message, index)}
                                    </div>
                                ))}
                                {(!agent || agent.length === 0) && (
                                    <p className="text-sm text-gray-500 italic">
                                        Waiting for analysis...
                                    </p>
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>

                {/* Tools Output Stream */}
                <Card>
                    <CardHeader>
                        <CardTitle>Data Collection</CardTitle>
                        <CardDescription>
                            Real-time data collection from various sources
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                            <div className="space-y-4">
                                {tools.map((message, index) => (
                                    <div key={index} className="space-y-2">
                                        {renderMessage(message, index)}
                                    </div>
                                ))}
                                {(!tools || tools.length === 0) && (
                                    <p className="text-sm text-gray-500 italic">
                                        Waiting for tool outputs...
                                    </p>
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}