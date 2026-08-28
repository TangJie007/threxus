<script setup lang="ts">
import { createContainer, createToken } from '@threxus/core';

const messageToken = createToken<string>('welcome-message');
const container = createContainer().set(
  messageToken,
  'Threxus is ready for Three.js applications.',
);
const message = container.get(messageToken);
</script>

<template>
  <main class="page">
    <section class="card">
      <p class="eyebrow">Vue 3 example</p>
      <h1>Threxus</h1>
      <p class="description">
        This example consumes <code>@threxus/core</code> through the pnpm
        workspace.
      </p>
      <div class="status">
        <span class="status-dot" aria-hidden="true"></span>
        <span>{{ message }}</span>
      </div>
    </section>
  </main>
</template>
