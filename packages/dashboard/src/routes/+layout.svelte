<script lang="ts">
  import "../app.css";
  import { page } from "$app/state";
  import { signIn, signOut } from "$lib/auth/client";

  interface Props {
    children: import("svelte").Snippet;
    data: {
      user: {
        id: string;
        email: string;
        name: string | null;
        image: string | null;
      } | null;
    };
  }

  let { children, data }: Props = $props();

  let showAuthMenu = $state(false);
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
      <div class="nav-right">
        <div class="nav-links">
          <a href="/" class:active={page.url.pathname === "/"}>Home</a>
          <a href="/settings" class:active={page.url.pathname === "/settings"}>Settings</a>
        </div>
        <div class="auth-section">
          {#if data.user}
            <button
              class="user-button"
              onclick={() => showAuthMenu = !showAuthMenu}
              aria-expanded={showAuthMenu}
            >
              {#if data.user.image}
                <img src={data.user.image} alt="" class="user-avatar" />
              {:else}
                <span class="user-avatar-placeholder">
                  {data.user.name?.[0] ?? data.user.email[0]}
                </span>
              {/if}
            </button>
            {#if showAuthMenu}
              <div class="auth-menu">
                <div class="auth-menu-header">
                  <span class="user-name">{data.user.name ?? "User"}</span>
                  <span class="user-email">{data.user.email}</span>
                </div>
                <hr />
                <button class="auth-menu-item" onclick={() => signOut("/")}>
                  Sign out
                </button>
              </div>
            {/if}
          {:else}
            <button
              class="login-button"
              onclick={() => showAuthMenu = !showAuthMenu}
            >
              Sign in
            </button>
            {#if showAuthMenu}
              <div class="auth-menu">
                <button class="auth-menu-item" onclick={() => signIn("google")}>
                  Continue with Google
                </button>
                <button class="auth-menu-item" onclick={() => signIn("github")}>
                  Continue with GitHub
                </button>
              </div>
            {/if}
          {/if}
        </div>
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

  .nav-right {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .auth-section {
    position: relative;
  }

  .user-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    overflow: hidden;
  }

  .user-avatar {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .user-avatar-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-border);
    color: var(--color-text);
    font-size: 0.875rem;
    font-weight: 500;
    text-transform: uppercase;
  }

  .login-button {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    color: var(--color-text);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .login-button:hover {
    background: var(--color-border);
  }

  .auth-menu {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    min-width: 200px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 200;
  }

  .auth-menu-header {
    padding: 0.75rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .user-name {
    font-weight: 500;
    color: var(--color-text);
  }

  .user-email {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .auth-menu hr {
    margin: 0;
    border: none;
    border-top: 1px solid var(--color-border);
  }

  .auth-menu-item {
    display: block;
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    color: var(--color-text);
    background: transparent;
    border: none;
    text-align: left;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .auth-menu-item:hover {
    background: var(--color-border);
  }

  .auth-menu-item:last-child {
    border-radius: 0 0 var(--radius-md) var(--radius-md);
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
