<script lang="ts">
  /**
   * Says plainly that the map below is sample content.
   *
   * Rendered unconditionally, because right now it is unconditionally true:
   * the app has no persistence yet and always renders `exampleData.ts`. Once
   * Milestone 8 lands and a real map can be loaded from localStorage, this
   * becomes conditional on whether seed data is actually what's on screen.
   */
</script>

<p class="demo-banner" role="status">
  Sample data — these parts and connections are for demonstration only, and are
  not a real parts map.
</p>

<style>
  .demo-banner {
    margin: 0;
    padding: 8px 12px;
    /* The comp's ember, the palette's own attention tone, against the deepest
       background color so the bar reads as system chrome rather than as part
       of the map. */
    background: #e38f6b;
    color: #0b0c12;
    text-align: center;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.2px;
  }
</style>
