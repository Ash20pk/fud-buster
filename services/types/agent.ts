export interface NewsItem {
    title: string;
    url: string;
    published_at: string;
    source: string;
    domain: string;
  }
  
  export interface SocialSentiment {
    twitter_sentiment: number;
    reddit_sentiment: number;
    total_mentions: number;
    sentiment_change_24h: number;
  }
  
  export interface FUDPatterns {
    fear_triggers: string[];
    uncertainty_factors: string[];
    doubt_elements: string[];
    severity: number;
    confidence: number;
  }
  
  export interface MarketData {
    price: number;
    volume_24h: number;
    market_cap: number;
    price_change_24h: number;
  }
  
  export interface FUDState {
    coinName: string;
    news?: NewsItem[];
    social_sentiment?: SocialSentiment;
    fud_patterns?: FUDPatterns;
    market_data?: MarketData;
    error?: string;
    completed_steps: string[];
  }
  
  export interface AgentInput {
    coinName: string;
    checkSocial?: boolean;
    checkMarket?: boolean;
  }
  
  export type FUDAction = 
    | { type: "FETCH_NEWS" }
    | { type: "ANALYZE_SENTIMENT" }
    | { type: "CHECK_MARKET" }
    | { type: "ANALYZE_FUD" }
    | { type: "FINAL_REPORT" };
  
  export interface FUDResponse {
    success: boolean;
    data: {
      news: NewsItem[];
      social_sentiment: SocialSentiment;
      fud_patterns: FUDPatterns;
      market_data: MarketData;
    };
  }