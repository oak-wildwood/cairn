<script lang="ts">
  /**
   * Says plainly that the map below is sample content.
   *
   * `App.svelte` renders this only while that is true — an untouched seed map
   * with nothing restored from localStorage. The moment a map is loaded or
   * edited it belongs to the person using it, and calling their own parts
   * "for demonstration only" would be false in the place the app is asking
   * them to be most honest.
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
    /* The palette's ember, its own attention tone, against the deepest
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
