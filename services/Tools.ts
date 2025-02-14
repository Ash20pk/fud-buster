import { Tool } from "@langchain/core/tools";
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

export class PriceTool extends Tool {
    name = "price_data";
    description = "Fetches current cryptocurrency price data using CoinGecko. Use this format bitcoin for Bitcoin, ethereum for Ethereum, etc.";
    private rateLimiter: RateLimiter;
    private cache: Map<string, { timestamp: number; data: any }>;
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    private readonly COINGECKO_URL = "https://api.coingecko.com/api/v3";

    constructor() {
        super();
        this.rateLimiter = new RateLimiter(10);
        this.cache = new Map();
    }

    private mapSymbolToCoinId(symbol: string): string {
        const symbolMap: {[key: string]: string} = {
            'btc': 'bitcoin',
            'eth': 'ethereum',
            'bnb': 'binancecoin',
            'xrp': 'ripple',
            'ada': 'cardano',
            'sol': 'solana'
        };
        return symbolMap[symbol.toLowerCase()] || symbol.toLowerCase();
    }

    public async fetchPrice(symbol: string): Promise<any> {
        const cacheKey = `${symbol.toLowerCase()}_price`;
        const cachedData = this.cache.get(cacheKey);

        if (cachedData && Date.now() - cachedData.timestamp < this.CACHE_DURATION) {
            return cachedData.data;
        }

        await this.rateLimiter.waitForNext();

        const coinId = this.mapSymbolToCoinId(symbol);
        const url = `${this.COINGECKO_URL}/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true&include_market_cap=true`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`CoinGecko API Error: ${response.status} ${response.statusText}`);
        }
        
        const priceData = await response.json();
        const processedData = {
            symbol: symbol.toUpperCase(),
            price: priceData[coinId].usd,
            volume_24h: priceData[coinId].usd_24h_vol,
            price_change_24h: priceData[coinId].usd_24h_change,
            market_cap: priceData[coinId].usd_market_cap,
            timestamp: Date.now()
        };

        this.cache.set(cacheKey, {
            timestamp: Date.now(),
            data: processedData
        });

        return processedData;
    }

    async _call(symbol: string): Promise<string> {
        try {
            const priceData = await this.fetchPrice(symbol);
            return JSON.stringify(priceData, null, 2);
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to fetch price data: ${error.message}`);
            }
            throw error;
        }
    }
}

export class TechnicalAnalysisTool extends Tool {
    name = "technical_analysis";
    description = "Provides technical analysis indicators for cryptocurrencies using TAAPI.io. Use this format BTC for Bitcoin, ETH for Ethereum, etc.";
    private rateLimiter: RateLimiter;
    private cache: Map<string, { timestamp: number; data: any }>;
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    private readonly TAAPI_URL = "https://api.taapi.io/bulk";
    private readonly TAAPI_SECRET = process.env.TAAPI_KEY || ""; // Use environment variable

    constructor() {
        super();
        this.rateLimiter = new RateLimiter(10);
        this.cache = new Map();
    }

    private findIndicatorValue(taapiData: any, id: string): any {
        const indicator = taapiData.data.find((item: any) => item.id === id);
        return indicator?.result || null;
    }

    public async fetchTechnicalIndicators(symbol: string): Promise<any> {
        const cacheKey = `${symbol.toLowerCase()}_indicators`;
        const cachedData = this.cache.get(cacheKey);

        if (cachedData && Date.now() - cachedData.timestamp < this.CACHE_DURATION) {
            return cachedData.data;
        }

        await this.rateLimiter.waitForNext();

        const payload = {
            secret: this.TAAPI_SECRET,
            construct: {
                exchange: "binance",
                symbol: `${symbol}/USDT`,
                interval: "1h",
                indicators: [
                    { id: "rsi", indicator: "rsi", period: 14 },
                    { id: "bbands", indicator: "bbands", period: 20 },
                    { id: "macd", indicator: "macd", optInFastPeriod: 12, optInSlowPeriod: 26, optInSignalPeriod: 9 },
                    { id: "adx", indicator: "adx", period: 14 },
                    { id: "obv", indicator: "obv" },
                    { id: "ema", indicator: "ema", period: 20 },
                    { id: "ema50", indicator: "ema", period: 50 },
                    { id: "sma", indicator: "sma", period: 200 }
                ]
            }
        };

        const response = await fetch(this.TAAPI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`TAAPI Error: ${response.status} ${response.statusText}`);
        }

        const taapiData = await response.json();

        const processedIndicators = {
            symbol: symbol.toUpperCase(),
            rsi: this.findIndicatorValue(taapiData, 'rsi')?.value || null,
            macd: {
                value: this.findIndicatorValue(taapiData, 'macd')?.valueMACD || null,
                signal: this.findIndicatorValue(taapiData, 'macd')?.valueMACDSignal || null,
                histogram: this.findIndicatorValue(taapiData, 'macd')?.valueMACDHist || null
            },
            bollinger_bands: {
                upper: this.findIndicatorValue(taapiData, 'bbands')?.valueUpperBand || null,
                middle: this.findIndicatorValue(taapiData, 'bbands')?.valueMiddleBand || null,
                lower: this.findIndicatorValue(taapiData, 'bbands')?.valueLowerBand || null
            },
            adx: this.findIndicatorValue(taapiData, 'adx')?.value || null,
            obv: this.findIndicatorValue(taapiData, 'obv')?.value || null,
            ema: {
                ema_20: this.findIndicatorValue(taapiData, 'ema')?.value || null,
                ema_50: this.findIndicatorValue(taapiData, 'ema50')?.value || null
            },
            sma_200: this.findIndicatorValue(taapiData, 'sma')?.value || null,
            timestamp: Date.now()
        };

        this.cache.set(cacheKey, {
            timestamp: Date.now(),
            data: processedIndicators
        });

        return processedIndicators;
    }

    async _call(symbol: string): Promise<string> {
        try {
            const technicalData = await this.fetchTechnicalIndicators(symbol);
            return JSON.stringify(technicalData, null, 2);
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to fetch technical indicators: ${error.message}`);
            }
            throw error;
        }
    }
}