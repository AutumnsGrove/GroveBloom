<script lang="ts">
  import "../app.css";
  import { page } from "$app/state";

  interface Props {
    children: import("svelte").Snippet;
  }

  let { children }: Props = $props();
</script>

<svelte:head>
  <title>Grove Bloom</title>
  <meta name="description" content="Personal serverless coding agent" />
  <meta name="theme-color" content="#0f0f14" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
</svelte:head>

<div class="app">
  <header>
    <nav>
      <a href="/" class="logo">
        <span class="logo-icon">🌸</span>
        <span class="logo-text">Bloom</span>
      </a>
      <div class="nav-links">
        <a href="/" class:active={page.url.pathname === "/"}>Home</a>
        <a href="/settings" class:active={page.url.pathname === "/settings"}>Settings</a>
      </div>
    </nav>
  </header>

  <main class="container">
    {@render children()}
  </main>
</div>

<style>
  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  header {
    position: sticky;
    top: 0;
    z-index: 100;
    background: var(--color-bg);
    border-bottom: 1px solid var(--color-border);
  }

  nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: 640px;
    margin: 0 auto;
    padding: 0.75rem 1rem;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text);
    text-decoration: none;
  }

  .logo:hover {
    color: var(--color-text);
  }

  .logo-icon {
    font-size: 1.25rem;
  }

  .nav-links {
    display: flex;
    gap: 1.5rem;
  }

  .nav-links a {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    text-decoration: none;
    transition: color 0.15s ease;
  }

  .nav-links a:hover,
  .nav-links a.active {
    color: var(--color-text);
  }

  main {
    flex: 1;
  }

  @media (min-width: 768px) {
    nav {
      padding: 1rem 2rem;
    }
  }
</style>
