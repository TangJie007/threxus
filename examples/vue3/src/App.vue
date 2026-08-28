<script setup lang="ts">
import { createDemoMessage } from './di-demo';

const message = createDemoMessage();
</script>

<template>
  <main class="page">
    <section class="card">
      <p class="eyebrow">Vue 3 example</p>
      <h1>Threxus</h1>
      <p class="description">
        DI shell: <code>@Injectable({ inject })</code> + field
        <code>@Inject</code> (Stage 3, zero third-party).
      </p>
      <div class="status">
        <span class="status-dot" aria-hidden="true"></span>
        <span>{{ message }}</span>
      </div>
    </section>
  </main>
</template>
