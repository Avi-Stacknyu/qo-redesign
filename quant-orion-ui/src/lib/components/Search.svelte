<script>
	import { Search } from "@lucide/svelte";
	import { Input } from "./ui/input";

</script>
    <div class="relative w-full">
      <Search class="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground" size={22} />

      <Input
        type="text"
        placeholder="Search"
        class="
          h-10
          rounded-full
          border-0
          bg-muted
          pl-14
          pr-5
          text-lg
          text-muted-foreground
          placeholder:text-muted-foreground
          shadow-none
          focus-visible:ring-0
          focus-visible:ring-offset-0
        "
      />
    </div>