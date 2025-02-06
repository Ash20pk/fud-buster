export interface NewsItem {
    title: string;
    url: string;
    published_at: string;
    source: string;
    domain: string;
    description?: string;
  }
  
  export interface SentimentAnalysis {
    fudLevel: number;
    concerns: string[];
    counterpoints: string[];
    marketImpact: string;
  }
  
  export interface AnalysisResponse {
    success: boolean;
    data: {
      news: NewsItem[];
      analysis: SentimentAnalysis;
    };
  }
  
  export interface ErrorResponse {
    error: string;
  }
  
  // API request types
  export interface AnalyzeRequest {
    coinName: string;
  }

  export interface NewsCache {
    timestamp: number;
    data: any;
}

export interface ArticleMetrics {
    sourceReliability: number;
    relevanceScore: number;
    impactScore: number;
}

export interface SocialCache {
    timestamp: number;
    data: any;
}