<script lang="ts">
  import { type Snippet } from 'svelte';
    import SeeMarketClearly from './SeeMarketClearly.svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();

  let splineLoaded = $state(false);
</script>

<div class="min-h-svh bg-background lg:h-svh lg:grid lg:grid-cols-2">
  <div class="relative hidden min-h-svh overflow-hidden bg-background lg:block lg:h-svh">
    

    <SeeMarketClearly/>

    <iframe
      onload={() => (splineLoaded = true)}
      class={`absolute left-1/2 top-1/2 h-[200%] w-[122%] min-h-svh min-w-full max-w-none -translate-x-1/2 -translate-y-1/2 border-0 transition-opacity duration-1000 ${
        splineLoaded ? 'opacity-100' : 'opacity-0'
      }`}
      src="https://my.spline.design/stackableglass-14usbydxYgIMPu7F9CSu9uPZ-cud/"
      title="Quant Orion 3D preview"
      loading="eager"
      allowfullscreen
    ></iframe>
  </div>

  <!-- right side -->
  <div
    class="relative min-h-svh w-full overflow-hidden  bg-linear-to-br from-[#0f172a]
via-[#111827]
to-[#1e1b4b] lg:col-start-2 lg:h-svh lg:border-l lg:border-border"
  >
    <!-- background pattern -->
    <img
      src="/images/pattern.png"
      alt=""
      aria-hidden="true"
      class="absolute inset-0 h-full w-full object-cover opacity-100"
    />
    <div
      class="relative z-10 flex min-h-svh flex-col justify-center px-8 py-12 md:mx-auto md:w-full lg:max-w-none lg:px-10 xl:px-16"
    >
      <div class="relative">
        <div class="relative">
          <div class="mb-10 flex w-full flex-col items-center gap-6 text-center md:hidden">
            <div class="group relative">
              <div
                class="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl transition-all duration-500 group-hover:bg-emerald-500/30"
              ></div>
              <div
                class="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5 transition-transform duration-500 group-hover:scale-105 group-hover:rotate-3"
              >
                <div
                  class="absolute inset-0 rounded-2xl bg-linear-to-br from-slate-50 to-slate-100 opacity-50"
                ></div>
                <svg
                  viewBox="0 0 24 24"
                  class="relative z-10 h-8 w-8 text-slate-900 drop-shadow-sm"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <circle cx="12" cy="12" r="10" class="opacity-20" />
                  <path
                    d="M12 2a10 10 0 0 1 10 10"
                    class="text-emerald-500"
                    stroke-linecap="round"
                  />
                  <path d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" />
                  <path d="M12 12l4 4" />
                </svg>
              </div>
            </div>

            <div class="space-y-1 text-center">
              <span class="block text-2xl font-bold tracking-tight text-white">Quant Orion</span
              >
              <p class="text-sm font-medium tracking-wide text-slate-400">
                Enterprise Intelligence
              </p>
            </div>
          </div>

          {@render children()}

          <div class="mt-12 text-center text-xs text-slate-500">
            &copy; {new Date().getFullYear()} Quant Orion. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

