'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { FUDAnalysisDialog } from './FUDAnalysis';
import { SearchDialog } from '@/components/SearchDialog';

interface PortfolioAsset {
  coin: string;
  amount: number;
  value: number;
  lastUpdated: string;
  fudScore?: number;
}

interface ProcessStep {
  label: string;
  status: 'pending' | 'loading' | 'complete' | 'error';
  data?: any;
}

interface AnalysisResult {
  summary: string;
  scores: {
    fud: number;
    sentiment: number;
    technical: number;
  };
  marketData: {
    price: number;
    change24h: number;
    volume24h: number;
  };
  risks: string[];
  action: {
    recommendation: string;
    confidence: number;
    rationale: string;
  };
}

interface PortfolioProps {
  walletId: string;
  addresses: string[];
}

const Portfolio: React.FC<PortfolioProps> = ({ walletId, addresses }) => {
  const [assets, setAssets] = useState<PortfolioAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisSteps, setAnalysisSteps] = useState<ProcessStep[]>([
    { label: 'Gathering market data', status: 'pending' },
    { label: 'Analyzing social sentiment', status: 'pending' },
    { label: 'Evaluating technical indicators', status: 'pending' },
    { label: 'Generating FUD analysis', status: 'pending' }
  ]);
  const [finalAnalysis, setFinalAnalysis] = useState<AnalysisResult | undefined>();
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        const response = await fetch(`/api/portfolio?walletId=${walletId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch portfolio');
        }
        const data = await response.json();
        setAssets(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch portfolio';
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolio();
    const intervalId = setInterval(fetchPortfolio, 30000);
    return () => clearInterval(intervalId);
  }, [walletId]);

  const handleAssetClick = async (coin: string) => {
    setSelectedAsset(coin);
    setAnalysisOpen(true);
    setAnalysisSteps(steps => steps.map(step => ({ ...step, status: 'pending' })));
    setFinalAnalysis(undefined);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coinName: coin })
      });

      if (!response.ok || !response.body) {
        throw new Error('Analysis failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let currentStep = 0;
      let analysisData: any = {};

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              // Update steps based on the type of data received
              if (data.type === 'tools') {
                setAnalysisSteps(steps => steps.map((step, index) => 
                  index === currentStep 
                    ? { ...step, status: 'complete' }
                    : index === currentStep + 1
                    ? { ...step, status: 'loading' }
                    : step
                ));
                currentStep++;

                // Store relevant data
                if (data.content && typeof data.content === 'string') {
                  try {
                    // Try parsing as JSON first
                    const contentData = JSON.parse(data.content);
                    if (contentData.price) {
                      analysisData.marketData = {
                        price: contentData.price,
                        change24h: contentData.price_change_24h,
                        volume24h: contentData.volume_24h
                      };
                    }
                  } catch (jsonError) {
                    // If not JSON, check for specific content types
                    const marketDataMatch = data.content.match(/Market Data:\s*{([^}]+)}/);
                    if (marketDataMatch) {
                      try {
                        const marketData = JSON.parse(`{${marketDataMatch[1]}}`);
                        analysisData.marketData = {
                          price: marketData.price || 0,
                          change24h: marketData.change24h || 0,
                          volume24h: marketData.volume24h || 0
                        };
                      } catch (parseError) {
                        console.error('Failed to parse market data:', parseError);
                      }
                    }
                  }
                }
              }

              // Process final analysis
              if (data.type === 'agent' && data.content && !data.steps) {
                const content = data.content;
                
                // Extract data from the content and format it
                const fudScoreMatch = content.match(/FUD Level: (\d+\.?\d*)/);
                const sentimentMatch = content.match(/Social Sentiment: (-?\d+\.?\d*)/);
                const technicalMatch = content.match(/Technical Health: (\d+)/);
                const confidenceMatch = content.match(/Confidence Level: (\d+)/);
                
                // Safely extract risks
                const risksSection = content.includes('Key Risks:') 
                  ? content.split('Key Risks:')[1]?.split('Recommended Action:')[0] 
                  : '';
                
                const risks = risksSection 
                  ? risksSection
                      .split('\n')
                      .filter(line => 
                        /^\d+\./.test(line.trim())
                      )
                      .map(line => line.replace(/^\d+\.\s*/, '').trim())
                  : [];

                const analysis: AnalysisResult = {
                  summary: content.split('\n')[0],
                  scores: {
                    fud: fudScoreMatch ? parseFloat(fudScoreMatch[1]) : 0,
                    sentiment: sentimentMatch ? parseFloat(sentimentMatch[1]) : 0,
                    technical: technicalMatch ? parseFloat(technicalMatch[1]) : 0
                  },
                  marketData: analysisData.marketData || {
                    price: 0,
                    change24h: 0,
                    volume24h: 0
                  },
                  risks: risks,
                  action: {
                    recommendation: content.match(/Recommended Action: (\w+)/)?.[1] || 'HOLD',
                    confidence: confidenceMatch ? parseInt(confidenceMatch[1]) : 0,
                    rationale: content.includes('Rationale:') 
                      ? content.split('Rationale:')[1]?.trim() 
                      : ''
                  }
                };

                setFinalAnalysis(analysis);
                
                // Update the asset's FUD score
                setAssets(prevAssets => 
                  prevAssets.map(asset => 
                    asset.coin === coin 
                      ? { ...asset, fudScore: analysis.scores.fud }
                      : asset
                  )
                );

                // Mark all steps as complete
                setAnalysisSteps(steps => steps.map(step => ({ ...step, status: 'complete' })));
              }
            } catch (e) {
              console.error('Failed to parse streaming data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Analysis failed:', error);
      setAnalysisSteps(steps => steps.map(step => 
        step.status === 'loading' ? { ...step, status: 'error' } : step
      ));
      toast.error(`Failed to analyze ${coin}`);
    }
  };

  const getFUDScoreColor = (score?: number) => {
    if (!score) return 'bg-gray-100 text-gray-800';
    if (score > 70) return 'bg-red-100 text-red-800';
    if (score > 40) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  return (
    <div className="space-y-6">
      <SearchDialog onAnalysisSelected={setSelectedAnalysis} />
      
      {selectedAnalysis && (
        <FUDAnalysisDialog
          open={!!selectedAnalysis}
          onOpenChange={() => setSelectedAnalysis(null)}
          coinName={selectedAnalysis.summary}
          steps={[]}
          finalAnalysis={selectedAnalysis}
        />
      )}
      
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Your Portfolio</span>
            {!loading && !error && (
              <span className="text-sm font-normal text-gray-500">
                {assets.length} {assets.length === 1 ? 'Asset' : 'Assets'}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : assets.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No assets found in this wallet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Token</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Value (USD)</TableHead>
                    <TableHead className="text-center">FUD Score</TableHead>
                    <TableHead>Last Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((asset) => (
                    <TableRow 
                      key={asset.coin}
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => handleAssetClick(asset.coin)}
                    >
                      <TableCell className="font-medium">{asset.coin}</TableCell>
                      <TableCell className="text-right">{asset.amount.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        ${asset.value.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        {asset.fudScore && (
                          <div 
                            className={`px-2 py-1 rounded-full text-center inline-block min-w-16 ${
                              getFUDScoreColor(asset.fudScore)
                            }`}
                          >
                            {asset.fudScore}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(asset.lastUpdated).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <FUDAnalysisDialog
        open={analysisOpen}
        onOpenChange={setAnalysisOpen}
        coinName={selectedAsset || ''}
        steps={analysisSteps}
        finalAnalysis={finalAnalysis}
      />
    </div>
  );
};

export default Portfolio;
