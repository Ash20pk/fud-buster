import { NextResponse } from 'next/server';
import { HumanMessage } from "@langchain/core/messages";
import graph from '@/services/Graph';
import { fudAgent } from '@/services/FUDAgent';

export async function POST(req: Request) {
  try {
    const { coinName } = await req.json();
    
    if (!coinName) {
      return NextResponse.json(
        { error: "Coin name is required" },
        { status: 400 }
      );
    }

    // Create a readable stream
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    // Start the analysis in the background
    (async () => {
      try {
        const iterator = await fudAgent.stream({
          messages: [
            new HumanMessage(
              `Analyze ${coinName} for FUD patterns. Consider:
               1. Recent news and developments
               2. Social media sentiment
               3. Market performance
               4. Common FUD narratives`
            ),
          ],
        });

        // Stream each chunk of the analysis
        for await (const chunk of iterator) {
          if ("agent" in chunk) {
            const content = chunk.agent.messages[0].content;
            
            if (Array.isArray(content)) {
              // For intermediate steps, include both text and tool usage
              const steps = content.map(item => {
                if (item.type === 'text') {
                  return { type: 'text', content: item.text };
                } else if (item.type === 'tool_use') {
                  return { 
                    type: 'tool_use', 
                    content: `Using ${item.name} to analyze "${item.input.input}"...`
                  };
                }
                return null;
              }).filter(Boolean);

              await writer.write(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "agent",
                    steps
                  })}\n\n`
                )
              );
            } else if (typeof content === 'string') {
              // For final analysis
              await writer.write(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "agent",
                    content: content
                  })}\n\n`
                )
              );
            }
          } else if ("tools" in chunk) {
            // Parse and format tool response
            let toolContent = chunk.tools.messages[0].content;
            try {
              const parsedContent = JSON.parse(toolContent);
              if (parsedContent.error) {
                toolContent = `Error: ${parsedContent.error}`;
              } else if (parsedContent.summary) {
                const summary = parsedContent.summary;
                toolContent = `News Summary:\n` +
                  `- Overall Sentiment: ${summary.metrics.overallSentiment}\n` +
                  `- Article Counts: ${JSON.stringify(summary.articleCounts)}\n` +
                  `- High Impact Articles: ${summary.metrics.highImpactArticles}`;
              } else {
                toolContent = JSON.stringify(parsedContent, null, 2);
              }
            } catch (e) {
              // If parsing fails, use the content as is
            }

            await writer.write(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "tools",
                  content: toolContent
                })}\n\n`
              )
            );
          }
        }

        // Close the stream
        await writer.close();
      } catch (error) {
        console.error('Streaming error:', error);
        const errorMessage = `data: ${JSON.stringify({
          type: "error",
          content: "Analysis failed"
        })}\n\n`;
        await writer.write(encoder.encode(errorMessage));
        await writer.close();
      }
    })();

    // Return the readable stream
    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: "Failed to analyze cryptocurrency" },
      { status: 500 }
    );
  }
}