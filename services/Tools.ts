import { Tool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { NewsCache, ArticleMetrics, SocialCache } from "@/services/types/api";

// Rate limiter implementation
class RateLimiter {
    private lastCallTime: number = 0;
    private minInterval: number;

    constructor(requestsPerSecond: number) {
        this.minInterval = 1000 / requestsPerSecond;
    }

    async waitForNext(): Promise<void> {
        const now = Date.now();
        const timeSinceLastCall = now - this.lastCallTime;
        
        if (timeSinceLastCall < this.minInterval) {
            const waitTime = this.minInterval - timeSinceLastCall;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        this.lastCallTime = Date.now();
    }
}

export class CryptoNewsTool extends Tool {
    name = "crypto_news";
    description = "Fetches and analyzes cryptocurrency news with sentiment analysis";
    private rateLimiter: RateLimiter;
    private cache: Map<string, NewsCache>;
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY = 1000; // 1 second

    constructor() {
        super();
        this.rateLimiter = new RateLimiter(5);
        this.cache = new Map();
    }

    private getCacheKey(query: string, filter: string): string {
        return `${query.toLowerCase()}_${filter}`;
    }

    private isCacheValid(cacheEntry: NewsCache): boolean {
        return Date.now() - cacheEntry.timestamp < this.CACHE_DURATION;
    }

    private async fetchWithRetry(url: string, options: RequestInit, retryCount = 0): Promise<Response> {
        try {
            const response = await fetch(url, options);
            if (!response.ok && retryCount < this.MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * Math.pow(2, retryCount)));
                return this.fetchWithRetry(url, options, retryCount + 1);
            }
            return response;
        } catch (error) {
            if (retryCount < this.MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * Math.pow(2, retryCount)));
                return this.fetchWithRetry(url, options, retryCount + 1);
            }
            throw error;
        }
    }

    private calculateArticleMetrics(article: any): ArticleMetrics {
        // Source reliability based on domain reputation (example values)
        const reliableSourceDomains = ['bloomberg.com', 'reuters.com', 'coindesk.com', 'cointelegraph.com'];
        const sourceUrl = new URL(article.url).hostname;
        const sourceReliability = reliableSourceDomains.includes(sourceUrl) ? 1 : 0.7;

        // Relevance score based on title keywords and timestamp
        const relevantKeywords = ['hack', 'security', 'regulation', 'ban', 'adoption', 'partnership'];
        const titleWords = article.title.toLowerCase().split(' ');
        const keywordMatches = relevantKeywords.filter(kw => titleWords.includes(kw)).length;
        const relevanceScore = Math.min(1, keywordMatches * 0.2 + 0.5);

        // Impact score based on votes and comments
        const votesWeight = article.votes ? Math.min(1, article.votes / 100) : 0;
        const impactScore = (sourceReliability + relevanceScore + votesWeight) / 3;

        return {
            sourceReliability,
            relevanceScore,
            impactScore
        };
    }

    private async fetchNewsWithFilter(query: string, filter: string): Promise<any> {
        const cacheKey = this.getCacheKey(query, filter);
        const cachedData = this.cache.get(cacheKey);

        if (cachedData && this.isCacheValid(cachedData)) {
            return cachedData.data;
        }

        try {
            await this.rateLimiter.waitForNext();
            
            const response = await this.fetchWithRetry(
                `https://cryptopanic.com/api/v1/posts/?auth_token=${process.env.CRYPTOPANIC_API_KEY}&currencies=${query}&filter=${filter}&public=true`,
                {
                    headers: {
                        'Accept': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                console.error(`API Error (${filter}):`, response.status, response.statusText);
                return { results: [] };
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                console.error(`Invalid content type (${filter}):`, contentType);
                return { results: [] };
            }

            const data = await response.json();
            this.cache.set(cacheKey, {
                timestamp: Date.now(),
                data
            });

            return data;
        } catch (error) {
            console.error(`Fetch error (${filter}):`, error);
            return { results: [] };
        }
    }

    private formatArticles(articles: any[], sentiment: string) {
        return articles
            .slice(0, 3)
            .map((item: any) => {
                const metrics = this.calculateArticleMetrics(item);
                return {
                    title: item.title,
                    url: item.url,
                    source: item.source?.title || 'Unknown Source',
                    domain: new URL(item.url).hostname,
                    sentiment,
                    published_at: item.published_at,
                    metrics,
                    votes: item.votes || 0,
                    domain_score: metrics.sourceReliability,
                    relevance_score: metrics.relevanceScore,
                    impact_score: metrics.impactScore
                };
            })
            .sort((a, b) => b.impact_score - a.impact_score);
    }

    async _call(query: string): Promise<string> {
        try {
            const [bearish, bullish] = await Promise.all([
                this.fetchNewsWithFilter(query, 'bearish'),
                this.fetchNewsWithFilter(query, 'bullish')
            ]);

            const articles: any = {
                bearish: this.formatArticles(bearish.results || [], 'bearish'),
                bullish: this.formatArticles(bullish.results || [], 'bullish')
            };

            const totalArticles = articles.bearish.length + articles.bullish.length;
            
            if (totalArticles < 5) {
                const trending = await this.fetchNewsWithFilter(query, 'rising');
                articles.trending = this.formatArticles(trending.results || [], 'trending');
            }

            // Calculate aggregate metrics
            const allArticles = [...articles.bearish, ...articles.bullish, ...(articles.trending || [])];
            const averageImpact = allArticles.reduce((sum, article) => sum + article.impact_score, 0) / allArticles.length;
            const highImpactCount = allArticles.filter(article => article.impact_score > 0.7).length;

            const summary = {
                articleCounts: {
                    bullish: articles.bullish.length,
                    bearish: articles.bearish.length,
                    trending: articles.trending?.length || 0
                },
                metrics: {
                    averageImpact,
                    highImpactArticles: highImpactCount,
                    overallSentiment: articles.bullish.length > articles.bearish.length ? 'bullish' : 'bearish'
                }
            };

            return JSON.stringify({
                summary,
                articles,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('News processing error:', error);
            return JSON.stringify({
                summary: {
                    articleCounts: { bullish: 0, bearish: 0, trending: 0 },
                    metrics: { averageImpact: 0, highImpactArticles: 0, overallSentiment: 'neutral' }
                },
                articles: {
                    bearish: [],
                    bullish: []
                },
                timestamp: Date.now()
            });
        }
    }
}

export class SocialDataTool extends Tool {
    name = "social_data";
    description = "Analyzes Twitter sentiment and engagement for cryptocurrency discussions";
    private rateLimiter: RateLimiter;
    private cache: Map<string, SocialCache>;
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY = 1000;

    constructor() {
        super();
        this.rateLimiter = new RateLimiter(10);
        this.cache = new Map();
    }

    private getCacheKey(query: string): string {
        return `twitter_${query.toLowerCase()}`;
    }

    private isCacheValid(cacheEntry: SocialCache): boolean {
        return Date.now() - cacheEntry.timestamp < this.CACHE_DURATION;
    }

    private async fetchWithRetry(url: string, options: RequestInit, retryCount = 0): Promise<Response> {
        try {
            const response = await fetch(url, options);
            if (!response.ok && retryCount < this.MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * Math.pow(2, retryCount)));
                return this.fetchWithRetry(url, options, retryCount + 1);
            }
            return response;
        } catch (error) {
            if (retryCount < this.MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * Math.pow(2, retryCount)));
                return this.fetchWithRetry(url, options, retryCount + 1);
            }
            throw error;
        }
    }

    private async fetchTwitterData(query: string): Promise<any> {
        const cacheKey = this.getCacheKey(query);
        const cachedData = this.cache.get(cacheKey);

        if (cachedData && this.isCacheValid(cachedData)) {
            return cachedData.data;
        }

        try {
            await this.rateLimiter.waitForNext();

            // Calculate timestamps for the last 2 days
            const now = Math.floor(Date.now() / 1000); // Current time in seconds
            const twoDaysAgo = now - (2 * 24 * 60 * 60); // 2 days ago in seconds

            // Build the search query with time range
            const searchQuery = encodeURIComponent(`${query} crypto -is:retweet`);
            const url = `https://api.socialdata.tools/twitter/search?query=${searchQuery}&type=Top&since_time=${twoDaysAgo}&until_time=${now}&filter:blue_verified`;
            
            console.log('Fetching from URL:', url);
            
            const response = await this.fetchWithRetry(
                url,
                {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${process.env.SOCIALDATA_API_KEY}`
                    }
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Twitter API Error:', {
                    status: response.status,
                    statusText: response.statusText,
                    body: errorText.substring(0, 200)
                });
                return null;
            }

            const rawData = await response.json();
            console.log('Raw API Response:', JSON.stringify(rawData).substring(0, 500));

            // Check if the response is already an array or needs to be extracted
            const tweets = Array.isArray(rawData) ? rawData : 
                         Array.isArray(rawData.data) ? rawData.data :
                         Array.isArray(rawData.tweets) ? rawData.tweets : null;

            if (!tweets) {
                console.error('Unexpected API response structure:', rawData);
                return null;
            }

            console.log(`Processing ${tweets.length} tweets`);
            const processedData = this.processTwitterData(tweets);
            
            if (processedData) {
                this.cache.set(cacheKey, {
                    timestamp: Date.now(),
                    data: processedData
                });
            }

            return processedData;
        } catch (error) {
            console.error('Twitter fetch error:', {
                message: error.message,
                stack: error.stack
            });
            return null;
        }
    }

    private processTwitterData(data: any): any {
        if (!data || !Array.isArray(data)) {
            return null;
        }

        const tweets = data;
        let totalSentiment = 0;
        let totalEngagement = 0;

        const processedTweets = tweets.map(tweet => {
            const text = tweet.full_text || tweet.text;
            const sentiment = this.calculateSentiment(text);
            const engagement = (tweet.retweet_count || 0) + 
                             (tweet.favorite_count || 0) +
                             (tweet.reply_count || 0) +
                             (tweet.quote_count || 0);

            totalSentiment += sentiment;
            totalEngagement += engagement;

            return {
                id: tweet.id_str,
                text: text,
                created_at: tweet.tweet_created_at,
                sentiment,
                engagement,
                metrics: {
                    retweet_count: tweet.retweet_count || 0,
                    like_count: tweet.favorite_count || 0,
                    reply_count: tweet.reply_count || 0,
                    quote_count: tweet.quote_count || 0,
                    view_count: tweet.views_count || 0
                },
                url: `https://twitter.com/i/web/status/${tweet.id_str}`,
                author: tweet.user // Note: user object contains author details
            };
        });

        return {
            metrics: {
                tweet_count: tweets.length,
                average_sentiment: tweets.length ? totalSentiment / tweets.length : 0,
                total_engagement: totalEngagement,
                average_engagement: tweets.length ? totalEngagement / tweets.length : 0
            },
            tweets: processedTweets.sort((a, b) => b.engagement - a.engagement).slice(0, 10) // Top 10 by engagement
        };
    }

    private calculateSentiment(text: string): number {
        const positiveWords = new Set([
            'bullish', 'moon', 'pump', 'buy', 'good', 'great', 'excellent',
            'amazing', 'positive', 'up', 'growth', 'growing', 'success',
            'potential', 'opportunity', 'innovative', 'strong', 'confident'
        ]);
        
        const negativeWords = new Set([
            'bearish', 'dump', 'sell', 'bad', 'terrible', 'poor', 'negative',
            'down', 'crash', 'scam', 'fraud', 'fake', 'fud', 'weak', 'risk',
            'suspicious', 'concern', 'worried', 'falling', 'manipulation'
        ]);

        const words = text.toLowerCase().split(/\W+/);
        let score = 0;
        let relevantWords = 0;

        for (const word of words) {
            if (positiveWords.has(word)) {
                score += 1;
                relevantWords++;
            } else if (negativeWords.has(word)) {
                score -= 1;
                relevantWords++;
            }
        }

        return relevantWords ? score / relevantWords : 0;
    }

    async _call(query: string): Promise<string> {
        try {
            const twitterData = await this.fetchTwitterData(query);

            if (!twitterData) {
                return JSON.stringify({
                    success: false,
                    error: "Failed to fetch Twitter data",
                    timestamp: Date.now()
                });
            }

            // Calculate FUD score based on sentiment and engagement
            const fudScore = Math.max(0, Math.min(100, 
                (1 - twitterData.metrics.average_sentiment) * 100 * 
                Math.min(1, twitterData.metrics.total_engagement / 1000)
            ));

            return JSON.stringify({
                success: true,
                data: {
                    metrics: {
                        ...twitterData.metrics,
                        fudScore,
                        fudLevel: fudScore > 70 ? 'high' : fudScore > 40 ? 'medium' : 'low'
                    },
                    tweets: twitterData.tweets
                },
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('Social data processing error:', error);
            return JSON.stringify({
                success: false,
                error: "Error processing social data",
                timestamp: Date.now()
            });
        }
    }
}

export interface MarketStats {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    vwap: number;
    timestamp: number;
    transactions: number;
    market_cap?: number;
}

export interface TechnicalIndicators {
    rsi?: number;
    macd?: {
        macd: number;
        signal: number;
        histogram: number;
    };
    ema_20?: number;
    ema_50?: number;
    sma_200?: number;
}

export interface MarketAnalysis {
    symbol: string;
    stats: MarketStats;
    indicators: TechnicalIndicators;
    price_change_24h: number;
    price_change_7d?: number;
}

export class MarketDataTool extends Tool {
    name = "market_data";
    description = "Analyzes cryptocurrency market data and technical indicators";
    private rateLimiter: RateLimiter;
    private cache: Map<string, { timestamp: number; data: MarketAnalysis }>;
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    private readonly BASE_URL = "https://api.coingecko.com/api/v3";

    constructor() {
        super();
        this.rateLimiter = new RateLimiter(10); // CoinGecko allows more requests per second
        this.cache = new Map();
    }

    private async fetchData(endpoint: string): Promise<any> {
        const url = `${this.BASE_URL}${endpoint}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`CoinGecko API Error: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }

    private async getMarketData(symbol: string): Promise<any> {
        // Convert common symbols to CoinGecko IDs
        const coinId = symbol.toLowerCase() === 'btc' ? 'bitcoin' : 
                      symbol.toLowerCase() === 'eth' ? 'ethereum' : 
                      symbol.toLowerCase();
        
        const endpoint = `/coins/${coinId}/market_chart?vs_currency=usd&days=7&interval=daily`;
        return this.fetchData(endpoint);
    }

    private async getCurrentPrice(symbol: string): Promise<any> {
        const coinId = symbol.toLowerCase() === 'btc' ? 'bitcoin' : 
                      symbol.toLowerCase() === 'eth' ? 'ethereum' : 
                      symbol.toLowerCase();
        
        const endpoint = `/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true&include_7d_change=true`;
        return this.fetchData(endpoint);
    }

    private calculateRSI(prices: number[], period: number = 14): number {
        if (prices.length < period + 1) {
            return 0;
        }

        let gains = 0;
        let losses = 0;

        for (let i = 1; i <= period; i++) {
            const difference = prices[i] - prices[i - 1];
            if (difference >= 0) {
                gains += difference;
            } else {
                losses -= difference;
            }
        }

        const avgGain = gains / period;
        const avgLoss = losses / period;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    private calculateEMA(prices: number[], period: number): number[] {
        const ema: number[] = [];
        const multiplier = 2 / (period + 1);

        // Start with SMA
        let sum = 0;
        for (let i = 0; i < period; i++) {
            sum += prices[i];
        }
        ema.push(sum / period);

        // Calculate EMA
        for (let i = period; i < prices.length; i++) {
            ema.push((prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1]);
        }

        return ema;
    }

    public async analyze(symbol: string): Promise<MarketAnalysis> {
        const cacheKey = `${symbol.toLowerCase()}_analysis`;
        const cachedData = this.cache.get(cacheKey);

        if (cachedData && Date.now() - cachedData.timestamp < this.CACHE_DURATION) {
            return cachedData.data;
        }

        try {
            await this.rateLimiter.waitForNext();

            const [marketData, currentPrice] = await Promise.all([
                this.getMarketData(symbol),
                this.getCurrentPrice(symbol)
            ]);

            const coinId = symbol.toLowerCase() === 'btc' ? 'bitcoin' : 
                          symbol.toLowerCase() === 'eth' ? 'ethereum' : 
                          symbol.toLowerCase();

            const prices = marketData.prices.map((p: number[]) => p[1]);
            const volumes = marketData.total_volumes.map((v: number[]) => v[1]);
            
            const latestPrice = currentPrice[coinId].usd;
            const priceChange24h = currentPrice[coinId].usd_24h_change;
            const priceChange7d = currentPrice[coinId].usd_7d_change;
            const volume24h = currentPrice[coinId].usd_24h_vol;

            // Calculate technical indicators
            const rsi = this.calculateRSI(prices);
            const ema20 = this.calculateEMA(prices, 20);
            const ema50 = this.calculateEMA(prices, 50);

            const analysis: MarketAnalysis = {
                symbol: symbol.toUpperCase(),
                stats: {
                    open: prices[prices.length - 2], // Yesterday's close
                    high: Math.max(...prices.slice(-2)),
                    low: Math.min(...prices.slice(-2)),
                    close: latestPrice,
                    volume: volume24h,
                    vwap: prices.reduce((a, b) => a + b, 0) / prices.length,
                    timestamp: Date.now(),
                    transactions: 0 // Not available in CoinGecko's free API
                },
                indicators: {
                    rsi,
                    ema_20: ema20[ema20.length - 1],
                    ema_50: ema50[ema50.length - 1],
                    macd: 0, // Simplified version without MACD for now
                    signal: 0,
                    histogram: 0
                },
                price_change_24h: priceChange24h,
                price_change_7d: priceChange7d
            };

            this.cache.set(cacheKey, {
                timestamp: Date.now(),
                data: analysis
            });

            return analysis;
        } catch (error) {
            console.error('Market data fetch error:', error);
            throw error;
        }
    }

    async _call(symbol: string): Promise<string> {
        try {
            const analysis = await this.analyze(symbol);
            return JSON.stringify(analysis, null, 2);
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to analyze market data: ${error.message}`);
            }
            throw error;
        }
    }
}