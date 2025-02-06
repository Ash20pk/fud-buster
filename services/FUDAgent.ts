import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { SystemMessage } from "@langchain/core/messages";
import { CryptoNewsTool, SocialDataTool, MarketDataTool } from "./Tools";
import { ChatAnthropic } from "@langchain/anthropic";

const llm = new ChatAnthropic({
    modelName: "claude-3-5-sonnet-20241022",
    temperature: 0,
  });

export const fudAgent = createReactAgent({
  llm,
  tools: [new CryptoNewsTool(), new SocialDataTool(), new MarketDataTool()],
  stateModifier: new SystemMessage("You are a cryptocurrency analysis expert specializing in FUD pattern recognition using social data and crypto news and technical analysis.")
})
