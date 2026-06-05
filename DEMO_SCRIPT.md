# Keeper — 2-minute demo script

> Conversational narration for the demo video. Walks problem → live demo → the proof.

---

Hello everyone, my name is Abhinav, and I've built Keeper, an agentic returns-rescue system for the streetwear brand Pretty Fly.

Returns are every store's worst nightmare. Shoppers sent back over $800 billion of merchandise last year, and for clothing, the number-one reason is the wrong size. Over two years, returns cost Pretty Fly £602,000, and more than half of that, £306,000, was nothing but sizing.

Most brands just refund and move on. Keeper intercepts the return, makes the smartest call, and learns from every one. Let's see how it works.

We're logged in as a real customer, Aisha, looking at her real past orders. She's returning her Heritage Tee, because it came up too small. As this is a demo, you'll see two buttons. "Continue" is the normal customer path. "Agent View" lets us look behind the curtain. In production the customer only ever sees one button, and everything else runs silently in the background.

Behind that single click, a swarm of specialised agents springs to life, all running on open-source models through Fireworks. That's deliberate: all of Pretty Fly's customer data stays inside their own walls, and nothing is ever sent to a third party like OpenAI or Anthropic.

Here we can see multiple agents firing in the background. For example, the Triage agent reads Aisha's message first and works out why she's returning, whether it's sizing, quality, or a change of mind, and it reads her sentiment. The Context agent then loads everything we know about her from her customer passport. The passport is a memory profile Keeper has built for all 22,000 customers from their real order history: every size they've kept, every size they've sent back, and how much a discount moves them.

Here we can actually see that memory. Every dot is one real customer. The bright ones are our highest-value shoppers, and there's Aisha, glowing. Keeper knows her.

From there it's a chain. Fit picks the corrective size; she said too small, so we size her up to an M. Inventory confirms that M is in stock right now. Economics weighs a refund against an exchange, and Concierge writes the offer. And here's a critical design choice. The deterministic engine owns every money calculation, and the agentic layer owns the decision-making and the actions. That means there's never a hallucination when it comes to money, or any risk of mistreating a customer.

The verdict: exchange to the M. A refund would lose the whole £55. The exchange keeps £31.67 of margin instead. That's £86.67 better than refunding, on a single tee.

And here's what makes Keeper adaptive. It doesn't just resolve this return, it learns from it. The moment Aisha accepts, it writes the outcome straight back into memory. You can see the note here. It flags the pattern for the buying team, so the next shopper who looks at this tee gets a "size up" nudge before they ever buy. Every return makes the system smarter.

The customer can even talk it through. Our ElevenLabs voice concierge makes the offer, listens, and on a simple "yes" it books the exchange itself, then hangs up. Fully hands-free.

Finally, the operator's view. This is the proof. We back-tested Keeper across Pretty Fly's entire history, all 5,843 real refunds over two years, with no AI in the loop, so every number is reproducible to the penny.

Here's what we found in that £306,000 lost to sizing. Six in ten of those returns could have been saved on the spot, because the right size was sitting in stock the moment the customer sent the item back. That alone is £108,000 of pure margin Keeper recovers.

Another fifth had a perfect fix, but the size was out of stock at the time. That's a £67,000 inventory problem, not a returns problem, so Keeper hands it straight to the buying team.

And one product line stands out: trainers, because trainers run small. So Keeper does two things at once. It turns a back-office cost centre into recovered margin, and it shows you exactly how to stop the leak at its source.

That's Keeper. The engine decides, the agents explain, and the ledger proves it. We turn Pretty Fly's biggest leak into kept sales, and the system gets smarter every single time.
