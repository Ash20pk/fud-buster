'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Check, AlertCircle } from 'lucide-react';

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

interface FUDAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coinName: string;
  steps: ProcessStep[];
  finalAnalysis?: AnalysisResult;
}

export function FUDAnalysisDialog({
  open,
  onOpenChange,
  coinName,
  steps,
  finalAnalysis,
}: FUDAnalysisDialogProps) {
  const getStepIcon = (status: ProcessStep['status']) => {
    switch (status) {
      case 'complete':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'loading':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <div className="h-4 w-4 rounded-full border" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score > 70) return 'text-red-500';
    if (score > 40) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>FUD Analysis for {coinName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Analysis Steps */}
          <div className="space-y-2">
            {steps.map((step, index) => (
              <div
                key={index}
                className="flex items-center space-x-3 text-sm"
              >
                {getStepIcon(step.status)}
                <span className={step.status === 'loading' ? 'text-blue-500 font-medium' : ''}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>

          {/* Analysis Results */}
          {finalAnalysis && (
            <div className="space-y-4">
              {/* Summary */}
              <Card>
                <CardContent className="pt-6">
                  <p className="text-lg font-medium">{finalAnalysis.summary}</p>
                </CardContent>
              </Card>

              {/* Scores */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-sm font-medium text-gray-500">FUD Score</div>
                      <div className={`text-2xl font-bold ${getScoreColor(finalAnalysis.scores.fud)}`}>
                        {finalAnalysis.scores.fud}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-sm font-medium text-gray-500">Sentiment</div>
                      <div className={`text-2xl font-bold ${getScoreColor(finalAnalysis.scores.sentiment + 50)}`}>
                        {finalAnalysis.scores.sentiment}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-sm font-medium text-gray-500">Technical</div>
                      <div className={`text-2xl font-bold ${getScoreColor(finalAnalysis.scores.technical)}`}>
                        {finalAnalysis.scores.technical}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Market Data */}
              <Card>
                <CardContent className="pt-6">
                  <h3 className="font-medium mb-3">Market Data</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm text-gray-500">Price</div>
                      <div className="font-medium">${finalAnalysis.marketData.price.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">24h Change</div>
                      <div className={`font-medium ${finalAnalysis.marketData.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {finalAnalysis.marketData.change24h.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">24h Volume</div>
                      <div className="font-medium">${finalAnalysis.marketData.volume24h.toLocaleString()}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Risks */}
              {finalAnalysis.risks.length > 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="font-medium mb-3">Key Risks</h3>
                    <ul className="list-disc pl-4 space-y-1">
                      {finalAnalysis.risks.map((risk, index) => (
                        <li key={index} className="text-sm">{risk}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Action */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium">Recommended Action</h3>
                      <p className="text-2xl font-bold mt-1">{finalAnalysis.action.recommendation}</p>
                      <p className="text-sm text-gray-500 mt-2">{finalAnalysis.action.rationale}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Confidence</div>
                      <div className="text-lg font-medium">{finalAnalysis.action.confidence}%</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
