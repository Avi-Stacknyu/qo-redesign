<script lang="ts">
  import { Badge } from '$lib/components/ui/badge';

  type Article = {
    category: string;
    time: string;
    headline: string;
    body: string;
    image: string;
  };

  type FeedConfig = {
    articles?: Article[];
    filters?: string[];
  };

  let { config = {}, activeFilter = $bindable('Markets') }: { config?: FeedConfig; activeFilter?: string } = $props();

  const DEFAULT_FILTERS = ['Markets', 'Tech', 'Policy'];

  const DEFAULT_ARTICLES: Article[] = [
    {
      category: 'MARKETS',
      time: '5M AGO',
      headline: 'Digital Asset Correlation Peaks at Record Highs',
      body: 'New quantitative models suggest a shifting landscape in algorithmic trading protocols as liquidity flows migrate towards high-density decentralized pools.',
      image: '/images/markets.jpg',
    },
    {
      category: 'TECH',
      time: '2H AGO',
      headline: 'Quantum Encryption Standards Released for PMs',
      body: 'The latest whitepaper outlines the necessity for quantum-resistant ledger architectures in private wealth management systems following recent breakthroughs.',
      image: '/images/tech.jpg',
    },
    {
      category: 'GLOBAL',
      time: '1D AGO',
      headline: 'Cross-Border Capital Flows Stabilize in Q3',
      body: 'Macroeconomic indicators point toward a soft landing for global emerging markets as central banks pivot towards more accommodative stances.',
      image: '/images/global.jpg',
    },
  ];

  let filters = $derived(config.filters?.length ? config.filters : DEFAULT_FILTERS);
  let articles = $derived(config.articles?.length ? config.articles : DEFAULT_ARTICLES);
</script>

<div>
  <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
      {#each articles as article}
        <div class="group cursor-pointer space-y-3">
          <!-- Image -->
          <div class="aspect-video overflow-hidden rounded-2xl bg-[#d3e4fe]">
            <img
              src={article.image}
              alt={article.headline}
              class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          </div>

          <!-- Meta badge -->
          <Badge
            variant="outline"
            class="border-0 bg-transparent px-0 text-[11px] font-bold tracking-widest text-[#6b38d4]"
          >
            {article.category} • {article.time}
          </Badge>

          <!-- Headline -->
          <h4
            class="font-Inter text-lg font-semibold leading-snug text-primary"
          >
            {article.headline}
          </h4>

          <!-- Body -->
          <p class="line-clamp-2 font-Inter text-sm leading-relaxed text-muted-foreground">
            {article.body}
          </p>
        </div>
      {/each}
    </div>
</div>