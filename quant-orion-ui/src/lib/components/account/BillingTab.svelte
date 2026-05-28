<script lang="ts">
  import PricingCard from "./PricingCard.svelte";

  type Plan = {
    name: string;
    price: number | string;
    description: string;
    features: string[];
    badge?: string;
    highlighted?: boolean;
    ctaLabel?: string;
  };

  const plans: Plan[] = $state([
    {
      name: "Starter",
      price: 0,
      description: "Perfect for individuals just getting started.",
      features: [
        "5 projects",
        "1 GB storage",
        "Basic analytics",
        "Email support",
      ],
      ctaLabel: "Start for free",
    },
    {
      name: "Pro",
      price: 19,
      description: "For professionals who need more power.",
      features: [
        "Unlimited projects",
        "20 GB storage",
        "Advanced analytics",
        "Priority support",
        "Custom domains",
      ],
      badge: "Most popular",
      highlighted: true,
      ctaLabel: "Get Pro",
    },
    {
      name: "Enterprise",
      price: 79,
      description: "For teams and organisations at scale.",
      features: [
        "Everything in Pro",
        "500 GB storage",
        "SSO & audit logs",
        "Dedicated manager",
        "SLA guarantee",
        "Custom contracts",
      ],
      ctaLabel: "Contact sales",
    },
  ]);
</script>

<div class="flex w-full flex-col gap-10 p-4">
  <div class="flex flex-col gap-1.5">
    <h2 class="font-medium font-Inter text-3xl">Subscription Plans</h2>
    <p class="text-muted-foreground font-light text-lg">
      Choose your default model. Per-chat overrides are available in the chat input.
    </p>
  </div>

  <div class="grid grid-cols-1 gap-12 sm:grid-cols-3">
    {#each plans as plan}
      <PricingCard
        name={plan.name}
        price={plan.price}
        description={plan.description}
        features={plan.features}
        badge={plan.badge ?? ''}
        highlighted={plan.highlighted ?? false}
        ctaLabel={plan.ctaLabel}
      />
    {/each}
  </div>
</div>