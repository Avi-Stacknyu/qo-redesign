<script lang="ts">
  import { ChevronLeft, ChevronRight, Ellipsis, Star } from '@lucide/svelte';
  import { Card } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Label } from '$lib/components/ui/label';

  // Checkbox state using Svelte 5 runes
  let researchChecks = $state({ userInterviews: false });
  let designChecks = $state({ wireframes: false, backend: false });
</script>

<Card class="w-full min-h-full py-4 px-5 flex flex-col gap-8">
  <!-- Header -->
  <section class="flex w-full items-center justify-between gap-4">
    <!-- Left -->
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-4 text-primary">
        <Button variant="ghost" size="icon" class="rounded-full">
          <ChevronLeft size={34} />
        </Button>
        <Button variant="ghost" size="icon" class="rounded-full">
          <ChevronRight size={34} />
        </Button>
      </div>
      <h2 class="text-lg font-semibold text-primary">Work Idea</h2>
    </div>
    <!-- Right -->
    <div class="flex items-center gap-2">
      <Button variant="secondary" class="rounded-2xl px-6 py-5 text-lg">
        Share
      </Button>
      <Star color="white" fill="#FFCC00" size={36} />
      <Button variant="ghost" size="icon" class="rounded-full">
        <Ellipsis size={36} />
      </Button>
    </div>
  </section>

  <img
    src="/images/rainbow.png"
    alt="Rainbow Img"
    class="w-full max-h-60 object-cover rounded-2xl"
  />

  <!-- <p class="text-5xl">📱</p> -->

  <!-- Info -->
  <section class="flex flex-col gap-5">
    <h2 class="text-4xl text-primary font-bold font-Inter">
      Mobile App Development Project
    </h2>
    <p class="text-lg font-normal font-Inter text-primary">
      We are building <strong>a task management mobile app</strong> aimed at enhancing productivity
      for individuals and teams. The project is divided into the following phases:
    </p>
  </section>

  <!-- Research -->
  <section class="flex flex-col gap-4">
    <h3 class="text-2xl font-semibold text-primary font-Inter">Research and Planning</h3>
    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-2">
        <Checkbox
          id="user-interviews"
          bind:checked={researchChecks.userInterviews}
          class="border-purple-500 data-[state=checked]:bg-primary data-[state=checked]:border-purple-600 data-[state=checked]:text-white"
        />
        <Label for="user-interviews" class="text-primary text-base cursor-pointer font-Inter font-normal">
          Conduct <span class="underline">user interviews</span> to gather requirements.
        </Label>
      </div>
    </div>
  </section>

  <!-- Design -->
  <section class="flex flex-col gap-4">
    <h3 class="text-2xl font-semibold text-primary font-Inter">Design and Development</h3>
    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-2">
        <Checkbox
          id="wireframes"
          bind:checked={designChecks.wireframes}
          class="border-purple-500 data-[state=checked]:bg-primary data-[state=checked]:border-purple-600 data-[state=checked]:text-white"
        />
        <Label for="wireframes" class="text-primary text-base cursor-pointer font-Inter">
          Create wireframes using tools like Figma or Adobe XD
        </Label>
      </div>

      <div class="flex items-center gap-2">
        <Checkbox
          id="backend"
          bind:checked={designChecks.backend}
          class="border-purple-500 data-[state=checked]:bg-primary data-[state=checked]:border-purple-600 data-[state=checked]:text-white"
        />
        <Label for="backend" class="text-primary text-lg cursor-pointer">
          Implement the backend using Node.js and the frontend with React Native.
        </Label>
      </div>
    </div>
  </section>
</Card>