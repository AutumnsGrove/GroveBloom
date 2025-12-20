<script lang="ts">
  import { onMount } from "svelte";
  import { bloomApi } from "$lib/api/bloom";
  import type { Region, Project } from "$lib/api/types";

  // Settings state
  let idleTimeout = $state(120); // minutes
  let defaultRegion: Region = $state("eu");
  let autoCommit = $state(false);
  let reasoningModel = $state("deepseek/deepseek-chat");
  let visionModel = $state("z-ai/glm-4.6v");

  // Projects state
  let projects: Project[] = $state([]);
  let loadingProjects = $state(true);

  // UI state
  let saving = $state(false);
  let saveMessage = $state<string | null>(null);

  const idleTimeoutOptions = [
    { value: 30, label: "30 minutes" },
    { value: 60, label: "1 hour" },
    { value: 120, label: "2 hours" },
    { value: 180, label: "3 hours" },
    { value: 240, label: "4 hours" },
  ];

  const modelOptions = {
    reasoning: [
      { value: "deepseek/deepseek-chat", label: "DeepSeek V3.2" },
      { value: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
      { value: "openai/gpt-4o", label: "GPT-4o" },
    ],
    vision: [
      { value: "z-ai/glm-4.6v", label: "GLM 4.6V" },
      { value: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
      { value: "openai/gpt-4o", label: "GPT-4o" },
    ],
  };

  async function loadProjects() {
    try {
      const response = await bloomApi.getProjects();
      projects = response.projects;
    } catch (e) {
      console.error("Failed to load projects:", e);
    } finally {
      loadingProjects = false;
    }
  }

  async function saveSettings() {
    saving = true;
    saveMessage = null;

    try {
      await bloomApi.updateConfig({
        idleTimeout: idleTimeout * 60, // Convert to seconds
        defaultRegion,
        autoCommit,
        models: {
          reasoning: reasoningModel,
          vision: visionModel,
        },
      });
      saveMessage = "Settings saved!";
      setTimeout(() => {
        saveMessage = null;
      }, 3000);
    } catch (e) {
      saveMessage = e instanceof Error ? e.message : "Failed to save settings";
    } finally {
      saving = false;
    }
  }

  onMount(() => {
    loadProjects();
  });
</script>

<div class="page">
  <h1>Settings</h1>

  <!-- Shutdown Behavior -->
  <section class="card">
    <h2>Shutdown Behavior</h2>

    <div class="form-group">
      <label for="idle-timeout">Idle Timeout</label>
      <select id="idle-timeout" bind:value={idleTimeout}>
        {#each idleTimeoutOptions as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
      <p class="hint">Server will shut down after this period of inactivity</p>
    </div>

    <div class="form-group checkbox-group">
      <label>
        <input type="checkbox" bind:checked={autoCommit} />
        <span>Auto-commit on shutdown</span>
      </label>
      <p class="hint">Automatically commit and push changes before shutting down</p>
    </div>
  </section>

  <!-- Default Region -->
  <section class="card">
    <h2>Default Region</h2>

    <div class="region-options">
      <label class="region-option" class:selected={defaultRegion === "eu"}>
        <input type="radio" name="region" value="eu" bind:group={defaultRegion} />
        <div class="region-content">
          <span class="region-name">EU (Falkenstein)</span>
          <span class="region-rate">~$0.0085/hr</span>
        </div>
      </label>

      <label class="region-option" class:selected={defaultRegion === "us"}>
        <input type="radio" name="region" value="us" bind:group={defaultRegion} />
        <div class="region-content">
          <span class="region-name">US (Ashburn)</span>
          <span class="region-rate">~$0.022/hr</span>
        </div>
      </label>
    </div>
  </section>

  <!-- AI Models -->
  <section class="card">
    <h2>AI Models (OpenRouter)</h2>

    <div class="form-group">
      <label for="reasoning-model">Reasoning / Code</label>
      <select id="reasoning-model" bind:value={reasoningModel}>
        {#each modelOptions.reasoning as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </div>

    <div class="form-group">
      <label for="vision-model">Vision</label>
      <select id="vision-model" bind:value={visionModel}>
        {#each modelOptions.vision as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </div>
  </section>

  <!-- Projects -->
  <section class="card">
    <h2>Projects</h2>

    {#if loadingProjects}
      <p class="text-muted">Loading projects...</p>
    {:else if projects.length === 0}
      <p class="text-muted">No projects configured</p>
    {:else}
      <div class="projects-list">
        {#each projects as project (project.id)}
          <div class="project-item">
            <div class="project-info">
              <span class="project-name">{project.name}</span>
              <span class="project-branch">{project.branch}</span>
            </div>
            <span class="project-status" class:enabled={project.enabled}>
              {project.enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
        {/each}
      </div>
    {/if}

    <p class="hint mt-md">
      Projects are managed via the prepare-repos script. See documentation for details.
    </p>
  </section>

  <!-- Save Button -->
  <div class="actions">
    <button class="btn btn-primary btn-lg" onclick={saveSettings} disabled={saving}>
      {saving ? "Saving..." : "Save Settings"}
    </button>

    {#if saveMessage}
      <p class="save-message" class:error={saveMessage.includes("Failed")}>
        {saveMessage}
      </p>
    {/if}
  </div>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    padding-bottom: var(--space-xl);
  }

  h1 {
    margin-bottom: var(--space-sm);
  }

  h2 {
    margin-bottom: var(--space-md);
    font-size: 1rem;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .hint {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .checkbox-group label {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    cursor: pointer;
  }

  .checkbox-group input[type="checkbox"] {
    width: auto;
    margin: 0;
  }

  .region-options {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .region-option {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: 1rem;
    background: var(--color-surface-elevated);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .region-option:hover {
    border-color: var(--color-text-muted);
  }

  .region-option.selected {
    border-color: var(--color-primary);
  }

  .region-option input[type="radio"] {
    width: auto;
    margin: 0;
    accent-color: var(--color-primary);
  }

  .region-content {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .region-name {
    font-weight: 500;
  }

  .region-rate {
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }

  .projects-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .project-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: var(--color-surface-elevated);
    border-radius: var(--radius-md);
  }

  .project-info {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .project-name {
    font-weight: 500;
  }

  .project-branch {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    padding: 0.125rem 0.5rem;
    background: var(--color-surface);
    border-radius: var(--radius-full);
  }

  .project-status {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .project-status.enabled {
    color: var(--color-green);
  }

  .actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
  }

  .save-message {
    font-size: 0.875rem;
    color: var(--color-green);
  }

  .save-message.error {
    color: var(--color-red);
  }
</style>
